-- ============================================================
-- Echelon Fitness Collective -- Remaining Base Programs Seed
-- ============================================================
-- Seeds the Workout Library (exercise_library, workouts,
-- workout_exercises, program_templates, program_template_workouts)
-- for the 5 base programs not yet live: Weight Loss, Bulking,
-- Muscle (Hypertrophy), Performance, and Older-Adult Wellness.
-- Cutting is already live via database/supabase-mobile-plugandplay.sql.
--
-- Run this whole file once in the Supabase SQL Editor (paste, then Run).
-- Every insert is idempotent (on conflict do nothing / where not exists),
-- so it is safe to re-run if anything fails partway through.
-- ============================================================


-- ================================================================
-- WEIGHT LOSS
-- ================================================================
-- Weight Loss program -- full live seed (exercises, workouts,
-- workout_exercises, program template, and the 12-week calendar), following
-- the same pattern as the Cutting program in database/supabase-mobile-plugandplay.sql.
--
-- Run this whole file once in the Supabase SQL Editor (paste, then Run).
-- Source content: docs/coaching-programs/02-weight-loss-12-week.md (Phase 1 numbers).
-- Only Day 1, Day 3, and Day 5 are seeded as structured workouts -- Days 2, 4,
-- and 6 are walk-based cardio homework, not exercise-list workouts.

-- =========================================================
-- 1a. Exercises
-- =========================================================
insert into public.exercise_library (name, target_area, form_cues, coaching_cues, modification_up, modification_down, modification_pregnancy, status)
values
('Goblet Squat', 'Quads, Glutes', 'Hold the weight at chest height, sit down to a comfortable depth, chest stays tall and heels stay planted.', 'Own the movement before we add weight; consistency beats a big number in week one.', 'Add a slow 3-1-1 tempo round through once form is confident.', 'Chair-assisted squat: sit to a box and stand back up until depth confidence builds.', 'Squat to a comfortable depth only and avoid pushing to end range as balance shifts.', 'published'),
('Seated Row (Machine or Cable)', 'Back', 'Shoulder blades pull together and down, avoid shrugging, control the return.', 'Pull the elbows back, not just the hands.', 'Add a 2-second squeeze at full contraction.', 'Reduce load and prioritize a full, controlled range of motion.', 'Safe as prescribed; keep the torso upright rather than leaning back to move more weight.', 'published'),
('Incline Push-Up (or Flat Bench Press)', 'Chest, Triceps', 'Hands slightly wider than shoulders, straight line from head to heels, full range of motion.', 'Brace the core like a plank the whole rep.', 'Progress from incline toward flat bench press as strength builds.', 'Raise the incline angle (counter or wall) to reduce the load on the push.', 'Use standing cable or band press instead of any position that puts you flat on your back after the first trimester.', 'published'),
('Glute Bridge', 'Glutes, Hamstrings', 'Feet hip-width, drive through the heels, squeeze at the top without overarching the low back.', 'Think tuck and squeeze at the top of every rep.', 'Add a resistance band above the knees or a light barbell across the hips.', 'Reduce range of motion or hold for a shorter top squeeze.', 'Safe as prescribed; stop if lying on the back causes lightheadedness after the first trimester and sub standing hip hinge.', 'published'),
('Assisted or Band-Resisted Plank', 'Core', 'Straight line from head to heels, ribs down, no sagging or piking hips.', 'Brace like someone is about to poke your stomach.', 'Add light band resistance across the hips or a short shoulder tap.', 'Drop to a knee plank or hold from the forearms on an elevated surface.', 'Skip prone plank positions; sub standing pallof press for anti-extension core work.', 'published'),
('Leg Press or Split Squat', 'Quads, Glutes', 'Full range of motion without rounding the low back, knees track over the toes.', 'Drive through the whole foot, not just the toes.', 'Add a 2-second pause at the bottom of the range.', 'Use the seated leg press instead of split squat if balance is a concern.', 'Adjust seat position or stance width for comfort as the belly grows; cap load conservatively.', 'published'),
('Lat Pulldown', 'Back, Biceps', 'Lead with the elbows, avoid leaning back excessively to move the weight.', 'Pull the bar to the collarbone, not the neck.', 'Slow the eccentric to 3 seconds on every rep.', 'Use a band pull-apart instead if grip or shoulder access is limited.', 'Safe as prescribed at a moderate, controlled intensity.', 'published'),
('Seated Shoulder Press (Machine or Dumbbell)', 'Shoulders', 'Ribs down, core braced, press straight overhead without arching the low back.', 'Press through the crown of the head.', 'Move to a standing version once core control is confident.', 'Reduce range of motion or load if shoulder impingement is present.', 'Cap RPE at 6 and keep the seated, back-supported version rather than standing.', 'published'),
('Standing Hip Hinge (Light RDL or Cable Pull-Through)', 'Hamstrings, Glutes', 'Hinge at the hips with soft knees, weight stays close to the legs.', 'Push the hips back, not down.', 'Add light load or slow the eccentric to 3-4 seconds.', 'Reduce range of motion and load, focus on the hinge pattern only.', 'Cap load light and stop the pattern entirely if it ever feels compressive.', 'published'),
('Standing Bicycle Crunch (Controlled)', 'Core', 'Controlled tempo, opposite elbow drives to the opposite knee without rushing.', 'Slow and controlled beats fast every time here.', 'Add a light ankle weight or slow the tempo further.', 'Reduce range of motion or hold onto a wall for balance.', 'Replace with standing marching in place for gentle core engagement.', 'published'),
('Standing Row (Band or Cable)', 'Back', 'Feet split for a stable base, pull elbows back and squeeze the shoulder blades together.', 'Pace, do not race, on the circuit round.', 'Increase band tension or cable load.', 'Reduce band tension or cable load.', 'Safe as prescribed at a controlled, conversational pace.', 'published'),
('Wall or Incline Push-Up', 'Chest, Triceps', 'Straight line from head to heels, full range of motion, hands slightly wider than shoulders.', 'Pace, do not race; the goal is elevated heart rate with controlled breathing.', 'Lower the incline angle to add load.', 'Raise the incline angle or move to a wall for the easiest regression.', 'Keep the wall or steep incline version throughout to avoid any horizontal or face-down position.', 'published'),
('Step-Up (Low Step)', 'Glutes, Balance', 'Full foot on the step, drive through the heel, avoid pushing off the trailing leg.', 'Stand tall out of the top, do not lean forward to muscle it up.', 'Raise the step height or add a dumbbell.', 'Lower the step height and hold a rail or rack for balance support.', 'Reduce step height and hold support as balance shifts.', 'published'),
('Dead Bug', 'Core', 'Low back stays pressed into the floor, opposite arm and leg extend together under control.', 'Move only as far as you can keep the low back flat.', 'Add a light dumbbell or band for resistance.', 'Reduce range of motion, keep knees bent at 90 degrees throughout.', 'Safe as prescribed; skip if lying on the back causes discomfort and sub standing marching in place.', 'published')
on conflict do nothing;

-- =========================================================
-- 1b. Workouts (gym setting; the base model assumes full gym access --
-- duplicate + adjust for mobile clients once you have a specific one)
-- =========================================================
insert into public.workouts (title, category, description, status, setting)
values
('Weight Loss -- Full-Body Strength A', 'Full-Body', 'Day 1 of the Weight Loss base model. Phase 1 numbers: 12-15 reps, 60-90s rest.', 'published', 'gym'),
('Weight Loss -- Full-Body Strength B', 'Full-Body', 'Day 3 of the Weight Loss base model. Phase 1 numbers: 12-15 reps, 60-90s rest.', 'published', 'gym'),
('Weight Loss -- Full-Body Strength C', 'Full-Body', 'Day 5 of the Weight Loss base model. Phase 1 numbers: 12-15 reps, 45-60s rest. Light circuit round introduced once a client has 4+ weeks of consistency.', 'published', 'gym')
on conflict do nothing;

-- =========================================================
-- 1c. Workout exercises (sort_order, sets, reps, rest -- Phase 1 numbers)
-- =========================================================
with w as (select id, title from public.workouts where title like 'Weight Loss --%'),
     e as (select id, name from public.exercise_library)
insert into public.workout_exercises (workout_id, exercise_id, sort_order, sets, reps, rest_seconds)
select w.id, e.id, x.sort_order, x.sets, x.reps, x.rest_seconds
from (values
    ('Weight Loss -- Full-Body Strength A', 'Goblet Squat', 0, 3, '12-15', 60),
    ('Weight Loss -- Full-Body Strength A', 'Seated Row (Machine or Cable)', 1, 3, '12-15', 60),
    ('Weight Loss -- Full-Body Strength A', 'Incline Push-Up (or Flat Bench Press)', 2, 3, '10-15', 60),
    ('Weight Loss -- Full-Body Strength A', 'Glute Bridge', 3, 3, '15', 45),
    ('Weight Loss -- Full-Body Strength A', 'Assisted or Band-Resisted Plank', 4, 3, '20-30s', 30),
    ('Weight Loss -- Full-Body Strength B', 'Leg Press or Split Squat', 0, 3, '12-15', 60),
    ('Weight Loss -- Full-Body Strength B', 'Lat Pulldown', 1, 3, '12-15', 60),
    ('Weight Loss -- Full-Body Strength B', 'Seated Shoulder Press (Machine or Dumbbell)', 2, 3, '10-12', 60),
    ('Weight Loss -- Full-Body Strength B', 'Standing Hip Hinge (Light RDL or Cable Pull-Through)', 3, 3, '12', 60),
    ('Weight Loss -- Full-Body Strength B', 'Standing Bicycle Crunch (Controlled)', 4, 3, '12/side', 30),
    ('Weight Loss -- Full-Body Strength C', 'Goblet Squat', 0, 3, '15', 60),
    ('Weight Loss -- Full-Body Strength C', 'Standing Row (Band or Cable)', 1, 3, '15', 60),
    ('Weight Loss -- Full-Body Strength C', 'Wall or Incline Push-Up', 2, 3, '12-15', 60),
    ('Weight Loss -- Full-Body Strength C', 'Step-Up (Low Step)', 3, 3, '10/leg', 60),
    ('Weight Loss -- Full-Body Strength C', 'Dead Bug', 4, 3, '10/side', 30)
) as x(workout_title, exercise_name, sort_order, sets, reps, rest_seconds)
join w on w.title = x.workout_title
join e on e.name = x.exercise_name
where not exists (
    select 1 from public.workout_exercises we
    where we.workout_id = w.id and we.exercise_id = e.id
);

