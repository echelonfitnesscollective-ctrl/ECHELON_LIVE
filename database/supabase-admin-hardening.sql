-- Admin hardening: keep exactly Luther Casimir as the Echelon administrator.
-- Run once in Supabase SQL Editor.

delete from public.admin_users
where user_id not in (
    select id from auth.users where lower(email) = 'luther.casimir@gmail.com'
);

insert into public.admin_users (user_id)
select id from auth.users
where lower(email) = 'luther.casimir@gmail.com'
on conflict (user_id) do nothing;
