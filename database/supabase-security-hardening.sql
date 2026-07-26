-- Approval-only Member Hub access and database-enforced role/status checks.
create table if not exists public.account_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'applicant' check (role in ('applicant','member','coach','administrator')),
  membership_status text not null default 'pending' check (membership_status in ('pending','approved','active','paused','suspended','expired','rejected')),
  program text, assigned_coach_id uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null, approved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.account_access enable row level security;
create or replace function public.set_account_access_updated_at() returns trigger language plpgsql security invoker set search_path='' as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists account_access_updated_at on public.account_access;
create trigger account_access_updated_at before update on public.account_access for each row execute procedure public.set_account_access_updated_at();
insert into public.account_access(user_id,role,membership_status,approved_at) select user_id,'administrator','active',now() from public.admin_users on conflict(user_id) do update set role='administrator',membership_status='active';
insert into public.account_access(user_id,role,membership_status) select id,'applicant','pending' from auth.users on conflict(user_id) do nothing;
create or replace function public.handle_new_account_access() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.account_access(user_id,role,membership_status) values(new.id,'applicant','pending') on conflict(user_id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created_account_access on auth.users;
create trigger on_auth_user_created_account_access after insert on auth.users for each row execute procedure public.handle_new_account_access();
create or replace function public.current_echelon_role() returns text language sql stable security definer set search_path='' as $$ select role from public.account_access where user_id=(select auth.uid()) $$;
create or replace function public.has_member_hub_access() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(exists(select 1 from public.account_access where user_id=(select auth.uid()) and (role='administrator' or (role in ('member','coach') and membership_status='active'))),false) $$;
revoke all on function public.current_echelon_role() from public;
revoke all on function public.has_member_hub_access() from public;
grant execute on function public.current_echelon_role(),public.has_member_hub_access() to authenticated;
drop policy if exists "Users can view their own account access" on public.account_access;
create policy "Users can view their own account access" on public.account_access for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Admins manage account access" on public.account_access;
create policy "Admins manage account access" on public.account_access for all to authenticated using((select public.is_echelon_admin())) with check((select public.is_echelon_admin()));
grant select,insert,update,delete on public.account_access to authenticated;

drop policy if exists "Members can read their own profile" on public.member_profiles;
create policy "Active members can read their own profile" on public.member_profiles for select to authenticated using(user_id=(select auth.uid()) and (select public.has_member_hub_access()));
drop policy if exists "Members can read their own onboarding" on public.member_onboarding;
drop policy if exists "Members can create their own onboarding" on public.member_onboarding;
drop policy if exists "Members can update their own onboarding" on public.member_onboarding;
create policy "Active members read own onboarding" on public.member_onboarding for select to authenticated using(user_id=(select auth.uid()) and (select public.has_member_hub_access()));
create policy "Active members create own onboarding" on public.member_onboarding for insert to authenticated with check(user_id=(select auth.uid()) and (select public.has_member_hub_access()));
create policy "Active members update own onboarding" on public.member_onboarding for update to authenticated using(user_id=(select auth.uid()) and (select public.has_member_hub_access())) with check(user_id=(select auth.uid()) and (select public.has_member_hub_access()));
drop policy if exists "Members can read their own waiver" on public.member_waivers;
drop policy if exists "Members can create their own waiver" on public.member_waivers;
drop policy if exists "Members can update their own waiver" on public.member_waivers;
create policy "Active members read own waiver" on public.member_waivers for select to authenticated using(user_id=(select auth.uid()) and (select public.has_member_hub_access()));
create policy "Active members create own waiver" on public.member_waivers for insert to authenticated with check(user_id=(select auth.uid()) and (select public.has_member_hub_access()));
create policy "Active members update own waiver" on public.member_waivers for update to authenticated using(user_id=(select auth.uid()) and (select public.has_member_hub_access())) with check(user_id=(select auth.uid()) and (select public.has_member_hub_access()));
drop policy if exists "Members can read their own weekly checkins" on public.member_weekly_checkins;
drop policy if exists "Members can create their own weekly checkins" on public.member_weekly_checkins;
drop policy if exists "Members can update their own weekly checkins" on public.member_weekly_checkins;
create policy "Active members read own weekly checkins" on public.member_weekly_checkins for select to authenticated using(user_id=(select auth.uid()) and (select public.has_member_hub_access()));
create policy "Active members create own weekly checkins" on public.member_weekly_checkins for insert to authenticated with check(user_id=(select auth.uid()) and (select public.has_member_hub_access()));
create policy "Active members update own weekly checkins" on public.member_weekly_checkins for update to authenticated using(user_id=(select auth.uid()) and (select public.has_member_hub_access())) with check(user_id=(select auth.uid()) and (select public.has_member_hub_access()));
drop policy if exists "Members can read their own goals" on public.member_goals;
create policy "Active members read own goals" on public.member_goals for select to authenticated using(user_id=(select auth.uid()) and (select public.has_member_hub_access()));

drop policy if exists "Members manage own nutrition profile" on public.nutrition_profiles;
drop policy if exists "Members manage own custom foods" on public.custom_foods;
drop policy if exists "Members manage own food logs" on public.food_logs;
drop policy if exists "Members manage own favorite foods" on public.favorite_foods;
drop policy if exists "Members manage own water logs" on public.water_logs;
drop policy if exists "Members manage own weight logs" on public.weight_logs;
drop policy if exists "Members manage own nutrition notes" on public.nutrition_daily_notes;
drop policy if exists "Members manage their nutrition logs" on public.member_nutrition_logs;
drop policy if exists "Members manage their progress photos" on public.member_progress_photos;
do $$ declare t text; begin foreach t in array array['nutrition_profiles','custom_foods','food_logs','favorite_foods','water_logs','weight_logs','nutrition_daily_notes','member_nutrition_logs','member_progress_photos'] loop execute format('create policy %I on public.%I for all to authenticated using(user_id=(select auth.uid()) and (select public.has_member_hub_access())) with check(user_id=(select auth.uid()) and (select public.has_member_hub_access()))','Active members manage own '||replace(t,'_',' '),t); end loop; end $$;
drop policy if exists "Members view their workout plans" on public.member_workout_plans;
create policy "Active members view own workout plans" on public.member_workout_plans for select to authenticated using(user_id=(select auth.uid()) and (select public.has_member_hub_access()));
drop policy if exists "Members view their messages" on public.coach_messages;
drop policy if exists "Members send their messages" on public.coach_messages;
create policy "Active members view own messages" on public.coach_messages for select to authenticated using((sender_id=(select auth.uid()) or recipient_id=(select auth.uid())) and (select public.has_member_hub_access()));
create policy "Active members send messages to admin" on public.coach_messages for insert to authenticated with check(sender_id=(select auth.uid()) and recipient_id=(select public.primary_echelon_admin()) and (select public.has_member_hub_access()));
drop policy if exists "Members view published library resources" on public.member_library_resources;
create policy "Active members view published library resources" on public.member_library_resources for select to authenticated using(published=true and (select public.has_member_hub_access()));
drop policy if exists "Members upload own progress photos" on storage.objects;
drop policy if exists "Members view own progress photos" on storage.objects;
drop policy if exists "Members delete own progress photos" on storage.objects;
create policy "Active members upload own progress photos" on storage.objects for insert to authenticated with check(bucket_id='progress-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and (select public.has_member_hub_access()));
create policy "Active members view own progress photos" on storage.objects for select to authenticated using(bucket_id='progress-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and (select public.has_member_hub_access()));
create policy "Active members delete own progress photos" on storage.objects for delete to authenticated using(bucket_id='progress-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and (select public.has_member_hub_access()));
drop policy if exists "Members read member library files" on storage.objects;
create policy "Active members read member library files" on storage.objects for select to authenticated using(bucket_id='member-library' and (select public.has_member_hub_access()));
