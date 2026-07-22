-- Echelon member waiver records. Review the waiver wording with local counsel before production use.
create table if not exists public.member_waivers (
    user_id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    agreement_version text not null,
    electronic_consent boolean not null default false,
    signed_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.member_waivers enable row level security;

drop policy if exists "Members can read their own waiver" on public.member_waivers;
create policy "Members can read their own waiver"
on public.member_waivers for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Members can create their own waiver" on public.member_waivers;
create policy "Members can create their own waiver"
on public.member_waivers for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Members can update their own waiver" on public.member_waivers;
create policy "Members can update their own waiver"
on public.member_waivers for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Admins can read all waivers" on public.member_waivers;
create policy "Admins can read all waivers"
on public.member_waivers for select to authenticated
using ((select public.is_echelon_admin()));
