-- Echelon Media Manager
-- Run once in the Supabase SQL Editor. The public site only receives published
-- photos and videos; only the Echelon administrator can manage this collection.

create table if not exists public.site_media_items (
    id uuid primary key default gen_random_uuid(),
    media_type text not null check (media_type in ('image', 'video')),
    title text not null default 'ECHELON IN MOTION',
    caption text,
    storage_path text not null unique,
    poster_path text,
    published boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists site_media_public_feed_idx
on public.site_media_items (published, sort_order, created_at desc);

create or replace function public.set_site_media_updated_at()
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

drop trigger if exists set_site_media_updated_at on public.site_media_items;
create trigger set_site_media_updated_at
    before update on public.site_media_items
    for each row execute procedure public.set_site_media_updated_at();

alter table public.site_media_items enable row level security;

drop policy if exists "Public can view published Echelon media" on public.site_media_items;
create policy "Public can view published Echelon media"
on public.site_media_items for select to anon, authenticated
using (published = true);

drop policy if exists "Admins manage Echelon media" on public.site_media_items;
create policy "Admins manage Echelon media"
on public.site_media_items for all to authenticated
using ((select public.is_echelon_admin()))
with check ((select public.is_echelon_admin()));

insert into storage.buckets (id, name, public)
values ('site-media', 'site-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read Echelon media files" on storage.objects;
create policy "Public can read Echelon media files"
on storage.objects for select to anon, authenticated
using (bucket_id = 'site-media');

drop policy if exists "Admins manage Echelon media files" on storage.objects;
create policy "Admins manage Echelon media files"
on storage.objects for all to authenticated
using (bucket_id = 'site-media' and (select public.is_echelon_admin()))
with check (bucket_id = 'site-media' and (select public.is_echelon_admin()));

grant select on public.site_media_items to anon, authenticated;
grant insert, update, delete on public.site_media_items to authenticated;
