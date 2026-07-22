-- Run this in the Supabase SQL Editor for the Echelon project.
-- This table stores one private onboarding record per authenticated member.

create table if not exists public.member_onboarding (
    user_id uuid primary key references auth.users(id) on delete cascade,
    parq jsonb not null default '{}'::jsonb,
    health_history jsonb not null default '{}'::jsonb,
    acknowledged_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.member_onboarding enable row level security;

drop policy if exists "Members can read their own onboarding" on public.member_onboarding;
create policy "Members can read their own onboarding"
on public.member_onboarding
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Members can create their own onboarding" on public.member_onboarding;
create policy "Members can create their own onboarding"
on public.member_onboarding
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Members can update their own onboarding" on public.member_onboarding;
create policy "Members can update their own onboarding"
on public.member_onboarding
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
