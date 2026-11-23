// Shared test helpers: browser at phone size, page-error capture, simple ok/fail output.
const { chromium } = require('playwright');
const os = require('os'), path = require('path');
const { start } = require('./server.cjs');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'workout-shots'); // never inside the repo
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failed++; };
async function open({ mockApi } = {}) {
  const { srv, base } = await start();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('https://www.gstatic.com/**', (r) => r.abort());
  if (mockApi) await ctx.route('**/api/**', mockApi);
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  const close = async () => { await browser.close(); srv.close(); };
  const shot = (name, opts = {}) => page.screenshot({ path: path.join(SHOTS, name + '.png'), ...opts });
  const top = () => page.locator('.sheet').last();
  return { page, base, errors, close, shot, top };
}
module.exports = { open, ok, failed: () => failed, SHOTS };
