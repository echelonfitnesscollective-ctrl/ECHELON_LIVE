-- Echelon Site Content CMS
-- Run once in the Supabase SQL Editor. This creates a safe, scheduled content feed
-- that only exposes published, in-window items to the public website.

create table if not exists public.site_content_items (
    id uuid primary key default gen_random_uuid(),
    placement text not null default 'homepage' check (placement in ('homepage', 'training', 'resources', 'shop')),
    status text not null default 'Draft' check (status in ('Draft', 'Published', 'Scheduled')),
    eyebrow text,
    title text not null,
    body text,
    cta_label text,
    cta_url text,
    image_url text,
    publish_at timestamptz not null default now(),
    expires_at timestamptz,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint site_content_dates_valid check (expires_at is null or expires_at > publish_at)
);

create index if not exists site_content_public_feed_idx
on public.site_content_items (placement, status, publish_at, sort_order, created_at desc);

create or replace function public.set_site_content_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_site_content_updated_at on public.site_content_items;
create trigger set_site_content_updated_at
    before update on public.site_content_items
    for each row execute procedure public.set_site_content_updated_at();

alter table public.site_content_items enable row level security;

drop policy if exists "Public can view active Echelon content" on public.site_content_items;
create policy "Public can view active Echelon content"
on public.site_content_items for select to anon, authenticated
using (
    status in ('Published', 'Scheduled')
    and publish_at <= now()
    and (expires_at is null or expires_at > now())
);

drop policy if exists "Admins manage Echelon site content" on public.site_content_items;
create policy "Admins manage Echelon site content"
on public.site_content_items for all to authenticated
using ((select public.is_echelon_admin()))
with check ((select public.is_echelon_admin()));

grant select on public.site_content_items to anon, authenticated;
grant insert, update, delete on public.site_content_items to authenticated;
