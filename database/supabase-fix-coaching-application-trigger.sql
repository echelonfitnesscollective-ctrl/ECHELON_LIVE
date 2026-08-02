-- Fix: create_echelon_application_project ran as a single BEFORE INSERT
-- trigger on public.coaching_applications, but it inserted into
-- public.onboarding_projects referencing the new row's id (new.id) before
-- that row existed in the table -- every insert violated the
-- onboarding_projects_application_id_fkey foreign key and failed with a
-- 409. This broke every coaching application submission in production.
--
-- Fix: split into a BEFORE INSERT trigger (sets fields on the new row --
-- safe before the row exists) and an AFTER INSERT trigger (creates the
-- linked onboarding project -- only safe once the row actually exists).

create or replace function public.prepare_echelon_application() returns trigger language plpgsql security definer set search_path='' as $$
declare client_id uuid;
begin
  new.application_reference := coalesce(new.application_reference,'EFC-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(new.id::text,'-',''),1,6)));
  insert into public.prospective_clients(full_name,email,phone) values(new.full_name,lower(new.email),new.phone) on conflict(email) do update set full_name=excluded.full_name,phone=coalesce(excluded.phone,public.prospective_clients.phone),updated_at=now() returning id into client_id;
  new.prospective_client_id := client_id;
  return new;
end; $$;

create or replace function public.create_echelon_application_project() returns trigger language plpgsql security definer set search_path='' as $$
declare project_id uuid; launch_template_id uuid; admin_id uuid; recent_project boolean;
begin
  select exists(select 1 from public.onboarding_projects p join public.prospective_clients c on c.id=p.prospective_client_id where c.email=lower(new.email) and p.created_at > now()-interval '15 minutes') into recent_project;
  if not recent_project then
    select user_id into admin_id from public.admin_users limit 1;
    insert into public.onboarding_projects(application_id,prospective_client_id,title,owner_id) values(new.id,new.prospective_client_id,'NEW MEMBER LAUNCH: '||new.full_name,admin_id) returning id into project_id;
    select id into launch_template_id from public.onboarding_task_templates where name='NEW MEMBER LAUNCH';
    insert into public.onboarding_tasks(project_id,template_item_id,title,description,stage,required,assigned_to)
      select project_id,i.id,i.title,i.description,i.stage,i.required,admin_id from public.onboarding_task_template_items i where i.template_id=launch_template_id order by i.sort_order;
    insert into public.automation_events(event_type,application_id,project_id,payload) values('application_project_created',new.id,project_id,jsonb_build_object('reference',new.application_reference));
    insert into public.command_notifications(user_id,title,body,kind) values(admin_id,'New coaching application','NEW MEMBER LAUNCH created for '||new.full_name,'application');
  end if;
  return new;
end; $$;

drop trigger if exists create_echelon_application_project on public.coaching_applications;
drop trigger if exists prepare_echelon_application on public.coaching_applications;

create trigger prepare_echelon_application before insert on public.coaching_applications
  for each row execute procedure public.prepare_echelon_application();

create trigger create_echelon_application_project after insert on public.coaching_applications
  for each row execute procedure public.create_echelon_application_project();
