// Phase 3: import from Strong / Hevy / FitNotes, and the AI coach screen (with /api/coach faked).
const { open, ok, failed } = require('./helpers.cjs');

const STRONG = `Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Distance;Seconds;Notes;Workout Notes;RPE
2026-10-01 18:00:00;"Push, heavy";1h;Bench Press (Barbell);W;45;10;0;0;;;
2026-10-01 18:00:00;"Push, heavy";1h;Bench Press (Barbell);1;135;8;0;0;;;
2026-10-01 18:00:00;"Push, heavy";1h;Bench Press (Barbell);2;135;7;0;0;"felt ""good""";;
2026-10-01 18:00:00;"Push, heavy";1h;Zercher Squat;1;95;10;0;0;;;
2026-10-03 18:00:00;Legs;1h;Squat (Barbell);1;185;5;0;0;;;
2026-10-03 18:00:00;Legs;1h;Plank;1;0;0;0;60;;;`;
const HEVY = `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
Pull,"5 Oct 2026, 10:00","5 Oct 2026, 11:00",,Lat Pulldown (Cable),,,0,normal,50,10,,,
Pull,"5 Oct 2026, 10:00","5 Oct 2026, 11:00",,Pull Up,,,0,normal,0,8,,,`;
const FITNOTES = `Date,Exercise,Category,Weight (lbs),Reps,Distance,Distance Unit,Time,Comment
2026-10-07,Flat Barbell Bench Press,Chest,140,5,,,,
2026-10-07,Sled Push,Legs,200,1,,,,`;

