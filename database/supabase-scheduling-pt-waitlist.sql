-- Extends the waitlist to 1-on-1 PT slots (it previously only covered
-- group-style windows/session_groups). Each distinct PT appointment slot
-- now allows 1 confirmed booking + 1 waitlisted booking, same pattern as
-- group classes -- for the case where 2 clients are at the same location
-- and can be knocked out back-to-back without a travel gap.
--
-- Also updates the live PT windows to a flat 60-minute session length:
-- Mon/Wed 9am-1pm now offer 4 back-to-back 60-min appointments (was 3 at
-- ~80 min), Tue/Thu/Fri 1-3:30pm keep 2 appointments (now 60 min each
-- instead of ~75, leaving a buffer in the window).
--
-- Run this once in the Supabase SQL Editor, after
-- supabase-scheduling-live-windows.sql.

update public.coach_availability_windows
set session_length_minutes = 60,
    capacity = 4
where session_type = 'one_on_one' and day_of_week in (1, 3); -- Mon/Wed 9-1

update public.coach_availability_windows
set session_length_minutes = 60
where session_type = 'one_on_one' and day_of_week in (2, 4, 5); -- Tue/Thu/Fri 1-3:30

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
      -- window. Each slot allows 1 confirmed + 1 waitlisted booking.
      offset_minutes := extract(epoch from (local_time - window_row.start_time)) / 60;
      if offset_minutes < 0
         or offset_minutes % greatest(window_row.session_length_minutes, 1) <> 0
         or local_time + make_interval(mins => window_row.session_length_minutes) > window_row.end_time
      then
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

      if confirmed_count < 1 then
        new.status := 'confirmed';
      elsif waitlisted_count < 1 then
        new.status := 'waitlisted';
      else
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
