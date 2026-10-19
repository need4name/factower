// ── config.js ─────────────────────────────────────────────────────────────────
// Build switches. TEST is for development builds: it hands out towers and
// opens every level so combat can be tested without playing through the
// campaign. Set test: false for a real release.
const BUILD = {
  test: true,
  // Every time you open the Dock or Armoury, stock is topped up to this
  testStock: { gunner: 40, bomber: 20, barricade: 20 },
  allLevels: true,        // every level in the Dock is playable
  allUpgrades: true,      // mid-battle tower mods without reaching their story unlock
  unlockAll: false        // every feature (Market, Uplink, belts, towers…) open from the start
};

// Tops the stockpile up to BUILD.testStock (test builds only). Returns the save.
function applyTestStock() {
  if (!BUILD.test) return SaveManager.load();
  return SaveManager.update(s => {
    if (!s.stockpile) s.stockpile = {};
    Object.entries(BUILD.testStock).forEach(([t, n]) => { if ((s.stockpile[t] || 0) < n) s.stockpile[t] = n; });
  });
}