(async () => {
  let coachMode = 'ok', sent = null;
  const t = await open({
    mockApi: async (r) => {
      sent = JSON.parse(r.request().postData() || '{}');
      if (coachMode === 'nokey') return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'no_ai', message: "The coach isn't set up yet: add your Gemini API key in Netlify." }) });
      r.fulfill({ contentType: 'application/json', body: JSON.stringify({ answer: '**Good** progress on bench.\n- Add 5 lb next time\n- Keep squats at 3 × 5' }) });
    },
  });
  const { page: p, base, errors, shot, top } = t;
  await p.goto(base + '/');
  await p.evaluate(() => { localStorage.setItem('wk:test:people', JSON.stringify([{ id: 'p1', name: 'Sam', planId: 'ppl3' }])); localStorage.setItem('wk:person', 'p1'); });
  await p.reload(); await p.waitForTimeout(300);

  // ---------- pure parts ----------
  const u = await p.evaluate(async (csv) => {
    const m = await import('/js/features/importer.js');
    const rows = m.parseCsv(csv.STRONG);
    return { n: rows.length, quoted: rows[2].Notes, wo: rows[0]['Workout Name'], fmts: [m.detect(m.parseCsv(csv.STRONG)), m.detect(m.parseCsv(csv.HEVY)), m.detect(m.parseCsv(csv.FITNOTES)), m.detect(m.parseCsv('a,b\n1,2'))],
      match: ['Bench Press (Barbell)', 'Pull Up', 'Flat Barbell Bench Press', 'Lat Pulldown (Cable)', 'Romanian Deadlift (Dumbbell)', 'Zercher Squat'].map((x) => m.matchExercise(x)) };
  }, { STRONG, HEVY, FITNOTES });
  ok(u.n === 6 && u.quoted === 'felt "good"' && u.wo === 'Push, heavy', 'CSV reader handles ; separators and quotes');
  ok(u.fmts.join() === 'strong,hevy,fitnotes,', 'recognises Strong, Hevy and FitNotes files: ' + u.fmts.join());
  ok(u.match.join() === 'bench,pullup,bench,latpulldown,rdl,', 'matches common names to the library: ' + u.match.join());

  // ---------- import flow ----------
  const closeAll = async () => { while (await p.locator('.sheet').count()) await top().locator('[data-act=close]').first().click(); };
  const importFile = async (name, text) => {
    await closeAll();
    await p.click('[data-act=people]'); await top().locator('[data-act=imp-open]').click();
    await top().locator('#impfile').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(text) });
    await p.waitForTimeout(300);
  };
  await importFile('strong.csv', STRONG);
  const prev = await top().locator('#impbody').textContent();
  ok(/3 workout days|2 workout days/.test(prev) && /Zercher Squat/.test(prev), 'preview counts days and lists new exercises: ' + prev.replace(/\s+/g, ' ').slice(0, 120));
  await shot('30-import-preview');
  await top().locator('[data-act=imp-go]').click(); await p.waitForTimeout(400);
  let logs = await p.evaluate(() => JSON.parse(localStorage.getItem('wk:test:logs') || '[]'));
  const bench = logs.find((l) => l.exId === 'bench');
  ok(logs.length === 4 && bench.sets.length === 2 && bench.source === 'strong' && bench.importId, 'Strong: 4 logs saved, warm-up left out, tagged');
  ok(logs.find((l) => l.exId === 'plank').kind === 'time' && logs.find((l) => l.exId === 'plank').sets[0].s === 60, 'timed sets kept as time');
  const custom = await p.evaluate(() => JSON.parse(localStorage.getItem('wk:test:exercises') || '[]'));
  ok(custom.length === 1 && custom[0].name === 'Zercher Squat', 'unknown exercise added to your own exercises');
  await importFile('strong.csv', STRONG);
  ok(/already imported/.test(await top().locator('#impbody').textContent()) && await top().locator('[data-act=imp-go]').isDisabled(), 'importing the same file again skips everything');
  await importFile('hevy.csv', HEVY); await top().locator('[data-act=imp-go]').click(); await p.waitForTimeout(300);
  await importFile('fitnotes.csv', FITNOTES); await top().locator('[data-act=imp-go]').click(); await p.waitForTimeout(300);
  logs = await p.evaluate(() => JSON.parse(localStorage.getItem('wk:test:logs') || '[]'));
  ok(logs.find((l) => l.source === 'hevy' && l.exId === 'latpulldown').unit === 'kg', 'Hevy: kilograms kept');
  ok(logs.some((l) => l.source === 'fitnotes' && l.exId === 'bench' && l.sets[0].w === 140), 'FitNotes: bench matched');
  await closeAll(); await p.click('[data-act=people]');
  const undoLinks = await top().locator('[data-act=imp-undo]').count();
  ok(undoLinks === 3, 'settings list each import with Undo');
  await top().locator('[data-act=imp-undo]').first().click(); await p.waitForTimeout(300);
  logs = await p.evaluate(() => JSON.parse(localStorage.getItem('wk:test:logs') || '[]'));
  ok(!logs.some((l) => l.source === 'strong') && logs.length === 4, 'Undo removes only that import');
  await closeAll();

  // ---------- coach ----------
  await p.click('nav [data-tab=progress]');
  ok(await p.locator('text=Ask the coach').count() === 1, 'coach card on Progress');
  await p.click('[data-act=coach-idea] >> nth=0'); await p.waitForTimeout(400);
  ok(/Working sets per muscle/.test(sent.summary) && /Bench Press/.test(sent.summary) && /Plan: 3-day/.test(sent.summary), 'sends a training summary with the question');
  ok(await p.locator('.coach .a b').first().textContent() === 'Good' && await p.locator('.coach .a li').count() === 2, 'answer shown with bold and bullet points');
  await p.fill('#coachq', 'And squats?'); await p.click('[data-act=coach-ask]'); await p.waitForTimeout(400);
  ok(sent.history.length === 2 && sent.history[0].role === 'user', 'follow-up questions include the conversation so far');
  await shot('31-coach', { fullPage: true });
  coachMode = 'nokey';
  await p.fill('#coachq', 'One more?'); await p.click('[data-act=coach-ask]'); await p.waitForTimeout(400);
  ok(/isn't set up yet/.test(await p.locator('.coach .note').textContent()), 'missing key explained in the card');
  await p.click('[data-act=coach-clear]'); await p.waitForTimeout(200);
  ok(await p.locator('.coach .q').count() === 0, 'Start over clears the conversation');

  ok(errors.length === 0, 'no page errors ' + JSON.stringify(errors));
  await t.close();
  process.exitCode = failed() ? 1 : 0;
})().catch((e) => { console.error(e.message); process.exit(1); });
