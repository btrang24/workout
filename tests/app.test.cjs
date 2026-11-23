// Main app flows in a phone-sized browser (Firebase off, /api faked).
// Run with: npm test   (screenshots go to $SHOTS or the system temp folder, never the repo)
const { open, ok, failed } = require('./helpers.cjs');

const ROUTINE = {
  routine: { found: true, name: '15-min dumbbell upper body', focus: 'Chest, back, arms', notes: '3 rounds. Rest 60 seconds between rounds.',
    exercises: [
      { name: 'DB bench press', libraryId: 'dbbench', group: 'Chest', kind: 'weight', sets: 3, reps: '10', note: '' },
      { name: 'Bear crawl', libraryId: '', group: 'Full body', kind: 'time', sets: 3, reps: '30 sec', note: 'Knees an inch off the floor' },
      { name: 'Hammer curl', libraryId: 'hammer', group: 'Arms', kind: 'weight', sets: 3, reps: '12', note: '' },
    ] },
  source: { kind: 'youtube', title: '15 MIN DUMBBELL UPPER BODY WORKOUT', watchedVideo: true },
};

(async () => {
  let apiMode = 'ok', sent = null;
  const t = await open({
    mockApi: async (r) => {
      sent = JSON.parse(r.request().postData() || '{}');
      if (apiMode === 'blocked') return r.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'couldnt_read', message: "Couldn't read anything from that link (some sites, like Instagram, often block this)." }) });
      if (apiMode === 'error') return r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'ai_failed', message: "The AI couldn't read this one." }) });
      r.fulfill({ contentType: 'application/json', body: JSON.stringify(ROUTINE) });
    },
  });
  const { page: p, base, errors, shot, top } = t;
  const closeTop = () => top().locator('[data-act=close]').first().click();

  // ---------- Library & photos ----------
  await p.goto(base + '/'); await p.waitForTimeout(500);
  ok(await p.$$eval('.tile', (x) => x.length) > 50, 'library shows all exercises');
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } });
  await p.waitForTimeout(400);
  const broken = await p.$$eval('.tile img', (a) => a.filter((i) => !i.naturalWidth).length);
  ok(broken === 0, 'all tile photos load');
  await p.evaluate(() => scrollTo(0, 0));
  await shot('01-library');

  // ---------- Dictation parser ----------
  const parse = (s) => p.evaluate((x) => window.__parseSpoken(x), s);
  const cases = [
    ['Bench press, 3 sets of 8 at 135 pounds', { ex: 'bench', sets: 3, reps: 8, w: 135, unit: 'lb' }],
    ['squat 225 for 5', { ex: 'squat', w: 225, reps: 5 }],
    ['plank 3 sets of 45 seconds', { ex: 'plank', sets: 3, secs: 45 }],
    ['plank a minute and a half', { ex: 'plank', secs: 90 }],
    ['three sets of eight reps deadlift at two hundred twenty five', { ex: 'deadlift', sets: 3, reps: 8, w: 225 }],
    ['bench 60 kilos 5 reps', { ex: 'bench', unit: 'kg', w: 60, reps: 5 }],
  ];
  for (const [s, want] of cases) {
    const got = await parse(s);
    ok(Object.entries(want).every(([k, v]) => got[k] === v), `dictation: "${s}" -> ${JSON.stringify(got)}`);
  }

  // ---------- Exercise page ----------
  await p.click('[data-act=ex][data-id=bench]'); await p.waitForTimeout(300);
  ok(await top().locator('#fphase').count() === 1, 'exercise page shows start/finish photos');
  await p.waitForTimeout(1500);
  ok((await top().locator('#fphase').textContent()) === 'Finish', 'photo switches to Finish');
  ok(await top().locator('.steps li').count() >= 4, 'exercise page shows steps');
  await shot('02-exercise');
  await closeTop();

  // ---------- Quick log + person ----------
  await p.click('nav [data-tab=today]');
  await p.fill('#quick', 'Bench press, 3 sets of 8 at 135 pounds'); await p.click('[data-act=quick-go]'); await p.waitForTimeout(200);
  ok(await top().locator('#lgsets input[data-f=w]').count() === 3, 'quick log fills 3 sets from dictation');
  await top().locator('[data-act=log-save]').first().click(); await p.waitForTimeout(200);
  await p.fill('#pname', 'Alex'); await p.click('[data-act=person-add]'); await p.waitForTimeout(300);
  ok(await p.locator('.card').count() === 1, 'log saved after picking a person');

  // History over several days -> progress chart + personal best
  for (const [d, w, r] of [['2026-11-01', 115, 8], ['2026-11-05', 125, 8], ['2026-11-09', 130, 6]]) {
    await p.click('.fab'); await p.selectOption('#lgex', 'bench'); await p.fill('#lgdate', d); await p.dispatchEvent('#lgdate', 'change');
    await p.fill('#lgsets input[data-f=w]', String(w)); await p.fill('#lgsets input[data-f=r]', String(r));
    await top().locator('[data-act=log-save]').first().click(); await p.waitForTimeout(120);
  }
  await p.click('nav [data-tab=progress]'); await p.waitForTimeout(200); await p.selectOption('#progex', 'bench'); await p.waitForTimeout(200);
  ok(await p.locator('#chart').count() === 1, 'progress chart drawn');
  await shot('03-progress', { fullPage: true });
  await p.click('nav [data-tab=history]');
  const before = await p.locator('.card').count();
  await p.locator('.card .del').first().click(); await p.waitForTimeout(200);
  ok(await p.locator('.card').count() === before - 1, 'delete from history');
  await p.reload(); await p.waitForTimeout(400); await p.click('nav [data-tab=history]');
  ok(await p.locator('.card').count() === before - 1, 'data persists after reload');

  // History paging: an old log is hidden behind "Show older"
  await p.click('.fab'); await p.selectOption('#lgex', 'squat'); await p.fill('#lgdate', '2025-10-01'); await p.dispatchEvent('#lgdate', 'change');
  await p.fill('#lgsets input[data-f=w]', '100'); await p.fill('#lgsets input[data-f=r]', '5');
  await top().locator('[data-act=log-save]').first().click(); await p.waitForTimeout(200);
  ok(await p.locator('text=Show older (1 more)').count() === 1, 'history shows recent weeks, older behind a button');
  await p.click('[data-act=hist-more]'); await p.click('[data-act=hist-more]'); await p.waitForTimeout(100);
  ok(await p.locator('.dayh', { hasText: '2025' }).count() === 1, '"Show older" reveals older workouts');

  // ---------- Custom exercise from an alternative ----------
  await p.click('nav [data-tab=library]'); await p.click('[data-act=ex][data-id=pullup]'); await p.waitForTimeout(200);
  await top().locator('[data-act=alt-add]').first().click(); await p.waitForTimeout(150);
  await top().locator('[data-act=ex-save]').first().click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('wk:test:exercises') || '[]').length) === 1, 'custom exercise saved');
  while (await p.locator('.sheet').count()) await closeTop();

  // ---------- Plans & sessions ----------
  await p.click('nav [data-tab=today]');
  await p.click('[data-act=plans]'); await p.waitForTimeout(150);
  await top().locator('[data-act=plan-set][data-id=ppl4]').click(); await p.waitForTimeout(150);
  await top().locator('[data-act=plan-cardio]').click(); await p.waitForTimeout(150);
  await closeTop();
  ok(await p.isVisible('text=4-day PPL · up next'), 'plan card shows next day');
  await p.click('[data-act=sess-start]'); await p.waitForTimeout(300);
  await top().locator('[data-act=slot-pick][data-i="0"][data-v=dbbench]').click(); await p.waitForTimeout(150);
  await top().locator('[data-act=slot-log][data-i="0"]').click(); await p.waitForTimeout(150);
  const ws = await top().locator('#lgsets input[data-f=w]').all(), rs = await top().locator('#lgsets input[data-f=r]').all();
  ok(ws.length === 3, 'plan slot pre-fills 3 sets');
  for (let i = 0; i < ws.length; i++) { await ws[i].fill('60'); await rs[i].fill('8'); }
  await top().locator('[data-act=log-save]').first().click(); await p.waitForTimeout(300);
  await shot('04-session');
  await top().locator('[data-act=sess-finish]').first().click(); await p.waitForTimeout(300);
  ok(await p.isVisible('text=Legs 1'), 'plan moves on to the next day');
  await p.click('[data-act=log-ex][data-id=walk]'); await top().locator('[data-act=lg-chip][data-v="1800"]').click(); await top().locator('[data-act=log-save]').first().click(); await p.waitForTimeout(200);
  ok(await p.isVisible('text=30 / 150 min'), 'cardio minutes counted');

  // ---------- Workouts from videos ----------
  await p.click('[data-act=rt-import]');
  await p.fill('#imurl', 'https://www.youtube.com/watch?v=abcdefghijk'); await p.click('#imgo');
  await p.waitForSelector('text=Check the workout', { timeout: 5000 });
  ok(sent && sent.url.includes('youtube') && sent.library.length > 50, 'import sends link and library');
  ok(await top().locator('[data-rf=name][data-i="1"]').inputValue() === 'Bear crawl', 'unmatched exercise offered as new');
  await top().locator('[data-rf=reps][data-i="2"]').fill('15');
  await top().locator('[data-act=rt-up][data-i="1"]').click();
  await top().locator('[data-act=rt-save]').first().click(); await p.waitForSelector('text=Start this workout');
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('wk:test:routines'))[0]);
  ok(saved.slots.map((s) => s.options[0].label).join(',') === 'Bear crawl,Dumbbell Bench Press,Hammer Curl' && saved.slots[2].reps === '15', 'routine saved in edited order');
  await top().locator('[data-act=rt-start]').first().click(); await p.waitForTimeout(300);
  ok(await top().locator('text=Watch the video').count() === 1, 'routine session links to the video');
  await top().locator('[data-act=sess-finish]').first().click(); await p.waitForTimeout(200);
  for (const [mode, text] of [['blocked', 'often block this'], ['error', "couldn't read this one"]]) {
    apiMode = mode;
    await p.click('[data-act=rt-import]'); await p.fill('#imurl', 'https://www.instagram.com/reel/abc/'); await p.click('#imgo');
    await p.waitForSelector(`text=${text}`, { timeout: 5000 }); ok(true, `import shows "${mode}" message`);
    await closeTop();
  }
  apiMode = 'ok';
  await p.goto(base + '/?share_title=Reel&share_text=' + encodeURIComponent('Try this https://www.tiktok.com/@coach/video/123'));
  await p.waitForSelector('text=Check the workout', { timeout: 5000 });
  ok(sent.url === 'https://www.tiktok.com/@coach/video/123' && !(await p.evaluate(() => location.search)), 'share from another app opens import');

  ok(errors.length === 0, 'no page errors ' + JSON.stringify(errors));
  await t.close();
  process.exitCode = failed() ? 1 : 0;
})().catch((e) => { console.error(e.message); process.exit(1); });
