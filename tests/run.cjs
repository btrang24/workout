// Runs every *.test.* file in this folder, one after another. `npm test`
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
const files = fs.readdirSync(__dirname).filter((f) => /\.test\.(c?js|mjs)$/.test(f)).sort();
let bad = 0;
for (const f of files) {
  console.log(`\n== ${f}`);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  if (r.status !== 0) bad++;
}
console.log(bad ? `\n${bad} test file(s) failed` : '\nAll tests passed');
process.exit(bad ? 1 : 0);
