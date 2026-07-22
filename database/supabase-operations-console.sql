-- Echelon operations hub: applications, check-ins, member tracking, and trainer resources.
create table if not exists public.coaching_applications (
    id uuid primary key default gen_random_uuid(),
    full_name text not null,
    email text not null,
    phone text,
    program_interest text not null,
    application_data jsonb not null default '{}'::jsonb,
    status text not null default 'New',
    admin_notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.session_checkins (
    id uuid primary key default gen_random_uuid(),
    full_name text not null,
    email text not null,
    phone text,
    program text not null,
    first_time text,
    emergency_contact text,
    coach_note text,
    waiver_agreed boolean not null default false,
    status text not null default 'Checked in',
    checked_in_at timestamptz not null default now()
);

create table if not exists public.member_goals (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    member_name text not null,
    goal text not null,
    target_date date,
    status text not null default 'Active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.member_notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    member_name text not null,
    note text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.trainer_resources (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    category text not null default 'Education',
    resource_url text,
    notes text,
    created_at timestamptz not null default now()
);

alter table public.coaching_applications enable row level security;
alter table public.session_checkins enable row level security;
alter table public.member_goals enable row level security;
alter table public.member_notes enable row level security;
alter table public.trainer_resources enable row level security;

create policy "Anyone can submit a coaching application"
on public.coaching_applications for insert to anon, authenticated with check (true);
create policy "Admins can manage coaching applications"
on public.coaching_applications for all to authenticated
using ((select public.is_echelon_admin()))
with check ((select public.is_echelon_admin()));

create policy "Anyone can submit a session checkin"
on public.session_checkins for insert to anon, authenticated with check (true);
create policy "Admins can manage session checkins"
on public.session_checkins for all to authenticated
using ((select public.is_echelon_admin()))
with check ((select public.is_echelon_admin()));

create policy "Admins can manage member goals"
on public.member_goals for all to authenticated
using ((select public.is_echelon_admin()))
with check ((select public.is_echelon_admin()));

create policy "Admins can manage member notes"
on public.member_notes for all to authenticated
using ((select public.is_echelon_admin()))
with check ((select public.is_echelon_admin()));

create policy "Admins can manage trainer resources"
on public.trainer_resources for all to authenticated
using ((select public.is_echelon_admin()))
with check ((select public.is_echelon_admin()));

grant insert on public.coaching_applications, public.session_checkins to anon;
grant select, insert, update, delete on public.coaching_applications, public.session_checkins, public.member_goals, public.member_notes, public.trainer_resources to authenticated;
