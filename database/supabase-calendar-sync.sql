-- Google Calendar sync for the session scheduler.
--
-- Holds the coach's OAuth refresh token so serverless functions can create
-- and cancel Google Calendar events for bookings. This is a single-tenant
-- singleton (one coach, one connected calendar) deliberately given NO
-- policies for the `authenticated` role: only the Vercel functions using
-- the Supabase service-role key (which bypasses RLS) can read or write it.
-- The refresh token must never be reachable from the admin or member
-- browser client.
--
-- Run this once in the Supabase SQL Editor.

create table if not exists public.coach_calendar_tokens (
    id integer primary key default 1,
    refresh_token text,
    connected_email text,
    connected_at timestamptz,
    oauth_state text,
    oauth_state_created_at timestamptz,
    constraint coach_calendar_tokens_singleton check (id = 1)
);

alter table public.coach_calendar_tokens enable row level security;

insert into public.coach_calendar_tokens (id) values (1) on conflict (id) do nothing;
