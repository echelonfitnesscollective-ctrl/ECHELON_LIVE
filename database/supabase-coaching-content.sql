-- Echelon Coaching Content System: equipment inventory, the exercise/workout
-- library, 12-week program templates, and Today's Work (per-member daily
-- workout assignment).
--
-- Reference only: built live via the Supabase Table Editor / SQL Editor GUI,
-- same as every other table in this codebase this session. This file
-- documents the resulting schema so it can be reproduced or reviewed
-- without opening the dashboard.
--
-- Every admin-write policy below is gated on is_echelon_admin() only, same
-- as everywhere else in this codebase today. account_access.role already
-- supports a 'coach' value (see supabase-security-hardening.sql) but coach
-- currently only grants member-hub access, not admin-console write access.
-- Adding real coach permissions to this feature later is a one-line change:
-- OR public.current_echelon_role() = 'coach' into the "using"/"with check"
-- clause of the relevant policy. Left out intentionally for now.

-- =========================================================
-- EQUIPMENT (admin-only inventory + notes; not member-facing)
-- =========================================================

create table if not exists public.equipment_inventory (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    category text,
    price numeric(10,2),
    quantity integer not null default 1,
    condition text,
    purchase_date date,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.equipment_notes (
    id uuid primary key default gen_random_uuid(),
    equipment_id uuid not null references public.equipment_inventory(id) on delete cascade,
    author_id uuid references auth.users(id) on delete set null,
    note text not null,
    created_at timestamptz not null default now()
);

-- =========================================================
-- EXERCISE LIBRARY (admin-authored, reusable building block)
-- =========================================================

create table if not exists public.exercise_library (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    target_area text,
    description text,
    form_cues text,
    coaching_cues text,
    modification_up text,
    modification_down text,
    modification_pregnancy text,
    video_url text,
    equipment_needed text,
    status text not null default 'draft' check (status in ('draft', 'published')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- =========================================================
-- WORKOUTS (a session assembled from exercise_library rows)
-- =========================================================

create table if not exists public.workouts (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    category text,
    description text,
    status text not null default 'draft' check (status in ('draft', 'published')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.workout_exercises (
    id uuid primary key default gen_random_uuid(),
    workout_id uuid not null references public.workouts(id) on delete cascade,
    exercise_id uuid not null references public.exercise_library(id) on delete restrict,
    sort_order integer not null default 0,
    sets integer,
    reps text,
    rest_seconds integer,
    notes text,
    created_at timestamptz not null default now()
);

-- =========================================================
-- 12-WEEK PROGRAM TEMPLATES (admin authoring tool; distinct from the
-- public-facing training_programs table that powers the marketing carousel)
-- =========================================================

create table if not exists public.program_templates (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    goal text,
    description text,
    duration_weeks integer not null default 12,
    status text not null default 'draft' check (status in ('draft', 'published')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.program_template_workouts (
    id uuid primary key default gen_random_uuid(),
    program_template_id uuid not null references public.program_templates(id) on delete cascade,
    week_number integer not null,
    day_number integer not null,
    workout_id uuid not null references public.workouts(id) on delete restrict,
    notes text,
    created_at timestamptz not null default now(),
    unique (program_template_id, week_number, day_number)
);

-- =========================================================
-- TODAY'S WORK (per-member daily workout assignment)
-- =========================================================

create table if not exists public.member_daily_workouts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    assigned_date date not null default current_date,
    workout_id uuid not null references public.workouts(id) on delete restrict,
    coach_note text,
    status text not null default 'assigned' check (status in ('assigned', 'completed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- =========================================================
-- updated_at trigger (shared function, matches the pattern used by
-- supabase-efc-fuel-tracker.sql etc.)
-- =========================================================

create or replace function public.set_coaching_content_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger equipment_inventory_updated_at before update on public.equipment_inventory
    for each row execute procedure public.set_coaching_content_updated_at();
create trigger exercise_library_updated_at before update on public.exercise_library
    for each row execute procedure public.set_coaching_content_updated_at();
create trigger workouts_updated_at before update on public.workouts
    for each row execute procedure public.set_coaching_content_updated_at();
create trigger program_templates_updated_at before update on public.program_templates
    for each row execute procedure public.set_coaching_content_updated_at();
create trigger member_daily_workouts_updated_at before update on public.member_daily_workouts
    for each row execute procedure public.set_coaching_content_updated_at();

-- =========================================================
-- RLS
-- =========================================================

alter table public.equipment_inventory enable row level security;
alter table public.equipment_notes enable row level security;
alter table public.exercise_library enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.program_templates enable row level security;
alter table public.program_template_workouts enable row level security;
alter table public.member_daily_workouts enable row level security;

-- Equipment: admin-only, both tables.
create policy "Admins manage equipment inventory" on public.equipment_inventory
    for all to authenticated
    using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));
create policy "Admins manage equipment notes" on public.equipment_notes
    for all to authenticated
    using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));

-- Exercise library: admin manages all; members with hub access can read published rows.
create policy "Admins manage exercise library" on public.exercise_library
    for all to authenticated
    using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));
create policy "Active members read published exercises" on public.exercise_library
    for select to authenticated
    using (status = 'published' and (select public.has_member_hub_access()));

-- Workouts: same shape as exercise library.
create policy "Admins manage workouts" on public.workouts
    for all to authenticated
    using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));
create policy "Active members read published workouts" on public.workouts
    for select to authenticated
    using (status = 'published' and (select public.has_member_hub_access()));

create policy "Admins manage workout exercises" on public.workout_exercises
    for all to authenticated
    using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));
create policy "Active members read workout exercises" on public.workout_exercises
    for select to authenticated
    using (
        (select public.has_member_hub_access())
        and exists (select 1 from public.workouts w where w.id = workout_id and w.status = 'published')
    );

-- Program templates: admin-only. Members never browse the template directly,
-- only the specific day assigned to them via member_daily_workouts.
create policy "Admins manage program templates" on public.program_templates
    for all to authenticated
    using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));
create policy "Admins manage program template workouts" on public.program_template_workouts
    for all to authenticated
    using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));

-- Today's Work: admin manages all; a member can read their own rows and
-- update only the status field on their own rows (marking a workout done).
create policy "Admins manage daily workouts" on public.member_daily_workouts
    for all to authenticated
    using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));
create policy "Active members view their daily workouts" on public.member_daily_workouts
    for select to authenticated
    using (user_id = (select auth.uid()) and (select public.has_member_hub_access()));
create policy "Active members update their daily workout status" on public.member_daily_workouts
    for update to authenticated
    using (user_id = (select auth.uid()) and (select public.has_member_hub_access()))
    with check (user_id = (select auth.uid()) and (select public.has_member_hub_access()));

grant select, insert, update, delete on
    public.equipment_inventory, public.equipment_notes,
    public.exercise_library, public.workouts, public.workout_exercises,
    public.program_templates, public.program_template_workouts,
    public.member_daily_workouts
to authenticated;
