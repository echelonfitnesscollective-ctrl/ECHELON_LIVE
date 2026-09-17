// The seven free-tier "starter plan" templates - one per population tag
// already used on the site (index.html's "Who We Train" pills), plus
// Pregnancy since the homepage calls it out explicitly even though it
// isn't its own Member Vault category. Static, hand-authored content
// (matches the FREE_RESOURCES pattern in echelonos/src/lib/free-resources.ts),
// deliberately not periodized or adjusted - Week 1 only, forever, on
// purpose. That's the hook: the full paid program is the only version
// that adapts as the client progresses.
//
// Each goal ships two equipment variants (gymDays / homeDays) so the
// free-plan intake's gym-access question actually changes what's
// delivered, not just the copy around it. Title/subtitle/level/
// structure/nutrition stay shared between variants; only the day-by-day
// exercises differ.
//
// Single source of truth: api/free-plan/submit.js returns the matched
// template's html/text in its JSON response, so the client renders
// whatever the server sends rather than keeping a second copy of this
// content in a browser-side script.

const TEMPLATES = {
  'Weight Loss': {
    title: 'Weight Loss: Foundations Starter',
    subtitle: 'Lose weight sustainably, build the training habit',
    level: 'Beginner / General population',
    structure: '3 strength days + 2 walking days + 2 rest (Week 1 only)',
    nutrition: 'Moderate deficit, not aggressive. Aim for no more than ~0.5-1% of bodyweight lost per week. Protein at every meal. No food eliminated outright.',
    gymDays: [
      { label: 'Day 1: Full Body', items: ['Goblet Squat 3×8', 'DB Romanian Deadlift 3×8', 'Incline Push-Up 3×10', 'Seated Row 3×10', 'Plank 3×20s'] },
      { label: 'Day 2: Walk', items: ['30-min walk, easy pace'] },
      { label: 'Day 3: Full Body', items: ['Reverse Lunge 3×8/leg', 'Lat Pulldown 3×10', 'DB Shoulder Press 3×8', 'Hip Bridge 3×12', 'Dead Bug 3×10/side'] },
      { label: 'Day 4: Walk', items: ['30-min walk, easy pace'] },
      { label: 'Day 5: Full Body', items: ['Leg Press 3×10', 'Chest Press 3×10', 'Cable Row 3×10', 'Standing Calf Raise 3×12', 'Bicycle Crunch 3×15'] },
      { label: 'Days 6-7: Rest', items: ['Light stretching optional'] },
    ],
    homeDays: [
      { label: 'Day 1: Full Body', items: ['Bodyweight Squat 3×12', 'Glute Bridge 3×12', 'Push-Up (knees if needed) 3×10', 'Superman 3×12', 'Plank 3×20s'] },
      { label: 'Day 2: Walk', items: ['30-min walk, easy pace'] },
      { label: 'Day 3: Full Body', items: ['Reverse Lunge 3×10/leg', 'Reverse Snow Angel 3×15', 'Pike Push-Up 3×8', 'Hip Bridge 3×12', 'Dead Bug 3×10/side'] },
      { label: 'Day 4: Walk', items: ['30-min walk, easy pace'] },
      { label: 'Day 5: Full Body', items: ['Step-Up (stairs or sturdy chair) 3×10/leg', 'Incline Push-Up 3×12', 'Superman Row 3×15', 'Standing Calf Raise 3×15', 'Bicycle Crunch 3×15'] },
      { label: 'Days 6-7: Rest', items: ['Light stretching optional'] },
    ],
  },
  Cutting: {
    title: 'Cutting: Reveal Phase Starter',
    subtitle: 'Lose fat while protecting trained muscle',
    level: 'Intermediate / Advanced (already has a training base)',
    structure: '4 training days (kept heavy or intense, not backed off) + 2 conditioning days + 1 rest',
    nutrition: 'Moderate deficit. The weights stay heavy, the diet is what changes, not the training. Protein is the anchor: ~1g per lb bodyweight, non-negotiable.',
    gymDays: [
      { label: 'Day 1: Lower (Heavy)', items: ['Back Squat 4×5', 'RDL 3×6', 'Walking Lunge 3×10/leg', 'Standing Calf Raise 3×12'] },
      { label: 'Day 2: Conditioning', items: ['20-min tempo intervals, comfortably hard'] },
      { label: 'Day 3: Upper (Heavy)', items: ['Bench Press 4×5', 'Weighted Pull-Up or Lat Pulldown 3×6', 'Overhead Press 3×6', 'Row 3×8'] },
      { label: 'Day 4: Rest', items: [] },
      { label: 'Day 5: Full Body (Heavy)', items: ['Deadlift 3×5', 'Incline DB Press 3×8', 'Front Squat 3×6', 'Face Pull 3×12'] },
      { label: 'Day 6: Conditioning', items: ['30-min Zone 2'] },
      { label: 'Day 7: Active Recovery', items: ['Walk'] },
    ],
    homeDays: [
      { label: 'Day 1: Lower (Heavy Effort)', items: ['Bulgarian Split Squat (chair) 4×10/leg', 'Single-Leg RDL 3×10/leg', 'Walking Lunge 3×12/leg', 'Standing Calf Raise 4×15'] },
      { label: 'Day 2: Conditioning', items: ['20-min tempo intervals: fast/slow walk or jog, comfortably hard'] },
      { label: 'Day 3: Upper (Heavy Effort)', items: ['Push-Up (feet elevated) 4×max', 'Superman Row 4×15', 'Pike Push-Up 3×10', 'Towel Row 3×12'] },
      { label: 'Day 4: Rest', items: [] },
      { label: 'Day 5: Full Body (Heavy Effort)', items: ['Single-Leg RDL 3×8/leg', 'Decline Push-Up (feet on chair) 3×10', 'Jump Squat 3×8', 'Reverse Fly Hold 3×15'] },
      { label: 'Day 6: Conditioning', items: ['30-min easy, steady pace'] },
      { label: 'Day 7: Active Recovery', items: ['Walk'] },
    ],
  },
  Bulking: {
    title: 'Bulking: Clean Mass Starter',
    subtitle: 'Build size and strength in a controlled surplus',
    level: 'Intermediate',
    structure: '4 training days, higher volume, 2 rest days, 1 optional light cardio',
    nutrition: '10-20% above maintenance, not a free-for-all. More isn’t better past a certain point. Protein anchors every meal; carbs sized to training days.',
    gymDays: [
      { label: 'Day 1: Push', items: ['Bench Press 4×6-8', 'Incline DB Press 3×8-10', 'Overhead Press 3×8', 'Triceps Pushdown 3×12'] },
      { label: 'Day 2: Pull', items: ['Deadlift 3×5', 'Barbell Row 4×6-8', 'Lat Pulldown 3×10', 'Bicep Curl 3×12'] },
      { label: 'Day 3: Rest', items: [] },
      { label: 'Day 4: Legs', items: ['Squat 4×6-8', 'Leg Press 3×10', 'Leg Curl 3×10', 'Standing Calf Raise 4×12'] },
      { label: 'Day 5: Upper Accessory', items: ['Incline Bench 3×8', 'Cable Row 3×10', 'Lateral Raise 3×15', 'Face Pull 3×15'] },
      { label: 'Day 6: Optional', items: ['20-min easy cardio'] },
      { label: 'Day 7: Rest', items: [] },
    ],
    homeDays: [
      { label: 'Day 1: Push', items: ['Push-Up (feet elevated) 4×12-15', 'Pike Push-Up 3×10', 'Diamond Push-Up 3×12', 'Bench Dip (chair) 3×12'] },
      { label: 'Day 2: Pull', items: ['Single-Leg RDL 3×10/leg', 'Superman Row 4×15', 'Towel Row 3×12', 'Reverse Fly Hold 3×15'] },
      { label: 'Day 3: Rest', items: [] },
      { label: 'Day 4: Legs', items: ['Jump Squat 4×10', 'Bulgarian Split Squat (chair) 4×10/leg', 'Single-Leg RDL 3×10/leg', 'Standing Calf Raise 4×20'] },
      { label: 'Day 5: Upper Accessory', items: ['Incline Push-Up 3×12', 'Superman Row 3×15', 'Lateral Raise Hold 3×20s', 'Reverse Fly 3×15'] },
      { label: 'Day 6: Optional', items: ['20-min easy cardio'] },
      { label: 'Day 7: Rest', items: [] },
    ],
  },
  Muscle: {
    title: 'Muscle: Hypertrophy Starter',
    subtitle: 'Build visible muscle at roughly maintenance calories',
    level: 'Intermediate',
    structure: '4 training days, moderate-high volume, rep ranges 8-15',
    nutrition: 'Eat at maintenance, protein high (~1g/lb). This isn’t a bulk or a cut, it’s fuel to recover and grow without adding fat.',
    gymDays: [
      { label: 'Day 1: Chest / Triceps', items: ['Bench Press 4×8-10', 'Incline DB Press 3×10', 'Cable Fly 3×12', 'Triceps Pushdown 3×12'] },
      { label: 'Day 2: Back / Biceps', items: ['Lat Pulldown 4×8-10', 'Seated Row 3×10', 'Face Pull 3×15', 'Bicep Curl 3×12'] },
      { label: 'Day 3: Rest', items: [] },
      { label: 'Day 4: Legs', items: ['Squat 4×8-10', 'Leg Press 3×10', 'Leg Curl 3×12', 'Calf Raise 4×15'] },
      { label: 'Day 5: Shoulders / Arms', items: ['Overhead Press 3×8-10', 'Lateral Raise 4×12-15', 'Rear Delt Fly 3×15', 'Curl / Pushdown Superset 3×12'] },
      { label: 'Days 6-7: Rest', items: [] },
    ],
    homeDays: [
      { label: 'Day 1: Chest / Triceps', items: ['Push-Up 4×12-15', 'Incline Push-Up 3×12', 'Diamond Push-Up 3×12', 'Bench Dip (chair) 3×15'] },
      { label: 'Day 2: Back / Biceps', items: ['Superman Row 4×15', 'Towel Row 3×12', 'Reverse Fly Hold 3×15', 'Isometric Curl Hold 3×20s'] },
      { label: 'Day 3: Rest', items: [] },
      { label: 'Day 4: Legs', items: ['Bodyweight Squat 4×15', 'Bulgarian Split Squat (chair) 3×10/leg', 'Single-Leg RDL 3×12/leg', 'Standing Calf Raise 4×20'] },
      { label: 'Day 5: Shoulders / Arms', items: ['Pike Push-Up 3×10', 'Lateral Raise Hold 3×20s', 'Reverse Fly 3×15', 'Push-Up / Dip Superset 3×12'] },
      { label: 'Days 6-7: Rest', items: [] },
    ],
  },
  Performance: {
    title: 'Performance: Athletic Starter',
    subtitle: 'Build speed, power, and explosiveness',
    level: 'Intermediate / Advanced',
    structure: '2 power days + 2 strength days + 1 conditioning + 2 rest',
    nutrition: 'Eat to fuel output, not to change body composition. This phase is about what the body can produce, not what the scale says.',
    gymDays: [
      { label: 'Day 1: Power', items: ['Broad Jump 4×3', 'Box Jump 4×3', 'Med Ball Slam 3×8', 'Sprint Starts 4×20m'] },
      { label: 'Day 2: Strength (Lower)', items: ['Trap Bar Deadlift 4×5', 'Bulgarian Split Squat 3×6/leg', 'Nordic Curl 3×6'] },
      { label: 'Day 3: Rest', items: [] },
      { label: 'Day 4: Power', items: ['Lateral Bound 4×4/side', 'Depth Jump 3×5', 'Rotational Med Ball Throw 3×8/side'] },
      { label: 'Day 5: Strength (Upper)', items: ['Bench Press 4×5', 'Weighted Pull-Up 3×5', 'Push Press 3×5'] },
      { label: 'Day 6: Conditioning', items: ['Agility ladder + 6×20s hill sprints'] },
      { label: 'Day 7: Rest', items: [] },
    ],
    homeDays: [
      { label: 'Day 1: Power', items: ['Broad Jump 4×3', 'Box Jump (stair/step) 4×3', 'Squat Jump 3×8', 'Sprint Starts 4×20m'] },
      { label: 'Day 2: Strength (Lower)', items: ['Single-Leg RDL 4×8/leg', 'Bulgarian Split Squat (chair) 3×8/leg', 'Nordic Curl (couch-anchored) 3×6'] },
      { label: 'Day 3: Rest', items: [] },
      { label: 'Day 4: Power', items: ['Lateral Bound 4×4/side', 'Depth Jump (step) 3×5', 'Rotational Bodyweight Twist 3×10/side'] },
      { label: 'Day 5: Strength (Upper)', items: ['Explosive Push-Up 4×8', 'Pull-Up (bar) or Inverted Row (table) 3×5', 'Pike Push Press 3×8'] },
      { label: 'Day 6: Conditioning', items: ['Agility footwork + 6×20s hill sprints'] },
      { label: 'Day 7: Rest', items: [] },
    ],
  },
  'Older-Adult Wellness': {
    title: 'Older-Adult Wellness: Strength & Stability Starter',
    subtitle: 'Build functional strength, balance, and bone density safely',
    level: 'All levels, joint-conscious',
    structure: '3 strength days + 2 balance/mobility days + 2 rest',
    nutrition: 'Prioritize protein to protect muscle mass (this matters more with age, not less). No aggressive deficit. The goal is strength and independence, not a number on the scale.',
    gymDays: [
      { label: 'Day 1: Full Body', items: ['Sit-to-Stand 3×10', 'Seated Row 3×12', 'Wall Push-Up 3×10', 'Standing Marches 3×10/side'] },
      { label: 'Day 2: Balance & Mobility', items: ['Single-Leg Stand (assisted) 3×20s/side', 'Cat-Cow', 'Band Pull-Apart 2×15'] },
      { label: 'Day 3: Full Body', items: ['Step-Up (low box) 3×8/leg', 'Lat Pulldown 3×12', 'Chest Press Machine 3×10', 'Dead Bug 3×8/side'] },
      { label: 'Day 4: Rest', items: [] },
      { label: 'Day 5: Full Body', items: ['Goblet Squat (light) 3×10', 'Seated Overhead Press 3×10', 'Standing Row (band) 3×12'] },
      { label: 'Day 6: Walk + Mobility', items: [] },
      { label: 'Day 7: Rest', items: [] },
    ],
    homeDays: [
      { label: 'Day 1: Full Body', items: ['Sit-to-Stand (chair) 3×10', 'Wall Push-Up 3×10', 'Standing Marches 3×10/side', 'Seated Reverse Fly 3×12'] },
      { label: 'Day 2: Balance & Mobility', items: ['Single-Leg Stand (chair-assisted) 3×20s/side', 'Cat-Cow', 'Arm Circles 2×15'] },
      { label: 'Day 3: Full Body', items: ['Step-Up (low stair) 3×8/leg', 'Wall Push-Up 3×12', 'Seated Row Hold 3×12', 'Dead Bug 3×8/side'] },
      { label: 'Day 4: Rest', items: [] },
      { label: 'Day 5: Full Body', items: ['Chair Squat (light) 3×10', 'Seated Overhead Reach 3×10', 'Standing Row Hold 3×12'] },
      { label: 'Day 6: Walk + Mobility', items: [] },
      { label: 'Day 7: Rest', items: [] },
    ],
  },
  Pregnancy: {
    title: 'Pregnancy (Preconception / Prenatal / Postpartum): Safe Foundations Starter',
    subtitle: 'Stay strong and active safely through pregnancy or early postpartum recovery',
    level: 'All levels. Requires physician clearance before starting',
    structure: '3 light-moderate sessions + daily walking + breath/core work',
    nutrition: 'This is not a fat-loss phase. Eat to support you and (if pregnant) your baby. No calorie targets here; follow your physician’s guidance. This template avoids supine (flat-on-back) positions and any bracing/impact work by design. It is a placeholder until your real intake and clearance, not a substitute for one.',
    gymDays: [
      { label: 'Day 1: Lower Body (light)', items: ['Bodyweight Squat 3×10', 'Glute Bridge 3×12', 'Standing Hip Abduction 3×10/side'] },
      { label: 'Day 2: Walk', items: ['20-30 min + pelvic floor breathing practice'] },
      { label: 'Day 3: Upper Body (light)', items: ['Seated Row (band) 3×12', 'Wall Push-Up 3×10', 'Standing Overhead Press (light) 3×10'] },
      { label: 'Day 4: Rest', items: ['Gentle stretching'] },
      { label: 'Day 5: Full Body (light)', items: ['Sit-to-Stand 3×10', 'Bird Dog 3×8/side', 'Standing March 3×10/side'] },
      { label: 'Days 6-7: Walk + Rest', items: [] },
    ],
    homeDays: [
      { label: 'Day 1: Lower Body (light)', items: ['Bodyweight Squat 3×10', 'Glute Bridge 3×12', 'Standing Hip Abduction 3×10/side'] },
      { label: 'Day 2: Walk', items: ['20-30 min + pelvic floor breathing practice'] },
      { label: 'Day 3: Upper Body (light)', items: ['Wall Push-Up 3×10', 'Standing Reverse Fly 3×12', 'Standing Overhead Reach (light) 3×10'] },
      { label: 'Day 4: Rest', items: ['Gentle stretching'] },
      { label: 'Day 5: Full Body (light)', items: ['Sit-to-Stand 3×10', 'Bird Dog 3×8/side', 'Standing March 3×10/side'] },
      { label: 'Days 6-7: Walk + Rest', items: [] },
    ],
  },
};

const WHATS_MISSING = [
  'No periodization/phases (no weeks-long roadmap, no deload schedule)',
  'No injury-specific modifications or exercise substitutions',
  'No macro-specific targets tied to your own check-ins',
  'No weekly coaching notes explaining why each choice was made',
  'No accountability/tracking system',
  'No adjustments as you progress. It’s Week 1, static, forever',
];

function getTemplate(goal, hasGymAccess) {
  const entry = TEMPLATES[goal];
  if (!entry) return null;
  const { gymDays, homeDays, ...shared } = entry;
  return {
    ...shared,
    equipment: hasGymAccess ? 'Gym & Equipment' : 'No Equipment / Bodyweight',
    days: hasGymAccess ? gymDays : homeDays,
  };
}

function templateGoals() {
  return Object.keys(TEMPLATES);
}

module.exports = { TEMPLATES, WHATS_MISSING, getTemplate, templateGoals };
