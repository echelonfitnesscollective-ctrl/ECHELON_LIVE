-- ECHELON FUEL TRACKER · Phase 1
-- Run once in the Echelon Supabase SQL Editor.

create table if not exists public.nutrition_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    calorie_target integer not null default 2200 check (calorie_target between 0 and 10000),
    protein_target_grams numeric(7,1) not null default 160 check (protein_target_grams between 0 and 1000),
    carbohydrate_target_grams numeric(7,1) not null default 220 check (carbohydrate_target_grams between 0 and 1500),
    fat_target_grams numeric(7,1) not null default 70 check (fat_target_grams between 0 and 500),
    water_target_ml integer not null default 2500 check (water_target_ml between 0 and 20000),
    preferred_weight_unit text not null default 'lb' check (preferred_weight_unit in ('lb','kg')),
    preferred_volume_unit text not null default 'oz' check (preferred_volume_unit in ('oz','ml')),
    goal_weight numeric(7,1), start_date date not null default current_date,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.custom_foods (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
    name text not null check (char_length(name) between 1 and 140), brand text,
    serving_name text not null default 'serving', serving_amount numeric(9,2) not null default 1 check (serving_amount > 0), serving_grams numeric(9,2),
    calories numeric(9,2) not null check (calories >= 0), protein_grams numeric(9,2) not null default 0 check (protein_grams >= 0), carbohydrate_grams numeric(9,2) not null default 0 check (carbohydrate_grams >= 0), fat_grams numeric(9,2) not null default 0 check (fat_grams >= 0),
    fiber_grams numeric(9,2) check (fiber_grams >= 0), sugar_grams numeric(9,2) check (sugar_grams >= 0), sodium_mg numeric(9,2) check (sodium_mg >= 0), barcode text, notes text, is_public boolean not null default false,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.food_logs (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
    log_date date not null default current_date, meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snacks')),
    custom_food_id uuid references public.custom_foods(id) on delete set null, food_name_snapshot text not null, brand_snapshot text,
    serving_description_snapshot text, serving_amount numeric(9,2) not null check (serving_amount > 0), serving_unit text,
    serving_grams numeric(9,2), calories numeric(9,2) not null check (calories >= 0), protein_grams numeric(9,2) not null default 0 check (protein_grams >= 0), carbohydrate_grams numeric(9,2) not null default 0 check (carbohydrate_grams >= 0), fat_grams numeric(9,2) not null default 0 check (fat_grams >= 0),
    fiber_grams numeric(9,2), sugar_grams numeric(9,2), sodium_mg numeric(9,2), source text not null default 'Custom',
    created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.favorite_foods (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
    food_name text not null, brand text not null default '', serving_description text, default_serving_amount numeric(9,2) not null default 1 check (default_serving_amount > 0), default_serving_unit text,
    calories numeric(9,2) not null check (calories >= 0), protein_grams numeric(9,2) not null default 0 check (protein_grams >= 0), carbohydrate_grams numeric(9,2) not null default 0 check (carbohydrate_grams >= 0), fat_grams numeric(9,2) not null default 0 check (fat_grams >= 0), source text not null default 'Saved',
    created_at timestamptz not null default now(), unique(user_id, food_name, brand)
);

create table if not exists public.water_logs (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
    log_date date not null default current_date, amount_ml integer not null check (amount_ml > 0 and amount_ml <= 10000), created_at timestamptz not null default now()
);

create table if not exists public.weight_logs (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
    log_date date not null default current_date, weight_value numeric(7,1) not null check (weight_value > 0 and weight_value < 2000),
    weight_unit text not null check (weight_unit in ('lb','kg')), weight_kg_normalized numeric(8,3) not null check (weight_kg_normalized > 0), notes text,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, log_date)
);

create table if not exists public.nutrition_daily_notes (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
    log_date date not null default current_date, notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, log_date)
);

create index if not exists food_logs_user_date_idx on public.food_logs(user_id, log_date, meal_type);
create index if not exists water_logs_user_date_idx on public.water_logs(user_id, log_date);
create index if not exists weight_logs_user_date_idx on public.weight_logs(user_id, log_date desc);
create index if not exists custom_foods_user_name_idx on public.custom_foods(user_id, name);

create or replace function public.set_efc_fuel_updated_at() returns trigger language plpgsql security invoker set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists nutrition_profiles_updated_at on public.nutrition_profiles;
drop trigger if exists custom_foods_updated_at on public.custom_foods;
drop trigger if exists food_logs_updated_at on public.food_logs;
drop trigger if exists weight_logs_updated_at on public.weight_logs;
drop trigger if exists nutrition_daily_notes_updated_at on public.nutrition_daily_notes;
create trigger nutrition_profiles_updated_at before update on public.nutrition_profiles for each row execute procedure public.set_efc_fuel_updated_at();
create trigger custom_foods_updated_at before update on public.custom_foods for each row execute procedure public.set_efc_fuel_updated_at();
create trigger food_logs_updated_at before update on public.food_logs for each row execute procedure public.set_efc_fuel_updated_at();
create trigger weight_logs_updated_at before update on public.weight_logs for each row execute procedure public.set_efc_fuel_updated_at();
create trigger nutrition_daily_notes_updated_at before update on public.nutrition_daily_notes for each row execute procedure public.set_efc_fuel_updated_at();

alter table public.nutrition_profiles enable row level security; alter table public.custom_foods enable row level security; alter table public.food_logs enable row level security; alter table public.favorite_foods enable row level security; alter table public.water_logs enable row level security; alter table public.weight_logs enable row level security; alter table public.nutrition_daily_notes enable row level security;

create policy "Members manage own nutrition profile" on public.nutrition_profiles for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Members manage own custom foods" on public.custom_foods for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Members manage own food logs" on public.food_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Members manage own favorite foods" on public.favorite_foods for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Members manage own water logs" on public.water_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Members manage own weight logs" on public.weight_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Members manage own nutrition notes" on public.nutrition_daily_notes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Echelon admins retain support access. Coach assignment policies can be added when coach roles are enabled.
create policy "Admins manage nutrition profiles" on public.nutrition_profiles for all to authenticated using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));
create policy "Admins manage custom foods" on public.custom_foods for all to authenticated using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));
create policy "Admins manage food logs" on public.food_logs for all to authenticated using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));
create policy "Admins manage favorite foods" on public.favorite_foods for all to authenticated using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));
create policy "Admins manage water logs" on public.water_logs for all to authenticated using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));
create policy "Admins manage weight logs" on public.weight_logs for all to authenticated using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));
create policy "Admins manage nutrition notes" on public.nutrition_daily_notes for all to authenticated using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));

grant select, insert, update, delete on public.nutrition_profiles, public.custom_foods, public.food_logs, public.favorite_foods, public.water_logs, public.weight_logs, public.nutrition_daily_notes to authenticated;
