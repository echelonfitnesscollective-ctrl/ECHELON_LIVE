-- Echelon Testimonials
-- Run once in the Supabase SQL Editor. Curated client testimonials
-- (quote + optional before/after photos), admin-managed from a new
-- TESTIMONIALS panel. The public site only ever receives published
-- rows; only the Echelon administrator can manage the collection.
-- Mirrors the site_media_items pattern in supabase-site-media-cms.sql.

create table if not exists public.testimonials (
    id uuid primary key default gen_random_uuid(),
    client_name text not null,
    program text,
    quote text not null,
    rating smallint check (rating between 1 and 5),
    before_image_path text,
    after_image_path text,
    published boolean not null default false,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists testimonials_public_feed_idx
on public.testimonials (published, sort_order, created_at desc);

create or replace function public.set_testimonials_updated_at()
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

drop trigger if exists set_testimonials_updated_at on public.testimonials;
create trigger set_testimonials_updated_at
    before update on public.testimonials
    for each row execute procedure public.set_testimonials_updated_at();

alter table public.testimonials enable row level security;

drop policy if exists "Public can view published testimonials" on public.testimonials;
create policy "Public can view published testimonials"
on public.testimonials for select to anon, authenticated
using (published = true);

drop policy if exists "Admins manage testimonials" on public.testimonials;
create policy "Admins manage testimonials"
on public.testimonials for all to authenticated
using ((select public.is_echelon_admin()))
with check ((select public.is_echelon_admin()));

insert into storage.buckets (id, name, public)
values ('testimonial-photos', 'testimonial-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read testimonial photos" on storage.objects;
create policy "Public can read testimonial photos"
on storage.objects for select to anon, authenticated
using (bucket_id = 'testimonial-photos');

drop policy if exists "Admins manage testimonial photos" on storage.objects;
create policy "Admins manage testimonial photos"
on storage.objects for all to authenticated
using (bucket_id = 'testimonial-photos' and (select public.is_echelon_admin()))
with check (bucket_id = 'testimonial-photos' and (select public.is_echelon_admin()));

grant select on public.testimonials to anon, authenticated;
grant insert, update, delete on public.testimonials to authenticated;
