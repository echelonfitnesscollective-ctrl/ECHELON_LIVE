-- Three additions to the native scheduler, all editable from the admin
-- console (no code changes needed to use them):
--
-- 1. class_label: an optional display name on a standing window (and
--    carried onto the bookings/groups it produces) so "Group Fitness"
--    windows can show their real name -- Echelon Strength Group Training,
--    VL Body Lab, Faith & Favor Mobility -- instead of one generic label.
--    session_type itself is untouched, so Stripe/membership logic tied to
--    'group_fitness' keeps working exactly as before.
--
-- 2. session_length_minutes + slot-mode for 1-on-1 windows: a one_on_one
--    window with capacity 3 and session_length_minutes 80 now offers three
--    distinct back-to-back appointment times (e.g. 9:00, 10:20, 11:40)
--    instead of one shared 9:00 start that up to 3 people could all claim.
--    Group-type windows (private_group, group_fitness) are unaffected --
--    capacity there still means "how many people can share this start
--    time," which is what a class needs.
--
-- 3. Waitlist: once a group window/group hits capacity, exactly one more
--    booking is allowed through as status='waitlisted' instead of being
--    rejected. If a confirmed booking at that same time is later canceled,
--    the oldest waitlisted booking is automatically promoted to confirmed.
--    (No email is sent on promotion yet -- the member sees it next time
--    they check My Sessions. Worth adding via Resend as a fast follow-up
--    if you want it.)
--
-- Run this once in the Supabase SQL Editor, after
-- supabase-session-booking-tamper-fix.sql.

alter table public.coach_availability_windows
    add column if not exists class_label text,
    add column if not exists session_length_minutes integer not null default 60;

alter table public.session_bookings
    add column if not exists class_label text;

alter table public.session_groups
    add column if not exists class_label text;

-- The member-facing "how full is this slot" view needs status now (still
-- no identity exposed) so the client can tell confirmed from waitlisted.
drop view if exists public.booked_session_times;
create view public.booked_session_times as
select scheduled_at, duration_minutes, session_type, status
from public.session_bookings
where status in ('confirmed', 'waitlisted');

grant select on public.booked_session_times to authenticated;

create or replace function public.check_session_booking_capacity()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  window_row record;
  group_row record;
  local_time time;
  offset_minutes numeric;
  confirmed_count integer;
  waitlisted_count integer;
  fallback_id uuid := '00000000-0000-0000-0000-000000000000'::uuid;
begin
  if new.status <> 'confirmed' or new.booked_by = 'admin' then
    return new;
  end if;

  if new.window_id is not null then
    select * into window_row
    from public.coach_availability_windows
    where id = new.window_id
      and day_of_week = extract(dow from new.scheduled_at at time zone 'America/New_York');

    if window_row.id is null then
      raise exception 'This session is full.' using errcode = '23514';
    end if;

    local_time := (new.scheduled_at at time zone 'America/New_York')::time;

    if window_row.session_type = 'one_on_one' then
      -- Distinct-slot mode: scheduled_at must land exactly on a generated
      -- slot boundary (start_time + N * session_length), fully inside the
      -- window. Each slot is its own appointment -- capacity 1, no waitlist.
      offset_minutes := extract(epoch from (local_time - window_row.start_time)) / 60;
      if offset_minutes < 0
         or offset_minutes % greatest(window_row.session_length_minutes, 1) <> 0
         or local_time + make_interval(mins => window_row.session_length_minutes) > window_row.end_time
      then
        raise exception 'This session is full.' using errcode = '23514';
      end if;

      select count(*) into confirmed_count
      from public.session_bookings
      where scheduled_at = new.scheduled_at
        and status = 'confirmed'
        and id <> coalesce(new.id, fallback_id);

      if confirmed_count >= 1 then
        raise exception 'This session is full.' using errcode = '23514';
      end if;

      return new;
    end if;

    -- Group-style window: shared start time, shared capacity, one waitlist spot.
    if local_time <> window_row.start_time then
      raise exception 'This session is full.' using errcode = '23514';
    end if;

    select
      count(*) filter (where status = 'confirmed'),
      count(*) filter (where status = 'waitlisted')
      into confirmed_count, waitlisted_count
    from public.session_bookings
    where scheduled_at = new.scheduled_at
      and status in ('confirmed', 'waitlisted')
      and id <> coalesce(new.id, fallback_id);

    if confirmed_count < window_row.capacity then
      new.status := 'confirmed';
    elsif waitlisted_count < 1 then
      new.status := 'waitlisted';
    else
      raise exception 'This session is full.' using errcode = '23514';
    end if;

    return new;
  end if;

  if new.group_id is not null then
    select * into group_row
    from public.session_groups
    where id = new.group_id
      and scheduled_at = new.scheduled_at;

    if group_row.id is null then
      raise exception 'This session is full.' using errcode = '23514';
    end if;

    select
      count(*) filter (where status = 'confirmed'),
      count(*) filter (where status = 'waitlisted')
      into confirmed_count, waitlisted_count
    from public.session_bookings
    where scheduled_at = new.scheduled_at
      and status in ('confirmed', 'waitlisted')
      and id <> coalesce(new.id, fallback_id);

    if confirmed_count < group_row.capacity then
      new.status := 'confirmed';
    elsif waitlisted_count < 1 then
      new.status := 'waitlisted';
    else
      raise exception 'This session is full.' using errcode = '23514';
    end if;

    return new;
  end if;

  -- No window_id/group_id: an exclusive one-off (admin quick-book already
  -- exempted above via booked_by='admin').
  select count(*) into confirmed_count
  from public.session_bookings
  where scheduled_at = new.scheduled_at
    and status = 'confirmed'
    and id <> coalesce(new.id, fallback_id);

  if confirmed_count >= 1 then
    raise exception 'This session is full.' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- When a confirmed booking is canceled, promote the oldest waitlisted
-- booking at that same time (if any) to confirmed.
create or replace function public.promote_waitlisted_booking()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'canceled' and old.status = 'confirmed' then
    update public.session_bookings
    set status = 'confirmed'
    where id = (
      select id from public.session_bookings
      where scheduled_at = new.scheduled_at
        and status = 'waitlisted'
      order by created_at asc
      limit 1
    );
  end if;
  return new;
end;
$$;

drop trigger if exists session_bookings_promote_waitlist on public.session_bookings;
create trigger session_bookings_promote_waitlist after update on public.session_bookings
    for each row execute procedure public.promote_waitlisted_booking();
