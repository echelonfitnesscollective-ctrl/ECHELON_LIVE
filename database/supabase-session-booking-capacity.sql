-- Group capacity for standing availability windows.
--
-- A Private Group or Group Fitness window should let multiple members book
-- the same time slot, not just one -- the old session_bookings_one_per_time
-- unique index treated every window as exclusive (capacity 1), which was
-- correct for 1-on-1 but wrong for group sessions.
--
-- capacity lives on coach_availability_windows (set per window, admin
-- picks it when adding the window). session_bookings.window_id links each
-- booking back to the window it came from so the capacity check knows the
-- limit without guessing from the time alone. Admin-direct bookings
-- (booked_by = 'admin') always bypass the check -- that's the coach
-- deliberately making an exception (e.g. squeezing in one more person by
-- arrangement), not a self-serve booking.
--
-- Run this once in the Supabase SQL Editor.

alter table public.coach_availability_windows add column if not exists capacity integer not null default 1;
alter table public.session_bookings add column if not exists window_id uuid references public.coach_availability_windows(id) on delete set null;

drop index if exists session_bookings_one_per_time;

-- security definer (not invoker): the count below has to see every
-- member's confirmed bookings at a given time, not just the booking
-- member's own rows, which is all their RLS policy would otherwise permit.
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
    select capacity into window_capacity from public.coach_availability_windows where id = new.window_id;
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

drop trigger if exists session_bookings_capacity_check on public.session_bookings;
create trigger session_bookings_capacity_check before insert or update on public.session_bookings
    for each row execute procedure public.check_session_booking_capacity();
