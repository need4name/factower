// ── SaveBackup.js ─────────────────────────────────────────────────────────────
// Saves live in this browser's storage, so clearing site data (or switching
// phones) loses them. A save can be exported as a text code and restored
// from one.
//
//   SaveBackup.show(scene, slot)     export / restore panel for a slot
//   SaveBackup.encode(save) / decode(code)

const SaveBackup = {
  PREFIX: 'FACTOWER1:',

  encode(save) {
    return SaveBackup.PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(save))));
  },

  // Returns the save object, or null if the code isn't a Factower save
  decode(code) {
    try {
      const c = String(code || '').replace(/\s+/g, '');
      if (!c.startsWith(SaveBackup.PREFIX)) return null;
      const save = JSON.parse(decodeURIComponent(escape(atob(c.slice(SaveBackup.PREFIX.length)))));
      return save && typeof save === 'object' && (save.saveVersion !== undefined || save.completedLevels) ? save : null;
    } catch (e) { return null; }
  },

  copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(() => true, () => false);
    return Promise.resolve(false);
  },

  show(scene, slot) {
    UI.modal(scene, {
      title: 'Save backup', icon: 'shield', accent: UI.C.blue,
      body: 'Your progress is stored in this browser. Copy a save code and keep it somewhere safe (a note or a message to yourself). Restore it here, or on another phone.',
      buttons: [
        { label: 'COPY SAVE CODE', variant: 'primary', onTap: () => SaveBackup.exportSlot(scene, slot) },
        { label: 'RESTORE FROM CODE', variant: 'secondary', onTap: () => SaveBackup.importInto(scene, slot) },
        { label: 'CLOSE' }
      ]
    });
  },

  exportSlot(scene, slot) {
    const save = SaveManager.load(slot);
    if (!save) return;
    const code = SaveBackup.encode(save);
    SaveBackup.copy(code).then(ok => {
      if (ok) UI.toast(scene, 'Save code copied — paste it somewhere safe', 'good');
      else window.prompt('Copy this save code and keep it somewhere safe:', code);
    });
  },

  // Restore over a slot (asks first if it holds a save)
  importInto(scene, slot, onDone) {
    const code = window.prompt('Paste your save code:');
    if (code === null) return;
    const save = SaveBackup.decode(code);
    if (!save) { UI.toast(scene, 'That isn’t a Factower save code', 'bad'); return; }
    const apply = () => {
      SaveManager.migrate(save);
      save.factoryActive = true;
      SaveManager.write(save, slot);
      SaveManager.setActiveSlot(slot);
      UI.toast(scene, 'Save restored', 'good');
      if (onDone) onDone(); else scene.time.delayedCall(500, () => scene.scene.restart());
    };
    if (!SaveManager.exists(slot)) return apply();
    UI.modal(scene, {
      title: 'Replace this save?', icon: 'trash', accent: UI.C.red,
      body: 'The save in this slot will be replaced by the one in the code. This can’t be undone.',
      buttons: [{ label: 'CANCEL' }, { label: 'REPLACE', variant: 'danger', onTap: apply }]
    });
  }
};
