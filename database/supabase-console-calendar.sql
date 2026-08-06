-- Echelon Admin Console Calendar
-- Run once in the Supabase SQL Editor. Stores a single linked calendar
-- (Google Calendar, Notion, or similar) for the 12-Week group session and
-- any other standing sessions. Admin only, not shown to members yet.

create table if not exists public.console_calendar_settings (
    id integer primary key default 1,
    label text,
    embed_url text,
    updated_at timestamptz not null default now(),
    constraint console_calendar_settings_singleton check (id = 1)
);

alter table public.console_calendar_settings enable row level security;

drop policy if exists "Admins manage console calendar settings" on public.console_calendar_settings;
create policy "Admins manage console calendar settings"
on public.console_calendar_settings for all to authenticated
using ((select public.is_echelon_admin()))
with check ((select public.is_echelon_admin()));

grant select, insert, update on public.console_calendar_settings to authenticated;

insert into public.console_calendar_settings (id) values (1) on conflict (id) do nothing;
