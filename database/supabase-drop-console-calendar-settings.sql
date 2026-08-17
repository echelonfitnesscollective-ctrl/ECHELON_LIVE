-- The admin CALENDAR tab (a single-row "paste an embed URL" form, added
-- 2026-08-06 before the native booking system existed) has been removed.
-- Nothing reads this table anymore -- SESSIONS now handles real Google
-- Calendar sync via OAuth. Safe to drop.
drop table if exists public.console_calendar_settings;
