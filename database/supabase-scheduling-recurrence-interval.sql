-- Adds "every other week" (and, generally, every N weeks) recurrence to
-- standing availability windows. Before this, coach_availability_windows
-- only understood a plain weekly repeat (day_of_week alone). Needed for the
-- new Saturday-morning Group Fitness slot, which runs every other Saturday
-- starting 2026-09-05.
--
-- recurrence_interval_weeks: 1 = every week (the existing, default
-- behavior, unchanged for every window that doesn't set this). 2 = every
-- other week. 3 = every third week, etc.
--
-- recurrence_anchor_date: the date of the FIRST occurrence. Only meaningful
-- when recurrence_interval_weeks > 1 -- the admin form only shows/requires
-- it in that case. assets/js/member-booking.js's slotsForDate() counts
-- whole weeks between a candidate date and this anchor and only produces a
-- slot when that count is a multiple of the interval.
--
-- Run this once in the Supabase SQL Editor.

alter table public.coach_availability_windows
    add column if not exists recurrence_interval_weeks integer not null default 1
        check (recurrence_interval_weeks >= 1),
    add column if not exists recurrence_anchor_date date;