-- =========================================================
-- 1d. Program template
-- =========================================================
insert into public.program_templates (title, goal, description, duration_weeks, status)
values ('Weight Loss -- 12-Week Base Model', 'weight-loss', 'Sustainable fat loss and habit-building for clients starting (or restarting) their fitness journey. Base model -- personalize load, exercise selection, and walking targets per client before assigning.', 12, 'published')
on conflict do nothing;

-- =========================================================
-- 1e. 12-week calendar: Day 1, Day 3, Day 5 (Days 2, 4, 6 are walk-based
-- cardio homework, not seeded as workout rows -- see the "Weekly Split" and
-- "Walk-Based Cardio" sections of docs/coaching-programs/02-weight-loss-12-week.md)
-- repeat the same 3 workouts across all 12 weeks (progression happens through
-- coaching execution per the periodization table, not through separate
-- workout rows)
-- =========================================================
with pt as (select id from public.program_templates where title = 'Weight Loss -- 12-Week Base Model'),
     w as (select id, title from public.workouts where title like 'Weight Loss --%'),
     slots as (
         select * from (values
             (1, 'Weight Loss -- Full-Body Strength A'),
             (3, 'Weight Loss -- Full-Body Strength B'),
             (5, 'Weight Loss -- Full-Body Strength C')
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
    (select count(*) from public.exercise_library where name in (
        'Goblet Squat', 'Seated Row (Machine or Cable)', 'Incline Push-Up (or Flat Bench Press)',
        'Glute Bridge', 'Assisted or Band-Resisted Plank', 'Leg Press or Split Squat', 'Lat Pulldown',
        'Seated Shoulder Press (Machine or Dumbbell)', 'Standing Hip Hinge (Light RDL or Cable Pull-Through)',
        'Standing Bicycle Crunch (Controlled)', 'Standing Row (Band or Cable)', 'Wall or Incline Push-Up',
        'Step-Up (Low Step)', 'Dead Bug'
    )) as weight_loss_exercises,
    (select count(*) from public.workouts where title like 'Weight Loss --%') as weight_loss_workouts,
    (select count(*) from public.program_template_workouts ptw join public.program_templates pt on pt.id = ptw.program_template_id where pt.title = 'Weight Loss -- 12-Week Base Model') as weight_loss_calendar_rows;


-- ================================================================
-- BULKING
-- ================================================================
-- =========================================================
-- Seed: Bulking 12-Week Base Model workout library content.
-- Inserts exercises, workouts, workout_exercises, program template,
-- and the 12-week calendar for Bulking (Days 1, 2, 4, 5 -- Day 6 is
-- an intentionally unstructured, coach-personalized accessory day
-- per docs/coaching-programs/03-bulking-12-week.md, not seeded here).
-- Run once in the Supabase SQL Editor; safe to re-run.
-- =========================================================

-- =========================================================
-- 1. Exercises
-- =========================================================
insert into public.exercise_library (name, target_area, form_cues, coaching_cues, modification_up, modification_down, modification_pregnancy, status)
values
('Barbell Bench Press', 'Chest, Triceps', 'Full range of motion to the chest, retract shoulder blades, drive the bar in a straight line without clipping depth for extra plates.', 'Load the muscle, not the ego, full ROM every rep even as the bar gets heavier.', 'Add a 2-second pause at the chest or a 1-1/4 rep to increase time under tension.', 'Machine chest press if joint stress from free-weight pressing is a limiter.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Standing Barbell Overhead Press', 'Shoulders, Triceps', 'Ribs down and core braced before the bar leaves the shoulders, bar path stays close to the face on the way up.', 'Press through the crown of the head, drive the whole body, not just the arms.', 'Add a brief pause at the top lockout each rep.', 'Landmine press or machine shoulder press if standing overhead pressing irritates the shoulder.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Incline Dumbbell Press', 'Upper Chest', 'Set the bench to 30-45 degrees, control the descent, and press the dumbbells together at the top.', 'Squeeze the dumbbells toward each other to keep the upper chest working.', 'Add a 2-second pause at the bottom of each rep.', 'Reduce range of motion or switch to a machine incline press.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Dumbbell Lateral Raise', 'Side Delts', 'Slight bend in the elbow, raise to shoulder height, lead with the elbows rather than the hands.', 'Pour the water out of the top of the dumbbell at the top of the rep.', 'Add a 1-2 second pause at shoulder height.', 'Lighten the load and use cable lateral raises for more constant tension.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Dips', 'Triceps, Chest', 'Lean slightly forward for chest emphasis, descend until the shoulder reaches elbow height, avoid excessive shoulder flare.', 'Control the descent, do not just drop and bounce out of the bottom.', 'Add a weight belt or dumbbell between the feet.', 'Bench dips or an assisted dip machine to manage bodyweight load.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Rope Tricep Pushdown', 'Triceps', 'Elbows pinned to the sides, split the rope apart at the bottom of the rep.', 'Full lockout every rep, no swinging the torso for momentum.', 'Add a 1-2 second pause at full lockout.', 'Reduce load and keep elbows fixed rather than letting them drift forward.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Back Squat', 'Quads, Glutes', 'Brace before the descent, knees track over the toes, hips and chest rise together out of the hole.', 'Spread the floor apart with the feet on the way down and the way up.', 'Add a 2-second pause at depth or a 1-1/4 rep.', 'Front-foot-elevated split squat or leg press as the primary quad driver if squat mobility is limited.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Leg Press', 'Quads, Glutes', 'Full range of motion without the low back rounding off the pad.', 'Drive through the whole foot, not just the toes.', 'Add a 2-second pause at the bottom of each rep.', 'Reduce range of motion and load if knee or low-back discomfort shows up.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Walking Lunge', 'Quads, Glutes', 'Long enough stride for a 90-degree front knee, torso stays tall through the whole rep.', 'Push through the front heel to drive back up.', 'Add a front-rack dumbbell or barbell hold.', 'Stationary reverse lunge instead of walking to manage balance demand.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Leg Extension', 'Quads', 'Full range of motion, pause briefly at full extension without locking out violently.', 'Squeeze the quad hard at the top of every rep.', 'Add a 2-second pause at full extension.', 'Reduce load and range of motion if knee discomfort is present.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Standing Calf Raise', 'Calves', 'Full stretch at the bottom, full contraction at the top of every rep.', 'Pause at the top of the rep rather than bouncing through it.', 'Single-leg version to increase per-leg load.', 'Reduce range of motion and load.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Weighted Pull-Up', 'Lats, Biceps', 'Full hang at the bottom, chin clears the bar at the top, avoid excessive kipping.', 'Pull the elbows down and back, think about bringing the chest to the bar.', 'Add a weight belt or dumbbell between the feet.', 'Lat pulldown at a manageable assist level until pulling strength is built.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Chest-Supported Row', 'Back', 'Chest stays pinned to the pad, pull the elbows back and down, squeeze the shoulder blades together.', 'Pull the bar apart for lat engagement rather than yanking with the arms.', 'Add a 2-second squeeze at the top of each rep.', 'Band-assisted rows or reduce range of motion if grip or shoulder is a limiter.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Single-Arm Dumbbell Row', 'Lats', 'Flat back, brace against the bench, pull the elbow up and back rather than rotating the torso.', 'Lead with the elbow, squeeze the shoulder blade at the top.', 'Add a 1-2 second pause at the top of each rep.', 'Reduce load and prioritize a controlled, full range of motion.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Cable Face Pull', 'Rear Delts', 'Pull to eye level and externally rotate at the end of the movement.', 'Lead with the elbows high, think about pulling the rope apart.', 'Add a pause at full contraction.', 'Lighten the load and prioritize form over the number on the stack.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Barbell Curl', 'Biceps', 'Elbows pinned to the sides, no swinging or leaning back to move the weight.', 'Squeeze at the top of every rep, control the way down.', 'Slow 3-second eccentric on every rep.', 'Dumbbell curls or reduce load to remove swing from the movement.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Hammer Curl', 'Biceps, Forearms', 'Neutral grip throughout, elbows stay pinned to the sides.', 'Squeeze the forearm at the top of every rep.', 'Add a 2-second pause at the top.', 'Reduce load and keep strict form.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Deadlift', 'Posterior Chain', 'Bar over mid-foot, lats engaged before the pull, hips and shoulders rise together.', 'Push the floor away rather than yanking the bar off the ground.', 'Add a deficit or a pause at the knee.', 'Trap-bar deadlift or rack pull from a comfortable pin height while hinge mechanics are built.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Hip Thrust', 'Glutes', 'Chin tucked, drive through the heels, full lockout with glutes squeezed at the top.', 'Squeeze glutes hard at the top of every rep, do not just push through the low back.', 'Add a 2-second pause at lockout.', 'Reduce load and range of motion.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Romanian Deadlift', 'Hamstrings, Glutes', 'Hinge at the hips with soft knees, bar stays close to the legs on the way down.', 'Push the hips back, not down, feel the hamstrings load before reversing.', 'Slow 4-second eccentric on every rep.', 'Reduce range of motion or load if hamstring flexibility limits the hinge.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Seated Leg Curl', 'Hamstrings', 'Full range of motion with a controlled tempo on the way back up.', 'Squeeze the hamstring hard at full contraction.', 'Slow 3-second eccentric on every rep.', 'Reduce load and prioritize full range of motion.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published'),
('Weighted Hanging Leg Raise', 'Core', 'Curl the pelvis and lift with the lower abs rather than swinging the legs.', 'Control the descent, avoid using momentum to reset for the next rep.', 'Add a light dumbbell between the feet.', 'Bodyweight hanging knee raise or a standing cable crunch to remove the hip flexor demand.', 'Bulking is not an appropriate goal during pregnancy; redirect to Weight Loss or a maintenance-focused personalized plan instead of modifying this lift.', 'published')
on conflict do nothing;

-- =========================================================
-- 2. Workouts (gym setting -- Bulking is a heavy-compound program
-- that assumes full gym access)
-- =========================================================
insert into public.workouts (title, category, description, status, setting)
values
('Bulking -- Upper Body A', 'Upper Body', 'Day 1 of the Bulking base model. Push-emphasis. Phase 1 numbers: 6-15 reps, 45-120s rest.', 'published', 'gym'),
('Bulking -- Lower Body A', 'Lower Body', 'Day 2 of the Bulking base model. Quad-emphasis. Phase 1 numbers: 6-15 reps, 45-120s rest.', 'published', 'gym'),
('Bulking -- Upper Body B', 'Upper Body', 'Day 4 of the Bulking base model. Pull-emphasis. Phase 1 numbers: 6-15 reps, 30-120s rest.', 'published', 'gym'),
('Bulking -- Lower Body B', 'Lower Body', 'Day 5 of the Bulking base model. Posterior-emphasis. Phase 1 numbers: 5-15 reps, 45-150s rest.', 'published', 'gym')
on conflict do nothing;

-- =========================================================
-- 3. Workout exercises (sort_order, sets, reps, rest -- Phase 1 numbers
-- taken from each exercise's own row in docs/coaching-programs/03-bulking-12-week.md)
-- =========================================================
with w as (select id, title from public.workouts where title like 'Bulking --%'),
     e as (select id, name from public.exercise_library)
insert into public.workout_exercises (workout_id, exercise_id, sort_order, sets, reps, rest_seconds)
select w.id, e.id, x.sort_order, x.sets, x.reps, x.rest_seconds
from (values
    ('Bulking -- Upper Body A', 'Barbell Bench Press', 0, 4, '6-10', 120),
    ('Bulking -- Upper Body A', 'Standing Barbell Overhead Press', 1, 4, '6-10', 105),
    ('Bulking -- Upper Body A', 'Incline Dumbbell Press', 2, 3, '10-12', 90),
    ('Bulking -- Upper Body A', 'Dumbbell Lateral Raise', 3, 3, '12-15', 45),
    ('Bulking -- Upper Body A', 'Dips', 4, 3, '8-12', 60),
    ('Bulking -- Upper Body A', 'Rope Tricep Pushdown', 5, 3, '12-15', 45),
    ('Bulking -- Lower Body A', 'Back Squat', 0, 4, '6-10', 120),
    ('Bulking -- Lower Body A', 'Leg Press', 1, 4, '10-12', 90),
    ('Bulking -- Lower Body A', 'Walking Lunge', 2, 3, '10/leg', 60),
    ('Bulking -- Lower Body A', 'Leg Extension', 3, 3, '12-15', 45),
    ('Bulking -- Lower Body A', 'Standing Calf Raise', 4, 4, '12-15', 35),
    ('Bulking -- Upper Body B', 'Weighted Pull-Up', 0, 4, '6-10', 120),
    ('Bulking -- Upper Body B', 'Chest-Supported Row', 1, 4, '8-10', 90),
    ('Bulking -- Upper Body B', 'Single-Arm Dumbbell Row', 2, 3, '10-12/side', 60),
    ('Bulking -- Upper Body B', 'Cable Face Pull', 3, 3, '15', 45),
    ('Bulking -- Upper Body B', 'Barbell Curl', 4, 3, '10-12', 45),
    ('Bulking -- Upper Body B', 'Hammer Curl', 5, 2, '12-15', 30),
    ('Bulking -- Lower Body B', 'Deadlift', 0, 4, '5-8', 150),
    ('Bulking -- Lower Body B', 'Hip Thrust', 1, 4, '8-10', 90),
    ('Bulking -- Lower Body B', 'Romanian Deadlift', 2, 3, '8-10', 90),
    ('Bulking -- Lower Body B', 'Seated Leg Curl', 3, 3, '12-15', 45),
    ('Bulking -- Lower Body B', 'Weighted Hanging Leg Raise', 4, 3, '10-12', 45)
) as x(workout_title, exercise_name, sort_order, sets, reps, rest_seconds)
join w on w.title = x.workout_title
join e on e.name = x.exercise_name
where not exists (
    select 1 from public.workout_exercises we
    where we.workout_id = w.id and we.exercise_id = e.id
);

-- =========================================================
-- 4. Program template
-- =========================================================
insert into public.program_templates (title, goal, description, duration_weeks, status)
values ('Bulking -- 12-Week Base Model', 'bulking', 'General mass gain, maximize total tissue growth (muscle plus some fat) with a simpler, higher-volume approach. Base model -- personalize per client before assigning.', 12, 'published')
on conflict do nothing;

-- =========================================================
-- 5. 12-week calendar: Day 1 (Upper Body A), Day 2 (Lower Body A),
-- Day 4 (Upper Body B), Day 5 (Lower Body B). Day 3, 6, 7 are rest,
-- optional accessory, and rest respectively and are not seeded --
-- repeat the same 4 workouts across all 12 weeks (progression happens
-- through coaching execution per the periodization table, not through
-- separate workout rows -- see docs/coaching-programs/03-bulking-12-week.md)
-- =========================================================
with pt as (select id from public.program_templates where title = 'Bulking -- 12-Week Base Model'),
     w as (select id, title from public.workouts where title like 'Bulking --%'),
     slots as (
         select * from (values
             (1, 'Bulking -- Upper Body A'),
             (2, 'Bulking -- Lower Body A'),
             (4, 'Bulking -- Upper Body B'),
             (5, 'Bulking -- Lower Body B')
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
    (select count(*) from public.exercise_library where status = 'published') as published_exercises,
    (select count(*) from public.workouts where title like 'Bulking --%') as bulking_workouts,
    (select count(*) from public.program_template_workouts ptw join public.program_templates pt on pt.id = ptw.program_template_id where pt.title = 'Bulking -- 12-Week Base Model') as bulking_calendar_rows;


-- ================================================================
-- MUSCLE HYPERTROPHY
-- ================================================================
-- =========================================================
-- Muscle (Hypertrophy) 12-Week Base Model -- workout library seed.
-- Seeds exercise_library, workouts, workout_exercises, program_templates,
-- and program_template_workouts for the Muscle program, following the
-- same pattern as the Cutting seed in supabase-mobile-plugandplay.sql.
-- Run once in the Supabase SQL Editor. Safe to re-run (on conflict do
-- nothing / where not exists guards throughout).
-- Source: docs/coaching-programs/04-muscle-hypertrophy-12-week.md
-- Uses Phase 1 (Volume Base, weeks 1-4) numbers per the periodization table.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Exercises
-- ---------------------------------------------------------
insert into public.exercise_library (name, target_area, form_cues, coaching_cues, modification_up, modification_down, modification_pregnancy, status)
values
('Incline Barbell or Dumbbell Press', 'Upper Chest', 'Set the bench to 30-45 degrees, drive the bar or dumbbells up and slightly back over the upper chest.', 'Squeeze through the top third of the rep.', 'Add a 2-second pause at the bottom.', 'Reduce range of motion or drop to machine incline press.', 'Sub standing incline cable press after first trimester; cap RPE at 6-7.', 'published'),
('Flat Dumbbell Press', 'Chest', 'Elbows at roughly 45 degrees from the torso, press dumbbells up and slightly together.', 'Feel the chest close, not just the arms extend.', 'Add a 2-second pause at the chest.', 'Reduce range of motion or use machine chest press.', 'Sub incline press after first trimester; cap RPE at 6.', 'published'),
('Seated Dumbbell Shoulder Press', 'Shoulders', 'Back supported, press dumbbells up and slightly in without flaring the ribs.', 'Press through the crown of the head.', 'Add a 2-second pause at lockout.', 'Reduce range of motion or drop to machine shoulder press.', 'Cap RPE at 6-7; avoid unsupported standing version.', 'published'),
('Cable Fly', 'Chest', 'Slight bend in the elbows held constant, sweep the hands together in an arc.', 'Squeeze the chest at the finish, do not just move the hands.', 'Add a 1-second squeeze at peak contraction.', 'Reduce cable weight or shorten the range of motion.', 'Safe as prescribed at light-to-moderate load.', 'published'),
('Lateral Raise', 'Side Delts', 'Slight bend in the elbows, raise to shoulder height leading with the elbows.', 'Pour the water out at the top, thumbs tilt down.', 'Add a 1-second pause at the top.', 'Reduce weight and prioritize strict form.', 'Safe as prescribed.', 'published'),
('Overhead Tricep Extension', 'Triceps', 'Elbows stay close to the head, lower the weight behind the head under control.', 'Stretch the triceps fully before pressing back up.', 'Add a 2-second eccentric.', 'Switch to rope pushdown to remove overhead shoulder demand.', 'Sub rope pushdown; avoid overhead loading as belly grows.', 'published'),
('Rope Tricep Pushdown', 'Triceps', 'Elbows pinned to the sides, split the rope at the bottom.', 'Full lockout every rep.', 'Add a pause at lockout.', 'Reduce load.', 'Safe as prescribed.', 'published'),
('Lat Pulldown (wide grip)', 'Lats', 'Wide overhand grip, lead with the elbows down and back, avoid leaning back excessively.', 'Pull the bar to the collarbone, not the neck.', 'Slow 3-second eccentric.', 'Narrow the grip or reduce weight and prioritize full range of motion.', 'Safe as prescribed at moderate intensity.', 'published'),
('Chest-Supported Row', 'Lats, Rhomboids, Rear Delts', 'Chest stays pinned to the pad, pull elbows back and down, squeeze shoulder blades.', 'Pull the bar apart for lat engagement.', 'Add a 2-second squeeze at the top.', 'Reduce range of motion if shoulder is limited.', 'Safe as prescribed; reduce load if uncomfortable.', 'published'),
('Single-Arm Cable Row', 'Lats, Rhomboids', 'Brace against the machine, pull the handle to the hip while keeping the torso still.', 'Lead with the elbow, avoid rotating the torso.', 'Add a 1-second squeeze at the hip.', 'Reduce load or use both arms together on a standard row.', 'Safe as prescribed; reduce load if uncomfortable.', 'published'),
('Straight-Arm Pulldown', 'Lats', 'Arms stay nearly straight, sweep the bar down to the thighs using the lats.', 'Think about pulling with the armpit, not the arms.', 'Add a 1-second squeeze at the bottom.', 'Reduce load and shorten the range of motion.', 'Safe as prescribed at light-to-moderate load.', 'published'),
('Face Pull', 'Rear Delts', 'Pull to eye level, externally rotate at the end.', 'Lead with the elbows high.', 'Add a pause at full contraction.', 'Lighten load and prioritize form.', 'Safe as prescribed.', 'published'),
('Incline Dumbbell Curl', 'Biceps', 'Seated on an incline bench, arms hang straight down, curl without swinging the shoulders forward.', 'Feel the stretch at the bottom of every rep.', 'Slow 3-second eccentric.', 'Switch to standing curl to remove the stretch-position demand.', 'Safe as prescribed.', 'published'),
('Cable Curl', 'Biceps', 'Elbows pinned to the sides, curl through a full range without swinging.', 'Squeeze at the top of every rep.', 'Slow 3-second eccentric.', 'Reduce load.', 'Safe as prescribed.', 'published'),
('Hack Squat or Leg Press', 'Quads', 'Feet mid-platform, lower until thighs are just past parallel without the low back rounding off the pad.', 'Drive through the whole foot, knees track over the toes.', 'Add a 2-second pause at depth.', 'Reduce range of motion or use standard leg press.', 'Reduce range of motion and load; adjust seat/back angle for comfort as needed.', 'published'),
('Front Squat (or Goblet Squat)', 'Quads, Core', 'Elbows high and chest tall, brace before descent, sit down between the hips.', 'Own the bottom position, do not just fall into it.', 'Add a 2-second pause at depth.', 'Drop to goblet squat with a dumbbell or kettlebell.', 'Goblet squat only, to comfortable depth.', 'published'),
('Walking Lunge', 'Quads, Glutes, Balance', 'Long enough stride for a 90-degree front knee, torso stays tall.', 'Push through the front heel.', 'Add a dumbbell or front-rack hold.', 'Stationary reverse lunge instead of walking.', 'Reduce stride length as balance shifts.', 'published'),
('Leg Extension', 'Quads', 'Pad rests just above the ankle, extend to full lockout without swinging the torso.', 'Squeeze the quads hard at the top of every rep.', 'Add a 1-second pause at lockout.', 'Reduce load and shorten the range of motion.', 'Safe as prescribed at moderate load.', 'published'),
('Seated Calf Raise', 'Calves', 'Full stretch at the bottom, full contraction at the top, knees stay bent throughout.', 'Pause at the top of every rep.', 'Add a 2-second pause at the top.', 'Reduce range of motion.', 'Safe as prescribed.', 'published'),
('Flat Barbell Press', 'Chest', 'Feet flat, shoulder blades pinned and down, bar path touches low chest, drive floor through feet.', 'Rip the floor for leg drive.', 'Add a 2-second pause at the chest.', 'Machine chest press.', 'Sub incline press after first trimester; cap RPE at 6.', 'published'),
('Weighted Pull-Up or Lat Pulldown', 'Lats', 'Full hang to chin over the bar, or matched range of motion on the pulldown.', 'Lead with the elbows, chest to the bar.', 'Add external load via a dip belt.', 'Use the pulldown machine or add assistance.', 'Sub assisted or machine pulldown at a comfortable load.', 'published'),
('Seated Cable Row', 'Back', 'Chest tall, pull to the sternum while keeping the torso still, avoid rocking.', 'Lead with the elbows, squeeze the shoulder blades together.', 'Add a 2-second squeeze at the finish.', 'Reduce load and shorten the range of motion.', 'Safe as prescribed; reduce load if uncomfortable.', 'published'),
('Arnold Press', 'Shoulders', 'Start palms facing you, rotate to palms-forward as you press overhead.', 'Control the rotation, do not rush it.', 'Add a 1-second pause at lockout.', 'Switch to standard dumbbell press to remove the rotation.', 'Cap RPE at 6; sub seated supported press.', 'published'),
('Cable Crossover', 'Chest', 'Slight bend in the elbows, cross the hands in front of the body at the bottom.', 'Squeeze the chest together, not just the arms.', 'Add a 1-second squeeze at the crossover point.', 'Reduce cable weight or shorten the range of motion.', 'Safe as prescribed at light-to-moderate load.', 'published'),
('Hammer Curl', 'Biceps', 'Neutral grip throughout, curl without swinging the elbows forward.', 'Squeeze at the top of every rep.', 'Slow 3-second eccentric.', 'Reduce load.', 'Safe as prescribed.', 'published'),
('Skull Crusher', 'Triceps', 'Elbows stay fixed and pointed at the ceiling, lower the bar to the forehead under control.', 'Elbows are the hinge, nothing else moves.', 'Add a 2-second eccentric.', 'Switch to rope pushdown to remove the elbow-loading position.', 'Sub rope pushdown; avoid loaded elbow flexion as belly grows.', 'published'),
('Romanian Deadlift', 'Hamstrings, Glutes, Lower Back', 'Hinge at the hips, soft knees, bar stays close to the legs.', 'Push the hips back, not down.', 'Slow 4-second eccentric.', 'Reduce range of motion or load.', 'Cap load conservatively; stop if any discomfort.', 'published'),
('Hip Thrust', 'Glutes', 'Chin tucked, drive through the heels, full lockout at the top.', 'Squeeze glutes hard at the top.', 'Add a pause at lockout.', 'Reduce load.', 'Monitor for pubic symphysis discomfort; stop if present.', 'published'),
('Seated Leg Curl', 'Hamstrings', 'Full range of motion, controlled tempo.', 'Squeeze at full contraction.', 'Slow 3-second eccentric.', 'Reduce load.', 'Sub standing or seated cable curl if lying flat is uncomfortable.', 'published'),
('Cable Pull-Through', 'Glutes, Hamstrings', 'Hinge at the hips, cable stays close to the body.', 'Squeeze glutes to finish.', 'Increase load.', 'Reduce load.', 'Safe as prescribed at moderate load.', 'published'),
('Standing Calf Raise', 'Calves', 'Full stretch at the bottom, full contraction at the top.', 'Pause at the top of every rep.', 'Single-leg version.', 'Reduce range of motion.', 'Safe as prescribed.', 'published'),
('Cable Woodchop', 'Rotational Core', 'Rotate through the torso, hips follow.', 'Power from the core, not the arms.', 'Increase load.', 'Reduce load.', 'Remove after first trimester; sub bird-dog.', 'published')
on conflict do nothing;

-- ---------------------------------------------------------
-- 2. Workouts (gym setting; base model assumes full gym access)
-- ---------------------------------------------------------
insert into public.workouts (title, category, description, status, setting)
values
('Muscle -- Push', 'Upper Body', 'Day 1 of the Muscle (Hypertrophy) base model. Chest, shoulders, triceps. Phase 1 numbers: 8-15 reps, 30-75s rest, RPE 6-7.', 'published', 'gym'),
('Muscle -- Pull', 'Upper Body', 'Day 2 of the Muscle (Hypertrophy) base model. Back, biceps. Phase 1 numbers: 10-15 reps, 30-75s rest, RPE 6-7.', 'published', 'gym'),
('Muscle -- Legs (Quad-Emphasis)', 'Lower Body', 'Day 3 of the Muscle (Hypertrophy) base model. Quad-dominant lower body. Phase 1 numbers: 8-20 reps, 30-90s rest, RPE 6-7.', 'published', 'gym'),
('Muscle -- Upper (Balanced Push/Pull)', 'Upper Body', 'Day 5 of the Muscle (Hypertrophy) base model. Balanced push/pull upper body. Phase 1 numbers: 8-15 reps, 45-75s rest, RPE 6-7.', 'published', 'gym'),
('Muscle -- Legs (Posterior-Emphasis)', 'Lower Body', 'Day 6 of the Muscle (Hypertrophy) base model. Posterior-chain-dominant lower body. Phase 1 numbers: 8-15 reps, 30-90s rest, RPE 6-7.', 'published', 'gym')
on conflict do nothing;

-- ---------------------------------------------------------
-- 3. Workout exercises (sort_order, sets, reps, rest -- Phase 1 numbers)
-- ---------------------------------------------------------
with w as (select id, title from public.workouts where title like 'Muscle --%'),
     e as (select id, name from public.exercise_library)
insert into public.workout_exercises (workout_id, exercise_id, sort_order, sets, reps, rest_seconds)
select w.id, e.id, x.sort_order, x.sets, x.reps, x.rest_seconds
from (values
    ('Muscle -- Push', 'Incline Barbell or Dumbbell Press', 0, 4, '8-12', 75),
    ('Muscle -- Push', 'Flat Dumbbell Press', 1, 3, '10-12', 60),
    ('Muscle -- Push', 'Seated Dumbbell Shoulder Press', 2, 3, '10-12', 60),
    ('Muscle -- Push', 'Cable Fly', 3, 3, '12-15', 45),
    ('Muscle -- Push', 'Lateral Raise', 4, 4, '12-15', 40),
    ('Muscle -- Push', 'Overhead Tricep Extension', 5, 3, '12-15', 45),
    ('Muscle -- Push', 'Rope Tricep Pushdown', 6, 2, '15', 30),
    ('Muscle -- Pull', 'Lat Pulldown (wide grip)', 0, 4, '10-12', 75),
    ('Muscle -- Pull', 'Chest-Supported Row', 1, 3, '10-12', 60),
    ('Muscle -- Pull', 'Single-Arm Cable Row', 2, 3, '12/side', 45),
    ('Muscle -- Pull', 'Straight-Arm Pulldown', 3, 3, '12-15', 45),
    ('Muscle -- Pull', 'Face Pull', 4, 3, '15', 30),
    ('Muscle -- Pull', 'Incline Dumbbell Curl', 5, 3, '10-12', 45),
    ('Muscle -- Pull', 'Cable Curl', 6, 2, '12-15', 30),
    ('Muscle -- Legs (Quad-Emphasis)', 'Hack Squat or Leg Press', 0, 4, '10-12', 80),
    ('Muscle -- Legs (Quad-Emphasis)', 'Front Squat (or Goblet Squat)', 1, 3, '8-10', 90),
    ('Muscle -- Legs (Quad-Emphasis)', 'Walking Lunge', 2, 3, '10/leg', 60),
    ('Muscle -- Legs (Quad-Emphasis)', 'Leg Extension', 3, 4, '12-15', 45),
    ('Muscle -- Legs (Quad-Emphasis)', 'Seated Calf Raise', 4, 4, '15-20', 30),
    ('Muscle -- Upper (Balanced Push/Pull)', 'Flat Barbell Press', 0, 3, '8-10', 75),
    ('Muscle -- Upper (Balanced Push/Pull)', 'Weighted Pull-Up or Lat Pulldown', 1, 3, '8-10', 75),
    ('Muscle -- Upper (Balanced Push/Pull)', 'Seated Cable Row', 2, 3, '10-12', 60),
    ('Muscle -- Upper (Balanced Push/Pull)', 'Arnold Press', 3, 3, '10-12', 60),
    ('Muscle -- Upper (Balanced Push/Pull)', 'Cable Crossover', 4, 3, '12-15', 45),
    ('Muscle -- Upper (Balanced Push/Pull)', 'Hammer Curl', 5, 3, '12', 0),
    ('Muscle -- Upper (Balanced Push/Pull)', 'Skull Crusher', 6, 3, '12', 45),
    ('Muscle -- Legs (Posterior-Emphasis)', 'Romanian Deadlift', 0, 4, '8-10', 90),
    ('Muscle -- Legs (Posterior-Emphasis)', 'Hip Thrust', 1, 4, '10-12', 75),
    ('Muscle -- Legs (Posterior-Emphasis)', 'Seated Leg Curl', 2, 3, '12-15', 45),
    ('Muscle -- Legs (Posterior-Emphasis)', 'Cable Pull-Through', 3, 3, '12-15', 45),
    ('Muscle -- Legs (Posterior-Emphasis)', 'Standing Calf Raise', 4, 4, '12-15', 30),
    ('Muscle -- Legs (Posterior-Emphasis)', 'Cable Woodchop', 5, 3, '12/side', 30)
) as x(workout_title, exercise_name, sort_order, sets, reps, rest_seconds)
join w on w.title = x.workout_title
join e on e.name = x.exercise_name
where not exists (
    select 1 from public.workout_exercises we
    where we.workout_id = w.id and we.exercise_id = e.id
);

-- ---------------------------------------------------------
-- 4. Program template
-- ---------------------------------------------------------
insert into public.program_templates (title, goal, description, duration_weeks, status)
values ('Muscle -- 12-Week Base Model', 'muscle-hypertrophy', 'Precision muscle growth at maintenance-to-slight-surplus calories, a refined hypertrophy approach for clients who already carry decent muscle and want targeted growth without the fat-gain tradeoff of a full Bulking block. Base model -- personalize per client before assigning.', 12, 'published')
on conflict do nothing;

-- ---------------------------------------------------------
-- 5. 12-week calendar: Day 1 (Push), Day 2 (Pull), Day 3 (Legs Quad),
-- Day 5 (Upper), Day 6 (Legs Posterior). Day 4 is rest/light mobility --
-- intentionally not seeded. Repeat the same 5 workouts across all 12
-- weeks (progression happens through coaching execution per the
-- periodization table, not through separate workout rows -- see
-- docs/coaching-programs/04-muscle-hypertrophy-12-week.md)
-- ---------------------------------------------------------
with pt as (select id from public.program_templates where title = 'Muscle -- 12-Week Base Model'),
     w as (select id, title from public.workouts where title like 'Muscle --%'),
     slots as (
         select * from (values
             (1, 'Muscle -- Push'),
             (2, 'Muscle -- Pull'),
             (3, 'Muscle -- Legs (Quad-Emphasis)'),
             (5, 'Muscle -- Upper (Balanced Push/Pull)'),
             (6, 'Muscle -- Legs (Posterior-Emphasis)')
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
    (select count(*) from public.exercise_library where status = 'published') as published_exercises,
    (select count(*) from public.workouts where title like 'Muscle --%') as muscle_workouts,
    (select count(*) from public.program_template_workouts ptw join public.program_templates pt on pt.id = ptw.program_template_id where pt.title = 'Muscle -- 12-Week Base Model') as muscle_calendar_rows;


-- ================================================================
-- PERFORMANCE
-- ================================================================
-- Seeds the "Performance" 12-week program into the live Workout Library
-- (exercise_library, workouts, workout_exercises, program_templates,
-- program_template_workouts), following the same pattern as the Cutting
-- seed in database/supabase-mobile-plugandplay.sql (section 4).
--
-- Run this whole file once in the Supabase SQL Editor (paste, then Run).
-- Safe to re-run: uses ON CONFLICT DO NOTHING / WHERE NOT EXISTS everywhere it matters.
--
-- Source: docs/coaching-programs/05-performance-12-week.md
-- Days seeded as formal workouts: Day 1, Day 2, Day 4, Day 5 (Phase 1 numbers).
-- Day 6 ("Optional sport-specific skill work") is intentionally NOT seeded --
-- per the source doc it is personalized per client/sport, not a base-model workout.

-- =========================================================
-- 1. Exercises
-- =========================================================
insert into public.exercise_library (name, target_area, form_cues, coaching_cues, modification_up, modification_down, modification_pregnancy, status)
values
-- Day 1: Power + Lower Strength
('Box Jump', 'Power, Lower Body', 'Land soft, knees tracking over toes, absorb through the whole foot; a loud landing means the box is too high.', 'Quality over quantity, the first sign of declining jump height ends the exercise for the day.', 'Increase box height only once landings are consistently silent and controlled.', 'Step-up in place of the jump until landing mechanics are reliable.', 'Not appropriate during pregnancy -- redirect to a personalized low-impact plan.', 'published'),
('Trap-Bar Deadlift', 'Power, Posterior Chain', 'Chest tall, brace before the pull, stand up through the handles without rounding the low back.', 'Move the bar away from the floor as fast as control allows, speed is the training effect.', 'Progress to trap-bar jumps once hinge mechanics and landing control are established (Phase 2+).', 'Reduce load and rebuild the hinge pattern before adding bar speed.', 'Cap load conservatively and stop once the belly interferes with bar path; sub sumo-stance or cable pull-through.', 'published'),
('Back Squat', 'Quads, Glutes', 'Brace before descent, knees track over toes, hips and chest rise together with intent out of the hole.', 'Move the bar with speed on the way up, bar velocity is the target here, not just the load.', 'Add accommodating resistance (bands or chains) once bar speed under straight weight is consistent.', 'Goblet squat regression while the squat pattern is being built.', 'Goblet squat only, to a comfortable depth; skip max-intent bar speed work.', 'published'),
('Bulgarian Split Squat', 'Unilateral Strength, Quads, Glutes', 'Rear foot elevated, front shin stays vertical, descend under control without the back knee slamming down.', 'Drive through the front heel, keep the torso tall through the whole rep.', 'Add dumbbells or a front-rack kettlebell hold.', 'Lower the rear-foot elevation or reduce range of motion.', 'Hold a wall or rack for balance support as center of gravity shifts; reduce range of motion.', 'published'),
('Nordic Curl', 'Hamstring Injury Resilience', 'Ankles anchored, hips stay in a straight line, lower under control and catch yourself with the hands at the bottom.', 'Fight the descent the whole way down, the eccentric is the point, not the number of reps.', 'Slow the eccentric further or reduce how much the hands assist the catch.', 'Sub eccentric-emphasis machine leg curl until hamstring strength supports bodyweight Nordics.', 'Sub seated or standing cable leg curl instead of a prone/kneeling position.', 'published'),
-- Day 2: Speed/Agility + Conditioning
('Acceleration Sprints', 'Speed', 'Drive knees forward and down, stay low and build to tall posture over the first several strides.', 'Sprint work is trained fresh, first, and fast; never after a fatiguing strength session, and never for volume at the cost of technique.', 'Extend distance slightly once acceleration mechanics through 10-20m are clean.', 'Reduce sprint distance and add more recovery between reps.', 'Not appropriate during pregnancy -- redirect to a personalized low-impact plan.', 'published'),
('Lateral Shuffle / Agility Ladder', 'Agility, Footwork', 'Stay low with hips loaded, quick ground contacts, eyes up rather than looking down at the feet.', 'Feet stay quiet and precise, speed comes after the pattern is clean, not before.', 'Increase speed through the pattern once footwork stays clean under fatigue.', 'Slow the pattern down and rebuild footwork before adding speed.', 'Not appropriate during pregnancy -- redirect to a personalized low-impact plan.', 'published'),
('Cone Change-of-Direction Drill', 'Agility', 'Plant the outside foot, drop the hips, and drive out of the cut in the new direction.', 'Decelerate under control before every cut, a sloppy plant is how knees get hurt.', 'Add a reactive/called cue (partner or light signal) instead of a fixed pattern.', 'Widen the cone spacing and slow the pace until the plant-and-cut is controlled.', 'Not appropriate during pregnancy -- redirect to a personalized low-impact plan.', 'published'),
('Sled Push or Prowler', 'Power Endurance', 'Shins angled into the sled, drive through the whole foot, stay long through the torso rather than folding at the waist.', 'Push, do not jog behind it, every step should still be a drive.', 'Increase load or distance.', 'Reduce load, or sub a bike or row if lower-body loading needs to be managed.', 'Not appropriate during pregnancy -- redirect to a personalized low-impact plan.', 'published'),
('Sprint Interval Finisher', 'Anaerobic Capacity', 'Hold the same effort on every work interval, do not let pace drift down as fatigue builds.', 'Push the work interval hard, truly rest on the rest interval, that contrast is what drives the adaptation.', 'Increase rounds or shorten the rest interval.', 'Reduce rounds or lengthen the rest interval.', 'Sub brisk walking intervals or stationary bike at a conversational pace.', 'published'),
-- Day 4: Power + Upper Strength
('Medicine Ball Chest Pass', 'Upper Power', 'Load the ball at the chest, extend through the arms and release with full-body intent, catch and reset.', 'Throw it, do not just push it, every rep is a maximal-intent release.', 'Increase ball weight or add a step-in for more force.', 'Standing medicine ball scoop toss instead of chest pass if throwing power is a new pattern.', 'Not appropriate during pregnancy -- redirect to a personalized low-impact plan.', 'published'),
('Weighted Pull-Up', 'Back, Power-Pulling', 'Full hang at the bottom, pull the chest to the bar, avoid kipping for a strength-focused rep.', 'Pull with intent through the whole range, no half reps.', 'Add load via a belt or vest.', 'Band-assisted or bodyweight pull-up, or lat pulldown while pulling strength is being built.', 'Sub lat pulldown at a conservative load, avoid full hang loading as the pregnancy progresses.', 'published'),
('Barbell Bench Press', 'Chest, Triceps', 'Feet flat, shoulder blades pinned and down, bar path touches the chest, drive the floor through the feet.', 'Move the bar fast off the chest, bar speed is the training target here.', 'Add accommodating resistance or reduce rest between sets.', 'Machine chest press instead of barbell bench while building pressing capacity.', 'Sub incline or machine press after the first trimester; cap effort well below max intent.', 'published'),
('Single-Arm Landmine Press', 'Shoulders, Core Stability', 'Brace the core against the rotation, press up and slightly across the body, avoid leaning back.', 'Resist the twist, the core has to work as hard as the shoulder.', 'Add a half-kneeling or standing split stance for more core demand.', 'Reduce load or press from a seated/supported position.', 'Reduce load and stop if any pressure or coning is noticed through the midline.', 'published'),
('Face Pull', 'Shoulder Health, Rear Delts', 'Pull to eye level, lead with the elbows high, externally rotate at the end of the pull.', 'Squeeze the shoulder blades together and hold briefly at full contraction.', 'Add a pause at full contraction or slow the eccentric.', 'Lighten the load and prioritize the end-range rotation over speed.', 'Safe as prescribed at a moderate load.', 'published'),
-- Day 5: Conditioning + Core/Stability
('Farmer''s Carry', 'Grip, Core, Total-Body Stability', 'Tall posture, shoulders packed down and back, ribs stacked over hips, walk with even, controlled steps.', 'Brace like someone could shove you from any direction and you would not move.', 'Increase load or distance.', 'Reduce load or distance.', 'Conservative load and shorter distance if grip and core pressure allow comfortably.', 'published'),
('Pallof Press', 'Anti-Rotation Core', 'Resist rotation, press straight out and back without letting the torso twist toward the anchor.', 'Brace like someone is trying to twist you and you will not let them.', 'Increase band tension or add a half-kneeling stance.', 'Reduce band tension or shorten the lever by pressing from closer to the chest.', 'Safe as prescribed.', 'published'),
('Single-Leg RDL', 'Balance, Posterior Chain', 'Hinge at the hip, the back leg reaches long, shoulders stay square to the floor.', 'Reach the floor, do not rotate the hips open to get there.', 'Add a dumbbell or kettlebell.', 'Hold onto a wall or rack for balance support.', 'Sub standing single-leg balance work once single-leg RDL balance is compromised.', 'published'),
('Battle Ropes / Assault Bike Intervals', 'Conditioning', 'Consistent wave amplitude or cadence for the full interval, brace the core rather than letting the low back sway.', 'Match effort to the clock, go hard on work, truly recover on rest.', 'Increase wave amplitude/bike resistance or shorten rest.', 'Reduce intensity or lengthen rest.', 'Cap effort at a conversational pace, not true intervals.', 'published'),
('Plank Variations', 'Core Endurance', 'Straight line from head to heels, no sagging hips or piking, brace as if about to be poked in the stomach.', 'Quality over duration, stop the set the moment form breaks down.', 'Add a shoulder tap, limb lift, or unstable surface.', 'Knee plank or shorten the hold time.', 'Reduce hold time; stop if any doming or downward pressure through the midline.', 'published')
on conflict do nothing;

-- =========================================================
-- 2. Workouts (gym setting; base model assumes full facility access --
-- Day 2's sprint work needs outdoor/track space, called out in its description)
-- =========================================================
insert into public.workouts (title, category, description, status, setting)
values
('Performance -- Power + Lower Strength', 'Lower Body', 'Day 1 of the Performance base model. Phase 1 numbers: power work 4-5 reps at full recovery, strength work 4-6 reps, 60-150s rest by movement.', 'published', 'gym'),
('Performance -- Speed/Agility + Conditioning', 'Conditioning', 'Day 2 of the Performance base model. Phase 1 numbers: sprint/agility volume with full recovery between efforts, finisher intervals :20 on/:40 off. Requires outdoor space or track access for sprint work; sled/agility drills can run on open gym floor.', 'published', 'gym'),
('Performance -- Power + Upper Strength', 'Upper Body', 'Day 4 of the Performance base model. Phase 1 numbers: power work 4-5 reps at full recovery, strength work 4-6 reps, 45-120s rest by movement.', 'published', 'gym'),
('Performance -- Conditioning + Core/Stability', 'Conditioning', 'Day 5 of the Performance base model. Phase 1 numbers: carries and core work 3-4 sets, conditioning intervals :20 on/:40 off.', 'published', 'gym')
on conflict do nothing;

-- =========================================================
-- 3. Workout exercises (sort_order, sets, reps, rest -- Phase 1 numbers)
-- =========================================================
with w as (select id, title from public.workouts where title like 'Performance --%'),
     e as (select id, name from public.exercise_library)
insert into public.workout_exercises (workout_id, exercise_id, sort_order, sets, reps, rest_seconds)
select w.id, e.id, x.sort_order, x.sets, x.reps, x.rest_seconds
from (values
    ('Performance -- Power + Lower Strength', 'Box Jump', 0, 4, '5', 90),
    ('Performance -- Power + Lower Strength', 'Trap-Bar Deadlift', 1, 4, '3-5', 150),
    ('Performance -- Power + Lower Strength', 'Back Squat', 2, 4, '4-6', 120),
    ('Performance -- Power + Lower Strength', 'Bulgarian Split Squat', 3, 3, '8/leg', 70),
    ('Performance -- Power + Lower Strength', 'Nordic Curl', 4, 3, '6-8', 60),
    ('Performance -- Speed/Agility + Conditioning', 'Acceleration Sprints', 0, 6, '10-20m', 150),
    ('Performance -- Speed/Agility + Conditioning', 'Lateral Shuffle / Agility Ladder', 1, 1, '4-6 sets', 75),
    ('Performance -- Speed/Agility + Conditioning', 'Cone Change-of-Direction Drill', 2, 1, '4-6x', 90),
    ('Performance -- Speed/Agility + Conditioning', 'Sled Push or Prowler', 3, 4, '20m', 90),
    ('Performance -- Speed/Agility + Conditioning', 'Sprint Interval Finisher', 4, 1, '8-10 rounds, :20 on/:40 off', 0),
    ('Performance -- Power + Upper Strength', 'Medicine Ball Chest Pass', 0, 4, '5', 90),
    ('Performance -- Power + Upper Strength', 'Weighted Pull-Up', 1, 4, '4-6', 120),
    ('Performance -- Power + Upper Strength', 'Barbell Bench Press', 2, 4, '4-6', 120),
    ('Performance -- Power + Upper Strength', 'Single-Arm Landmine Press', 3, 3, '8/side', 60),
    ('Performance -- Power + Upper Strength', 'Face Pull', 4, 3, '15', 45),
    ('Performance -- Conditioning + Core/Stability', 'Farmer''s Carry', 0, 4, '30m', 75),
    ('Performance -- Conditioning + Core/Stability', 'Pallof Press', 1, 3, '12/side', 30),
    ('Performance -- Conditioning + Core/Stability', 'Single-Leg RDL', 2, 3, '8/leg', 55),
    ('Performance -- Conditioning + Core/Stability', 'Battle Ropes / Assault Bike Intervals', 3, 8, ':20 on/:40 off', 0),
    ('Performance -- Conditioning + Core/Stability', 'Plank Variations', 4, 3, '30-45s', 30)
) as x(workout_title, exercise_name, sort_order, sets, reps, rest_seconds)
join w on w.title = x.workout_title
join e on e.name = x.exercise_name
where not exists (
    select 1 from public.workout_exercises we
    where we.workout_id = w.id and we.exercise_id = e.id
);

-- =========================================================
-- 4. Program template
-- =========================================================
insert into public.program_templates (title, goal, description, duration_weeks, status)
values ('Performance -- 12-Week Base Model', 'performance', 'Athletic conditioning, power, speed, agility, and work capacity for a client training for a sport, event, or general athleticism, not primarily for aesthetics. Strength is trained as a means to power output, not as the end goal. Base model -- personalize load, plyometric volume, and sport-specific conditioning per client before assigning.', 12, 'published')
on conflict do nothing;

-- =========================================================
-- 5. 12-week calendar: Day 1 (Mon), Day 2 (Tue), Day 4 (Thu), Day 5 (Fri)
-- Day 3, 6, 7 are rest/mobility/optional sport-specific work and are not
-- seeded as formal workouts -- repeat the same 4 workouts across all 12
-- weeks (progression happens through coaching execution per the
-- periodization table, not through separate workout rows -- see
-- docs/coaching-programs/05-performance-12-week.md)
-- =========================================================
with pt as (select id from public.program_templates where title = 'Performance -- 12-Week Base Model'),
     w as (select id, title from public.workouts where title like 'Performance --%'),
     slots as (
         select * from (values
             (1, 'Performance -- Power + Lower Strength'),
             (2, 'Performance -- Speed/Agility + Conditioning'),
             (4, 'Performance -- Power + Upper Strength'),
             (5, 'Performance -- Conditioning + Core/Stability')
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
    (select count(*) from public.exercise_library where status = 'published') as published_exercises,
    (select count(*) from public.workouts where title like 'Performance --%') as performance_workouts,
    (select count(*) from public.program_template_workouts ptw join public.program_templates pt on pt.id = ptw.program_template_id where pt.title = 'Performance -- 12-Week Base Model') as performance_calendar_rows;


-- ================================================================
-- OLDER ADULT WELLNESS
-- ================================================================
-- Older-Adult Wellness program: full live seed (exercises, workouts,
-- workout_exercises, program template, and the 12-week calendar).
-- Run this whole file once in the Supabase SQL Editor (paste, then Run).
-- Safe to re-run: uses ON CONFLICT DO NOTHING / WHERE NOT EXISTS everywhere it matters.

-- =========================================================
-- 1. Exercises
-- =========================================================
insert into public.exercise_library (name, target_area, form_cues, coaching_cues, modification_up, modification_down, modification_pregnancy, status)
values
('Sit-to-Stand (chair squat)', 'Quads, Glutes, Functional Strength', 'Lean forward from the hips before rising, push through the whole foot, and control the descent back into the chair rather than dropping.', 'Steady and strong beats fast and heavy, every rep is coached for control first.', 'Once comfortable and controlled without hands, add a light dumbbell held at the chest or remove hand support entirely.', 'Keep a hand lightly on the chair arms or a nearby wall for as long as needed, there is no rush to remove support.', 'Not the target population for this base model -- see the Weight Loss or a personalized plan for pregnancy-specific programming.', 'published'),
('Seated Row (machine or band)', 'Back, Posture', 'Sit tall, drive elbows back and down, squeeze the shoulder blades together at the finish.', 'Posture first, pull the chest proud rather than yanking with the arms.', 'Increase band tension or machine weight in small increments once form is consistently clean.', 'Use the lightest band or machine setting and prioritize full, pain-free range of motion over resistance.', 'Not the target population for this base model -- see the Weight Loss or a personalized plan for pregnancy-specific programming.', 'published'),
('Wall or Incline Push-Up', 'Chest, Triceps', 'Hands slightly wider than shoulders, body stays in a straight line, lower under control and press back to start.', 'Smooth and controlled, no need to rush the lockout.', 'Move from wall to an inclined surface (counter or bench) as strength improves for greater load.', 'Stay at the wall and shorten the range of motion if shoulders are uncomfortable.', 'Not the target population for this base model -- see the Weight Loss or a personalized plan for pregnancy-specific programming.', 'published'),
('Standing Marching (hip flexion)', 'Balance, Hip Strength', 'Stand tall, lift the knee to hip height with control, avoid leaning back to compensate.', 'Quality over height, a smaller controlled lift beats a high sloppy one.', 'Add a light ankle weight or hold the top position for one to two seconds.', 'Hold a chair or counter for support and reduce knee height as needed.', 'Not the target population for this base model -- see the Weight Loss or a personalized plan for pregnancy-specific programming.', 'published'),
('Single-Leg Stand (hand support as needed)', 'Balance', 'Eyes forward, core gently braced, weight centered over the standing foot.', 'Steady wins, a long stable hold beats a wobbly unsupported one.', 'Reduce hand contact to fingertip support, then no support, only once fully steady.', 'Keep a full hand on a chair or counter for the entire hold, and remove support only when it is clearly safe to do so, this is never a race.', 'Not the target population for this base model -- see the Weight Loss or a personalized plan for pregnancy-specific programming.', 'published'),
('Step-Up (low, stable step)', 'Quads, Glutes, Stair Function', 'Drive through the full foot on the step, control the descent, avoid pushing off the trailing leg.', 'Think "quiet feet", a controlled step down is as important as the step up.', 'Increase step height slightly or add a light dumbbell once the movement is fully controlled.', 'Use a lower step and keep a hand on a rail or wall for balance.', 'Not the target population for this base model -- see the Weight Loss or a personalized plan for pregnancy-specific programming.', 'published'),
('Seated or Standing Band Row', 'Back, Posture', 'Pull elbows back and down, squeeze shoulder blades, avoid shrugging the shoulders up.', 'Pull from the back, not the arms.', 'Increase band tension or add a brief pause at full contraction.', 'Use the lightest band and perform seated for extra stability.', 'Not the target population for this base model -- see the Weight Loss or a personalized plan for pregnancy-specific programming.', 'published'),
('Seated Overhead Press (light dumbbell or band)', 'Shoulders', 'Ribs down, press straight overhead without arching the low back.', 'Press tall, brace the core rather than leaning back.', 'Progress to a slightly heavier dumbbell or band once the movement is pain-free and controlled.', 'Reduce range of motion to a comfortable arc, especially with any shoulder history.', 'Not the target population for this base model -- see the Weight Loss or a personalized plan for pregnancy-specific programming.', 'published'),
('Heel-to-Toe Walk (hand support as needed)', 'Balance, Gait', 'Place the heel directly in front of the opposite toe, eyes forward, arms out for balance.', 'Slow and steady, this is about control, not speed.', 'Progress from a countertop to no hand support once consistently steady.', 'Walk alongside a countertop or rail for continuous light support the entire distance.', 'Not the target population for this base model -- see the Weight Loss or a personalized plan for pregnancy-specific programming.', 'published'),
('Standing Hip Abduction (band)', 'Hip Stability, Falls Prevention', 'Stand tall, lift the leg straight out to the side without leaning the torso.', 'Small and controlled, the hips do the work, not momentum.', 'Increase band tension or add a brief pause at the top.', 'Hold a chair or counter for support and reduce range of motion as needed.', 'Not the target population for this base model -- see the Weight Loss or a personalized plan for pregnancy-specific programming.', 'published'),
('Sit-to-Stand (with slight pause at top)', 'Quads, Glutes', 'Rise to full standing, pause briefly at the top to find balance, then lower with control.', 'Own the top of the rep, the pause builds real-world stability, not just strength.', 'Add a light dumbbell held at the chest once the pause feels stable and controlled.', 'Keep a hand on the chair arms throughout and skip the pause until standing feels fully stable.', 'Not the target population for this base model -- see the Weight Loss or a personalized plan for pregnancy-specific programming.', 'published'),
('Standing Row (band, both arms)', 'Back', 'Anchor the band, pull both elbows back evenly, keep the chest tall throughout.', 'Squeeze the shoulder blades together, not just the arms.', 'Increase band tension in small increments as strength builds.', 'Use the lightest band and perform seated if standing balance is a concern.', 'Not the target population for this base model -- see the Weight Loss or a personalized plan for pregnancy-specific programming.', 'published'),
('Standing Chest Press (band)', 'Chest', 'Anchor the band behind, press straight out at chest height, avoid locking the elbows hard.', 'Press and control the return, the band fights back on both halves of the rep.', 'Increase band tension once the movement is smooth and pain-free.', 'Use the lightest band and perform seated if standing balance is a concern.', 'Not the target population for this base model -- see the Weight Loss or a personalized plan for pregnancy-specific programming.', 'published'),
('Farmer''s Carry (light, short distance)', 'Grip, Functional Carrying Strength', 'Stand tall, shoulders back, walk with even, controlled steps, avoid leaning to one side.', 'Posture over pace, a slow steady carry beats a rushed one.', 'Increase load slightly or extend the carry distance once posture stays solid throughout.', 'Shorten the distance and use a very light load, the focus is grip and posture, not the training stimulus.', 'Not the target population for this base model -- see the Weight Loss or a personalized plan for pregnancy-specific programming.', 'published'),
('Gentle Cardio (stationary bike or treadmill walk)', 'Cardiovascular Health', 'Maintain an upright posture, breathing should stay conversational throughout.', 'If you cannot hold a conversation, the pace is too high, ease back.', 'Extend duration by a few minutes or add gentle resistance on the bike.', 'Use a recumbent bike instead of a treadmill for anyone with balance concerns during cardio.', 'Not the target population for this base model -- see the Weight Loss or a personalized plan for pregnancy-specific programming.', 'published')
on conflict do nothing;

-- =========================================================
-- 2. Workouts (gym setting; light equipment needs -- bands, a light
-- dumbbell, a stable chair/step -- translate easily to a home or
-- mobile setting, duplicate + adjust "setting" once you have a
-- specific mobile client)
-- =========================================================
insert into public.workouts (title, category, description, status, setting)
values
('Older-Adult Wellness -- Functional Strength A', 'Full-Body', 'Day 1 of the Older-Adult Wellness base model. Phase 1 numbers: 10-15 reps, 60-90s rest, RPE 4-5, functional strength paired with balance work. Light equipment needs (bands, light dumbbells, a stable chair) translate easily to a home or mobile setting.', 'published', 'gym'),
('Older-Adult Wellness -- Functional Strength B', 'Full-Body', 'Day 3 of the Older-Adult Wellness base model. Phase 1 numbers: 10-15 reps, 60-90s rest, RPE 4-5, functional strength paired with balance and gait work. Light equipment needs (bands, a low step, a stable chair) translate easily to a home or mobile setting.', 'published', 'gym'),
('Older-Adult Wellness -- Functional Strength C + Gentle Cardio', 'Full-Body', 'Day 5 of the Older-Adult Wellness base model. Phase 1 numbers: 10 reps, 60s rest, RPE 4-5, functional strength followed by 10-15 minutes of conversational-pace cardio. Light equipment needs (bands, a light carry load) translate easily to a home or mobile setting where a short walk or stationary bike is available.', 'published', 'gym')
on conflict do nothing;

-- =========================================================
-- 3. Workout exercises (sort_order, sets, reps, rest -- Phase 1 numbers,
-- taken directly from the Day 1 / Day 3 / Day 5 tables in the source doc)
-- =========================================================
with w as (select id, title from public.workouts where title like 'Older-Adult Wellness --%'),
     e as (select id, name from public.exercise_library)
insert into public.workout_exercises (workout_id, exercise_id, sort_order, sets, reps, rest_seconds)
select w.id, e.id, x.sort_order, x.sets, x.reps, x.rest_seconds
from (values
    ('Older-Adult Wellness -- Functional Strength A', 'Sit-to-Stand (chair squat)', 0, 3, '10-12', 60),
    ('Older-Adult Wellness -- Functional Strength A', 'Seated Row (machine or band)', 1, 3, '12-15', 60),
    ('Older-Adult Wellness -- Functional Strength A', 'Wall or Incline Push-Up', 2, 3, '8-12', 60),
    ('Older-Adult Wellness -- Functional Strength A', 'Standing Marching (hip flexion)', 3, 3, '10/leg', 45),
    ('Older-Adult Wellness -- Functional Strength A', 'Single-Leg Stand (hand support as needed)', 4, 3, '15-20s/side', 30),
    ('Older-Adult Wellness -- Functional Strength B', 'Step-Up (low, stable step)', 0, 3, '8/leg', 60),
    ('Older-Adult Wellness -- Functional Strength B', 'Seated or Standing Band Row', 1, 3, '12-15', 60),
    ('Older-Adult Wellness -- Functional Strength B', 'Seated Overhead Press (light dumbbell or band)', 2, 3, '10-12', 60),
    ('Older-Adult Wellness -- Functional Strength B', 'Heel-to-Toe Walk (hand support as needed)', 3, 3, '10 steps', 30),
    ('Older-Adult Wellness -- Functional Strength B', 'Standing Hip Abduction (band)', 4, 3, '12/side', 30),
    ('Older-Adult Wellness -- Functional Strength C + Gentle Cardio', 'Sit-to-Stand (with slight pause at top)', 0, 3, '10', 60),
    ('Older-Adult Wellness -- Functional Strength C + Gentle Cardio', 'Standing Row (band, both arms)', 1, 3, '12-15', 60),
    ('Older-Adult Wellness -- Functional Strength C + Gentle Cardio', 'Standing Chest Press (band)', 2, 3, '10-12', 60),
    ('Older-Adult Wellness -- Functional Strength C + Gentle Cardio', 'Farmer''s Carry (light, short distance)', 3, 3, '15-20m', 60),
    ('Older-Adult Wellness -- Functional Strength C + Gentle Cardio', 'Gentle Cardio (stationary bike or treadmill walk)', 4, 1, '10-15 min', 0)
) as x(workout_title, exercise_name, sort_order, sets, reps, rest_seconds)
join w on w.title = x.workout_title
join e on e.name = x.exercise_name
where not exists (
    select 1 from public.workout_exercises we
    where we.workout_id = w.id and we.exercise_id = e.id
);

-- =========================================================
-- 4. Program template
-- =========================================================
insert into public.program_templates (title, goal, description, duration_weeks, status)
values ('Older-Adult Wellness -- 12-Week Base Model', 'older-adult-wellness', 'Functional strength, joint-friendly mobility, and balance for day-to-day quality of life, not aesthetics or performance maximization. Falls-prevention and independence drive every exercise choice. Base model -- personalize heavily per client''s joint history, balance level, and physician guidance before assigning.', 12, 'published')
on conflict do nothing;

-- =========================================================
-- 5. 12-week calendar: Day 1, Day 3, Day 5 (Days 2, 4, 6 are
-- mobility/flexibility sessions + a walk, not structured strength
-- workouts with exercise tables, so they are not seeded here --
-- see docs/coaching-programs/06-older-adult-wellness-12-week.md)
-- repeat the same 3 workouts across all 12 weeks (progression happens
-- through coaching execution per the periodization table, not through
-- separate workout rows)
-- =========================================================
with pt as (select id from public.program_templates where title = 'Older-Adult Wellness -- 12-Week Base Model'),
     w as (select id, title from public.workouts where title like 'Older-Adult Wellness --%'),
     slots as (
         select * from (values
             (1, 'Older-Adult Wellness -- Functional Strength A'),
             (3, 'Older-Adult Wellness -- Functional Strength B'),
             (5, 'Older-Adult Wellness -- Functional Strength C + Gentle Cardio')
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
    (select count(*) from public.exercise_library where status = 'published') as published_exercises,
    (select count(*) from public.workouts where title like 'Older-Adult Wellness --%') as older_adult_wellness_workouts,
    (select count(*) from public.program_template_workouts ptw join public.program_templates pt on pt.id = ptw.program_template_id where pt.title = 'Older-Adult Wellness -- 12-Week Base Model') as older_adult_wellness_calendar_rows;

