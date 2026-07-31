-- Mobile training kit, gym/mobile workout setting, program enrollment automation,
-- and the full Cutting program seeded as a live test.
--
-- Run this whole file once in the Supabase SQL Editor (paste, then Run).
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT DO NOTHING everywhere it matters.

-- =========================================================
-- 1. WORKOUT SETTING: gym vs mobile (out-of-car) vs both
-- =========================================================

alter table public.workouts
    add column if not exists setting text not null default 'gym'
    check (setting in ('gym', 'mobile', 'both'));

-- =========================================================
-- 2. PROGRAM ENROLLMENT (the plug-and-play mechanism)
-- Enrolling a member in a program_template bulk-generates their
-- entire member_daily_workouts calendar in one shot, computed from
-- each program_template_workouts row's week_number/day_number offset
-- from the enrollment start_date. No daily manual assignment needed.
-- =========================================================

create table if not exists public.member_program_enrollments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    program_template_id uuid not null references public.program_templates(id) on delete restrict,
    start_date date not null,
    status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
    created_at timestamptz not null default now()
);

alter table public.member_program_enrollments enable row level security;

drop policy if exists "Admins manage program enrollments" on public.member_program_enrollments;
create policy "Admins manage program enrollments" on public.member_program_enrollments
    for all to authenticated
    using ((select public.is_echelon_admin())) with check ((select public.is_echelon_admin()));

drop policy if exists "Active members view their own enrollments" on public.member_program_enrollments;
create policy "Active members view their own enrollments" on public.member_program_enrollments
    for select to authenticated
    using (user_id = (select auth.uid()) and (select public.has_member_hub_access()));

grant select, insert, update, delete on public.member_program_enrollments to authenticated;

-- =========================================================
-- 3. EQUIPMENT: mobile training kit (from the owner's mobile-training
-- research). Price and quantity intentionally left blank/0 -- fill in
-- real numbers once purchased. Category "Mobile Kit" distinguishes
-- these from any fixed-gym equipment already logged.
-- =========================================================

insert into public.equipment_inventory (name, category, quantity, notes)
select v.name, 'Mobile Kit', 0, 'Mobile training kit -- update quantity, price, and condition once purchased.'
from (values
    ('Resistance Bands (set, various tensions)'),
    ('Suspension Trainer (TRX-style)'),
    ('Adjustable Dumbbells (compact set)'),
    ('Adjustable Kettlebell'),
    ('Sandbag / Bulgarian Bag'),
    ('Jump Rope'),
    ('Exercise Mats'),
    ('Foam Roller'),
    ('Medicine Ball(s)'),
    ('Agility Cones / Ladder'),
    ('Professional Timer / Stopwatch'),
    ('Portable Bluetooth Speaker'),
    ('First Aid Kit'),
    ('Body Weight Scale'),
    ('Skinfold Calipers'),
    ('Measuring Tape')
) as v(name)
where not exists (
    select 1 from public.equipment_inventory e where e.name = v.name
);

-- =========================================================
-- 4. CUTTING PROGRAM -- full live seed (exercises, workouts,
-- workout_exercises, program template, and the 12-week calendar).
-- =========================================================

