-- Group join links: lets someone attend a session without a full Echelon
-- account -- just their name, contact info, and a signed waiver. Covers
-- two cases:
--   1. Corporate one-off: you create a private group session for a
--      company (date/time/capacity you arranged with the host), get a
--      join link, and send it to the host to forward to their people.
--   2. Recurring drop-in: you attach the link to a specific occurrence of
--      an existing standing-availability window (e.g. this Tuesday's
--      Group Fitness class) so a walk-in can join without booking a full
--      account, counted against the same capacity as member bookings.
--
-- Run this once in the Supabase SQL Editor.

alter table public.session_bookings alter column user_id drop not null;
alter table public.session_bookings add column if not exists guest_email text;
alter table public.session_bookings add column if not exists guest_phone text;
alter table public.session_bookings add column if not exists waiver_agreed boolean not null default false;

create table if not exists public.session_groups (
    id uuid primary key default gen_random_uuid(),
    window_id uuid references public.coach_availability_windows(id) on delete set null,
    session_type text not null default 'private_group',
    scheduled_at timestamptz not null,
    duration_minutes integer not null default 60,
    capacity integer not null default 1,
    host_name text,
    host_email text,
    join_token uuid not null default gen_random_uuid(),
    notes text,
    created_at timestamptz not null default now()
);

create unique index if not exists session_groups_join_token_key on public.session_groups (join_token);

alter table public.session_bookings add column if not exists group_id uuid references public.session_groups(id) on delete set null;

alter table public.session_groups enable row level security;

drop policy if exists "Admins manage session groups" on public.session_groups;
create policy "Admins manage session groups" on public.session_groups
    for all to authenticated
    using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));

-- No anon/member policies on purpose: the join page looks a group up
-- through a server endpoint (service role) by its join_token, the same
-- pattern already used for private Stripe payment links. That keeps the
-- token itself as the only way in and the table never enumerable.

-- Extend the group-capacity trigger (originally window-only) to also
-- check a one-off group's own capacity when a booking isn't tied to a
-- standing window.
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
  elsif new.group_id is not null then
    select capacity into window_capacity from public.session_groups where id = new.group_id;
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
