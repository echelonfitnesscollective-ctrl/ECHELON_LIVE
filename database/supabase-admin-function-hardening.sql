-- P2 hardening: primary_echelon_admin() (database/supabase-member-coaching-hub.sql)
-- was granted execute to `authenticated` but never had `public`/`anon`
-- execute explicitly revoked in a tracked migration, unlike
-- is_echelon_admin()/has_member_hub_access() which both do this. It's a
-- read-only lookup (returns the admin's user_id, not sensitive), but
-- tightening it removes an unnecessary anon-reachable surface.
-- Run this once in the Supabase SQL Editor.

revoke all on function public.primary_echelon_admin() from public;
grant execute on function public.primary_echelon_admin() to authenticated;
