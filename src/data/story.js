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
  agent:    { name: 'Rogue agent',   colour: 0x7fe3ff, role: 'Walked out on Helix' },
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
  ],
  's1-4.before': [
    ['tim', 'Umbaji\u2019s here. Says he\u2019s \u201cvisiting\u201d.'],
    ['umbaji', 'You took in Front scum? After everything they have done on these waters?'],
    ['umbaji', 'I offered you the Collective. You chose them. So you get what they get.']
  ],
  's1-4.after': [
    ['bet', 'He\u2019ll be back. Angrier.']
  ],
  's1-5.before': [
    ['umbaji', '(on the radio) Every tide, raft-dweller. Every tide until your raft sinks.']
  ],
  's1-5.after': [
    ['tim', 'We can\u2019t hold like this forever.']
  ],
  's1-6.before': [
    ['borga', 'You want to stop the SALV? I have something. Learned it fighting for the Front, before they threw me away.'],
    ['borga', 'A siphon. It drinks a boat dry. First \u2014 survive this.']
  ],
  's1-6.after': [
    ['borga', 'Siphon plans are in the factory. Feed it refined plastic.'],
    ['umbaji', '(on the radio) This is not finished.'],
    ['tim', 'And the Front keep coming from the west\u2026 like they\u2019re running from something.']
  ],

  // ── Story 2 · Borga ─────────────────────────────────────────────────────
  's2-1.before': [
    ['bet', 'SALV gave us the Mk II plans but not the metal to build them. Their salvage yard is lightly guarded.']
  ],
  's2-1.after': [
    ['bet', 'Metal enough for a few Mk IIs. Not bad for a morning.']
  ],
  's2-2.before': [
    ['tim', 'Another reef, another stash. In and out.']
  ],
  's2-2.after': [
    ['narrator', 'Behind the Salt Children\u2019s camp you find a Front crew, cut off from their fleet. They haven\u2019t eaten in days.'],
    ['tim', 'We can\u2019t leave them here. We don\u2019t really have a choice.'],
    ['narrator', 'You bring them home. One of them is a hulking mass of cybernetics.'],
    ['borga', 'Borga. I lift things. I break things. Point me at your factory.']
  ],
  's2-3.before': [
    ['bet', 'SALV sails while our best are out on the reefs. Hold the raft!']
  ],
  's2-4.before': [
    ['borga', 'Umbaji keeps hitting our people. Let\u2019s hit back.']
  ],
  's2-4.after': [
    ['umbaji', '(on the radio) You will regret this, raft-dweller.']
  ],
  's2-5.before': [
    ['voice', '\u2026this line is secure. I speak for the office of Commander Luis Ortega. IOA.'],
    ['voice', 'Umbaji is a problem for both of us. End him.'],
    ['narrator', 'You ask what\u2019s in it for you.'],
    ['voice', 'That depends on whether you\u2019re willing to work for the IOA.'],
    ['narrator', 'The line goes dead. Then the SALV sails appear.']
  ],
  's2-5.after': [
    ['tim', 'The IOA don\u2019t do favours. Whatever they want, it\u2019s bigger than Umbaji.']
  ],
  's2-6.before': [
    ['narrator', 'You key the radio. This time you do the asking.'],
    ['narrator', 'Why is Helix driving the whole Front east? What are they running from?'],
    ['voice', '\u2026Will you end Umbaji or not?'],
    ['narrator', 'Static. Then SALV sails, and Front boats running ahead of them.']
  ],
  's2-6.after': [
    ['narrator', 'That night you sit down with everyone who works the raft.'],
    ['tim', 'I don\u2019t trust the voice. But I don\u2019t trust Umbaji either.'],
    ['bet', 'Odds are bad either way. I\u2019d rather bet on us.'],
    ['borga', 'Umbaji left my people to starve. I will not cry for him.'],
    ['narrator', 'Whatever the IOA want, the worst that can happen is the SALV raids stop. You decide to end it.']
  ],
  's2-7.before': [
    ['umbaji', '(on the radio) I offered you the Collective. You chose the gutter.'],
    ['umbaji', 'Now you see the Makombora. Nobody has ever seen it twice.'],
    ['borga', 'Big ship. Big target.']
  ],
  's2-7.after': [
    ['narrator', 'The Makombora rolls over and goes down by the bow. The SALV sails scatter for the horizon.'],
    ['tim', 'No more raids. Not from them.'],
    ['voice', '(on the radio) Efficient. The office of Commander Ortega will be in touch.'],
    ['bet', 'I don\u2019t like being somebody\u2019s good news.']
  ],

  // ── Story 3 · Helix ─────────────────────────────────────────────────────
  's3-1.before': [
    ['tim', 'A Front crew \u2014 but not the old Front. They\u2019re asking about the siphon.']
  ],
  's3-1.after': [
    ['borga', 'They wanted my siphon. Everyone wants my siphon.']
  ],
  's3-2.before': [
    ['bet', 'Biggest Front force since the Commander. Where are they all coming from?']
  ],
  's3-2.after': [
    ['ncf', 'Here. Take it. Someone will call. They\u2019ll need something from you.'],
    ['narrator', 'A battered radio, still warm from the raider\u2019s hands.']
  ],
  's3-3.before': [
    ['tim', 'Always from the west. Always running. This time we take one alive.']
  ],
  's3-3.after': [
    ['narrator', 'You pull a Front raider out of the water and sit him down in the factory.'],
    ['tim', 'Who are you running from?'],
    ['narrator', 'He doesn\u2019t answer for a long time. Then one word.'],
    ['ncf', 'Helix.'],
    ['narrator', 'He won\u2019t say anything else.']
  ],
  's3-4.before': [
    ['bet', 'Front boats on the horizon. Not many. Not enough to be a raid.'],
    ['tim', 'They\u2019re not attacking. They\u2019re fleeing. Get ready for whatever\u2019s behind them.']
  ],
  's3-4.after': [
    ['narrator', 'In the wreck of the command ship, someone is still alive \u2014 and wants you to know it.'],
    ['agent', 'Don\u2019t shoot. I\u2019m not with them. Not any more.'],
    ['agent', 'That was the Advance Force. Helix sends it ahead to clear the water. What it clears, it keeps.'],
    ['agent', 'They don\u2019t want the Front. They don\u2019t want your raft. They want the turbines.'],
    ['tim', 'Then we\u2019re next.'],
    ['agent', 'Everyone is next.']
  ]
};