-- 4a. Exercises
insert into public.exercise_library (name, target_area, form_cues, coaching_cues, modification_up, modification_down, modification_pregnancy, status)
values
('Barbell Bench Press', 'Chest, Triceps, Front Delts', 'Feet flat, shoulder blades pinned and down, bar path touches low chest, drive floor through feet.', 'Rip the floor for leg drive.', 'Add a 2-second pause at the chest.', 'Machine chest press.', 'Sub incline press after first trimester; cap RPE at 6.', 'published'),
('Chest-Supported Row', 'Lats, Rhomboids, Rear Delts', 'Chest stays pinned to the pad, pull elbows back and down, squeeze shoulder blades.', 'Pull the bar apart for lat engagement.', 'Add a 2-second squeeze at the top.', 'Reduce range of motion if shoulder is limited.', 'Safe as prescribed; reduce load if uncomfortable.', 'published'),
('Seated Overhead Press', 'Shoulders, Triceps', 'Ribs down, core braced, bar path stays close to the face.', 'Press through the crown of the head.', 'Standing version for more core demand.', 'Reduce range of motion if shoulder impingement present.', 'Cap RPE at 6; avoid unsupported standing version.', 'published'),
('Lat Pulldown', 'Lats, Biceps', 'Lead with the elbows, avoid leaning back excessively.', 'Pull the bar to the collarbone, not the neck.', 'Slow 3-second eccentric.', 'Reduce weight and prioritize full range of motion.', 'Safe as prescribed at moderate intensity.', 'published'),
('Incline Dumbbell Press', 'Upper Chest', 'Set bench to 30-45 degrees, control the descent.', 'Squeeze the dumbbells together at the top.', 'Add a 2-second pause at the bottom.', 'Reduce range of motion or use machine press.', 'Sub for flat bench during pregnancy.', 'published'),
('Cable Face Pull', 'Rear Delts, Rotator Cuff', 'Pull to eye level, externally rotate at the end.', 'Lead with the elbows high.', 'Add a pause at full contraction.', 'Lighten load and prioritize form.', 'Safe as prescribed.', 'published'),
('Standing Cable Curl', 'Biceps', 'Elbows pinned to the sides, no swinging.', 'Squeeze at the top of every rep.', 'Slow 3-second eccentric.', 'Reduce load.', 'Safe as prescribed.', 'published'),
('Rope Tricep Pushdown', 'Triceps', 'Elbows pinned to the sides, split the rope at the bottom.', 'Full lockout every rep.', 'Add a pause at lockout.', 'Reduce load.', 'Safe as prescribed.', 'published'),
('Back Squat', 'Quads, Glutes', 'Brace before descent, knees track over toes, hips and chest rise together.', 'Spread the floor.', 'Add a 2-second pause at depth.', 'Goblet squat regression.', 'Goblet squat only, to comfortable depth.', 'published'),
('Romanian Deadlift', 'Hamstrings, Glutes, Lower Back', 'Hinge at the hips, soft knees, bar stays close to the legs.', 'Push the hips back, not down.', 'Slow 4-second eccentric.', 'Reduce range of motion or load.', 'Cap load conservatively; stop if any discomfort.', 'published'),
('Walking Lunge', 'Quads, Glutes, Balance', 'Long enough stride for a 90-degree front knee, torso stays tall.', 'Push through the front heel.', 'Add a dumbbell or front-rack hold.', 'Stationary reverse lunge instead of walking.', 'Reduce stride length as balance shifts.', 'published'),
('Leg Press', 'Quads, Glutes', 'Full range of motion without rounding the low back.', 'Drive through the whole foot.', 'Add a pause at the bottom.', 'Reduce range of motion.', 'Adjust seat position for comfort as needed.', 'published'),
('Seated Leg Curl', 'Hamstrings', 'Full range of motion, controlled tempo.', 'Squeeze at full contraction.', 'Slow 3-second eccentric.', 'Reduce load.', 'Sub standing or seated cable curl if lying flat is uncomfortable.', 'published'),
('Standing Calf Raise', 'Calves', 'Full stretch at the bottom, full contraction at the top.', 'Pause at the top of every rep.', 'Single-leg version.', 'Reduce range of motion.', 'Safe as prescribed.', 'published'),
('Hanging Knee Raise', 'Core', 'Avoid swinging, control the descent.', 'Curl the pelvis, do not just lift the legs.', 'Straight-leg raise for more difficulty.', 'Standing cable crunch instead.', 'Sub standing pallof press.', 'published'),
('Kettlebell Swing', 'Posterior Chain, Conditioning', 'Hinge, do not squat; hips drive the bell.', 'Snap the hips, not the arms.', 'Increase bell weight.', 'Reduce weight, focus on hinge pattern.', 'Remove; sub banded hip hinge.', 'published'),
('Push-Up', 'Chest, Triceps, Core', 'Straight line from head to heels, full range of motion.', 'Brace the core like a plank.', 'Elevate feet.', 'Incline push-up against a bench or wall.', 'Incline version as belly grows.', 'published'),
('Goblet Squat', 'Quads, Glutes', 'Elbows inside the knees at depth, chest tall.', 'Sit down, not back.', 'Add a pause at depth.', 'Box squat to a target height.', 'To comfortable depth only.', 'published'),
('Bent-Over Dumbbell Row', 'Back', 'Flat back, hinge at the hips, pull to the hip.', 'Lead with the elbow.', 'Add a pause at the top.', 'Chest-supported row instead.', 'Chest-supported row instead of bent-over.', 'published'),
('Mountain Climbers', 'Core, Conditioning', 'Hips stay level, drive knees to chest.', 'Quick feet, stable core.', 'Increase pace.', 'Slow controlled tempo.', 'Remove; sub standing marching in place.', 'published'),
('Plank Hold', 'Core', 'Straight line from head to heels, no sagging hips.', 'Squeeze glutes and brace core.', 'Add a shoulder tap.', 'Knee plank.', 'Reduce hold time; stop if any doming or pressure.', 'published'),
('Deadlift', 'Full Posterior Chain', 'Bar over mid-foot, lats engaged before the pull, hips and shoulders rise together.', 'Push the floor away.', 'Add a deficit or pause at the knee.', 'Trap-bar or rack pull from knee height.', 'Cap load conservatively; sub sumo-stance or cable pull-through as belly grows.', 'published'),
('Hip Thrust', 'Glutes', 'Chin tucked, drive through the heels, full lockout at the top.', 'Squeeze glutes hard at the top.', 'Add a pause at lockout.', 'Reduce load.', 'Monitor for pubic symphysis discomfort; stop if present.', 'published'),
('Single-Leg RDL', 'Hamstrings, Balance', 'Hinge at the hip, back leg reaches long, shoulders stay square.', 'Reach the floor, do not rotate.', 'Add a dumbbell.', 'Hold onto a wall or rack for balance support.', 'Reduce range and hold support as balance shifts.', 'published'),
('Cable Pull-Through', 'Glutes, Hamstrings', 'Hinge at the hips, cable stays close to the body.', 'Squeeze glutes to finish.', 'Increase load.', 'Reduce load.', 'Safe as prescribed at moderate load.', 'published'),
('Pallof Press', 'Anti-Rotation Core', 'Resist rotation, press straight out and back.', 'Brace like someone is trying to twist you.', 'Add a pause at full extension.', 'Reduce band tension.', 'Safe as prescribed.', 'published'),
('Cable Woodchop', 'Rotational Core', 'Rotate through the torso, hips follow.', 'Power from the core, not the arms.', 'Increase load.', 'Reduce load.', 'Remove after first trimester; sub bird-dog.', 'published'),
('Interval Conditioning (Bike/Row)', 'Conditioning', 'Consistent pace on work intervals, full recovery on rest.', 'Push the work interval, truly rest on the rest interval.', 'Increase interval intensity or reduce rest.', 'Reduce interval intensity or extend rest.', 'Keep effort conversational; avoid true intervals.', 'published'),
('Bodyweight Finisher Circuit', 'Full-Body Conditioning', 'Smooth and controlled beats fast and sloppy.', 'Pace, do not race.', 'Add rounds or reduce rest.', 'Reduce rounds or extend rest.', 'Reduce to a slow, conversational-pace circuit.', 'published')
on conflict do nothing;

