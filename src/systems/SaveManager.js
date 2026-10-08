// ── SaveManager.js ────────────────────────────────────────────────────────────
// Single place that reads and writes save slots, and upgrades old saves.
//
// STORAGE
// ─────────
// localStorage['factower_active_slot'] — index of the slot in play (0-2)
// localStorage['factower_save_<slot>'] — JSON save for that slot
//
// SAVE VERSIONING
// ────────────────
// Every save carries saveVersion. Bump SAVE_VERSION whenever the save format
// changes and append a step to SAVE_MIGRATIONS: SAVE_MIGRATIONS[n] upgrades a
// version-n save to version n+1. Saves from before versioning count as 0.
// migrate() runs every pending step in order when a slot is loaded from
// SaveScene, so the rest of the game can assume the current format.
//
// STALE SNAPSHOTS
// ────────────────
// Scenes keep this.saveData from create(). write(snapshot) replaces the whole
// save with it, which can undo anything written since (e.g. by Factory.save).
// When only touching a few fields, prefer update(), which re-reads the latest
// save before applying the change.

const SAVE_VERSION = 1;

const SAVE_MIGRATIONS = [
  // 0 → 1: fill in fields added before versioning existed (formerly the
  // ad-hoc migration block in SaveScene).
  save => {
    if (save.nuts            === undefined) save.nuts            = 0;
    if (save.bolts           === undefined) save.bolts           = 0;
    if (save.skillTree       === undefined) save.skillTree       = {};
    if (save.merchantFatigue === undefined) save.merchantFatigue = { chrome: 0, ricochet: 0, doubleDown: 0 };
    if (save.merchantUnlocks === undefined) save.merchantUnlocks = { chrome: false, ricochet: false, doubleDown: false };
    if (save.chromeState     === undefined) save.chromeState     = { pityCount: 0 };
    if (save.ricochetState   === undefined) save.ricochetState   = {};
    if (save.ddState         === undefined) save.ddState         = {};
    if (save.tutorials       === undefined) save.tutorials       = {};
    if (save.flags           === undefined) save.flags           = { armouryUnlocked: false, skillTreeUnlocked: false, baseTutDone: false };
    if (save.materials       === undefined) save.materials       = { plasticScrap: 2, refinedPlastic: 0, salvagedMetal: 0 };
    if (save.factoryActive   === undefined) save.factoryActive   = true;
  }
];

const SaveManager = {
  keyFor(slot) {
    return 'factower_save_' + slot;
  },

  activeSlot() {
    return localStorage.getItem('factower_active_slot');
  },

  setActiveSlot(slot) {
    localStorage.setItem('factower_active_slot', slot);
  },

  exists(slot) {
    return localStorage.getItem(this.keyFor(slot)) !== null;
  },

  // Returns the parsed save for a slot (default: active slot), or null.
  load(slot = this.activeSlot()) {
    if (slot === null) return null;
    const raw = localStorage.getItem(this.keyFor(slot));
    return raw === null ? null : JSON.parse(raw);
  },

  // Replaces the whole save for a slot (default: active slot).
  write(save, slot = this.activeSlot()) {
    if (slot === null || !save) return;
    localStorage.setItem(this.keyFor(slot), JSON.stringify(save));
  },

  // Read-modify-write against the latest stored save. Returns the updated
  // save, or null if the slot is empty.
  update(mutator, slot = this.activeSlot()) {
    const save = this.load(slot);
    if (!save) return null;
    mutator(save);
    this.write(save, slot);
    return save;
  },

  remove(slot) {
    localStorage.removeItem(this.keyFor(slot));
  },

  // Brings a save up to SAVE_VERSION. Returns true if anything changed.
  migrate(save) {
    const from = save.saveVersion || 0;
    if (from >= SAVE_VERSION) return false;
    for (let v = from; v < SAVE_VERSION; v++) SAVE_MIGRATIONS[v](save);
    save.saveVersion = SAVE_VERSION;
    return true;
  }
};
