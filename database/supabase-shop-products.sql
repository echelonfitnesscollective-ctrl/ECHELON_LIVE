-- Echelon Goods: admin-controlled shop catalog. Replaces the hardcoded
-- assets/js/shop-catalog.js array so the storefront (assets/js/shop-showcase.js)
-- and the checkout price lookup (api/shop/checkout.js) both read the same
-- live table an admin can edit from the Admin Console's SHOP tab, no code
-- changes or redeploy needed to show, hide, or add a product.
-- Run once in the Supabase SQL Editor.

create table if not exists public.shop_products (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    name text not null,
    description text not null default '',
    price_cents integer not null check (price_cents > 0),
    sizes jsonb not null default '[]',
    -- Each entry: {"name": "Black", "hex": "#0d0d0c", "image": "<url or repo-relative path>"}.
    -- image is used directly as an <img src>/background-image, so it can be
    -- either a Supabase Storage public URL (new colors uploaded from the
    -- Admin Console) or a relative assets/images/merch/... path (colors
    -- migrated from the old static catalog) - the storefront doesn't care.
    colors jsonb not null default '[]',
    published boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists shop_products_public_feed_idx
on public.shop_products (published, sort_order, created_at desc);

create or replace function public.set_shop_products_updated_at()
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

drop trigger if exists set_shop_products_updated_at on public.shop_products;
create trigger set_shop_products_updated_at
    before update on public.shop_products
    for each row execute procedure public.set_shop_products_updated_at();

alter table public.shop_products enable row level security;

drop policy if exists "Public can view published shop products" on public.shop_products;
create policy "Public can view published shop products"
on public.shop_products for select to anon, authenticated
using (published = true);

drop policy if exists "Admins manage shop products" on public.shop_products;
create policy "Admins manage shop products"
on public.shop_products for all to authenticated
using ((select public.is_echelon_admin()))
with check ((select public.is_echelon_admin()));

grant select on public.shop_products to anon, authenticated;
grant insert, update, delete on public.shop_products to authenticated;

insert into storage.buckets (id, name, public)
values ('shop-products', 'shop-products', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read shop product images" on storage.objects;
create policy "Public can read shop product images"
on storage.objects for select to anon, authenticated
using (bucket_id = 'shop-products');

drop policy if exists "Admins manage shop product images" on storage.objects;
create policy "Admins manage shop product images"
on storage.objects for all to authenticated
using (bucket_id = 'shop-products' and (select public.is_echelon_admin()))
with check (bucket_id = 'shop-products' and (select public.is_echelon_admin()));

-- Seed content migrated verbatim from the previously hardcoded
-- assets/js/shop-catalog.js, all published so the storefront looks
-- identical the moment this script runs.
insert into public.shop_products (slug, name, description, price_cents, sizes, colors, published, sort_order)
values
    ('classic-tee', 'Echelon Classic Tee',
     'Soft, breathable cotton tee with the small chest emblem. An everyday staple.',
     3200, '["S","M","L","XL"]'::jsonb,
     '[{"name":"Black","hex":"#0d0d0c","image":"assets/images/merch/classic-tee-black.jpg"},{"name":"Heather Grey","hex":"#9a9a9a","image":"assets/images/merch/classic-tee-heather-grey.jpg"},{"name":"White","hex":"#ffffff","image":"assets/images/merch/classic-tee-white.jpg"}]'::jsonb,
     true, 10),
    ('cropped-tee', 'Echelon Cropped Tee',
     'Fitted, cropped length with the full front lockup. Built for training or off-duty.',
     3000, '["S","M","L"]'::jsonb,
     '[{"name":"Black","hex":"#0d0d0c","image":"assets/images/merch/cropped-tee-black.jpg"},{"name":"White","hex":"#ffffff","image":"assets/images/merch/cropped-tee-white.jpg"}]'::jsonb,
     true, 20),
    ('long-sleeve', 'Echelon Long Sleeve Performance Tee',
     'Moisture-wicking long sleeve with the small chest emblem. Layer it or wear it alone.',
     4200, '["S","M","L","XL"]'::jsonb,
     '[{"name":"Black","hex":"#0d0d0c","image":"assets/images/merch/long-sleeve-black.jpg"},{"name":"White","hex":"#ffffff","image":"assets/images/merch/long-sleeve-white.jpg"}]'::jsonb,
     true, 30),
    ('pullover-hoodie', 'Echelon Pullover Hoodie',
     'Heavyweight fleece, front pouch pocket, full front lockup and sleeve mark.',
     6400, '["S","M","L","XL"]'::jsonb,
     '[{"name":"Black","hex":"#0d0d0c","image":"assets/images/merch/pullover-hoodie-black.jpg"},{"name":"White","hex":"#ffffff","image":"assets/images/merch/pullover-hoodie-white.jpg"}]'::jsonb,
     true, 40),
    ('quarter-zip', 'Echelon Quarter-Zip Pullover',
     'Performance fabric quarter-zip with the small chest emblem and sleeve mark.',
     5600, '["S","M","L","XL"]'::jsonb,
     '[{"name":"Black","hex":"#0d0d0c","image":"assets/images/merch/quarter-zip-black.jpg"}]'::jsonb,
     true, 50),
    ('performance-leggings', 'Echelon Performance Leggings',
     'High-waist compression leggings with a side zip pocket and hip emblem.',
     5800, '["XS","S","M","L","XL"]'::jsonb,
     '[{"name":"Black","hex":"#0d0d0c","image":"assets/images/merch/performance-leggings-black.jpg"}]'::jsonb,
     true, 60)
on conflict (slug) do nothing;
