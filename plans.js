// Workout plans, typed in from the PPL PDFs (3, 4, 5 and 6-day) and the Cardio guide.
// Each workout day is a list of "slots": a type of exercise with sets, reps and
// the exercises you can choose from (ids point at the exercise library).
(function () {
  const S = (body, name, sets, reps, options) => ({ body, name, sets, reps, options: options.map(([label, ex]) => ({ label, ex })) });

  // ---- slot templates ----
  const horizPush = (r) => S("Chest", "Horizontal push", 3, r, [["Barbell bench press", "bench"], ["Dumbbell bench press", "dbbench"], ["Weighted push-up", "pushup"]]);
  const inclinePush = (r) => S("Chest", "Incline push", 3, r, [["Barbell incline bench press", "inclinebench"], ["Dumbbell incline bench press", "inclinedb"], ["Weighted decline push-up", "declinepushup"]]);
  const chestIso = () => S("Chest", "Chest isolation", 3, "12-20", [["Dumbbell flies", "dbfly"], ["Cable flies", "cablefly"]]);
  const ohp = (r, sets = 3) => S("Shoulders", "Overhead press", sets, r, [["Overhead press (barbell)", "ohp"], ["Dumbbell shoulder press", "dbohp"]]);
  const lateral = (sets = 3) => S("Shoulders", "Lateral raise", sets, "15-20", [["Dumbbell lateral raise", "lateralraise"], ["Cable lateral raise", "cablelateral"]]);
  const triLat = () => S("Triceps", "Lateral head isolation", 3, "12-15", [["Triceps pushdown", "pushdown"], ["Push-ups", "pushup"], ["Dips", "dips"]]);
  const triOH = () => S("Triceps", "Overhead extension", 3, "12-15", [["Skull crusher", "skullcrusher"], ["Overhead triceps extension", "ohtriceps"]]);
  const squat = (r) => S("Quads", "Squat", 3, r, [["Back squat", "squat"], ["Front squat", "frontsquat"]]);
  const quadIso = (r) => S("Quads", "Quad isolation", 3, r, [["Leg press", "legpress"], ["Hack squat", "hacksquat"], ["Leg extensions", "legext"]]);
  const hinge = () => S("Hamstrings", "Hip hinge", 3, "8-12", [["Romanian deadlift", "rdl"], ["Stiff-leg deadlift", "stiffleg"], ["Good mornings", "goodmorning"]]);
  const lunges = () => S("Glutes", "Lunges", 3, "15 each leg", [["Lunges", "lunge"], ["Glute kickbacks", "kickback"]]);
  const hamCurl = () => S("Hamstrings", "Hamstring curl", 3, "12-15", [["Hamstring curls", "hamcurl"], ["Nordic hamstring curls", "nordic"]]);
  const calves = () => S("Calves", "Calf raise", 3, "15-30", [["Calf raise (machine, or on a plate/stairs)", "calfraise"]]);
  const hipThrust = () => S("Glutes", "Hip thrust", 3, "8-12", [["Hip thrust (barbell or machine)", "hipthrust"]]);
  const vPull = (r) => S("Back", "Vertical pull", 3, r, [["Pull-up", "pullup"], ["Chin-up", "chinup"], ["Lat pulldown", "latpulldown"]]);
  const vPullArm = (r) => S("Back", "Vertical pull (straight arm)", 3, r, [["Straight-arm pulldown", "straightarm"], ["Pullover", "pullover"]]);
  const hPull = (r) => S("Back", "Horizontal pull", 3, r, [["Barbell row", "row"], ["Dumbbell row", "dbrow"]]);
  const hPull2 = (r) => S("Back", "Horizontal pull", 3, r, [["Meadows row", "meadows"], ["Seated cable row", "cablerow"], ["One-arm dumbbell row", "dbrow"]]);
  const curl = (r, sets = 3) => S("Biceps", "Normal curl", sets, r, [["Barbell strict curl", "bbcurl"], ["EZ-bar curl", "bbcurl"], ["Dumbbell curl", "curl"]]);
  const brachCurl = () => S("Biceps", "Brachialis & brachioradialis curl", 3, "12-15", [["Hammer curl", "hammer"], ["Any overhand-grip curl", "hammer"]]);
  const peakCurl = () => S("Biceps", "Peak-focused curl", 3, "12-15", [["Concentration curl", "concentration"], ["Preacher curl", "preacher"]]);
  const rearDelt = (sets = 5) => S("Rear delts", "Rear delt movement", sets, "15-20", [["Rear delt fly", "reardelt"], ["Reverse pec deck", "pecdeck"], ["Face pull", "facepull"]]);

  // ---- workout days ----
  const D = (key, name, focus, slots) => ({ key, name, focus, slots });
  const PUSH1 = D("PUSH1", "Push 1", "Chest, shoulders, triceps", [horizPush("5-8"), inclinePush("8-12"), chestIso(), ohp("8-12"), lateral(), triLat(), triOH()]);
  const PUSH2 = D("PUSH2", "Push 2", "Shoulders, chest, triceps", [ohp("5-8"), inclinePush("5-8"), horizPush("12-15"), chestIso(), lateral(), triLat(), triOH()]);
  const LEGS1 = (iso) => D("LEGS1", "Legs 1", "Quads, hamstrings, glutes, calves", [squat("5-8"), quadIso(iso), hinge(), lunges(), hamCurl(), calves()]);
  const LEGS2 = D("LEGS2", "Legs 2", "Hamstrings, glutes, quads, calves", [hinge(), hipThrust(), squat("8-12"), quadIso("12-15"), calves()]);
  const PULL1 = D("PULL1", "Pull 1", "Back, biceps, rear delts", [vPull("8-12"), vPullArm("12-15"), hPull("8-12"), curl("8-12"), brachCurl(), rearDelt()]);
  const PULL2 = D("PULL2", "Pull 2", "Back, biceps, rear delts", [hPull("5-8"), hPull2("8-12"), vPull("8-12"), curl("8-12"), peakCurl(), rearDelt()]);
  const PUSH2LEGS2 = D("PUSH2LEGS2", "Push 2 + Legs 2", "Shoulders, chest, quads, hamstrings, calves", [ohp("5-8"), horizPush("12-15"), chestIso(), lateral(), squat("8-12"), hamCurl(), calves()]);

  const SPECIALS = [
    D("SP_CHEST", "Chest & Triceps day", "Specialized: chest and triceps", [horizPush("5-8"), inclinePush("8-12"), chestIso(), triLat(), triOH()]),
    D("SP_BACK", "Back day", "Specialized: back", [vPull("8-12"), hPull("8-12"), vPullArm("12-15"), hPull2("12-15")]),
    D("SP_SHOULDER", "Shoulder day", "Specialized: shoulders", [ohp("5-8", 5), lateral(5), rearDelt(5)]),
    D("SP_BICEPS", "Biceps day", "Specialized: biceps", [curl("5-8", 4), brachCurl(), peakCurl()]),
    D("SP_LEGS", "Leg day", "Specialized: legs", [squat("5-8"), hinge(), lunges(), calves()]),
  ];

  const HOW = [
    "Always do the exercises in the order they're listed.",
    "Pick any of the listed exercises for each slot, based on what you like and what you have.",
    "Use a heavier weight for low rep ranges (5-8) than for higher ones (8-12, 12-15).",
    "Log the weight, sets and reps every time so you can see your progress.",
  ];

  const PLANS = [
    {
      id: "ppl3", name: "3-day Push Pull Legs", short: "3-day PPL", perWeek: 3,
      blurb: "Three workouts a week. Week 1 uses the “1” days, week 2 the “2” days, then repeat.",
      sequence: [PUSH1, LEGS1("8-12"), PULL1, PUSH2, LEGS2, PULL2],
      schedule: ["Any 3 days a week, with at least 1 rest day between every workout.", "Order: Push → Legs → Pull (gives your upper body more rest)."],
      restAfterEvery: true, how: HOW,
    },
    {
      id: "ppl4", name: "4-day Push Pull Legs", short: "4-day PPL", perWeek: 4,
      blurb: "The 3-day plan plus one specialized day for a body part you want to improve.",
      sequence: [PUSH1, LEGS1("8-12"), PULL1, "SPECIAL", PUSH2, LEGS2, PULL2, "SPECIAL"],
      schedule: ["Day 1 Push · Day 2 rest · Day 3 Legs · Day 4 rest · Day 5 Pull · Day 6 rest · Day 7 Specialized day", "or: Day 1 rest · Day 2 Push · Day 3 rest · Day 4 Legs · Day 5 rest · Day 6 Pull · Day 7 Specialized day", "Don't train the same body part the workout before your specialized day (e.g. no Pull day right before a Back day)."],
      restAfterEvery: true, specials: SPECIALS, how: HOW,
    },
    {
      id: "ppl5", name: "5-day Push Pull Legs", short: "5-day PPL", perWeek: 5,
      blurb: "The full Push, Pull, Legs cycle twice a week in 5 days. One day combines Push 2 and Legs 2.",
      sequence: [PUSH1, LEGS1("8-12"), PULL1, PUSH2LEGS2, PULL2],
      schedule: ["Day 1 Push 1 · Day 2 Legs 1 · Day 3 Pull 1 · Day 4 rest · Day 5 Push 2 + Legs 2 · Day 6 rest · Day 7 Pull 2", "You can swap days 6 and 7."],
      restAfter: ["PULL1", "PUSH2LEGS2"], how: HOW,
    },
    {
      id: "ppl6", name: "6-day Push Pull Legs", short: "6-day PPL", perWeek: 6,
      blurb: "Six different days, each hitting a body part from a different angle.",
      sequence: [PUSH1, LEGS1("12-15"), PULL1, PUSH2, LEGS2, PULL2],
      schedule: ["Push 1 → Legs 1 → Pull 1 → rest → Push 2 → Legs 2 → Pull 2", "or 6 days in a row: Push 1 → Legs 1 → Pull 1 → Push 2 → Legs 2 → Pull 2 → rest"],
      restAfter: ["PULL2"], how: HOW,
    },
  ];

  const CARDIO = {
    id: "cardio", name: "Cardio", minutesPerWeek: 150,
    blurb: "150 minutes of moderate cardio a week, on top of your lifting plan.",
    rules: [
      "Aim for 150 minutes of moderate cardio each week.",
      "Split it into at least 2 sessions; don't do it all at once.",
      "Keep it separate from lifting: on a rest day, or at least 6 hours before or after weights. Never right before lifting.",
      "Low impact is best, like fast walking.",
      "Go at a conversational pace: you should be able to chat the whole time.",
      "No need for HIIT. Low-intensity steady cardio is king.",
      "Avoid hours of hard cardio. If you do a long session, eat afterwards.",
    ],
    exercises: ["walk", "inclinewalk", "cycling", "elliptical", "swim"],
  };

  window.WORKOUT_PLANS = { PLANS, CARDIO, SPECIALS, source: "TrainerWinny's Push Pull Legs and Cardio guides" };
})();
