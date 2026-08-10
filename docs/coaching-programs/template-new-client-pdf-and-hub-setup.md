# TEMPLATE: BUILDING A NEW CLIENT'S PROGRAM PDF + HUB SETUP

Reusable prompt and intake checklist for building a personalized 1-on-1 program like Zamiyah's (see `docs/coaching-programs/client-programs/zamiyah-elite-performance-program.md` and `assets/documents/client-programs/zamiyah-elite-performance-program.pdf` for the reference build), and getting it live in her Coaching Hub.

---

## 1. The Prompt

Paste this into a new conversation, filled in, once you've got the client's intake and call notes in hand:

> I have a new coaching client, **[NAME]**. I want a program PDF and webpage built for them just like Zamiyah's Elite Performance & Shape Program, use `docs/coaching-programs/client-programs/zamiyah-elite-performance-program.md` as the exact template for structure, tone, and design (black/gold theme, philosophy section, 28-week-style roadmap, tracking chart, nutrition protocol).
>
> Here's their full intake application data:
> [paste everything from the coaching application]
>
> Here's what I learned from our call that isn't in the system:
> [paste your call notes, see the checklist below for what to cover]
>
> Build me:
> 1. The PDF + a standalone webpage at `pages/programs/<name>.html`, same black/gold style as Zamiyah's, with its own PWA manifest so it can be added to their phone's home screen like an app.
> 2. The Workout Library entries and however many training days their split needs, published. Reuse existing `exercise_library` rows by exact name wherever they fit (see section 5 below), don't duplicate what's already there.
> 3. If I didn't give you their current working weights, don't invent numbers, use "Establish Week 1, log in Hub" as the Load value and say so plainly in the program.
> 4. Once I give you their start date, populate their Hub exactly like Zamiyah's: a program_template covering their full timeline, program_template_workouts for every week, member_program_enrollments, and their nutrition_profiles targets.

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

---

## 5. Exercise Library Lookup (do this before writing new exercise rows)

The library is large and reused across every prior client program, most common movements already exist. Building Lex's program reused about 30 existing rows and only added 12 new ones. Check before creating:

```sql
select target_area, string_agg(name, ' | ' order by name) from exercise_library group by target_area order by target_area;
```

Existing `target_area` groupings as of the last build: Push, Pull, Squat, Lunge, Hinge, Isolation/Activation (biceps, triceps, calves, leg curl/extension, lateral raise, etc.), Core, Glutes, Glute Medius, Hamstrings, Adductors, Locomotion (carries, sled work), SAQ (Speed, Agility, Quickness), Athletic/Plyometric, Prenatal/Postpartum. Reuse an exact existing `name` wherever the movement matches, only add a new row for something genuinely not covered (a specific technique variant, a new running/conditioning protocol, a new mobility drill).

**Schema reference** (`exercise_library`): `id, name, target_area, description, form_cues, coaching_cues, modification_up, modification_down, modification_pregnancy, video_url, equipment_needed, status`.
**Schema reference** (`workouts`): `id, title, category, description, status, created_at, updated_at, setting` (`setting` is `gym` / `home` / `both`; `category` is a free-text muscle-group or type label like `Full-Body`, `Conditioning`, `Mobility`).
**Schema reference** (`workout_exercises`): `id, workout_id, exercise_id, sort_order, sets, reps, rest_seconds, notes` (`sets` is an integer, so rep ranges like "6-8" belong in `reps` as text, not `sets`; if the count itself is a range, set `sets` to 1 and describe the range inside `reps`).

**Linking workout_exercises safely:** several exercise names are duplicated across `target_area` rows from earlier programs (e.g. multiple "Face Pull" or "Romanian Deadlift" rows). Never `join` on `exercise_library.name` directly, it silently multiplies rows. Use a scalar subquery with `limit 1` per row instead: `(select id from exercise_library where name='Exact Name' limit 1)`.

**Typing SQL in the Supabase SQL Editor safely:** always open a genuinely blank new query tab (the `+` button, not an existing tab, which can carry over stale content) before typing. Write each statement as one continuous line with no line breaks (chunk long statements across multiple `type` actions rather than pressing Enter mid-statement), since Monaco's auto-close-bracket feature corrupts a statement if a line break lands right after an open parenthesis. For a new client's full workout_exercises set, insert per-day (7-11 rows at a time) rather than one giant statement, so a mistake is easy to isolate. After inserting, verify with a count/null check before moving on: `select w.title, count(*) filter (where we.exercise_id is null) as missing, count(*) as total from workouts w join workout_exercises we on we.workout_id = w.id where w.title like 'ClientName - %' group by w.title;` — `missing` should always be 0.

**When you don't have real working weights:** if the client's intake doesn't include current lifts (unlike Zamiyah's workout log), don't invent numbers. Use "Establish Week 1, log in Hub" (or "Light, log in Hub" for accessory work) as the Load value instead, and say so plainly in the PDF/webpage. The Hub's Today's Work panel has a per-exercise load-weight input specifically for this, the client's first real session becomes the baseline everything after progresses against.

**Webpage + home screen:** every client program should exist as a standalone page at `pages/programs/<client-slug>.html`, styled black/gold to match the site (see an existing one for the exact CSS block to reuse), with its own `manifest-<client-slug>.json` in the same folder and the standard PWA head tags (`link rel="manifest"`, `apple-mobile-web-app-*` meta tags, `apple-touch-icon`) so the client can add it to their phone's home screen like a native app. The PDF is generated by pointing headless Microsoft Edge's `--print-to-pdf` at that same live page (via a local static server), not built separately, so the two never drift apart. A `@media print` block in the page's CSS handles the black-to-white flip for the printed version; when adding new elements, always add their print-mode text color to that block too, plain white text on a printed white page is invisible and easy to miss until you actually render a page and look.
