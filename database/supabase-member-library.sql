create table if not exists public.member_library_resources (id uuid primary key default gen_random_uuid(), title text not null, category text not null default 'Education', description text, storage_path text not null unique, published boolean not null default true, created_at timestamptz not null default now());
alter table public.member_library_resources enable row level security;
create policy "Members view published library resources" on public.member_library_resources for select to authenticated using (published = true);
create policy "Admins manage member library resources" on public.member_library_resources for all to authenticated using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));
insert into storage.buckets (id,name,public) values ('member-library','member-library',false) on conflict (id) do nothing;
create policy "Members read member library files" on storage.objects for select to authenticated using (bucket_id = 'member-library');
create policy "Admins manage member library files" on storage.objects for all to authenticated using (bucket_id = 'member-library' and (select public.is_echelon_admin())) with check (bucket_id = 'member-library' and (select public.is_echelon_admin()));
grant select, insert, update, delete on public.member_library_resources to authenticated;
