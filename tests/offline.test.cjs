// Offline start: after one visit, the app must open with no network (service worker copy).
const { chromium } = require('playwright');
const { start } = require('./server.cjs');
let failed = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) failed++; };
(async () => {
  const { srv, base } = await start();
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('https://www.gstatic.com/**', (r) => r.abort());
  const p = await ctx.newPage(); p.setDefaultTimeout(10000);
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base + '/');
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload(); await p.waitForTimeout(800); // now controlled: files get saved as they load
  ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'service worker controls the page');
  await ctx.setOffline(true);
  await p.reload(); await p.waitForTimeout(800);
  ok(await p.locator('.tile').count() > 50, 'app opens offline with all exercises');
  await p.click('[data-act=ex][data-id=squat]'); await p.waitForTimeout(300);
  ok(await p.locator('.sheet .steps li').count() > 3, 'exercise page works offline');
  await p.goto(base + '/?share_url=' + encodeURIComponent('https://youtu.be/abcdefghijk')).catch(() => {});
  await p.waitForTimeout(600);
  ok(await p.locator('#imurl').count() === 1, 'shared link opens the import screen offline (saved page)');
  ok(errors.length === 0, 'no page errors ' + JSON.stringify(errors));
  await b.close(); srv.close();
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e.message); process.exit(1); });
