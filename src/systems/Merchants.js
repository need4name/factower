// ── Merchants.js ──────────────────────────────────────────────────────────────
// One place for everything the three merchant games share: who they are, when
// they join, what a play costs, what it pays, and how Gambling upgrades from
// the Uplink change those numbers.
//
// Economy in one line: sell towers for nuts → stake nuts with a merchant →
// win bolts → spend bolts in the Uplink.

const MERCHANT_FREE_PLAYS = 5;     // plays before fatigue starts to bite
const MERCHANT_BASE_EDGE  = 0.30;  // house edge baked into base payouts

const MERCHANTS = [
  { id: 'chrome', fx: 'chrome', name: 'Chrome', tag: 'THE SLOTS', colour: 0xf2a93b, scene: 'ChromeScene',
    baseCost: 2, recruitLevel: 1, unit: 'SPIN',
    desc: 'Spin three reels. Match symbols to win bolts.',
    bio: 'A chrome-plated slot cabinet that talks back. Turned up on your dock the night you won your first battle.' },
  { id: 'ricochet', fx: 'ricochet', name: 'Ricochet', tag: 'THE BOARD', colour: 0x52c47f, scene: 'RicochetScene',
    baseCost: 3, recruitLevel: 2, unit: 'SHOT',
    desc: 'Aim a ball through the pegs. More hits, more bolts.',
    bio: 'Ex-Tianxia engineer. Built a peg board out of the company logo and charges you to knock it down.' },
  { id: 'doubleDown', fx: 'doubledown', name: 'Double-Down', tag: 'PRESS YOUR LUCK', colour: 0xe5534b, scene: 'DoubleDownScene',
    baseCost: 4, recruitLevel: 3, unit: 'ROUND',
    desc: 'Roll dice, bank points — or push your luck and lose it all.',
    bio: 'A dice shark who follows the winning side. Shows up once your island looks like it might survive.' }
];

