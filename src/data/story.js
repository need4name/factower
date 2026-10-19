// ── story.js ──────────────────────────────────────────────────────────────────
// Characters and story beats. A beat is a short scene of lines played before
// or after a level (`<levelKey>.before` / `<levelKey>.after`) or at a moment
// like starting a new game ('intro'). Each line: [speaker, text].
// Speakers are keys of CHARACTERS; 'narrator' has no portrait.

const CHARACTERS = {
  narrator: { name: '',              colour: 0x6f7b8d },
  tim:      { name: 'Tim',           colour: 0x8fb3c9, role: 'The first soul you met on the raft' },
  bet:      { name: 'Uncle Bet',     colour: 0xf2a93b, role: 'Freed NCF prisoner. Worker, gambler' },
  chrome:   { name: 'Chrome',        colour: 0xe8a020, role: 'A slot machine with opinions' },
  ncf:      { name: 'NCF raider',    colour: 0xe5534b },
  umbaji:   { name: 'Umbaji',        colour: 0x52c47f, role: 'Captain of the SALV Collective' },
  borga:    { name: 'Borga',         colour: 0x9d7ff0, role: 'More cybernetics than woman' },
  voice:    { name: 'Muffled voice', colour: 0x8b9bb0, role: 'Claims to speak for Luis Ortega, IOA' }
};

const STORY_BEATS = {
  // ── Prologue ────────────────────────────────────────────────────────────
  intro: [
    ['narrator', 'You wash up on a raft of fused plastic, lashed to a dead Tianxia wind turbine.'],
    ['narrator', 'Someone pulls you out of the water. A man with no implants — the first unwired face you’ve seen in maybe five years.'],
    ['tim', 'Easy. You’re alive. That’s about all you’ve got going for you.'],
    ['tim', 'Name’s Tim. And this raft sits out in the open — anyone with a boat can see it.'],
    ['tim', 'There’s a scrap press under the turbine. Build something that shoots before somebody comes.']
  ],
  'p1.before': [
    ['tim', 'Sails on the horizon. Broken-circle flags — the Non-Continuous Front.'],
    ['tim', 'Anarchists. Badly organised, but there are always more of them. Put your towers by the bends.']
  ],
  'p1.after': [
    ['tim', 'They ran. Ill-prepared lot.'],
    ['narrator', 'In the wreck of their boat you find a prisoner, chained to the hull.'],
    ['bet', 'Name’s Bet. Uncle Bet, to friends — and you just became one.'],
    ['bet', 'I can carry, I can build, and I can count. Mostly cards. Point me at your factory.']
  ],
  'p2.before': [
    ['bet', 'They’ll be back. The Front never takes one beating when it can take two.']
  ],
  'p2.after': [
    ['bet', 'Look at this — salvaged hull metal. Bend it right and it’ll stop a charging raider dead.'],
    ['bet', 'I’ve opened a metal store in the factory. Build a Barricade bench.']
  ],
  'p3.before': [
    ['tim', 'A bigger crew this time.'],
    ['tim', 'Watch the wrecks when they go down. There’s good salvage in them, if you’re quick.']
  ],
  'p3.after': [
    ['bet', 'Grab their scrap mid-fight and bolt it straight onto the towers. It’s ugly. It works.']
  ],
  'p4.before': [
    ['tim', 'We can’t keep waiting for them to come to us.'],
    ['bet', 'Their camp’s two reefs over. We load the towers onto carts and take back what they took.'],
    ['tim', '…So we become them.'],
    ['bet', 'We become alive. Different thing.']
  ],
  'p4.after': [
    ['bet', 'What a haul! A working smelter — and plans for a bomb launcher.'],
    ['tim', 'They’ll know it was us.']
  ],
  'p5.before': [
    ['tim', 'You hit their camp. Now they’re coming with everything they’ve got.']
  ],
  'p5.after': [
    ['bet', 'We held! Tonight we drink. And I know a fella…'],
    ['narrator', 'Bet’s “fella” is a slot machine called Chrome. By sunrise Bet owes it forty nuts, and you finally understand the nickname.'],
    ['chrome', 'Welcome, welcome! Everyone loses here, friend. Some just lose slower.']
  ],
  'p6.before': [
    ['tim', 'These aren’t the usual raiders. Armour. Discipline. Someone is equipping the Front.']
  ],
  'p6.after': [
    ['tim', 'The Front isn’t the real problem. Something out west is pushing them this way.']
  ],
  'p7.before': [
    ['bet', 'That’s their boss — the Front Commander. Bring it down and this lot scatters.']
  ],
  'p7.after': [
    ['tim', 'The commander was carrying an uplink. Old Tianxia kit.'],
    ['tim', 'Wire it into the turbine and we can trade bolts for real upgrades.'],
    ['narrator', 'The Front scatters. For now, the raft is yours.']
  ],

  // ── Story 1 · The SALV Collective ───────────────────────────────────────
  's1-1.before': [
    ['bet', 'Word’s spread. A raft this size draws the local federation — the SALV Collective.'],
    ['bet', 'We’ll want supplies before they show up. The Salt Children keep a stash on the next reef.']
  ],
  's1-1.after': [
    ['tim', 'Full crates. Good. We’ll need every one.']
  ],
  's1-2.before': [
    ['tim', 'Those sails aren’t Front. Bigger hulls. Better guns. They’re circling.']
  ],
  's1-3.before': [
    ['bet', 'They’re coming in properly this time. Keep them off the raft!']
  ],
  's1-3.after': [
    ['umbaji', 'Enough! You fight well, raft-dweller. I am Umbaji, captain of the SALV Collective.'],
    ['umbaji', 'We did not come to take. We came to see what you are. Join the Collective, and we share what we know.'],
    ['umbaji', 'A gift, to begin: conveyor belts. Your workers will thank me.'],
    ['tim', '(quietly) I don’t trust him.'],
    ['narrator', 'You tell Umbaji you’ll think about it.']
  ]
};
