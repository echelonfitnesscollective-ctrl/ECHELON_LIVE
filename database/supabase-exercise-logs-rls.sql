-- P0 SECURITY FIX: member_exercise_logs (Coaching Hub load tracking) was
-- created directly in the Supabase dashboard with no tracked migration --
-- meaning there is no record anywhere of RLS ever being enabled on it, and
-- no policy restricting a member to their own rows. assets/js/member-coaching.js
-- reads and writes this table directly from the browser (user_id,
-- daily_workout_id, exercise_id, load_lb), so if RLS was never turned on,
-- any logged-in member can currently read or overwrite every other
-- member's load data.
--
-- Run this immediately in the Supabase SQL Editor, then confirm in
-- Table Editor (or Security Advisor) that member_exercise_logs shows RLS
-- as enabled. This does not create the table -- it assumes the table
-- already exists live with at least a user_id column referencing auth.users.

alter table public.member_exercise_logs enable row level security;

drop policy if exists "Active members manage own exercise logs" on public.member_exercise_logs;
create policy "Active members manage own exercise logs" on public.member_exercise_logs
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.has_member_hub_access()))
    with check (user_id = (select auth.uid()) and (select public.has_member_hub_access()));

drop policy if exists "Admins manage exercise logs" on public.member_exercise_logs;
create policy "Admins manage exercise logs" on public.member_exercise_logs
    for all to authenticated
    using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));

grant select, insert, update, delete on public.member_exercise_logs to authenticated;
