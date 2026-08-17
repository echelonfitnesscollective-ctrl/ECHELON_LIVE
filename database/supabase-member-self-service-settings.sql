-- Lets members update their own display name and phone number from the
-- member portal, without granting them any ability to touch other columns
-- (email, membership status, etc. stay admin-only) or other members' rows.
drop policy if exists "Members can update their own contact details" on public.member_profiles;
create policy "Members can update their own contact details"
on public.member_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke update on public.member_profiles from authenticated;
grant update (full_name, phone) on public.member_profiles to authenticated;
