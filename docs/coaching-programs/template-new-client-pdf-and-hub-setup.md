# TEMPLATE: BUILDING A NEW CLIENT'S PROGRAM PDF + HUB SETUP

Reusable prompt and intake checklist for building a personalized 1-on-1 program like Zamiyah's (see `docs/coaching-programs/client-programs/zamiyah-elite-performance-program.md` and `assets/documents/client-programs/zamiyah-elite-performance-program.pdf` for the reference build), and getting it live in her Coaching Hub.

---

## 1. The Prompt

Paste this into a new conversation, filled in, once you've got the client's intake and call notes in hand:

> I have a new coaching client, **[NAME]**. I want a program PDF and webpage built for them just like Zamiyah's Elite Performance & Shape Program, use `docs/coaching-programs/client-programs/zamiyah-elite-performance-program.md` as the exact template for structure, tone, and design (black/gold theme, philosophy section, 28-week-style roadmap, tracking chart, nutrition protocol).
>
> Here's her full intake application data:
> [paste everything from the coaching application]
>
> Here's what I learned from our call that isn't in the system:
> [paste your call notes, see the checklist below for what to cover]
>
> Build me:
> 1. The PDF + webpage, same style as Zamiyah's.
> 2. The Workout Library entries and however many training days her split needs, published.
> 3. Once I give you her start date, populate her Hub exactly like Zamiyah's: a program_template covering her full timeline, program_template_workouts for every week, member_program_enrollments, and her nutrition_profiles targets.

---

## 2. What's Already in the Echelon System (don't re-ask)

**From the coaching application** (`coaching_applications`, visible in Leads): phone, primary goal, fitness level, training days per week, commitment level, goal and why it matters, goal timeline, what they've tried before, current barriers, 6-month success vision, support system, activity level, nutrition rating, sleep hours, why coaching will help, ready for a structured program, Instagram handle.

**From the Training Profile** (`member_training_profiles`, fill in the admin console before or during the call if you have it): delivery setting, primary/secondary goal, age, training experience, training days available, session duration, equipment access, current activity level, injuries/conditions, pregnancy/postpartum flag, medical clearance, exercise preferences, sleep/stress, consistency barrier.

If both of these are filled in before the call, you're mostly just confirming, not re-asking.

## 3. What's NOT in the System, Ask for It Live

- [ ] **Current working weights and exercises** she already does (e.g. "Hip Thrust, 45 lb, 4x6-8"), there's no field anywhere for actual current lift numbers, this is what made Zamiyah's program feel like *hers* instead of a generic template.
- [ ] **Body-area language in her own words** ("hip dips," "bat wings," "want a shelf"), richer and more specific than a generic goal category.
- [ ] **Nutrition baseline**: current body weight, current average daily calories/macros if she knows them.
- [ ] **Athletic/functional interest**: does she want plyometrics, agility, sport-style movement, or is this purely aesthetic?
- [ ] **Flexibility/mobility goals** beyond general ("wants a split," "tight hamstrings").
- [ ] **A real deadline and why it matters** (birthday, wedding, event), the intake has a goal-timeline date but not always the emotional weight behind it, that's what makes the philosophy section land.
- [ ] **Actual training days/times and setting** if different from the general "days per week" number, home vs. gym vs. both.
- [ ] **Explicit dislikes**: "don't want to look bulky," "hate HIIT," anything she's ruling out.
- [ ] **Her real start date**, needed at the end to generate the week/day calendar correctly.

---

## 4. Populating the Hub (what actually happens after the PDF is approved)

1. Exercises get added to `exercise_library` (reuse existing ones by name where they already fit, most glute/back/arm staples already exist from prior clients).
2. Each training day becomes a `workouts` row with its `workout_exercises`, published.
3. A `program_templates` row captures the whole arc: title, goal, duration in weeks, and the phase roadmap written into `progression_notes` so it travels with the program record, not just the PDF.
4. `program_template_workouts` maps every week/day to the right workout, with deload and phase-transition weeks carrying a `notes` flag that surfaces as a coach note in her Today's Work automatically.
5. Once you give a start date, `member_program_enrollments` plus the full `member_daily_workouts` calendar get generated from the template, this is what actually drives her Today's Work panel.
6. `nutrition_profiles` gets her real macro targets from the plan, not the 2,200/160/220/70 defaults.
