-- Echelon Coaching Hub: private nutrition, training, messaging, and progress photos.
create table if not exists public.member_nutrition_logs (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
    log_date date not null default current_date, calories integer, protein_grams integer, carbs_grams integer,
    fat_grams integer, water_ounces integer, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    unique (user_id, log_date)
);

create table if not exists public.member_workout_plans (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
    title text not null, coach_note text, plan_text text not null, week_of date, status text not null default 'Active',
    created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.coach_messages (
    id uuid primary key default gen_random_uuid(), sender_id uuid not null references auth.users(id) on delete cascade,
    recipient_id uuid not null references auth.users(id) on delete cascade, message text not null,
    read_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.member_progress_photos (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
    storage_path text not null unique, caption text, taken_on date not null default current_date, created_at timestamptz not null default now()
);

alter table public.member_nutrition_logs enable row level security;
alter table public.member_workout_plans enable row level security;
alter table public.coach_messages enable row level security;
alter table public.member_progress_photos enable row level security;

-- Gives the member app a safe recipient for coach messages without exposing an admin email.
create or replace function public.primary_echelon_admin()
returns uuid
language sql stable security definer set search_path = public
as $$ select user_id from public.admin_users limit 1; $$;
grant execute on function public.primary_echelon_admin() to authenticated;

create policy "Members manage their nutrition logs" on public.member_nutrition_logs for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Admins manage nutrition logs" on public.member_nutrition_logs for all to authenticated
using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));

create policy "Members view their workout plans" on public.member_workout_plans for select to authenticated using (auth.uid() = user_id);
create policy "Admins manage workout plans" on public.member_workout_plans for all to authenticated
using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));

create policy "Members view their messages" on public.coach_messages for select to authenticated
using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "Members send their messages" on public.coach_messages for insert to authenticated
with check (auth.uid() = sender_id and recipient_id = (select public.primary_echelon_admin()));
create policy "Admins manage messages" on public.coach_messages for all to authenticated
using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));

create policy "Members manage their progress photos" on public.member_progress_photos for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Admins manage progress photos" on public.member_progress_photos for all to authenticated
using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));

insert into storage.buckets (id, name, public) values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

create policy "Members upload own progress photos" on storage.objects for insert to authenticated
with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Members view own progress photos" on storage.objects for select to authenticated
using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Members delete own progress photos" on storage.objects for delete to authenticated
using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Admins view progress photos" on storage.objects for select to authenticated
using (bucket_id = 'progress-photos' and (select public.is_echelon_admin()));

grant select, insert, update, delete on public.member_nutrition_logs, public.member_workout_plans, public.coach_messages, public.member_progress_photos to authenticated;
