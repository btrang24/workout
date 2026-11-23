// Phase 1, in the gym: suggestions (overload), tick-to-repeat sets, rest timer, PR pop-up,
// workout mode and settings. Phone-sized browser, Firebase off.
const { open, ok, failed } = require('./helpers.cjs');

const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();

(async () => {
  const t = await open();
  const { page: p, base, errors, shot, top } = t;
  await p.goto(base + '/');
  // A person and one earlier bench session: 3 × 12 @ 135 lb (top of the 8-12 range).
  await p.evaluate((d) => {
    localStorage.setItem('wk:test:people', JSON.stringify([{ id: 'p1', name: 'Sam', planId: 'ppl3' }]));
    localStorage.setItem('wk:person', 'p1');
    localStorage.setItem('wk:test:logs', JSON.stringify([{ id: 'old1', exId: 'bench', kind: 'weight', date: d, unit: 'lb', ts: 1, personId: 'p1', personName: 'Sam', sets: [{ w: 135, r: 12 }, { w: 135, r: 12 }, { w: 135, r: 12 }] }]));
  }, yesterday);
  // Fake Screen Wake Lock (the test browser has none) that records requests and releases.
  await p.addInitScript(() => {
    window.__wl = { req: 0, rel: 0 };
    Object.defineProperty(navigator, 'wakeLock', { value: { request: async () => { window.__wl.req++; return { release: async () => { window.__wl.rel++; }, addEventListener() {} }; } } });
  });
  await p.reload(); await p.waitForTimeout(400);

  // ---------- overload rules (pure functions) ----------
  const cases = await p.evaluate(async () => {
    const { suggest, parseRange } = await import('/js/features/overload.js');
    const W = { id: 'x', kind: 'weight' }, R = { id: 'y', kind: 'reps' }, T = { id: 'z', kind: 'time' };
    const L = (sets, unit = 'lb') => ({ sets, unit });
    return {
      range: [parseRange('8-12'), parseRange('15 each leg'), parseRange('max')],
      up: suggest(W, { reps: '8-12' }, L([{ w: 135, r: 12 }, { w: 135, r: 12 }])),
      same: suggest(W, { reps: '8-12' }, L([{ w: 135, r: 10 }, { w: 135, r: 9 }, { w: 135, r: 8 }])),
      kg: suggest(W, { reps: '5-8' }, L([{ w: 60, r: 8 }, { w: 60, r: 8 }], 'kg')),
      reps: suggest(R, { reps: '15' }, L([{ r: 10 }, { r: 12 }])),
      time: suggest(T, null, L([{ s: 45 }, { s: 40 }])),
      none: suggest(W, null, null),
    };
  });
  ok(JSON.stringify(cases.range) === '[[8,12],[15,15],null]', 'rep ranges are read from the plan');
  ok(cases.up.w === 140 && cases.up.r === 8 && cases.up.up, 'hit the top of the range -> +5 lb, back to 8 reps');
  ok(cases.same.w === 135 && cases.same.r === 9 && !cases.same.up, 'missed the top -> same weight, one more rep than the worst set');
  ok(cases.kg.w === 62.5 && cases.kg.r === 5, 'kilograms go up 2.5 kg');
  ok(cases.reps.r === 11, 'bodyweight: one more rep');
  ok(cases.time.s === 50, 'timed: 5 seconds longer');
  ok(cases.none === null, 'no history -> no suggestion');

  // ---------- session shows today's suggestion ----------
  await p.click('nav [data-tab=today]');
  await p.click('[data-act=sess-start]'); await p.waitForTimeout(300);
  const sgText = await top().locator('.sgline').first().textContent();
  ok(/140 lb × 5/.test(sgText), 'session shows "💡 Today: 140 lb × 5" (plan says 5-8 reps) (' + sgText.trim() + ')');
  await shot('10-session-suggestion');
  ok(await p.evaluate(() => window.__wl.req) === 1, 'screen kept on when a workout opens');

  // ---------- log sheet: prefilled sets, tick ✓, rest timer ----------
  await top().locator('[data-act=slot-log][data-i="0"]').click(); await p.waitForTimeout(200);
  ok(await top().locator('.set.pre').count() === 3, 'log screen pre-fills 3 suggested sets');
  ok(await top().locator('#lgsets input[data-f=w]').first().inputValue() === '140', 'suggested weight filled in');
  await top().locator('[data-act=lg-done][data-i="0"]').click(); await p.waitForTimeout(300);
  ok(await top().locator('.set.done').count() === 1, 'tick ✓ marks the set done');
  ok(await p.locator('.restpill:not(.hide)').count() === 1, 'rest timer starts after ✓');
  const t1 = await p.locator('.restpill .t b').textContent();
  ok(/^(2:00|1:59|1:58)$/.test(t1), 'barbell lift rests 2:00 (' + t1 + ')');
  await shot('11-log-ticked');
  await p.click('.restpill [data-act=rest-add][data-v="15"]');
  ok(/^2:1[0-5]$/.test(await p.locator('.restpill .t b').textContent()), '+15 adds 15 seconds');
  await top().locator('[data-act=close]').first().click(); await top().locator('[data-act=close]').first().click();
  ok(await p.evaluate(() => window.__wl.rel) === 1, 'screen lock released when the workout is closed');
  await p.reload(); await p.waitForTimeout(500);
  ok(await p.locator('.restpill:not(.hide)').count() === 1, 'timer survives a reload');
  await p.click('.restpill [data-act=rest-stop]');
  ok(await p.locator('.restpill.hide').count() === 1, '✕ stops the timer');

  // ---------- save: only ticked/edited sets count; PR pop-up ----------
  await p.click('nav [data-tab=today]'); await p.click('[data-act=sess-open]'); await p.waitForTimeout(200);
  await top().locator('[data-act=slot-log][data-i="0"]').click(); await p.waitForTimeout(200);
  await top().locator('[data-act=lg-done][data-i="0"]').click();
  await top().locator('[data-act=log-save]').first().click(); await p.waitForTimeout(400);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('wk:test:logs')).find((l) => l.id !== 'old1'));
  ok(saved.sets.length === 1 && saved.sets[0].w === 140 && saved.sets[0].r === 5, 'untouched suggestions are not saved (1 ticked set saved)');
  ok(saved.pr === true, 'log marked as a personal best');
  ok(await p.locator('.prpop').count() === 1 && /140 lb × 5/.test(await p.locator('.prpop').textContent()), '🏆 pop-up shows the new best');
  await shot('12-pr');
  await p.click('.prpop');
  ok(await p.locator('.prpop').count() === 0, 'tap closes the pop-up');

  // ---------- workout mode ----------
  await top().locator('[data-act=wm-open]').click(); await p.waitForTimeout(200);
  ok(/2 of 7/.test(await top().locator('.sbar .sp').textContent()), 'workout mode opens at the first exercise not done yet');
  await top().locator('[data-act=wm-go][data-v="0"]').click();
  ok(/Done set 2: 140 lb × 5/.test(await top().locator('[data-act=wm-set]').textContent()), 'big button repeats the set before');
  await top().locator('[data-act=wm-set]').click(); await p.waitForTimeout(300);
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem('wk:test:logs')).find((l) => l.id !== 'old1'));
  ok(after.sets.length === 2, 'one tap adds a set to the log');
  ok(await p.locator('.restpill:not(.hide)').count() === 1, 'and starts the rest timer');
  await shot('13-workout-mode');
  await top().locator('[data-act=wm-go][data-v="1"]').click(); await p.waitForTimeout(100);
  ok(/Enter set 1/.test(await top().locator('[data-act=wm-set]').textContent()), 'no history: button asks to enter the set');
  for (let i = 2; i <= 6; i++) await top().locator(`[data-act=wm-go][data-v="${i}"]`).click();
  await top().locator('[data-act=wm-finish]').click(); await p.waitForTimeout(400);
  const sess = await p.evaluate(() => JSON.parse(localStorage.getItem('wk:test:sessions'))[0]);
  ok(!!sess.finishedAt, 'Finish in workout mode finishes the session');

  // ---------- settings ----------
  await p.click('[data-act=rest-stop]').catch(() => {});
  await p.click('[data-act=people]'); await p.waitForTimeout(150);
  ok(await top().locator('text=Rest timer between sets').count() === 1, 'settings show rest timer options');
  await top().locator('[data-act=rest-pref][data-v=off]').click();
  await top().locator('[data-act=close]').first().click();
  await p.click('[data-act=log-ex][data-id=bench]').catch(async () => { await p.click('.fab'); await p.selectOption('#lgex', 'bench'); });
  await p.waitForTimeout(200);
  await top().locator('[data-act=lg-done][data-i="0"]').click(); await p.waitForTimeout(200);
  ok(await p.locator('.restpill.hide').count() === 1, 'rest timer "Off" is respected');
  await top().locator('[data-act=close]').first().click();

  // History shows the PB badge
  await p.click('nav [data-tab=history]');
  ok(await p.locator('.prb').count() === 1, 'history shows a 🏆 PB badge');

  ok(errors.length === 0, 'no page errors ' + JSON.stringify(errors));
  await t.close();
  process.exitCode = failed() ? 1 : 0;
})().catch((e) => { console.error(e.message); process.exit(1); });
