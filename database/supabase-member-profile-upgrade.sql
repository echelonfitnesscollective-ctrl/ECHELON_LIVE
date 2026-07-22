-- Adds the contact fields used by the premium member roster.
alter table public.member_profiles add column if not exists phone text;

drop policy if exists "Admins can update member profiles" on public.member_profiles;
create policy "Admins can update member profiles"
on public.member_profiles for update to authenticated
using ((select public.is_echelon_admin()))
with check ((select public.is_echelon_admin()));

grant update on public.member_profiles to authenticated;
