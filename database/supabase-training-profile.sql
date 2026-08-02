-- Client Training Profile: the intake/personalization record a coach fills in
-- (or a member self-reports) to adapt a base program to one specific person.
--
-- Distinct from member_onboarding (the PAR-Q / health-history legal safety
-- screening every member completes once). This table is the coaching-
-- programming intake -- goal, constraints, equipment, preferences -- used to
-- decide how to personalize a base 12-week program (Cutting, Weight Loss,
-- Bulking, Muscle, Performance, Older-Adult Wellness) for the delivery
-- format a client is in (Group Fitness, Private Group Training, 1-on-1,
-- 12-Week Transformation, VL Body Lab, Faith & Favor Mobility).
--
-- Run this once in the Supabase SQL Editor.

create table if not exists public.member_training_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    delivery_setting text,
    primary_goal text,
    secondary_goal text,
    age integer,
    training_experience text,
    training_days_available integer,
    session_duration_minutes integer,
    equipment_access text,
    current_activity_level text,
    injuries_conditions text,
    medical_clearance text,
    exercise_preferences text,
    sleep_stress text,
    consistency_barrier text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create or replace function public.set_training_profile_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists member_training_profiles_updated_at on public.member_training_profiles;
create trigger member_training_profiles_updated_at before update on public.member_training_profiles
    for each row execute procedure public.set_training_profile_updated_at();

alter table public.member_training_profiles enable row level security;

-- Admins manage every profile (this is where personalization decisions get made).
drop policy if exists "Admins manage training profiles" on public.member_training_profiles;
create policy "Admins manage training profiles" on public.member_training_profiles
    for all to authenticated
    using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));

-- A member can read and self-report/update their own profile (fills the gap
-- so intake can happen before a coach ever opens the record, same "plug and
-- play" spirit as the rest of this system).
drop policy if exists "Active members manage their own training profile" on public.member_training_profiles;
create policy "Active members manage their own training profile" on public.member_training_profiles
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.has_member_hub_access()))
    with check (user_id = (select auth.uid()) and (select public.has_member_hub_access()));

grant select, insert, update, delete on public.member_training_profiles to authenticated;
