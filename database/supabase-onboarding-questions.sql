-- Onboarding Questions feature.
--
-- Two things bundled together because they share the same question set:
--
-- 1. application_questions: the "profile/assessment" portion of the coaching
--    application (goal, barriers, fitness level, etc.) used to be hardcoded
--    HTML in pages/coaching-application.html. It's now a data-driven,
--    admin-editable question bank so the owner can add/edit/reorder/retire
--    questions from the Admin Console without a code change. Identity fields
--    (name/email/phone/program_interest) and the conditional private-group
--    field stay hardcoded in the form on purpose, since they drive business
--    logic elsewhere (payment option routing, contact editor, etc.).
--
-- 2. prospect_onboarding_links: lets the owner generate a one-off private
--    link ("ASSIGN ONBOARDING QUESTIONS" in the admin console) and send it
--    to a prospect who didn't get on a call, so they can answer the same
--    question set themselves. Answering it creates a normal
--    coaching_applications row, same as the public form. Token-gated, no
--    anon/authenticated RLS policy on purpose, same convention already used
--    for session_groups.join_token and enrollment_offers.checkout_token:
--    access is only through a server endpoint using the service role key,
--    so the table itself is never enumerable.
--
-- Run this in the Supabase SQL Editor for the Echelon project.

create table if not exists public.application_questions (
    id uuid primary key default gen_random_uuid(),
    question_key text not null unique,
    label text not null,
    field_type text not null default 'textarea' check (field_type in ('text', 'textarea', 'select')),
    options jsonb,
    help_text text,
    section_label text not null default 'Current Fitness Profile',
    required boolean not null default false,
    sort_order integer not null default 0,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.application_questions enable row level security;

drop policy if exists "Public can view active application questions" on public.application_questions;
create policy "Public can view active application questions"
on public.application_questions for select to public
using (active = true);

drop policy if exists "Admins manage application questions" on public.application_questions;
create policy "Admins manage application questions"
on public.application_questions for all to authenticated
using ((select public.is_echelon_admin()))
with check ((select public.is_echelon_admin()));

create or replace function public.set_application_questions_updated_at()
returns trigger
language plpgsql
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists application_questions_updated_at on public.application_questions;
create trigger application_questions_updated_at before update on public.application_questions
    for each row execute procedure public.set_application_questions_updated_at();

insert into public.application_questions (question_key, label, field_type, options, section_label, required, sort_order)
values
    ('instagram_handle', 'Instagram Handle (Optional)', 'text', null, 'Current Fitness Profile', false, 10),
    ('fitness_level', 'Current Fitness Level', 'select', '["Beginner","Intermediate","Advanced"]'::jsonb, 'Current Fitness Profile', true, 20),
    ('primary_goal', 'Primary Goal', 'select', '["Fat Loss","Body Recomposition","Muscle Gain","Athletic Performance","Lifestyle Accountability"]'::jsonb, 'Current Fitness Profile', true, 30),
    ('current_workout_plan', 'Do you already have a current workout plan you like and are following? If yes, briefly describe it.', 'textarea', null, 'Current Fitness Profile', false, 35),
    ('training_days_per_week', 'How many days per week can you realistically train?', 'text', null, 'Current Fitness Profile', true, 40),
    ('commitment_level', 'Commitment Level (1-10)', 'select', '["1","2","3","4","5","6","7","8","9","10"]'::jsonb, 'Current Fitness Profile', true, 50),
    ('goal_and_why', 'What is your primary goal and why is it important to you?', 'textarea', null, 'Goal Discovery', true, 60),
    ('goal_timeline', 'When would you like to reach this goal?', 'text', null, 'Goal Discovery', false, 70),
    ('past_attempts', 'What have you tried in the past that didn''t work?', 'textarea', null, 'Goal Discovery', true, 80),
    ('current_barriers', 'What is currently holding you back from reaching your goals?', 'textarea', null, 'Goal Discovery', true, 90),
    ('six_month_success', 'What would success look like for you 6 months from now?', 'textarea', null, 'Goal Discovery', true, 100),
    ('support_system', 'Who, if anyone, is supporting you in reaching this goal?', 'textarea', null, 'Goal Discovery', false, 110),
    ('activity_level', 'Current Activity Level', 'select', '["Mostly Sedentary","Lightly Active","Moderately Active","Highly Active"]'::jsonb, 'Lifestyle & Habits', true, 120),
    ('nutrition_rating', 'How would you rate your nutrition?', 'select', '["Poor","Fair","Good","Excellent"]'::jsonb, 'Lifestyle & Habits', true, 130),
    ('sleep_hours', 'Average Hours of Sleep Per Night', 'text', null, 'Lifestyle & Habits', false, 140),
    ('coaching_why', 'Why do you believe coaching will help you succeed where you''ve struggled before?', 'textarea', null, 'Coaching Readiness', true, 150),
    ('structured_program_ready', 'Are you prepared to follow a structured coaching program?', 'select', '["Yes","No"]'::jsonb, 'Coaching Readiness', true, 160)
on conflict (question_key) do nothing;

-- Marks which channel a coaching_applications row came in through, so the
-- admin console can badge submissions that arrived via an assigned link
-- instead of the public application form.
alter table public.coaching_applications add column if not exists source text not null default 'website';

create table if not exists public.prospect_onboarding_links (
    id uuid primary key default gen_random_uuid(),
    token text not null unique,
    prospect_name text,
    prospect_email text,
    prospect_phone text,
    program_interest text,
    status text not null default 'pending' check (status in ('pending', 'completed', 'expired')),
    application_id uuid references public.coaching_applications(id) on delete set null,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    completed_at timestamptz
);

alter table public.prospect_onboarding_links enable row level security;

-- No anon/public policy on purpose, see header comment. The admin still
-- gets a policy so the Admin Console can list pending/sent links directly
-- with the signed-in admin session, without needing a dedicated endpoint.
drop policy if exists "Admins manage onboarding links" on public.prospect_onboarding_links;
create policy "Admins manage onboarding links"
on public.prospect_onboarding_links for all to authenticated
using ((select public.is_echelon_admin()))
with check ((select public.is_echelon_admin()));
