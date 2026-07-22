-- Echelon website leads: contact requests and waitlist entries.
create table if not exists public.website_leads (
    id uuid primary key default gen_random_uuid(),
    lead_type text not null,
    full_name text not null,
    email text not null,
    phone text,
    category text,
    message text,
    source_data jsonb not null default '{}'::jsonb,
    status text not null default 'New',
    admin_notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.website_leads enable row level security;

create policy "Anyone can submit an Echelon website lead"
on public.website_leads for insert to anon, authenticated with check (true);

create policy "Admins can manage website leads"
on public.website_leads for all to authenticated
using ((select public.is_echelon_admin()))
with check ((select public.is_echelon_admin()));

grant insert on public.website_leads to anon;
grant select, insert, update, delete on public.website_leads to authenticated;
