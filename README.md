# factower

A tower-defence and factory game for phones, built with Phaser 3. Play it at
https://need4name.github.io/factower/ (deployed from `main`).

No build step: `index.html` loads the scripts in `src/` in order. To play
locally, serve the repo root with any static server, for example
`python3 -m http.server 8765`, and open http://localhost:8765/.

## Tests

Automated checks live in `tests/`:

```
cd tests
npm install
npx playwright install chromium   # first time only
npm test                          # everything (about 15 minutes)
npm run unit                      # only the fast logic tests
node run.js tut bomb7             # just the named browser tests
```

`run.js` serves the game itself, runs each test and prints PASS / FAIL. A
test fails when one of its checks fails or the game throws an error.
Screenshots go to `tests/out/` (not committed). Set `CHROME` to use a
different Chromium binary.

- `tests/unit/` — factory, belts, routes and save logic, run in Node.
- `tests/browser/` — the game in a real browser: the tutorial, a full play
  session, menus, the Market, salvage, upgrades, abilities, towers, story
  scenes, the Dock, raids, stars, the Ortega choice, the Bomber line, the new
  towers, Endless, contracts and Borga.
