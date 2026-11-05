// ── Contracts.js ──────────────────────────────────────────────────────────────
// Factory contracts: two standing orders for towers from your stock, paid in
// bolts and materials. Fill one and its slot waits for your next battle win
// (or Endless run) before a new order comes in. Open once the Uplink is.
//
//   Contracts.open(save)        are contracts available yet?
//   Contracts.state(save)       { items: [order | null, ...] }  (fills empty slots on first look)
//   Contracts.canFill(save, i)  enough towers in stock?
//   Contracts.fill(i)           hand the towers over and get paid → updated save
//   Contracts.refill(save)      after a battle: new orders in empty slots (mutates save)

const Contracts = {
  SLOTS: 2,
  CLIENTS: ['Tim’s night patrol', 'Salt Children traders', 'Chrome’s back room', 'SALV deserters',
            'A Front holdout', 'The reef villages', 'Uncle Bet’s cousin', 'An IOA quartermaster'],

  open(save) { return Progress.has(save, 'uplink'); },

  towerTypes(save) {
    return TOWER_ORDER.filter(t => t === 'gunner' || Progress.has(save, t));
  },

  make(save) {
    const types = Contracts.towerTypes(save);
    // Bigger orders later in the story
    const stage = Math.max(0, LEVEL_DATA.storylines.filter(st => st.levels.some(l => Progress.done(save, Progress.key(st.id, l.id)))).length - 1);
    const pick = types.slice().sort(() => Math.random() - 0.5).slice(0, types.length > 2 && Math.random() < 0.6 ? 2 : 1);
    const want = {};
    let n = 0;
    pick.forEach((t, i) => { const c = 2 + Math.floor(Math.random() * (2 + stage)) - i; want[t] = Math.max(1, c); n += want[t]; });
    const worth = Object.entries(want).reduce((v, [t, c]) => v + c * ((typeof TOWER_SELL_VALUE !== 'undefined' && TOWER_SELL_VALUE[t]) || 1), 0);
    return {
      client: Contracts.CLIENTS[Math.floor(Math.random() * Contracts.CLIENTS.length)],
      want,
      bolts: Math.max(1, Math.round(n / 3 + worth / 6)),
      plasticScrap: Math.round(n / 4),
      salvagedMetal: Math.round(worth / 5)
    };
  },

  state(save) {
    if (!save.contracts) {
      SaveManager.update(s => { s.contracts = { items: Array.from({ length: Contracts.SLOTS }, () => Contracts.make(s)) }; });
      save.contracts = SaveManager.load().contracts;
    }
    return save.contracts;
  },

  canFill(save, i) {
    const o = Contracts.state(save).items[i];
    if (!o) return false;
    const stock = save.stockpile || {};
    return Object.entries(o.want).every(([t, c]) => (stock[t] || 0) >= c);
  },

  fill(i) {
    let paid = null;
    const save = SaveManager.update(s => {
      const o = s.contracts && s.contracts.items[i];
      if (!o) return;
      const stock = s.stockpile || {};
      if (!Object.entries(o.want).every(([t, c]) => (stock[t] || 0) >= c)) return;
      Object.entries(o.want).forEach(([t, c]) => { stock[t] -= c; });
      s.bolts = (s.bolts || 0) + o.bolts;
      if (!s.materials) s.materials = {};
      s.materials.plasticScrap = (s.materials.plasticScrap || 0) + o.plasticScrap;
      s.materials.salvagedMetal = (s.materials.salvagedMetal || 0) + o.salvagedMetal;
      s.contracts.items[i] = null;
      s.contracts.filled = (s.contracts.filled || 0) + 1;
      paid = o;
    });
    return { save, paid };
  },

  refill(save) {
    if (!save || !save.contracts || !Contracts.open(save)) return;
    save.contracts.items = save.contracts.items.map(o => o || Contracts.make(save));
  }
};
