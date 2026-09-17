// The seven free-tier "starter plan" templates - one per population tag
// already used on the site (index.html's "Who We Train" pills), plus
// Pregnancy since the homepage calls it out explicitly even though it
// isn't its own Member Vault category. Static, hand-authored content
// (matches the FREE_RESOURCES pattern in echelonos/src/lib/free-resources.ts),
// deliberately not periodized or adjusted - Week 1 only, forever, on
// purpose. That's the hook: the full paid program is the only version
// that adapts as the client progresses.
//
// Single source of truth: api/free-plan/submit.js returns the matched
// template's html/text in its JSON response, so the client renders
// whatever the server sends rather than keeping a second copy of this
// content in a browser-side script.

const TEMPLATES = {
  'Weight Loss': {
    title: 'Weight Loss — Foundations Starter',
    subtitle: 'Lose weight sustainably, build the training habit',
    level: 'Beginner / General population',
    structure: '3 full-body strength days + 2 walking days + 2 rest (Week 1 only)',
    days: [
      { label: 'Day 1 — Full Body', items: ['Goblet Squat 3×8', 'DB Romanian Deadlift 3×8', 'Incline Push-Up 3×10', 'Seated Row 3×10', 'Plank 3×20s'] },
      { label: 'Day 2 — Walk', items: ['30-min walk, easy pace'] },
      { label: 'Day 3 — Full Body', items: ['Reverse Lunge 3×8/leg', 'Lat Pulldown 3×10', 'DB Shoulder Press 3×8', 'Hip Bridge 3×12', 'Dead Bug 3×10/side'] },
      { label: 'Day 4 — Walk', items: ['30-min walk, easy pace'] },
      { label: 'Day 5 — Full Body', items: ['Leg Press 3×10', 'Chest Press 3×10', 'Cable Row 3×10', 'Standing Calf Raise 3×12', 'Bicycle Crunch 3×15'] },
      { label: 'Days 6–7 — Rest', items: ['Light stretching optional'] },
    ],
    nutrition: 'Moderate deficit, not aggressive — aim for no more than ~0.5–1% of bodyweight lost per week. Protein at every meal. No food eliminated outright.',
  },
  Cutting: {
    title: 'Cutting — Reveal Phase Starter',
    subtitle: 'Lose fat while protecting trained muscle',
    level: 'Intermediate / Advanced (already has a training base)',
    structure: '4 lifting days (kept heavy, not backed off) + 2 conditioning days + 1 rest',
    days: [
      { label: 'Day 1 — Lower (Heavy)', items: ['Back Squat 4×5', 'RDL 3×6', 'Walking Lunge 3×10/leg', 'Standing Calf Raise 3×12'] },
      { label: 'Day 2 — Conditioning', items: ['20-min tempo intervals, comfortably hard'] },
      { label: 'Day 3 — Upper (Heavy)', items: ['Bench Press 4×5', 'Weighted Pull-Up or Lat Pulldown 3×6', 'Overhead Press 3×6', 'Row 3×8'] },
      { label: 'Day 4 — Rest', items: [] },
      { label: 'Day 5 — Full Body (Heavy)', items: ['Deadlift 3×5', 'Incline DB Press 3×8', 'Front Squat 3×6', 'Face Pull 3×12'] },
      { label: 'Day 6 — Conditioning', items: ['30-min Zone 2'] },
      { label: 'Day 7 — Active Recovery', items: ['Walk'] },
    ],
    nutrition: 'Moderate deficit — the weights stay heavy, the diet is what changes, not the training. Protein is the anchor: ~1g per lb bodyweight, non-negotiable.',
  },
  Bulking: {
    title: 'Bulking — Clean Mass Starter',
    subtitle: 'Build size and strength in a controlled surplus',
    level: 'Intermediate',
    structure: '4 lifting days, higher volume, 2 rest days, 1 optional light cardio',
    days: [
      { label: 'Day 1 — Push', items: ['Bench Press 4×6-8', 'Incline DB Press 3×8-10', 'Overhead Press 3×8', 'Triceps Pushdown 3×12'] },
      { label: 'Day 2 — Pull', items: ['Deadlift 3×5', 'Barbell Row 4×6-8', 'Lat Pulldown 3×10', 'Bicep Curl 3×12'] },
      { label: 'Day 3 — Rest', items: [] },
      { label: 'Day 4 — Legs', items: ['Squat 4×6-8', 'Leg Press 3×10', 'Leg Curl 3×10', 'Standing Calf Raise 4×12'] },
      { label: 'Day 5 — Upper Accessory', items: ['Incline Bench 3×8', 'Cable Row 3×10', 'Lateral Raise 3×15', 'Face Pull 3×15'] },
      { label: 'Day 6 — Optional', items: ['20-min easy cardio'] },
      { label: 'Day 7 — Rest', items: [] },
    ],
    nutrition: '10–20% above maintenance, not a free-for-all — more isn’t better past a certain point. Protein anchors every meal; carbs sized to training days.',
  },
  Muscle: {
    title: 'Muscle — Hypertrophy Starter',
    subtitle: 'Build visible muscle at roughly maintenance calories',
    level: 'Intermediate',
    structure: '4 lifting days, moderate-high volume, rep ranges 8–12',
    days: [
      { label: 'Day 1 — Chest / Triceps', items: ['Bench Press 4×8-10', 'Incline DB Press 3×10', 'Cable Fly 3×12', 'Triceps Pushdown 3×12'] },
      { label: 'Day 2 — Back / Biceps', items: ['Lat Pulldown 4×8-10', 'Seated Row 3×10', 'Face Pull 3×15', 'Bicep Curl 3×12'] },
      { label: 'Day 3 — Rest', items: [] },
      { label: 'Day 4 — Legs', items: ['Squat 4×8-10', 'Leg Press 3×10', 'Leg Curl 3×12', 'Calf Raise 4×15'] },
      { label: 'Day 5 — Shoulders / Arms', items: ['Overhead Press 3×8-10', 'Lateral Raise 4×12-15', 'Rear Delt Fly 3×15', 'Curl / Pushdown Superset 3×12'] },
      { label: 'Days 6–7 — Rest', items: [] },
    ],
    nutrition: 'Eat at maintenance, protein high (~1g/lb). This isn’t a bulk or a cut — it’s fuel to recover and grow without adding fat.',
  },
  Performance: {
    title: 'Performance — Athletic Starter',
    subtitle: 'Build speed, power, and explosiveness',
    level: 'Intermediate / Advanced',
    structure: '2 power days + 2 strength days + 1 conditioning + 2 rest',
    days: [
      { label: 'Day 1 — Power', items: ['Broad Jump 4×3', 'Box Jump 4×3', 'Med Ball Slam 3×8', 'Sprint Starts 4×20m'] },
      { label: 'Day 2 — Strength (Lower)', items: ['Trap Bar Deadlift 4×5', 'Bulgarian Split Squat 3×6/leg', 'Nordic Curl 3×6'] },
      { label: 'Day 3 — Rest', items: [] },
      { label: 'Day 4 — Power', items: ['Lateral Bound 4×4/side', 'Depth Jump 3×5', 'Rotational Med Ball Throw 3×8/side'] },
      { label: 'Day 5 — Strength (Upper)', items: ['Bench Press 4×5', 'Weighted Pull-Up 3×5', 'Push Press 3×5'] },
      { label: 'Day 6 — Conditioning', items: ['Agility ladder + 6×20s hill sprints'] },
      { label: 'Day 7 — Rest', items: [] },
    ],
    nutrition: 'Eat to fuel output, not to change body composition — this phase is about what the body can produce, not what the scale says.',
  },
  'Older-Adult Wellness': {
    title: 'Older-Adult Wellness — Strength & Stability Starter',
    subtitle: 'Build functional strength, balance, and bone density safely',
    level: 'All levels, joint-conscious',
    structure: '3 strength days + 2 balance/mobility days + 2 rest',
    days: [
      { label: 'Day 1 — Full Body', items: ['Sit-to-Stand 3×10', 'Seated Row 3×12', 'Wall Push-Up 3×10', 'Standing Marches 3×10/side'] },
      { label: 'Day 2 — Balance & Mobility', items: ['Single-Leg Stand (assisted) 3×20s/side', 'Cat-Cow', 'Band Pull-Apart 2×15'] },
      { label: 'Day 3 — Full Body', items: ['Step-Up (low box) 3×8/leg', 'Lat Pulldown 3×12', 'Chest Press Machine 3×10', 'Dead Bug 3×8/side'] },
      { label: 'Day 4 — Rest', items: [] },
      { label: 'Day 5 — Full Body', items: ['Goblet Squat (light) 3×10', 'Seated Overhead Press 3×10', 'Standing Row (band) 3×12'] },
      { label: 'Day 6 — Walk + Mobility', items: [] },
      { label: 'Day 7 — Rest', items: [] },
    ],
    nutrition: 'Prioritize protein to protect muscle mass (this matters more with age, not less). No aggressive deficit — the goal is strength and independence, not a number on the scale.',
  },
  Pregnancy: {
    title: 'Pregnancy (Preconception / Prenatal / Postpartum) — Safe Foundations Starter',
    subtitle: 'Stay strong and active safely through pregnancy or early postpartum recovery',
    level: 'All levels — requires physician clearance before starting',
    structure: '3 light-moderate sessions + daily walking + breath/core work',
    days: [
      { label: 'Day 1 — Lower Body (light)', items: ['Bodyweight Squat 3×10', 'Glute Bridge 3×12', 'Standing Hip Abduction 3×10/side'] },
      { label: 'Day 2 — Walk', items: ['20–30 min + pelvic floor breathing practice'] },
      { label: 'Day 3 — Upper Body (light)', items: ['Seated Row (band) 3×12', 'Wall Push-Up 3×10', 'Standing Overhead Press (light) 3×10'] },
      { label: 'Day 4 — Rest', items: ['Gentle stretching'] },
      { label: 'Day 5 — Full Body (light)', items: ['Sit-to-Stand 3×10', 'Bird Dog 3×8/side', 'Standing March 3×10/side'] },
      { label: 'Days 6–7 — Walk + Rest', items: [] },
    ],
    nutrition: 'This is not a fat-loss phase — eat to support you and (if pregnant) your baby. No calorie targets here; follow your physician’s guidance. This template avoids supine (flat-on-back) positions and any bracing/impact work by design — a placeholder until your real intake and clearance, not a substitute for one.',
  },
};

const WHATS_MISSING = [
  'No periodization/phases (no weeks-long roadmap, no deload schedule)',
  'No injury-specific modifications or exercise substitutions',
  'No macro-specific targets tied to your own check-ins',
  'No weekly coaching notes explaining why each choice was made',
  'No accountability/tracking system',
  'No adjustments as you progress — it’s Week 1, static, forever',
];

function getTemplate(goal) {
  return TEMPLATES[goal] || null;
}

function templateGoals() {
  return Object.keys(TEMPLATES);
}

module.exports = { TEMPLATES, WHATS_MISSING, getTemplate, templateGoals };
