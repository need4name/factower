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
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
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
  // Tests run one at a time, asynchronously, so this process keeps serving the game
  const run = (label, file, cwd, env) => new Promise(resolve => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [file], { cwd, env: Object.assign({}, process.env, env) });
    let out = '';
    child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
    const kill = setTimeout(() => { out += '\nFAIL: timed out after 10 minutes'; child.kill(); }, 600000);
    child.on('close', code => {
      clearTimeout(kill);
      const ok = code === 0;
      console.log((ok ? 'PASS ' : 'FAIL ') + label.padEnd(16) + Math.round((Date.now() - t0) / 1000) + 's');
      if (!ok) console.log(out.split('\n').filter(l => /FAIL|rror|assert/i.test(l)).slice(0, 8).map(l => '     ' + l).join('\n'));
      results.push(ok);
      resolve();
    });
  });
  (async () => {
    for (const f of runUnit) await run('unit/' + f.replace('.js', ''), path.join(__dirname, 'unit', f), ROOT, {});
    for (const f of runBrowser) await run('browser/' + f.replace('.js', ''), path.join(__dirname, 'browser', f), __dirname, { BASE_URL, OUT });
    server.close();
    const failed = results.filter(x => !x).length;
    console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
  })();
});
