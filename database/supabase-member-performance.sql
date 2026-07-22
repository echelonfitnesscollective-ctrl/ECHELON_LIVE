-- Echelon Performance: member-owned weekly coaching check-ins.
create table if not exists public.member_weekly_checkins (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    week_of date not null default current_date,
    body_weight numeric,
    body_fat_percentage numeric,
    workouts_completed integer,
    average_steps integer,
    average_sleep_hours numeric,
    energy_score integer,
    stress_score integer,
    nutrition_adherence integer,
    protein_days integer,
    water_days integer,
    wins text,
    blockers text,
    coach_focus text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, week_of)
);

alter table public.member_weekly_checkins enable row level security;

create policy "Members can read their own weekly checkins"
on public.member_weekly_checkins for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Members can create their own weekly checkins"
on public.member_weekly_checkins for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Members can update their own weekly checkins"
on public.member_weekly_checkins for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Admins can read weekly checkins"
on public.member_weekly_checkins for select to authenticated
using ((select public.is_echelon_admin()));

drop policy if exists "Members can read their own goals" on public.member_goals;
create policy "Members can read their own goals"
on public.member_goals for select to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update on public.member_weekly_checkins to authenticated;
grant select on public.member_goals to authenticated;
