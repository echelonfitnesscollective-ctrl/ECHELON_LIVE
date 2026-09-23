-- Build Your Group: each applicant (a website_leads row, lead_type
-- 'Build Your Group') can build a real attendee roster - either share
-- their own group link so each person self-registers and signs their
-- own waiver, or enter an attendee's name/phone/email directly, which
-- emails that person their own personal confirm-and-sign link. All
-- access goes through the api/calendar/gateway.js service-role routes
-- (build-group-info/invite/join), never a direct anon REST call, same
-- trust model as session_groups: the lead's own id (an unguessable
-- uuid) is the only key, and this table is never publicly enumerable.

create table if not exists public.build_group_attendees (
    id uuid primary key default gen_random_uuid(),
    lead_id uuid not null references public.website_leads(id) on delete cascade,
    name text not null,
    phone text,
    email text,
    waiver_agreed boolean not null default false,
    added_by text not null default 'self' check (added_by in ('self', 'organizer')),
    invited_at timestamptz,
    joined_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists build_group_attendees_lead_idx on public.build_group_attendees (lead_id);

alter table public.build_group_attendees enable row level security;
-- Deliberately no policies: only the service-role gateway ever touches
-- this table, so RLS with zero grants blocks anon/authenticated access
-- entirely by default rather than needing to hand-write a safe one.
