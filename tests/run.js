// ── Factower test runner ──────────────────────────────────────────────────────
// Serves the game from the repo root, then runs every test and reports
// PASS / FAIL. A test fails if it exits non-zero (a FAIL: check or a page
// error in the game).
//
//   node run.js            everything
//   node run.js unit       only the fast logic tests (no browser)
//   node run.js tut bomb7  just these browser tests
//
// Browser tests use Playwright's Chromium; set CHROME to use another binary.
// Screenshots land in tests/out/ (not committed).
const http = require('http'), fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(__dirname, 'out');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };

const args = process.argv.slice(2);
const unit = fs.readdirSync(path.join(__dirname, 'unit')).filter(f => f.endsWith('.js'));
const browser = fs.readdirSync(path.join(__dirname, 'browser')).filter(f => f.endsWith('.js'));
const pick = (list) => args.length && args[0] !== 'unit' ? list.filter(f => args.includes(f.replace('.js', ''))) : list;
const runUnit = pick(unit), runBrowser = args[0] === 'unit' ? [] : pick(browser);

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(0, '127.0.0.1', () => {
  const BASE_URL = 'http://127.0.0.1:' + server.address().port;
  ['', 'tut', 'e2e'].forEach(d => fs.mkdirSync(path.join(OUT, d), { recursive: true }));
  const results = [];
  const run = (label, file, cwd, env) => {
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [file], { cwd, env: Object.assign({}, process.env, env), encoding: 'utf8', timeout: 600000 });
    const ok = r.status === 0;
    const secs = Math.round((Date.now() - t0) / 1000);
    console.log((ok ? 'PASS ' : 'FAIL ') + label.padEnd(16) + secs + 's');
    if (!ok) console.log(((r.stdout || '') + (r.stderr || '')).split('\n').filter(l => /FAIL|rror|assert/i.test(l)).slice(0, 8).map(l => '     ' + l).join('\n'));
    results.push(ok);
  };
  runUnit.forEach(f => run('unit/' + f.replace('.js', ''), path.join(__dirname, 'unit', f), ROOT, {}));
  runBrowser.forEach(f => run('browser/' + f.replace('.js', ''), path.join(__dirname, 'browser', f), __dirname, { BASE_URL, OUT }));
  server.close();
  const failed = results.filter(x => !x).length;
  console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
});
