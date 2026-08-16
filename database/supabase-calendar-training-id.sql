-- Adds the dedicated "Echelon Training" Google Calendar id, created
-- automatically on connect so session events land on their own
-- color-coded calendar instead of mixing into the coach's primary one.
-- Run this once in the Supabase SQL Editor.

alter table public.coach_calendar_tokens add column if not exists training_calendar_id text;