const Merchants = {
  list() { return MERCHANTS; },
  get(id) { return MERCHANTS.find(m => m.id === id); },

  completed(save) {
    return (save && save.completedLevels && save.completedLevels.storyline1) || [];
  },

  // Merchants join as the story progresses (derived from completed levels, so
  // old saves pick them up automatically).
  isRecruited(save, id) {
    const m = Merchants.get(id);
    return !!m && Merchants.completed(save).includes(m.recruitLevel);
  },

  // Merchants who join by clearing this level (for the victory screen).
  recruitedBy(levelId) { return MERCHANTS.filter(m => m.recruitLevel === levelId); },

  // Fresh Gambling-branch effects for this save.
  effects(save) {
    skillTreeEffects.rebuildFromSaveData(save || {});
    return skillTreeEffects;
  },

  fatigue(save, id) { return (save && save.merchantFatigue && save.merchantFatigue[id]) || 0; },

  freePlays(id, fx) {
    return MERCHANT_FREE_PLAYS + (id === 'doubleDown' ? fx.getMerchantFatigueThreshold() : 0);
  },

  // Plays past the free allowance — the number that drives cost and payout.
  effFatigue(id, fatigue, fx) { return Math.max(0, fatigue - Merchants.freePlays(id, fx)); },

  cost(id, fatigue, fx) {
    const m = Merchants.get(id);
    const e = Merchants.effFatigue(id, fatigue, fx);
    const costMult = id === 'doubleDown' ? fx.getMerchantFatigueCostMult() : 1;
    return Math.min(Math.round(m.baseCost * (1 + Math.pow(e, 3) / 500 * costMult)), 60);
  },

  // Multiplier on raw winnings: fatigue penalty × upgrade bonuses.
  payoutMult(id, fatigue, fx) {
    const e = Merchants.effFatigue(id, fatigue, fx);
    const tired = Math.max(0.2, 1 / (1 + 0.08 * e));
    const bonus = 1 + fx.getMerchantPayout(Merchants.get(id).fx);
    const edge  = (1 - MERCHANT_BASE_EDGE * fx.getMerchantHouseEdgeMult()) / (1 - MERCHANT_BASE_EDGE);
    return tired * bonus * edge;
  },

  // Raw bolts → bolts actually paid. Any win pays at least 1.
  payout(raw, id, fatigue, fx) {
    if (raw <= 0) return 0;
    return Math.max(1, Math.round(raw * Merchants.payoutMult(id, fatigue, fx)));
  },

  // Chance a losing result gets a second chance.
  luck(id, fx) { return fx.getMerchantLuck(Merchants.get(id).fx); },

  mood(id, fatigue, fx) {
    const free = Merchants.freePlays(id, fx);
    const e = Merchants.effFatigue(id, fatigue, fx);
    if (fatigue < free) return { label: 'FRESH', colour: UI.C.green, note: (free - fatigue) + ' full-price play' + (free - fatigue === 1 ? '' : 's') + ' left' };
    if (e < 4)  return { label: 'WARM',  colour: UI.C.amber, note: 'Payouts reduced a little' };
    if (e < 10) return { label: 'TIRED', colour: 0xd98a3a,  note: 'Costs rising, payouts reduced' };
    return             { label: 'BURNT', colour: UI.C.red,   note: 'Win a battle to let them rest' };
  },

  // ── Shared fatigue strip ────────────────────────────────────────────────
  // Compact card: mood + note on the left, next-play cost and payout on the
  // right, bar underneath. Returns { refresh(fatigue) }.
  drawStrip(scene, y, id, fx) {
    const { width } = scene.scale;
    const w = width - 32, h = 58, lx = 16 + 16, rx = width - 16 - 16;
    UI.panel(scene, width / 2, y, w, h, { fill: UI.C.surface, stroke: UI.C.line, radius: 12 });
    const mood = UI.text(scene, lx, y - 12, '', 'tag', { size: 11, origin: [0, 0.5] });
    const note = UI.text(scene, lx + 62, y - 12, '', 'small', { size: 11, origin: [0, 0.5] });
    const right = UI.text(scene, rx, y - 12, '', 'tag', { size: 11, origin: [1, 0.5], color: UI.T.dim });
    const barW = w - 32;
    const track = scene.add.graphics();
    track.fillStyle(UI.C.surface2, 1);
    track.fillRoundedRect(lx, y + 9, barW, 8, 4);
    const fill = scene.add.graphics();
    const strip = {
      refresh(fatigue) {
        const md = Merchants.mood(id, fatigue, fx);
        mood.setText(md.label).setColor(UI.hex(md.colour));
        note.setText(md.note).setX(lx + mood.width + 10);
        const cost = Merchants.cost(id, fatigue, fx);
        const pm = Merchants.payoutMult(id, fatigue, fx);
        right.setText(cost + ' NUTS  ·  ×' + pm.toFixed(2));
        const free = Merchants.freePlays(id, fx);
        const pct = Math.min(1, fatigue / (free + 14));
        fill.clear();
        fill.fillStyle(md.colour, 1);
        fill.fillRoundedRect(lx, y + 9, Math.max(8, barW * pct), 8, 4);
        // Tick where fatigue starts to bite
        fill.fillStyle(UI.C.bg, 1);
        fill.fillRect(lx + barW * (free / (free + 14)) - 1, y + 9, 2, 8);
        return strip;
      }
    };
    return strip;
  },

  // ── Coach tour ──────────────────────────────────────────────────────────
  // Runs a list of spotlight steps with a NEXT button, then marks the
  // tutorial seen. Each step: { target, title, body }.
  tour(scene, key, steps, onDone) {
    const coach = new Coach(scene, { depth: 300 });
    scene.events.once('shutdown', () => coach.destroy());
    let i = 0;
    const finish = () => {
      coach.hide();
      SaveManager.update(s => { if (!s.tutorials) s.tutorials = {}; s.tutorials[key] = true; });
      if (scene.saveData) { if (!scene.saveData.tutorials) scene.saveData.tutorials = {}; scene.saveData.tutorials[key] = true; }
      if (onDone) onDone();
    };
    const show = () => {
      const s = steps[i];
      coach.show(Object.assign({}, s, {
        key: key + i, step: i + 1, total: steps.length,
        button: {
          label: i === steps.length - 1 ? 'GOT IT' : 'NEXT',
          onTap: () => { i++; if (i >= steps.length) finish(); else show(); },
          secondary: i === 0 && steps.length > 1 ? { label: 'SKIP', onTap: finish } : undefined
        }
      }));
    };
    show();
    return coach;
  },

  // Floating "+N BOLTS" over a point.
  popBolts(scene, x, y, amount, colour) {
    const t = UI.text(scene, x, y, '+' + amount + ' BOLT' + (amount === 1 ? '' : 'S'), 'title',
      { size: 24, origin: 0.5, color: colour || '#7cc4f2', depth: 60 }).setAlpha(0);
    scene.tweens.add({ targets: t, y: y - 40, alpha: 1, duration: 220, onComplete: () =>
      scene.time.delayedCall(800, () => scene.tweens.add({ targets: t, alpha: 0, duration: 300, onComplete: () => t.destroy() }))
    });
  }
};
