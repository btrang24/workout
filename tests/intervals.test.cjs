// Timed (interval) workouts: import with timing, edit, and run the interval timer.
// Uses Playwright's fake clock to fast-forward through work and rest periods.
const { open, ok, failed } = require('./helpers.cjs');

const TABATA = {
  routine: { found: true, name: 'KB Tabata', focus: 'Full body', notes: 'Tabata style.', timer: { timed: true, work: 20, rest: 10, rounds: 8, roundRest: 0 },
    exercises: [
      { name: 'Kettlebell swing', libraryId: '', group: 'Full body', kind: 'reps', sets: 8, reps: '20 sec', seconds: 0, note: '' },
      { name: 'Goblet squat', libraryId: '', group: 'Legs', kind: 'reps', sets: 8, reps: '20 sec', seconds: 0, note: '' },
    ] },
  source: { kind: 'reddit', title: 'Your next KB tabata', readByGemini: true },
};

(async () => {
  const t = await open({ mockApi: (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(TABATA) }) });
  const { page: p, base, errors, shot, top } = t;
  await p.clock.install();
  await p.addInitScript(() => {
    window.__wl = { req: 0, rel: 0 };
    Object.defineProperty(navigator, 'wakeLock', { value: { request: async () => { window.__wl.req++; return { release: async () => { window.__wl.rel++; }, addEventListener() {} }; } } });
  });
  await p.goto(base + '/');
  await p.evaluate(() => { localStorage.setItem('wk:test:people', JSON.stringify([{ id: 'p1', name: 'Sam' }])); localStorage.setItem('wk:person', 'p1'); localStorage.setItem('wk:ivVoice', 'off'); });
  await p.reload(); await p.clock.runFor(500);

  // ---------- timeline (pure) ----------
  const tl = await p.evaluate(async () => {
    const { timeline, totalSecs } = await import('/js/features/intervals.js');
    const r = (timer) => ({ timer, slots: [{ options: [{ label: 'A' }] }, { options: [{ label: 'B' }], secs: 40 }] });
    const a = r({ work: 20, rest: 10, rounds: 2, roundRest: 0 }), b = r({ work: 30, rest: 15, rounds: 2, roundRest: 60 });
    return { a: timeline(a).map((s) => s.type[0] + s.secs).join(' '), at: totalSecs(a), b: timeline(b).map((s) => s.type[0] + s.secs).join(' ') };
  });
  ok(tl.a === 'r10 w20 r10 w40 r10 w20 r10 w40', 'timeline: ready, work/rest, own time for one exercise, no rest at the very end: ' + tl.a);
  ok(tl.at === 150, 'total time 150 sec');
  ok(tl.b === 'r10 w30 r15 w40 r60 w30 r15 w40', 'rest between rounds replaces the normal rest: ' + tl.b);

  // ---------- import a timed workout (Reddit, read by Gemini) ----------
  await p.click('nav [data-tab=today]'); await p.click('[data-act=rt-import]');
  await p.fill('#imurl', 'https://www.reddit.com/r/kettlebell_workouts/comments/1y1xq3w/your_next_kb_tabata/');
  await p.click('#imgo'); await p.waitForSelector('text=Check the workout');
  ok(await top().locator('[data-act=rt-mode][data-v=timed].on').count() === 1, 'review screen opens in "Timed intervals" mode');
  ok(await top().locator('[data-rtt=work]').inputValue() === '20' && await top().locator('[data-rtt=rounds]').inputValue() === '8', 'timing filled in: 20 sec work, 8 rounds');
  await top().locator('[data-rtt=rounds]').fill('2');
  await top().locator('[data-rf=secs][data-i="1"]').fill('30');
  await shot('40-interval-review');
  await top().locator('[data-act=rt-save]').first().click(); await p.waitForSelector('text=Start the timer');
  const r = await p.evaluate(() => JSON.parse(localStorage.getItem('wk:test:routines'))[0]);
  ok(r.timer.rounds === 2 && r.timer.work === 20 && r.slots[1].secs === 30, 'saved with timing (2 rounds, squat 30 sec)');
  ok(/20 sec on · 10 sec off · 2 rounds/.test(await top().locator('.rest').textContent()), 'workout page shows the timing');
  await shot('41-interval-routine');

  // ---------- run the timer ----------
  await top().locator('[data-act=iv-start]').click(); await p.clock.runFor(300);
  const phase = async () => (await top().locator('.ivphase .lab').textContent()).trim() + ' | ' + (await top().locator('.ivphase .clock').textContent()).trim() + ' | ' + (await top().locator('.ivphase .ex').textContent()).trim();
  ok(/^Get ready \| 0:10 \| Next: Kettlebell swing$/.test(await phase()), 'starts with 10 sec get-ready: ' + await phase());
  ok(await p.evaluate(() => window.__wl.req) === 1, 'screen kept on');
  await p.clock.runFor(10_000);
  ok(/^Work \| 0:20 \| Kettlebell swing$/.test(await phase()), 'then work: ' + await phase());
  await shot('42-interval-work');
  await p.clock.runFor(20_000);
  ok(/^Rest \| 0:10 \| Next: Goblet squat$/.test(await phase()), 'then rest, showing what is next: ' + await phase());
  await shot('43-interval-rest');
  await top().locator('[data-act=iv-pause]').click(); await p.clock.runFor(30_000);
  ok(/^Rest \| 0:10/.test(await phase()), 'pause stops the clock');
  await top().locator('[data-act=iv-pause]').click(); await p.clock.runFor(10_000);
  ok(/^Work \| 0:30 \| Goblet squat$/.test(await phase()), 'resume, then the squat runs its own 30 sec: ' + await phase());
  await top().locator('[data-act=iv-next]').click(); await p.clock.runFor(300);
  ok(/Round 2 of 2/.test(await top().locator('.ivphase .meta').textContent()), 'skip moves on to round 2');
  await p.clock.runFor(200_000);
  ok((await top().locator('.ivphase .lab').textContent()).trim() === 'Done!', 'finishes after the last round');
  await top().locator('[data-act=iv-save]').click(); await p.clock.runFor(500);
  const logs = await p.evaluate(() => JSON.parse(localStorage.getItem('wk:test:logs') || '[]'));
  ok(logs.length === 2 && logs[0].kind === 'time' && logs[0].sets.length === 2 && logs[0].sets[0].s === 20 && logs[1].sets[0].s === 30, 'saved to history: each exercise 2 × its work time');
  ok(await p.evaluate(() => window.__wl.rel) === 1, 'screen lock released at the end');

  ok(errors.length === 0, 'no page errors ' + JSON.stringify(errors));
  await t.close();
  process.exitCode = failed() ? 1 : 0;
})().catch((e) => { console.error(e.message); process.exit(1); });
