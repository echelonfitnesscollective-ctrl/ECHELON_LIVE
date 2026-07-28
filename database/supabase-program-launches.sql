-- Echelon Program Launches: lets an admin flip "Faith & Favor Mobility" and
-- "VL Body Lab" from IN DEVELOPMENT to LIVE by picking a date and clicking a
-- button in the Admin Console — no code changes, no redeploy. The public site
-- checks launch_at on page load and swaps the card automatically once that
-- date passes.
--
-- Reference only: this table was created live via the Supabase Table Editor
-- GUI (not by running this script), because the SQL Editor was unreliable in
-- that session. This file documents the resulting schema so it can be
-- reproduced or reviewed without opening the dashboard.

create table if not exists public.program_launches (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    program_key text not null unique,
    status text not null default 'in_development',
    coach_name text,
    launch_at timestamptz
);

alter table public.program_launches enable row level security;

drop policy if exists "Public can view program launch status" on public.program_launches;
create policy "Public can view program launch status"
on public.program_launches for select to public
using (true);

drop policy if exists "Admins manage program launches" on public.program_launches;
create policy "Admins manage program launches"
on public.program_launches for all to authenticated
using ((select public.is_echelon_admin()))
with check ((select public.is_echelon_admin()));

insert into public.program_launches (program_key, status)
values ('faith-favor-mobility', 'in_development'), ('vl-body-lab', 'in_development')
on conflict (program_key) do nothing;
