-- Creates the 8 recurring availability windows discussed: 5 PT blocks
-- (distinct-slot 1-on-1 appointments) + 3 recurring group classes.
-- Run this once in the Supabase SQL Editor, after
-- supabase-scheduling-class-labels-waitlist.sql.
--
-- Every value here (day, time, capacity, session length, class label) is
-- editable afterward from the admin console's SESSIONS tab -- EDIT on any
-- window -- so nothing below is locked in.

insert into public.coach_availability_windows
    (day_of_week, start_time, end_time, session_type, capacity, session_length_minutes, class_label)
values
    -- 1-on-1 PT, distinct appointment slots
    (1, '09:00', '13:00', 'one_on_one', 3, 80, null), -- Monday 9am-1pm, 3 appts
    (3, '09:00', '13:00', 'one_on_one', 3, 80, null), -- Wednesday 9am-1pm, 3 appts
    (2, '13:00', '15:30', 'one_on_one', 2, 75, null), -- Tuesday 1-3:30pm, 2 appts
    (4, '13:00', '15:30', 'one_on_one', 2, 75, null), -- Thursday 1-3:30pm, 2 appts
    (5, '13:00', '15:30', 'one_on_one', 2, 75, null), -- Friday 1-3:30pm, 2 appts

    -- Recurring group classes
    (2, '17:00', '18:00', 'group_fitness', 20, 60, 'Echelon Strength'),        -- Tuesday 5pm
    (4, '17:00', '18:00', 'group_fitness', 20, 60, 'VL Body Lab'),             -- Thursday 5pm
    (5, '17:00', '18:00', 'group_fitness', 20, 60, 'Faith & Favor Mobility'); -- Friday 5pm
