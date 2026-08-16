-- Native in-app session scheduler.
--
-- coach_availability_windows: the recurring weekly windows Echelon opens for
-- training (day of week + time range). Admin-managed only.
--
-- session_bookings: the actual sessions -- either a member books themselves
-- into an open window, or the coach books one directly (e.g. taken over the
-- phone during onboarding, before the member has a login).
--
-- booked_session_times: a members-readable view exposing only the time/
-- duration of confirmed bookings (no member identity), so the booking page
-- can compute open slots without leaking who else trains when. Left as a
-- non-security-invoker view (Supabase's usual pattern for this) so it reads
-- past the base table's row-level security instead of being restricted to
-- "my own rows" like a normal query would be.
--
-- Run this once in the Supabase SQL Editor.

create table if not exists public.coach_availability_windows (
    id uuid primary key default gen_random_uuid(),
    day_of_week integer not null check (day_of_week between 0 and 6), -- 0 = Sunday
    start_time time not null,
    end_time time not null check (end_time > start_time),
    session_type text not null default 'one_on_one',
    active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.session_bookings (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    member_name text not null,
    session_type text not null default 'one_on_one',
    scheduled_at timestamptz not null,
    duration_minutes integer not null default 60,
    status text not null default 'confirmed',
    notes text,
    booked_by text not null default 'member',
    google_event_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create or replace function public.set_session_booking_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists session_bookings_updated_at on public.session_bookings;
create trigger session_bookings_updated_at before update on public.session_bookings
    for each row execute procedure public.set_session_booking_updated_at();

-- Solo coach, one client at a time: two confirmed sessions can't share the
-- same start instant. Canceled sessions free the slot back up.
create unique index if not exists session_bookings_one_per_time
    on public.session_bookings (scheduled_at)
    where status = 'confirmed';

alter table public.coach_availability_windows enable row level security;
alter table public.session_bookings enable row level security;

drop policy if exists "Admins manage availability windows" on public.coach_availability_windows;
create policy "Admins manage availability windows" on public.coach_availability_windows
    for all to authenticated
    using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));

drop policy if exists "Active members view active availability windows" on public.coach_availability_windows;
create policy "Active members view active availability windows" on public.coach_availability_windows
    for select to authenticated
    using (active = true and (select public.has_member_hub_access()));

drop policy if exists "Admins manage session bookings" on public.session_bookings;
create policy "Admins manage session bookings" on public.session_bookings
    for all to authenticated
    using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));

drop policy if exists "Active members manage their own bookings" on public.session_bookings;
create policy "Active members manage their own bookings" on public.session_bookings
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.has_member_hub_access()))
    with check (user_id = (select auth.uid()) and (select public.has_member_hub_access()));

grant select, insert, update, delete on public.coach_availability_windows, public.session_bookings to authenticated;

drop view if exists public.booked_session_times;
create view public.booked_session_times as
select scheduled_at, duration_minutes, session_type
from public.session_bookings
where status = 'confirmed';

grant select on public.booked_session_times to authenticated;
