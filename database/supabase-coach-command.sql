-- Echelon Coach Command: private coach follow-ups, priorities, and due dates.
create table if not exists public.coach_tasks (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    related_name text,
    task_type text not null default 'Follow-up',
    priority text not null default 'Normal' check (priority in ('Low', 'Normal', 'High', 'Urgent')),
    assigned_to text not null default 'Echelon Coach',
    status text not null default 'Open' check (status in ('Open', 'Completed', 'Snoozed')),
    due_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.coach_tasks enable row level security;

create policy "Admins can manage coach tasks"
on public.coach_tasks for all to authenticated
using ((select public.is_echelon_admin()))
with check ((select public.is_echelon_admin()));

grant select, insert, update, delete on public.coach_tasks to authenticated;
