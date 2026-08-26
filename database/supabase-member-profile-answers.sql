-- Lets an approved member view and edit their own answers to the same
-- admin-editable Coaching Application question bank (application_questions),
-- as an ongoing profile instead of a one-time snapshot frozen at application
-- time. Seeded once from coaching_applications.application_data when the
-- member is invited (api/enrollment/activate-member.js), editable by the
-- member from the Member Portal and by the coach from Member Records from
-- then on. Matches the member_training_profiles self-edit RLS pattern.
--
-- Run this once in the Supabase SQL Editor.

create table if not exists public.member_profile_answers (
    user_id uuid not null references auth.users(id) on delete cascade,
    question_key text not null,
    answer text,
    updated_at timestamptz not null default now(),
    primary key (user_id, question_key)
);

alter table public.member_profile_answers enable row level security;

drop policy if exists "Admins manage profile answers" on public.member_profile_answers;
create policy "Admins manage profile answers"
on public.member_profile_answers for all to authenticated
using ((select public.is_echelon_admin()))
with check ((select public.is_echelon_admin()));

-- Same "plug and play" spirit as member_training_profiles: an active member
-- can read and update only their own rows.
drop policy if exists "Active members manage their own profile answers" on public.member_profile_answers;
create policy "Active members manage their own profile answers"
on public.member_profile_answers for all to authenticated
using (user_id = (select auth.uid()) and (select public.has_member_hub_access()))
with check (user_id = (select auth.uid()) and (select public.has_member_hub_access()));

grant select, insert, update, delete on public.member_profile_answers to authenticated;

create or replace function public.set_member_profile_answers_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists member_profile_answers_updated_at on public.member_profile_answers;
create trigger member_profile_answers_updated_at before update on public.member_profile_answers
    for each row execute procedure public.set_member_profile_answers_updated_at();
