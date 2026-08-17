-- Adds open/closed tracking to leads + applications, and lets a Coach
-- Command task reference back to the specific submission it followed up on.
-- Admins already have full manage() access to all three tables (see
-- supabase-website-leads.sql, supabase-operations-console.sql, and
-- supabase-coach-command.sql), so no new RLS policies are needed here.

alter table public.website_leads
    add column if not exists closed_at timestamptz,
    add column if not exists closed_by uuid references auth.users(id) on delete set null;

alter table public.coaching_applications
    add column if not exists closed_at timestamptz,
    add column if not exists closed_by uuid references auth.users(id) on delete set null;

alter table public.coach_tasks
    add column if not exists lead_id uuid references public.website_leads(id) on delete set null,
    add column if not exists application_id uuid references public.coaching_applications(id) on delete set null;