-- 4b. Workouts (gym setting; the base model assumes full gym access --
-- duplicate + adjust for mobile clients once you have a specific one)
insert into public.workouts (title, category, description, status, setting)
values
('Cutting -- Upper Body Strength', 'Upper Body', 'Day 1 of the Cutting base model. Phase 1 numbers: 10-12 reps, 60s rest.', 'published', 'gym'),
('Cutting -- Lower Body Strength', 'Lower Body', 'Day 2 of the Cutting base model. Phase 1 numbers: 10-12 reps, 60s rest.', 'published', 'gym'),
('Cutting -- Full-Body Metabolic Conditioning', 'Full-Body', 'Day 4 of the Cutting base model. Circuit format, 3-4 rounds, 90s rest between rounds.', 'published', 'both'),
('Cutting -- Posterior Chain + Core', 'Lower Body', 'Day 5 of the Cutting base model. Phase 1 numbers: 10-12 reps, 60-90s rest.', 'published', 'gym'),
('Cutting -- Conditioning Finisher', 'Conditioning', 'Day 6 of the Cutting base model. 15-20 minutes, rotate weekly between intervals and circuit.', 'published', 'both')
on conflict do nothing;

-- 4c. Workout exercises (sort_order, sets, reps, rest -- Phase 1 numbers)
with w as (select id, title from public.workouts where title like 'Cutting --%'),
     e as (select id, name from public.exercise_library)
