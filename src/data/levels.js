const LEVEL_DATA = {
  storylines: [
    {
      id: 1,
      name: 'SALT & PLASTIC',
      description: 'Establish your base. Survive the first raids.',
      faction: 'Non-Continuous Front',
      levels: [
        {
          id: 1,
          name: 'FIRST CONTACT',
          description: 'A small scouting party. Learn your towers.',
          difficulty: 1,
          towerSlots: 6,
          baseHp: 10,
          waves: [
            {
              preWaveDelay: 3000,
              enemies: [
                { type: 'saltChild', count: 4, interval: 2500 }
              ]
            }
          ]
        },
        {
          id: 2,
          name: 'WORD SPREADS',
          description: 'A larger force. Scrap Runners have joined.',
          difficulty: 2,
          towerSlots: 6,
          baseHp: 10,
          waves: [
            {
              preWaveDelay: 3000,
              enemies: [
                { type: 'saltChild', count: 8, interval: 1500 }
              ]
            },
            {
              preWaveDelay: 5000,
              enemies: [
                { type: 'saltChild', count: 6, interval: 1500 },
                { type: 'scrapRunner', count: 3, interval: 2500 }
              ]
            }
          ]
        },
        {
          id: 3,
          name: 'OVERNIGHT ASSAULT',
          description: 'They hit while you sleep. Three waves.',
          difficulty: 3,
          towerSlots: 8,
          baseHp: 10,
          waves: [
            {
              preWaveDelay: 3000,
              enemies: [
                { type: 'saltChild', count: 10, interval: 1200 }
              ]
            },
            {
              preWaveDelay: 6000,
              enemies: [
                { type: 'saltChild', count: 8, interval: 1200 },
                { type: 'scrapRunner', count: 4, interval: 2000 }
              ]
            },
            {
              preWaveDelay: 6000,
              enemies: [
                { type: 'saltChild', count: 12, interval: 1000 },
                { type: 'scrapRunner', count: 6, interval: 1800 }
              ]
            }
          ]
        },
        {
          id: 4,
          name: 'THE HULK',
          description: 'Something bigger arrives. Splash damage is useless against it.',
          difficulty: 4,
          towerSlots: 8,
          baseHp: 10,
          waves: [
            {
              preWaveDelay: 3000,
              enemies: [
                { type: 'saltChild', count: 10, interval: 1200 }
              ]
            },
            {
              preWaveDelay: 6000,
              enemies: [
                { type: 'driftwoodHulk', count: 1, interval: 0 },
                { type: 'saltChild', count: 8, interval: 1500 }
              ]
            },
            {
              preWaveDelay: 6000,
              enemies: [
                { type: 'driftwoodHulk', count: 2, interval: 5000 },
                { type: 'scrapRunner', count: 6, interval: 1500 }
              ]
            }
          ]
        },
        {
          id: 5,
          name: 'THE COMMANDER',
          description: 'The Front Commander leads the final assault. Hold your ground.',
          difficulty: 5,
          towerSlots: 8,
          baseHp: 10,
          waves: [
            {
              preWaveDelay: 3000,
              enemies: [
                { type: 'saltChild', count: 12, interval: 1000 },
                { type: 'scrapRunner', count: 6, interval: 1500 }
              ]
            },
            {
              preWaveDelay: 6000,
              enemies: [
                { type: 'driftwoodHulk', count: 2, interval: 4000 },
                { type: 'saltChild', count: 10, interval: 1200 }
              ]
            },
            {
              preWaveDelay: 8000,
              enemies: [
                { type: 'frontCommander', count: 1, interval: 0 },
                { type: 'saltChild', count: 15, interval: 800 },
                { type: 'scrapRunner', count: 8, interval: 1200 }
              ]
            }
          ]
        }
      ]
    }
  ]
};
