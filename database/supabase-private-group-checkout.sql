-- Echelon Private Group Training checkout: lets one enrollment offer carry multiple Stripe
-- line items (a base price plus a per-person add-on), so group price can auto-calculate by size.
-- Run after supabase-application-enrollment-flow.sql. Additive only — existing 12-Week and
-- 1-on-1 offers keep using the single stripe_price_id column untouched.

alter table public.enrollment_offers add column if not exists line_items jsonb;
alter table public.enrollment_offers add column if not exists group_size integer;
