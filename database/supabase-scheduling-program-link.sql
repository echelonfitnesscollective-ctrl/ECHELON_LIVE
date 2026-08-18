-- Links a standing availability window to a Training Hub program (the
-- cards Section Control controls). Once linked, a window only produces
-- bookable time slots on the public/member booking calendar while its
-- linked program's status is 'live' (or 'launched' and inside its
-- launch/expire window) -- the same visibility rule Section Control
-- already uses for the card itself. An unlinked window is unaffected and
-- always shows, exactly as before.
--
-- Run this once in the Supabase SQL Editor.

alter table public.coach_availability_windows
    add column if not exists program_key text references public.training_programs(program_key) on delete set null;

-- Link the live windows created earlier to their Training Hub program.
update public.coach_availability_windows set program_key = '1-on-1-coaching' where session_type = 'one_on_one';
update public.coach_availability_windows set program_key = 'group-fitness' where session_type = 'group_fitness' and class_label = 'Echelon Strength';
update public.coach_availability_windows set program_key = 'vl-body-lab' where session_type = 'group_fitness' and class_label = 'VL Body Lab';
update public.coach_availability_windows set program_key = 'faith-favor-mobility' where session_type = 'group_fitness' and class_label = 'Faith & Favor Mobility';
