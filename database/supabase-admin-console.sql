-- Echelon Admin Console: roles, member email labels, and intake access.
-- The email below is the initial Echelon administrator account.

create table if not exists public.admin_users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_echelon_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    );
$$;

revoke all on function public.is_echelon_admin() from public;
grant execute on function public.is_echelon_admin() to authenticated;

insert into public.admin_users (user_id)
select id
from auth.users
where email = 'luther.casimir@gmail.com'
on conflict (user_id) do nothing;

create table if not exists public.member_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    full_name text,
    created_at timestamptz not null default now()
);

alter table public.member_profiles enable row level security;

create or replace function public.handle_new_member_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.member_profiles (user_id, email, full_name)
    values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
    on conflict (user_id) do update set email = excluded.email;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created_member_profile on auth.users;
create trigger on_auth_user_created_member_profile
    after insert on auth.users
    for each row execute procedure public.handle_new_member_profile();

insert into public.member_profiles (user_id, email, full_name)
select id, email, raw_user_meta_data ->> 'full_name'
from auth.users
on conflict (user_id) do update set email = excluded.email;

drop policy if exists "Members can read their own profile" on public.member_profiles;
create policy "Members can read their own profile"
on public.member_profiles for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Admins can read member profiles" on public.member_profiles;
create policy "Admins can read member profiles"
on public.member_profiles for select to authenticated
using ((select public.is_echelon_admin()));

drop policy if exists "Admins can read all onboarding" on public.member_onboarding;
create policy "Admins can read all onboarding"
on public.member_onboarding for select to authenticated
using ((select public.is_echelon_admin()));
