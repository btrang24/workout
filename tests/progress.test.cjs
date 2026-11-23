// Phase 2: muscles this week (body map), body weight log, dark mode.
const { open, ok, failed } = require('./helpers.cjs');
const iso = (n = 0) => { const d = new Date(); d.setDate(d.getDate() - n); const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };

(async () => {
  const t = await open();
  const { page: p, base, errors, shot } = t;
  await p.goto(base + '/');
  await p.evaluate((today) => {
    localStorage.setItem('wk:test:people', JSON.stringify([{ id: 'p1', name: 'Sam' }]));
    localStorage.setItem('wk:person', 'p1');
    const L = (id, exId, n, date) => ({ id, exId, kind: 'weight', date, unit: 'lb', ts: 1, personId: 'p1', sets: Array.from({ length: n }, () => ({ w: 100, r: 8 })) });
    localStorage.setItem('wk:test:logs', JSON.stringify([L('a', 'bench', 3, today), L('b', 'squat', 4, today), L('c', 'row', 2, '2020-01-06')]));
  }, iso());
  await p.reload(); await p.waitForTimeout(400);

  // ---------- muscle mapping ----------
  const m = await p.evaluate(async () => {
    const { muscleMap, weekSets } = await import('/js/features/muscles.js');
    const ex = (id) => window.WORKOUT_LIB.EX.find((e) => e.id === id);
    return { bench: muscleMap(ex('bench')), pullup: muscleMap(ex('pullup')), custom: muscleMap({ group: 'Legs', muscles: '' }), week: weekSets() };
  });
  ok(m.bench.primary.join() === 'chest' && m.bench.secondary.includes('triceps'), 'bench = chest, helped by triceps ' + JSON.stringify(m.bench));
  ok(m.pullup.primary.length > 0, 'pull-up maps to muscles ' + JSON.stringify(m.pullup));
  ok(m.custom.primary.join() === 'quads', 'custom leg exercise falls back to its group');
  ok(m.week.chest === 3 && m.week.triceps === 1.5 && m.week.quads === 4, 'this week: chest 3 sets, triceps 1.5, quads 4 (old logs ignored)');

  // ---------- Today line + Progress card ----------
  await p.click('nav [data-tab=today]');
  const line = await p.locator('.mweek').textContent();
  ok(/Quads 4/.test(line) && /Chest 3/.test(line), 'Today shows this week\'s top muscles: ' + line.trim());
  await p.click('.mweek');
  ok(await p.locator('text=Muscles this week').count() === 1, 'tapping it opens Progress');
  ok(await p.locator('svg.body ellipse[fill-opacity]').count() >= 4, 'body map shades trained muscles');
  ok(/Not trained yet:.*calves/.test(await p.locator('.chartbox').first().textContent()), 'lists muscles not trained yet');
  await shot('20-muscles');

  // ---------- Body weight ----------
  await p.fill('#bwin', '182.4'); await p.click('[data-act=bw-save]'); await p.waitForTimeout(200);
  let bw = await p.evaluate(() => JSON.parse(localStorage.getItem('wk:test:bodyweight')));
  ok(bw.length === 1 && bw[0].w === 182.4, 'weigh-in saved');
  await p.fill('#bwin', '181'); await p.click('[data-act=bw-save]'); await p.waitForTimeout(200);
  bw = await p.evaluate(() => JSON.parse(localStorage.getItem('wk:test:bodyweight')));
  ok(bw.length === 1 && bw[0].w === 181, 'same day updates instead of adding');
  await p.evaluate((d) => {
    const arr = JSON.parse(localStorage.getItem('wk:test:bodyweight'));
    arr.push({ id: 'p1_x', personId: 'p1', date: d[0], w: 185, unit: 'lb' }, { id: 'p1_y', personId: 'p1', date: d[1], w: 183, unit: 'lb' });
    localStorage.setItem('wk:test:bodyweight', JSON.stringify(arr));
  }, [iso(20), iso(3)]);
  await p.reload(); await p.waitForTimeout(400); await p.click('nav [data-tab=progress]');
  const stats = await p.locator('.chartbox', { has: p.locator('#bwin') }).textContent();
  ok(/7-day average\s*182/.test(stats), '7-day average (181 and 183) = 182');
  ok(/30 days\s*-4/.test(stats), '30-day change = -4');
  ok(await p.locator('.chartbox', { has: p.locator('#bwin') }).locator('svg path').count() === 1, 'body weight chart drawn');
  await shot('21-bodyweight', { fullPage: true });

  // ---------- Dark mode ----------
  const bg = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(await bg() === 'rgb(245, 243, 238)', 'light by default');
  await p.click('[data-act=people]'); await p.click('[data-act=theme][data-v=dark]');
  ok(await bg() === 'rgb(18, 22, 25)', 'Dark switches colours at once');
  await p.reload(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.documentElement.dataset.theme) === 'dark' && await bg() === 'rgb(18, 22, 25)', 'Dark is remembered on this phone');
  await p.click('nav [data-tab=library]'); await shot('22-dark-library');
  await p.click('nav [data-tab=progress]'); await shot('23-dark-progress', { fullPage: true });
  await p.click('[data-act=people]'); await p.click('[data-act=theme][data-v=auto]');
  await p.emulateMedia({ colorScheme: 'dark' });
  ok(await bg() === 'rgb(18, 22, 25)', 'Auto follows the phone\'s dark mode');
  await p.emulateMedia({ colorScheme: 'light' });
  ok(await bg() === 'rgb(245, 243, 238)', 'Auto follows the phone\'s light mode');

  ok(errors.length === 0, 'no page errors ' + JSON.stringify(errors));
  await t.close();
  process.exitCode = failed() ? 1 : 0;
})().catch((e) => { console.error(e.message); process.exit(1); });
