-- Echelon Operating System foundation: projects, launch tasks, offers, billing state and audit trail.
-- Apply after supabase-security-hardening.sql.

alter table public.coaching_applications add column if not exists application_reference text;
alter table public.coaching_applications add column if not exists application_status text not null default 'submitted' check (application_status in ('draft','submitted','under_review','more_information_requested','approved','rejected','withdrawn'));
alter table public.coaching_applications add column if not exists prospective_client_id uuid;

create table if not exists public.prospective_clients (
  id uuid primary key default gen_random_uuid(), full_name text not null, email text not null, phone text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(email)
);
create table if not exists public.onboarding_projects (
  id uuid primary key default gen_random_uuid(), application_id uuid unique references public.coaching_applications(id) on delete cascade,
  prospective_client_id uuid references public.prospective_clients(id) on delete set null, user_id uuid references auth.users(id) on delete set null,
  title text not null, program_id uuid, assigned_coach_id uuid references auth.users(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null, payment_status text not null default 'awaiting_selection' check(payment_status in ('not_required','awaiting_selection','checkout_created','pending','paid','active','past_due','failed','canceled','refunded','partially_refunded','complimentary','manual_payment_pending','manual_payment_confirmed')),
  account_status text not null default 'not_created' check(account_status in ('not_created','invitation_pending','invitation_sent','invitation_expired','activated','disabled')),
  onboarding_status text not null default 'not_started' check(onboarding_status in ('not_started','in_progress','blocked','awaiting_admin','completed')),
  membership_status text not null default 'pending' check(membership_status in ('pending','approved','active','paused','past_due','suspended','expired','canceled','rejected')),
  start_date date, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.onboarding_task_templates (
  id uuid primary key default gen_random_uuid(), name text not null unique, description text, active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.onboarding_task_template_items (
  id uuid primary key default gen_random_uuid(), template_id uuid not null references public.onboarding_task_templates(id) on delete cascade,
  title text not null, description text, stage text not null default 'Application review', sort_order integer not null default 0, required boolean not null default true
);
create table if not exists public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  template_item_id uuid references public.onboarding_task_template_items(id) on delete set null, title text not null, description text, stage text not null,
  status text not null default 'open' check(status in ('open','waiting','completed','skipped')), required boolean not null default true,
  assigned_to uuid references auth.users(id) on delete set null, due_at timestamptz, completed_at timestamptz, completed_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.enrollment_offers (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  program_id uuid, allowed_payment_options jsonb not null default '[]'::jsonb, currency text not null default 'usd', expires_at timestamptz,
  status text not null default 'draft' check(status in ('draft','sent','expired','accepted','canceled')), created_at timestamptz not null default now()
);
create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(), event_type text not null, application_id uuid references public.coaching_applications(id) on delete set null,
  project_id uuid references public.onboarding_projects(id) on delete set null, payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id) on delete set null, action text not null, entity_type text not null, entity_id uuid, detail jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.command_notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, title text not null, body text, kind text not null default 'system', read_at timestamptz, created_at timestamptz not null default now()
);

alter table public.onboarding_projects enable row level security;
alter table public.onboarding_tasks enable row level security;
alter table public.enrollment_offers enable row level security;
alter table public.automation_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.command_notifications enable row level security;
create policy "Admins manage onboarding projects" on public.onboarding_projects for all to authenticated using((select public.is_echelon_admin())) with check((select public.is_echelon_admin()));
create policy "Admins manage onboarding tasks" on public.onboarding_tasks for all to authenticated using((select public.is_echelon_admin())) with check((select public.is_echelon_admin()));
create policy "Admins manage enrollment offers" on public.enrollment_offers for all to authenticated using((select public.is_echelon_admin())) with check((select public.is_echelon_admin()));
create policy "Admins view automation events" on public.automation_events for select to authenticated using((select public.is_echelon_admin()));
create policy "Admins view audit logs" on public.audit_logs for select to authenticated using((select public.is_echelon_admin()));
create policy "Admins manage command notifications" on public.command_notifications for all to authenticated using((select public.is_echelon_admin())) with check((select public.is_echelon_admin()));
grant select,insert,update,delete on public.onboarding_projects,public.onboarding_tasks,public.enrollment_offers,public.command_notifications to authenticated;
grant select on public.automation_events,public.audit_logs to authenticated;

insert into public.onboarding_task_templates(name,description) values('NEW MEMBER LAUNCH','Private operations checklist created from each submitted training application.') on conflict(name) do nothing;
insert into public.onboarding_task_template_items(template_id,title,stage,sort_order) select t.id,v.title,v.stage,v.sort_order from public.onboarding_task_templates t cross join (values
 ('Review application and safety flags','Application review',10),('Choose program and assigned coach','Program assignment',20),('Create approved payment offer','Pricing and payment',30),('Send payment-selection link','Pricing and payment',40),('Verify payment or approved exemption','Pricing and payment',50),('Approve and invite member securely','Account setup',60),('Confirm onboarding and waiver','Member documents',70),('Publish first-week plan','Training preparation',80),('Confirm launch readiness','Final verification',90)
) as v(title,stage,sort_order) where t.name='NEW MEMBER LAUNCH' and not exists(select 1 from public.onboarding_task_template_items i where i.template_id=t.id and i.title=v.title);

create or replace function public.create_echelon_application_project() returns trigger language plpgsql security definer set search_path='' as $$
declare client_id uuid; project_id uuid; launch_template_id uuid; admin_id uuid; recent_project boolean;
begin
  new.application_reference := coalesce(new.application_reference,'EFC-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(new.id::text,'-',''),1,6)));
  insert into public.prospective_clients(full_name,email,phone) values(new.full_name,lower(new.email),new.phone) on conflict(email) do update set full_name=excluded.full_name,phone=coalesce(excluded.phone,public.prospective_clients.phone),updated_at=now() returning id into client_id;
  new.prospective_client_id := client_id;
  select exists(select 1 from public.onboarding_projects p join public.prospective_clients c on c.id=p.prospective_client_id where c.email=lower(new.email) and p.created_at > now()-interval '15 minutes') into recent_project;
  if not recent_project then
    select user_id into admin_id from public.admin_users limit 1;
    insert into public.onboarding_projects(application_id,prospective_client_id,title,owner_id) values(new.id,client_id,'NEW MEMBER LAUNCH — '||new.full_name,admin_id) returning id into project_id;
    select id into launch_template_id from public.onboarding_task_templates where name='NEW MEMBER LAUNCH';
    insert into public.onboarding_tasks(project_id,template_item_id,title,description,stage,required,assigned_to)
      select project_id,i.id,i.title,i.description,i.stage,i.required,admin_id from public.onboarding_task_template_items i where i.template_id=launch_template_id order by i.sort_order;
    insert into public.automation_events(event_type,application_id,project_id,payload) values('application_project_created',new.id,project_id,jsonb_build_object('reference',new.application_reference));
    insert into public.command_notifications(user_id,title,body,kind) values(admin_id,'New coaching application','NEW MEMBER LAUNCH created for '||new.full_name,'application');
  end if;
  return new;
end; $$;
drop trigger if exists create_echelon_application_project on public.coaching_applications;
create trigger create_echelon_application_project before insert on public.coaching_applications for each row execute procedure public.create_echelon_application_project();