insert into public.workout_exercises (workout_id, exercise_id, sort_order, sets, reps, rest_seconds)
select w.id, e.id, x.sort_order, x.sets, x.reps, x.rest_seconds
from (values
    ('Cutting -- Upper Body Strength', 'Barbell Bench Press', 0, 4, '8-12', 75),
    ('Cutting -- Upper Body Strength', 'Chest-Supported Row', 1, 4, '8-12', 75),
    ('Cutting -- Upper Body Strength', 'Seated Overhead Press', 2, 3, '8-10', 60),
    ('Cutting -- Upper Body Strength', 'Lat Pulldown', 3, 3, '10-12', 55),
    ('Cutting -- Upper Body Strength', 'Incline Dumbbell Press', 4, 3, '10-12', 55),
    ('Cutting -- Upper Body Strength', 'Cable Face Pull', 5, 3, '15', 35),
    ('Cutting -- Upper Body Strength', 'Standing Cable Curl', 6, 2, '12-15', 30),
    ('Cutting -- Upper Body Strength', 'Rope Tricep Pushdown', 7, 2, '12-15', 30),
    ('Cutting -- Lower Body Strength', 'Back Squat', 0, 4, '8-12', 90),
    ('Cutting -- Lower Body Strength', 'Romanian Deadlift', 1, 4, '8-12', 90),
    ('Cutting -- Lower Body Strength', 'Walking Lunge', 2, 3, '10/leg', 60),
    ('Cutting -- Lower Body Strength', 'Leg Press', 3, 3, '10-12', 60),
    ('Cutting -- Lower Body Strength', 'Seated Leg Curl', 4, 3, '12-15', 45),
    ('Cutting -- Lower Body Strength', 'Standing Calf Raise', 5, 3, '15-20', 35),
    ('Cutting -- Lower Body Strength', 'Hanging Knee Raise', 6, 3, '12-15', 30),
    ('Cutting -- Full-Body Metabolic Conditioning', 'Kettlebell Swing', 0, 4, '15', 0),
    ('Cutting -- Full-Body Metabolic Conditioning', 'Push-Up', 1, 4, '12-15', 0),
    ('Cutting -- Full-Body Metabolic Conditioning', 'Goblet Squat', 2, 4, '12', 0),
    ('Cutting -- Full-Body Metabolic Conditioning', 'Bent-Over Dumbbell Row', 3, 4, '12/side', 0),
    ('Cutting -- Full-Body Metabolic Conditioning', 'Mountain Climbers', 4, 4, '30s', 0),
    ('Cutting -- Full-Body Metabolic Conditioning', 'Plank Hold', 5, 4, '30-45s', 90),
    ('Cutting -- Posterior Chain + Core', 'Deadlift', 0, 4, '6-8', 100),
    ('Cutting -- Posterior Chain + Core', 'Hip Thrust', 1, 3, '10-12', 60),
    ('Cutting -- Posterior Chain + Core', 'Single-Leg RDL', 2, 3, '10/leg', 60),
    ('Cutting -- Posterior Chain + Core', 'Cable Pull-Through', 3, 3, '12-15', 45),
    ('Cutting -- Posterior Chain + Core', 'Pallof Press', 4, 3, '12/side', 30),
    ('Cutting -- Posterior Chain + Core', 'Cable Woodchop', 5, 3, '12/side', 30),
    ('Cutting -- Conditioning Finisher', 'Interval Conditioning (Bike/Row)', 0, 1, '10-14 rounds', 0),
    ('Cutting -- Conditioning Finisher', 'Bodyweight Finisher Circuit', 1, 4, '40s work/20s rest', 60)
) as x(workout_title, exercise_name, sort_order, sets, reps, rest_seconds)
join w on w.title = x.workout_title
join e on e.name = x.exercise_name
where not exists (
    select 1 from public.workout_exercises we
    where we.workout_id = w.id and we.exercise_id = e.id
);

-- 4d. Program template
insert into public.program_templates (title, goal, description, duration_weeks, status)
values ('Cutting -- 12-Week Base Model', 'cutting', 'Fat loss while preserving lean muscle and strength. Base model -- personalize per client before assigning.', 12, 'published')
on conflict do nothing;

-- 4e. 12-week calendar: Day 1 (Mon), Day 2 (Tue), Day 4 (Thu), Day 5 (Fri), Day 6 (Sat)
-- repeat the same 5 workouts across all 12 weeks (progression happens through
-- coaching execution per the periodization table, not through separate
-- workout rows -- see docs/coaching-programs/01-cutting-12-week.md)
with pt as (select id from public.program_templates where title = 'Cutting -- 12-Week Base Model'),
     w as (select id, title from public.workouts where title like 'Cutting --%'),
     slots as (
         select * from (values
             (1, 'Cutting -- Upper Body Strength'),
             (2, 'Cutting -- Lower Body Strength'),
             (4, 'Cutting -- Full-Body Metabolic Conditioning'),
             (5, 'Cutting -- Posterior Chain + Core'),
             (6, 'Cutting -- Conditioning Finisher')
         ) as s(day_number, workout_title)
     ),
     weeks as (select generate_series(1, 12) as week_number)
insert into public.program_template_workouts (program_template_id, week_number, day_number, workout_id)
select pt.id, weeks.week_number, slots.day_number, w.id
from pt, weeks, slots
join w on w.title = slots.workout_title
where not exists (
    select 1 from public.program_template_workouts ptw
    where ptw.program_template_id = pt.id
    and ptw.week_number = weeks.week_number
    and ptw.day_number = slots.day_number
);

-- =========================================================
-- Verification
-- =========================================================
select
    (select count(*) from public.equipment_inventory where category = 'Mobile Kit') as mobile_kit_items,
    (select count(*) from public.exercise_library where status = 'published') as published_exercises,
    (select count(*) from public.workouts where title like 'Cutting --%') as cutting_workouts,
    (select count(*) from public.program_template_workouts ptw join public.program_templates pt on pt.id = ptw.program_template_id where pt.title = 'Cutting -- 12-Week Base Model') as cutting_calendar_rows;
