-- Echelon accepted-applicant flow: approval → Stripe payment → secure member invitation.
-- Run after supabase-echolon-operating-system.sql and supabase-security-hardening.sql.
-- This migration is additive: existing applications, member records, and task history stay intact.

alter table public.enrollment_offers add column if not exists payment_option text;
alter table public.enrollment_offers add column if not exists stripe_price_id text;
alter table public.enrollment_offers add column if not exists checkout_token text unique;
alter table public.enrollment_offers add column if not exists stripe_checkout_session_id text unique;
alter table public.enrollment_offers add column if not exists payment_status text not null default 'awaiting_payment';
alter table public.enrollment_offers add column if not exists sent_at timestamptz;
alter table public.enrollment_offers add column if not exists paid_at timestamptz;

alter table public.coaching_applications add column if not exists approved_program text;
alter table public.coaching_applications add column if not exists payment_status text not null default 'not_started';
alter table public.coaching_applications add column if not exists approved_at timestamptz;
alter table public.coaching_applications add column if not exists invited_at timestamptz;

create table if not exists public.stripe_payment_events (
  stripe_event_id text primary key,
  event_type text not null,
  offer_id uuid references public.enrollment_offers(id) on delete set null,
  project_id uuid references public.onboarding_projects(id) on delete set null,
  application_id uuid references public.coaching_applications(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

alter table public.stripe_payment_events enable row level security;
drop policy if exists "Admins view Stripe payment events" on public.stripe_payment_events;
create policy "Admins view Stripe payment events" on public.stripe_payment_events for select to authenticated using ((select public.is_echelon_admin()));
grant select on public.stripe_payment_events to authenticated;

create index if not exists enrollment_offers_checkout_token_idx on public.enrollment_offers(checkout_token);
create index if not exists enrollment_offers_project_idx on public.enrollment_offers(project_id, created_at desc);
create index if not exists onboarding_tasks_project_stage_idx on public.onboarding_tasks(project_id, stage, status);

-- A clear, human-readable current state is retained in the legacy status column so
-- the existing console keeps working while application_status remains the formal workflow state.
update public.coaching_applications
set application_status = case
  when lower(coalesce(status, '')) in ('approved', 'accepted') then 'approved'
  when lower(coalesce(status, '')) in ('rejected', 'not selected') then 'rejected'
  when lower(coalesce(status, '')) in ('reviewing', 'under review') then 'under_review'
  else application_status
end
where application_status is distinct from case
  when lower(coalesce(status, '')) in ('approved', 'accepted') then 'approved'
  when lower(coalesce(status, '')) in ('rejected', 'not selected') then 'rejected'
  when lower(coalesce(status, '')) in ('reviewing', 'under review') then 'under_review'
  else application_status
end;

