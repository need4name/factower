// ── config.js ─────────────────────────────────────────────────────────────────
// Build switches. TEST is for development builds: it hands out towers and
// opens every level so combat can be tested without playing through the
// campaign. Set test: false for a real release.
// In a test build a new save can still be a normal campaign save
// (save.campaign = true); the test perks only apply to test saves.
const BUILD = {
  test: true,
  // Every time you open the Dock or Armoury, stock is topped up to this
  testStock: { gunner: 40, gunner2: 12, bomber: 20, barricade: 20, siphon: 12 },
  allLevels: true,        // every level in the Dock is playable
  allUpgrades: true,      // mid-battle tower mods without reaching their story unlock
  unlockAll: false        // every feature (Market, Uplink, belts, towers…) open from the start
};

// Do the test perks apply to this save? (Saves from before the choice
// existed count as test saves.)
function isTestSave(save) {
  if (!BUILD.test) return false;
  const s = save || (typeof SaveManager !== 'undefined' ? SaveManager.load() : null);
  return !(s && s.campaign);
}

// Tops the stockpile up to BUILD.testStock (test saves only). Returns the save.
function applyTestStock() {
  if (!isTestSave()) return SaveManager.load();
  return SaveManager.update(s => {
    if (!s.stockpile) s.stockpile = {};
    Object.entries(BUILD.testStock).forEach(([t, n]) => { if ((s.stockpile[t] || 0) < n) s.stockpile[t] = n; });
  });
}
