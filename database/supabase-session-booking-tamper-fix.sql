-- P0 fix: close a capacity-bypass gap in session_bookings.
--
-- The member self-book RLS policy only ever checked user_id, so a member
-- calling the Supabase REST API directly (bypassing the app's own JS --
-- trivial with their own valid session token and devtools) could:
--   (a) set booked_by='admin' on their own insert. The capacity trigger
--       treats booked_by='admin' as "always allowed, skip the check" --
--       so this let them overbook a full class, or double-book an
--       already-taken exclusive 1-on-1 slot.
--   (b) attach an arbitrary window_id or group_id with a much higher
--       capacity than the slot they're actually booking, borrowing that
--       capacity for an unrelated time -- the trigger trusted whatever
--       window_id/group_id was supplied without checking it actually
--       corresponded to the booking's own scheduled_at.
--
-- Fix: the member policy now rejects booked_by='admin' outright (only the
-- separate admin-only policy, gated on real is_echelon_admin(), can set
-- it), and the capacity trigger only honors window_id/group_id when they
-- actually match the booking's own scheduled_at.
--
-- Run this once in the Supabase SQL Editor, after
-- supabase-session-booking-capacity.sql / supabase-session-groups.sql.

drop policy if exists "Active members manage their own bookings" on public.session_bookings;
create policy "Active members manage their own bookings" on public.session_bookings
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.has_member_hub_access()))
    with check (user_id = (select auth.uid()) and (select public.has_member_hub_access()) and booked_by <> 'admin');

create or replace function public.check_session_booking_capacity()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  window_capacity integer;
  taken integer;
begin
  if new.status <> 'confirmed' or new.booked_by = 'admin' then
    return new;
  end if;

  if new.window_id is not null then
    select capacity into window_capacity
    from public.coach_availability_windows
    where id = new.window_id
      and day_of_week = extract(dow from new.scheduled_at at time zone 'America/New_York')
      and start_time = (new.scheduled_at at time zone 'America/New_York')::time;
  elsif new.group_id is not null then
    select capacity into window_capacity
    from public.session_groups
    where id = new.group_id
      and scheduled_at = new.scheduled_at;
  end if;
  window_capacity := coalesce(window_capacity, 1);

  select count(*) into taken
  from public.session_bookings
  where scheduled_at = new.scheduled_at
    and status = 'confirmed'
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if taken >= window_capacity then
    raise exception 'This session is full.' using errcode = '23514';
  end if;

  return new;
end;
$$;
