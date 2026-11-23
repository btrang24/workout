// Built-in exercise library and the little animated form diagrams.
// Each diagram is a side view, facing right, drawn from joint angles
// so the arms and legs keep their length while they move.
(function () {
  // ---------- Drawing ----------
  const L = { torso: 40, neck: 13, thigh: 28, shin: 28, upper: 22, fore: 20, foot: 10 };
  const rad = (d) => (d * Math.PI) / 180;
  const down = (a, len) => [Math.sin(rad(a)) * len, Math.cos(rad(a)) * len]; // angle from straight down, + = forward
  const add = (p, v) => [p[0] + v[0], p[1] + v[1]];

  function joints(q) {
    const P = [0, 0];
    const S = add(P, [Math.sin(rad(q.t)) * L.torso, -Math.cos(rad(q.t)) * L.torso]);
    const ht = q.t + (q.hd || 0);
    const H = add(S, [Math.sin(rad(ht)) * L.neck, -Math.cos(rad(ht)) * L.neck]);
    const rel = q.armRel ? q.t : 0;
    const leg = (th, sh, ft) => {
      const K = add(P, down(th, L.thigh));
      const A = add(K, down(sh, L.shin));
      const F = add(A, down(ft == null ? 90 : ft, L.foot));
      return { k: K, a: A, f: F };
    };
    const arm = (ua, fa) => {
      const E = add(S, down(ua + rel, L.upper));
      const W = add(E, down(fa + rel, L.fore));
      return { e: E, w: W };
    };
    const l1 = leg(q.th, q.sh, q.ft), a1 = arm(q.ua, q.fa);
    const j = { p: P, s: S, h: H, k: l1.k, a: l1.a, f: l1.f, e: a1.e, w: a1.w };
    if (q.th2 != null) { const l2 = leg(q.th2, q.sh2, q.ft2); j.k2 = l2.k; j.a2 = l2.a; j.f2 = l2.f; }
    if (q.ua2 != null) { const a2 = arm(q.ua2, q.fa2); j.e2 = a2.e; j.w2 = a2.w; }
    const [an, ax, ay] = q.at;
    const off = [ax - j[an][0], ay - j[an][1]];
    for (const k in j) j[k] = add(j[k], off);
    return j;
  }

  function lerpPose(A, B, t) {
    const o = {};
    for (const k in A) {
      if (typeof A[k] === "number") o[k] = A[k] + ((B[k] == null ? A[k] : B[k]) - A[k]) * t;
      else if (k === "at") o.at = [A.at[0], A.at[1] + (B.at[1] - A.at[1]) * t, A.at[2] + (B.at[2] - A.at[2]) * t];
      else o[k] = A[k];
    }
    return o;
  }

  const f1 = (n) => Math.round(n * 10) / 10;
  const pt = (p) => f1(p[0]) + "," + f1(p[1]);
  const line = (pts, cls) => `<polyline class="${cls}" points="${pts.map(pt).join(" ")}"/>`;

  function propSvg(pr, j) {
    const at = (k) => (typeof k === "string" ? j[k] : k);
    switch (pr.type) {
      case "plate": { const c = at(pr.at); return `<circle class="eq" cx="${f1(c[0])}" cy="${f1(c[1])}" r="${pr.r || 11}"/><circle class="eqd" cx="${f1(c[0])}" cy="${f1(c[1])}" r="2.5"/>`; }
      case "db": { const c = at(pr.at); return `<rect class="eqf" x="${f1(c[0] - 6)}" y="${f1(c[1] - 4)}" width="12" height="8" rx="2"/>`; }
      case "handle": { const c = at(pr.at); return `<line class="eqs" x1="${f1(c[0] - 7)}" y1="${f1(c[1])}" x2="${f1(c[0] + 7)}" y2="${f1(c[1])}"/>`; }
      case "rect": return `<rect class="${pr.cls || "eqf"}" x="${pr.x}" y="${pr.y}" width="${pr.w}" height="${pr.h}" rx="${pr.rx || 2}"/>`;
      case "line": return `<line class="eqs" x1="${pr.x1}" y1="${pr.y1}" x2="${pr.x2}" y2="${pr.y2}"/>`;
      case "cable": { const c = at(pr.to); return `<line class="cab" x1="${pr.from[0]}" y1="${pr.from[1]}" x2="${f1(c[0])}" y2="${f1(c[1])}"/>`; }
      default: return "";
    }
  }

  function frame(ex, t) {
    const [A, B] = ex.poses;
    const j = joints(lerpPose(A, B || A, t));
    const props = ex.props || [];
    const back = props.filter((p) => !p.front).map((p) => propSvg(p, j)).join("");
    const front = props.filter((p) => p.front).map((p) => propSvg(p, j)).join("");
    let far = "";
    if (j.k2) far += line([j.p, j.k2, j.a2, j.f2], "lf");
    if (j.e2) far += line([j.s, j.e2, j.w2], "lf");
    return (
      back + far +
      line([j.p, j.k, j.a, j.f], "lm") +
      line([j.s, j.p], "tr") +
      `<circle class="hd" cx="${f1(j.h[0])}" cy="${f1(j.h[1])}" r="8.5"/>` +
      line([j.s, j.e, j.w], "lm") +
      front
    );
  }

  const FLOOR = `<line class="fl" x1="0" y1="141" x2="200" y2="141"/>`;
  function svg(ex, t, cls) {
    return `<svg class="${cls || "dg"}" viewBox="0 0 200 150" role="img" aria-label="${ex.name} form diagram">${FLOOR}<g class="fig">${frame(ex, t)}</g></svg>`;
  }

  // Animate an SVG between the start and finish positions, pausing at each end.
  function animate(el, ex, onPhase) {
    const g = el.querySelector(".fig");
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!g || !ex.poses || ex.poses.length < 2 || reduce) return () => {};
    const move = (ex.tempo || 1.4) * 1000, hold = 700, cyc = 2 * (move + hold);
    let raf, start = performance.now(), last = "";
    const ease = (x) => 0.5 - Math.cos(Math.PI * x) / 2;
    const tick = (now) => {
      const m = (now - start) % cyc;
      let t, ph;
      if (m < hold) { t = 0; ph = "start"; }
      else if (m < hold + move) { t = ease((m - hold) / move); ph = "move"; }
      else if (m < 2 * hold + move) { t = 1; ph = "end"; }
      else { t = 1 - ease((m - 2 * hold - move) / move); ph = "move"; }
      g.innerHTML = frame(ex, t);
      if (ph !== last && onPhase) { onPhase(ph); last = ph; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }

  // ---------- Library ----------
  const BAR_W = [45, 65, 95, 115, 135, 155, 185, 225];
  const DB_W = [10, 15, 20, 25, 30, 35, 40, 50];
  const REPS = [5, 6, 8, 10, 12, 15];
  const BW_REPS = [5, 8, 10, 12, 15, 20];
  const TIMES = [20, 30, 45, 60, 90, 120];
  const barArms = { ua: -58, fa: 160, armRel: true };

  const EX = [
    {
      id: "squat", name: "Back Squat", group: "Legs", muscles: "Quads, glutes, core", equip: "Barbell", kind: "weight",
      aliases: ["back squat", "squat", "squats", "barbell squat"], chips: { w: BAR_W, r: REPS },
      poses: [
        { t: 0, th: 0, sh: 0, ...barArms, at: ["a", 95, 138] },
        { t: 42, th: 88, sh: -32, ...barArms, at: ["a", 95, 138] },
      ],
      props: [{ type: "plate", at: "w", front: true }],
      steps: [
        "Put the bar on your upper back, not on your neck.",
        "Hold the bar with your hands a little wider than your shoulders.",
        "Stand with your feet apart at shoulder width. Turn your toes out a small distance.",
        "Breathe in fully. Tighten your stomach muscles.",
        "Move your hips back and bend your knees at the same time. Keep your chest up.",
        "Go down until your thighs are approximately level with the floor.",
        "Push through your full foot to stand up. Breathe out at the top.",
      ],
      tips: ["Your knees move in the same direction as your toes.", "Keep the bar above the middle of your foot at all times.", "Look at the floor approximately 1 m in front of you."],
      mistakes: ["The knees move in when you go up.", "The heels come up from the floor.", "The lower back becomes round at the bottom."],
      alts: [
        { name: "Bodyweight squat", equip: "None", note: "Same movement with arms straight out in front for balance. Do 15–25 slow reps." },
        { name: "Goblet squat", equip: "Dumbbell", note: "Hold one dumbbell against your chest. Great for learning good depth." },
        { name: "Leg press", equip: "Machine", note: "Easier on the back; push the platform with your whole foot." },
        { id: "lunge", name: "Lunge", equip: "None", note: "Works each leg on its own." },
      ],
    },
    {
      id: "bench", name: "Bench Press", group: "Chest", muscles: "Chest, shoulders, triceps", equip: "Barbell", kind: "weight",
      aliases: ["bench press", "bench", "barbell bench", "chest press"], chips: { w: BAR_W, r: REPS },
      poses: [
        { t: -90, th: 62, sh: -10, ua: 180, fa: 180, at: ["p", 112, 101] },
        { t: -90, th: 62, sh: -10, ua: 78, fa: -160, at: ["p", 112, 101] },
      ],
      props: [{ type: "rect", x: 40, y: 103, w: 88, h: 7 }, { type: "line", x1: 52, y1: 110, x2: 52, y2: 141 }, { type: "line", x1: 116, y1: 110, x2: 116, y2: 141 }, { type: "plate", at: "w", front: true }],
      steps: [
        "Lie on the bench. Put your eyes below the bar and your feet flat on the floor.",
        "Hold the bar with your hands a little wider than your shoulders.",
        "Pull your shoulder blades together.",
        "Lift the bar off the rack. Hold it straight above your shoulders.",
        "Lower the bar slowly to the middle of your chest.",
        "Keep your elbows at approximately 45° from your body.",
        "Push the bar up until your arms are straight.",
      ],
      tips: ["WARNING: For heavy weights, use a spotter or safety bars.", "Keep your buttocks on the bench and your feet on the floor.", "Keep your wrists straight and above your elbows."],
      mistakes: ["The bar hits the chest and comes up fast.", "The elbows point straight out to the sides. This can cause injury to the shoulders.", "The hips come up from the bench."],
      alts: [
        { id: "pushup", name: "Push-up", equip: "None", note: "The classic no-equipment chest exercise." },
        { name: "Dumbbell bench press", equip: "Dumbbells", note: "Each arm works on its own; easier to bail out safely." },
        { name: "Floor press", equip: "Dumbbells or barbell", note: "Lie on the floor; the floor stops you at a shoulder-friendly depth." },
      ],
    },
    {
      id: "deadlift", name: "Deadlift", group: "Back", muscles: "Hamstrings, glutes, back, grip", equip: "Barbell", kind: "weight",
      aliases: ["deadlift", "deadlifts", "dead lift"], chips: { w: [95, 135, 185, 225, 275, 315], r: [3, 5, 6, 8, 10] }, tempo: 1.6,
      poses: [
        { t: 62, th: 78, sh: -22, ua: 0, fa: 0, hd: -30, at: ["a", 95, 138] },
        { t: 0, th: 0, sh: 0, ua: 0, fa: 0, at: ["a", 95, 138] },
      ],
      props: [{ type: "plate", at: "w", r: 12, front: true }],
      steps: [
        "Stand with the bar above the middle of your feet. Put your feet apart at hip width.",
        "Bend down and hold the bar. Put your hands immediately outside your legs.",
        "Bend your knees until your shins touch the bar.",
        "Make your back flat and lift your chest.",
        "Tighten your stomach muscles. Push the floor down with your legs.",
        "Keep the bar against your legs as it moves up.",
        "Stand straight. Tighten your buttocks at the top.",
        "To lower the bar, move your hips back first. Then bend your knees.",
      ],
      tips: ["Push the floor down with your legs. Do not pull with your back.", "Keep the bar against your legs at all times.", "Stop at the bottom of each repetition and start again."],
      mistakes: ["The back becomes round.", "The bar moves away from the body.", "The body moves too far back at the top."],
      alts: [
        { name: "Single-leg hip hinge", equip: "None", note: "Stand on one leg, tip forward with a flat back while the other leg reaches back. 10 slow reps a side." },
        { id: "bridge", name: "Glute bridge", equip: "None", note: "Trains the same hip muscles lying down." },
        { name: "Romanian deadlift", equip: "Dumbbells", note: "Slight knee bend, push hips back, lower to mid-shin." },
        { name: "Kettlebell swing", equip: "Kettlebell", note: "A fast hip hinge; snap your hips forward." },
      ],
    },
    {
      id: "ohp", name: "Overhead Press", group: "Shoulders", muscles: "Shoulders, triceps, upper back", equip: "Barbell", kind: "weight",
      aliases: ["overhead press", "shoulder press", "military press", "ohp", "press"], chips: { w: [45, 55, 65, 75, 85, 95, 115], r: REPS },
      poses: [
        { t: 0, th: 0, sh: 0, ua: 28, fa: 172, at: ["a", 95, 138] },
        { t: -3, th: 0, sh: 0, ua: 178, fa: 180, at: ["a", 95, 138] },
      ],
      props: [{ type: "plate", at: "w", front: true }],
      steps: [
        "Stand with the bar on the front of your shoulders.",
        "Put your hands a little wider than your shoulders.",
        "Tighten your buttocks and stomach muscles. Make your body stiff.",
        "Push the bar straight up. Move your head back a small distance to let the bar go past.",
        "Make your arms straight above your head. Keep the bar above the middle of your feet.",
        "Lower the bar slowly to your shoulders.",
      ],
      tips: ["When the bar goes past your forehead, move your head forward below the bar.", "At the start, keep your elbows a little in front of the bar.", "Keep your ribs down. Do not lean back."],
      mistakes: ["The lower back bends to push the weight.", "The bar moves forward, not straight up.", "The legs push the weight. That is a different exercise (push press)."],
      alts: [
        { name: "Pike push-up", equip: "None", note: "Hips high in an upside-down V; lower your head toward the floor between your hands." },
        { name: "Dumbbell shoulder press", equip: "Dumbbells", note: "Seated or standing; palms facing forward." },
        { name: "Wall walk / handstand hold", equip: "None", note: "Advanced: walk your feet up a wall and hold." },
      ],
    },
    {
      id: "row", name: "Barbell Row", group: "Back", muscles: "Upper back, lats, biceps", equip: "Barbell", kind: "weight",
      aliases: ["barbell row", "bent over row", "row", "rows", "bent-over row"], chips: { w: [65, 95, 115, 135, 155, 185], r: REPS },
      poses: [
        { t: 68, th: 26, sh: -16, ua: 0, fa: 0, hd: -40, at: ["a", 92, 138] },
        { t: 68, th: 26, sh: -16, ua: -62, fa: 10, hd: -40, at: ["a", 92, 138] },
      ],
      props: [{ type: "plate", at: "w", front: true }],
      steps: [
        "Hold the bar with your hands immediately outside your knees. Your palms point to your body.",
        "Bend your knees a small distance.",
        "Move your hips back and lean forward until your back is almost flat.",
        "Let the bar hang below your shoulders. Keep your arms straight.",
        "Pull the bar to your lower ribs. Pull your shoulder blades together.",
        "Lower the bar slowly until your arms are straight.",
      ],
      tips: ["Keep your back flat and stationary. Only your arms move.", "Pull with your elbows, not with your hands.", "Stop for 1 second at the top."],
      mistakes: ["The body comes up more with each repetition.", "The hips push the weight up.", "The shoulders move up to the ears."],
      alts: [
        { name: "Table row (inverted row)", equip: "None", note: "Lie under a sturdy table, grip the edge and pull your chest up to it." },
        { name: "One-arm dumbbell row", equip: "Dumbbell", note: "One hand and knee on a bench; pull the dumbbell to your hip." },
        { name: "Towel door row", equip: "Towel", note: "Loop a towel around a solid door handle (door shut), lean back, pull yourself in." },
      ],
    },
    {
      id: "pullup", name: "Pull-up", group: "Back", muscles: "Lats, biceps, grip", equip: "Pull-up bar", kind: "reps",
      aliases: ["pull up", "pull ups", "pullup", "pullups", "pull-up", "pull-ups", "chin up", "chin ups", "chinup", "chin-ups"], chips: { w: [0, 10, 25, 45], r: [1, 3, 5, 8, 10, 12] },
      poses: [
        { t: 0, th: 12, sh: -70, ua: 180, fa: 180, at: ["w", 100, 12] },
        { t: 4, th: 18, sh: -76, ua: 26, fa: 172, at: ["w", 100, 12] },
      ],
      props: [{ type: "line", x1: 55, y1: 10, x2: 150, y2: 10 }, { type: "line", x1: 58, y1: 10, x2: 58, y2: 141 }, { type: "line", x1: 147, y1: 10, x2: 147, y2: 141 }],
      steps: [
        "Hold the bar with your palms away from you. Put your hands a little wider than your shoulders.",
        "Hang with your arms straight.",
        "Pull your shoulders down, away from your ears.",
        "Pull your elbows down to your ribs until your chin is above the bar.",
        "Lower your body slowly until your arms are straight.",
      ],
      tips: ["Tighten your buttocks and keep your legs stationary. This stops the body movement.", "If you cannot do a pull-up, jump up. Then lower your body slowly for 3–5 seconds.", "A grip with your palms to your body (chin-up) is easier."],
      mistakes: ["The arms do not become straight at the bottom.", "The legs kick and the body moves from side to side.", "The neck extends forward to get the chin above the bar."],
      alts: [
        { name: "Table row (inverted row)", equip: "None", note: "The best no-bar pulling exercise. Lie under a sturdy table and pull your chest to the edge." },
        { id: "latpulldown", name: "Lat pulldown", equip: "Machine", note: "Same motion seated, with adjustable weight." },
        { name: "Band-assisted pull-up", equip: "Band", note: "Loop a band on the bar and put a knee or foot in it." },
      ],
    },
    {
      id: "pushup", name: "Push-up", group: "Chest", muscles: "Chest, shoulders, triceps, core", equip: "None", kind: "reps",
      aliases: ["push up", "push ups", "pushup", "pushups", "push-up", "push-ups", "press up", "press ups"], chips: { w: [0], r: BW_REPS },
      poses: [
        { t: 73, th: -73, sh: -73, ft: 10, ua: 0, fa: 0, hd: 5, at: ["f", 30, 140] },
        { t: 86, th: -86, sh: -86, ft: 10, ua: -120, fa: 26, hd: 5, at: ["f", 30, 140] },
      ],
      steps: [
        "Put your hands on the floor, a little wider than your shoulders.",
        "Move your feet back. Make a straight line from your head to your heels.",
        "Bend your elbows. Lower your chest until it is approximately 10 cm from the floor.",
        "Push the floor away until your arms are straight.",
      ],
      tips: ["Tighten your buttocks and stomach muscles. This keeps your hips up.", "Keep your elbows at approximately 45° from your body.", "If it is too difficult, put your hands on a table or bench."],
      mistakes: ["The hips go down or go up.", "The chest goes only half of the distance down.", "The head moves down first."],
      alts: [
        { name: "Incline push-up", equip: "None", note: "Hands on a counter, table or stairs. The higher the hands, the easier." },
        { name: "Knee push-up", equip: "None", note: "Same as a push-up with your knees on the floor." },
        { id: "bench", name: "Bench press", equip: "Barbell", note: "The gym version with adjustable weight." },
      ],
    },
    {
      id: "plank", name: "Plank", group: "Core", muscles: "Abs, deep core, shoulders", equip: "None", kind: "time",
      aliases: ["plank", "planks", "forearm plank"], chips: { t: TIMES }, tempo: 2.2,
      poses: [
        { t: 79, th: -79, sh: -79, ft: 10, ua: 0, fa: 90, hd: 0, at: ["f", 30, 140] },
        { t: 80, th: -80, sh: -80, ft: 10, ua: 0, fa: 90, hd: 4, at: ["f", 30, 140] },
      ],
      steps: [
        "Put your forearms on the floor. Put your elbows below your shoulders.",
        "Move your feet back. Make a straight line from your head to your heels.",
        "Tighten your buttocks and stomach muscles.",
        "Push the floor away with your forearms.",
        "Hold this position. Breathe slowly.",
        "Stop when you cannot keep the correct position.",
      ],
      tips: ["To make it more difficult, pull your elbows toward your toes.", "Do a number of short, correct holds. This is better than one long, incorrect hold.", "Look at the floor immediately in front of your hands."],
      mistakes: ["The hips go down to the floor.", "The hips go up too high.", "You hold your breath."],
      alts: [
        { name: "Knee plank", equip: "None", note: "Same position with knees on the floor. Good for building up." },
        { name: "Side plank", equip: "None", note: "On one forearm, body sideways, hips lifted. Works the sides of your core." },
        { name: "Dead bug", equip: "None", note: "On your back, slowly lower the opposite arm and leg while keeping your lower back flat." },
      ],
    },
    {
      id: "lunge", name: "Lunge", group: "Legs", muscles: "Quads, glutes, balance", equip: "None", kind: "reps",
      aliases: ["lunge", "lunges", "split squat", "split squats", "walking lunge", "walking lunges"], chips: { w: [0, 10, 15, 20, 25, 30], r: [6, 8, 10, 12, 15, 20] },
      poses: [
        { t: 0, th: 18, sh: 0, th2: -18, sh2: -18, ft2: 55, ua: 0, fa: 0, at: ["a", 112, 138] },
        { t: 0, th: 82, sh: -2, th2: -10, sh2: -78, ft2: 8, ua: 0, fa: 0, at: ["a", 112, 138] },
      ],
      steps: [
        "Stand straight. Move one foot forward a long step.",
        "Bend both knees. Lower your body straight down until your rear knee is almost on the floor.",
        "Keep your front knee above your ankle. Let your rear heel come up.",
        "Push through your front heel to come up.",
        "Do the steps again with the other leg.",
      ],
      tips: ["Move your body down, not forward.", "Keep your upper body straight.", "At the start, hold a wall or chair for balance."],
      mistakes: ["The front knee moves in.", "The step is too short. The front knee moves too far forward.", "The body leans forward above the front leg."],
      alts: [
        { name: "Reverse lunge", equip: "None", note: "Step backward instead. Easier on the knees." },
        { name: "Step-up", equip: "Stairs or chair", note: "Step onto a sturdy step and stand up tall on one leg." },
        { name: "Dumbbell lunge", equip: "Dumbbells", note: "Hold a dumbbell in each hand to make it harder." },
      ],
    },
    {
      id: "curl", name: "Dumbbell Curl", group: "Arms", muscles: "Biceps, forearms", equip: "Dumbbells", kind: "weight",
      aliases: ["dumbbell curl", "bicep curl", "biceps curl", "curl", "curls", "bicep curls"], chips: { w: DB_W, r: [8, 10, 12, 15] }, tempo: 1.1,
      poses: [
        { t: 0, th: 0, sh: 0, ua: 2, fa: 4, at: ["a", 95, 138] },
        { t: 0, th: 0, sh: 0, ua: 6, fa: 160, at: ["a", 95, 138] },
      ],
      props: [{ type: "db", at: "w", front: true }],
      steps: [
        "Stand straight. Hold a dumbbell in each hand with your palms forward.",
        "Keep your elbows against your sides.",
        "Lift the dumbbells to your shoulders.",
        "Tighten your biceps at the top.",
        "Lower the dumbbells slowly for 2–3 seconds until your arms are straight.",
      ],
      tips: ["Only your forearms move.", "When you lower the weight slowly, the muscle gets stronger.", "Use a weight that you can lift 8 times without body movement."],
      mistakes: ["The body moves to lift the weight.", "The elbows move forward.", "The arms do not become straight at the bottom."],
      alts: [
        { name: "Backpack curl", equip: "None", note: "Fill a backpack with books, hold the top handle and curl it." },
        { name: "Towel curl (isometric)", equip: "Towel", note: "Stand on a towel, grip both ends, and pull up hard for 20–30 seconds." },
        { name: "Chin-up", equip: "Pull-up bar", note: "Palms facing you; works biceps hard." },
      ],
    },
    {
      id: "bridge", name: "Glute Bridge", group: "Legs", muscles: "Glutes, hamstrings", equip: "None", kind: "reps",
      aliases: ["glute bridge", "glute bridges", "bridge", "bridges", "hip thrust", "hip thrusts"], chips: { w: [0, 25, 45, 95, 135], r: [10, 12, 15, 20] },
      poses: [
        { t: -90, th: 150, sh: 20, ft: 95, ua: 90, fa: 90, hd: 0, at: ["a", 128, 136] },
        { t: -119, th: 104, sh: 2, ft: 95, ua: 90, fa: 90, hd: 29, at: ["a", 128, 136] },
      ],
      steps: [
        "Lie on your back. Bend your knees and put your feet flat on the floor.",
        "Put your feet apart at hip width.",
        "Put your arms on the floor at your sides.",
        "Push through your heels. Lift your hips until your shoulders, hips and knees are in a straight line.",
        "Tighten your buttocks for 1 second at the top.",
        "Lower your hips slowly.",
      ],
      tips: ["Push through your heels. You can lift your toes a small distance.", "Keep your ribs down. This keeps your lower back flat.", "To make it more difficult, use one leg or put a weight on your hips."],
      mistakes: ["The lower back bends and the buttocks do not do the work.", "The feet are too far from the body.", "The repetitions are too fast."],
      alts: [
        { name: "Single-leg glute bridge", equip: "None", note: "One foot on the floor, the other leg straight up. Much harder." },
        { name: "Barbell hip thrust", equip: "Barbell + bench", note: "Upper back on a bench, bar across your hips." },
        { id: "deadlift", name: "Deadlift", equip: "Barbell", note: "Heavier hip exercise for the gym." },
      ],
    },
    {
      id: "latpulldown", name: "Lat Pulldown", group: "Back", muscles: "Lats, upper back, biceps", equip: "Machine", kind: "weight",
      aliases: ["lat pulldown", "lat pull down", "pulldown", "pull down", "lat pulldowns"], chips: { w: [40, 50, 60, 70, 80, 100, 120], r: [8, 10, 12, 15] },
      poses: [
        { t: -8, th: 90, sh: 0, ua: 174, fa: 180, at: ["p", 88, 108] },
        { t: -14, th: 90, sh: 0, ua: 12, fa: 166, hd: 4, at: ["p", 88, 108] },
      ],
      props: [
        { type: "rect", x: 66, y: 110, w: 38, h: 6 }, { type: "line", x1: 82, y1: 116, x2: 82, y2: 141 },
        { type: "rect", x: 100, y: 97, w: 20, h: 6 }, { type: "line", x1: 60, y1: 4, x2: 60, y2: 141 }, { type: "line", x1: 60, y1: 4, x2: 92, y2: 4 },
        { type: "cable", from: [92, 4], to: "w" }, { type: "handle", at: "w", front: true },
      ],
      steps: [
        "Sit with your thighs below the pad. Put your feet flat on the floor.",
        "Hold the bar a little wider than your shoulders. Your palms point away from you.",
        "Lean back a small distance.",
        "Pull the bar down to your upper chest.",
        "At the bottom, pull your shoulder blades down and together.",
        "Let the bar go up slowly until your arms are straight.",
      ],
      tips: ["Pull with your elbows.", "Keep your chest up toward the bar.", "Control the bar when it goes up. Do not let it pull you."],
      mistakes: ["The bar goes behind the neck.", "The body leans far back and moves forward and back.", "The weight is too heavy. The bar moves only a short distance."],
      alts: [
        { name: "Table row (inverted row)", equip: "None", note: "Lie under a sturdy table and pull your chest to the edge." },
        { name: "Prone Y-raise", equip: "None", note: "Lie face down, arms overhead in a Y, lift them off the floor and hold 2 seconds." },
        { id: "pullup", name: "Pull-up", equip: "Pull-up bar", note: "The bodyweight version of this movement." },
        { name: "Band pulldown", equip: "Band", note: "Anchor a band high on a door and pull it down to your chest." },
      ],
    },
    {
      id: "dips", name: "Dips", group: "Arms", muscles: "Triceps, chest, shoulders", equip: "Dip bars", kind: "reps",
      aliases: ["dip", "dips", "tricep dips", "triceps dips", "parallel bar dips"], chips: { w: [0, 10, 25, 45], r: [5, 8, 10, 12, 15] },
      poses: [
        { t: 4, th: -6, sh: -70, ua: 0, fa: 0, at: ["w", 100, 82] },
        { t: 22, th: 6, sh: -60, ua: -100, fa: 4, at: ["w", 100, 82] },
      ],
      props: [{ type: "rect", x: 74, y: 82, w: 56, h: 4 }, { type: "line", x1: 80, y1: 86, x2: 80, y2: 141 }, { type: "line", x1: 124, y1: 86, x2: 124, y2: 141 }],
      steps: [
        "Hold the bars. Lift your body until your arms are straight.",
        "Lean forward a small distance. Bend your knees and cross your ankles.",
        "Bend your elbows. Lower your body until your upper arms are almost level with the floor.",
        "Push up until your arms are straight.",
      ],
      tips: ["Keep your shoulders down, away from your ears.", "A straight body works the triceps more. A forward lean works the chest more.", "Go down only as far as your shoulders feel comfortable."],
      mistakes: ["The body goes too far down. This puts too much load on the shoulders.", "The shoulders move up at the bottom.", "The legs move from side to side."],
      alts: [
        { name: "Chair dips", equip: "Chair", note: "Hands on the edge of a sturdy chair behind you, feet on the floor. Bend elbows to lower." },
        { name: "Diamond push-up", equip: "None", note: "Push-up with hands close together under your chest. Works triceps." },
        { name: "Triceps pushdown", equip: "Cable machine", note: "Push a cable bar down, keeping elbows at your sides." },
      ],
    },
    {
      id: "wallsit", name: "Wall Sit", group: "Legs", muscles: "Quads", equip: "None", kind: "time",
      aliases: ["wall sit", "wall sits", "wallsit"], chips: { t: TIMES }, tempo: 2.4,
      poses: [
        { t: 0, th: 90, sh: 0, ua: 34, fa: 70, at: ["p", 67, 110] },
        { t: 0, th: 90, sh: 0, ua: 34, fa: 74, hd: 3, at: ["p", 67, 110] },
      ],
      props: [{ type: "rect", x: 50, y: 0, w: 8, h: 141, rx: 0, cls: "wall" }],
      steps: [
        "Stand with your back flat against a wall.",
        "Move your feet approximately 60 cm forward from the wall. Put them apart at hip width.",
        "Move your back down the wall until your knees are at approximately 90°.",
        "Hold this position. Keep your back against the wall and your weight on your heels.",
      ],
      tips: ["Keep your knees above your ankles.", "If it is too difficult, do not go down as far.", "Breathe slowly. Count your breaths."],
      mistakes: ["The knees go forward past the toes. The feet are too near the wall.", "The hands push on the thighs.", "You hold your breath."],
      alts: [
        { name: "Bodyweight squat hold", equip: "None", note: "Hold the bottom of a squat without a wall." },
        { name: "Spanish squat", equip: "Band", note: "Band behind the knees, anchored in front; lean back and sit." },
        { id: "squat", name: "Back squat", equip: "Barbell", note: "Heavier leg strength in the gym." },
      ],
    },
    {
      id: "calfraise", name: "Calf Raise", group: "Legs", muscles: "Calves", equip: "None", kind: "reps",
      aliases: ["calf raise", "calf raises", "calves", "heel raise", "heel raises"], chips: { w: [0, 10, 20, 25, 45], r: [10, 12, 15, 20, 25] }, tempo: 0.9,
      poses: [
        { t: 0, th: 0, sh: 0, ft: 90, ua: 2, fa: 2, at: ["f", 106, 139] },
        { t: 0, th: 0, sh: 0, ft: 42, ua: 2, fa: 2, at: ["f", 106, 139] },
      ],
      steps: [
        "Stand straight with your feet apart at hip width.",
        "If necessary, hold a wall for balance.",
        "Push through the front of your feet. Lift your heels as high as possible.",
        "Stop for 1 second at the top.",
        "Lower your heels slowly to the floor.",
      ],
      tips: ["For a larger stretch, stand on a step. Let your heels go below the step.", "Move slowly. Calf muscles get stronger with more time under load.", "To make it more difficult, use one leg."],
      mistakes: ["Small, fast movements up and down.", "The weight moves to the outer side of the foot.", "The knees bend to help the lift."],
      alts: [
        { name: "Single-leg calf raise", equip: "None", note: "Same exercise on one foot. Hold a wall." },
        { name: "Jump rope", equip: "Jump rope", note: "Light bouncing on the balls of your feet." },
        { name: "Dumbbell calf raise", equip: "Dumbbells", note: "Hold weights at your sides." },
      ],
    },
  ];

  window.WORKOUT_LIB = { EX, svg, animate };
})();
