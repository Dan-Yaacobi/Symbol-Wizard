const projectileSprite = [
  [
    ' ===> ',
    '====> ',
    ' ===> ',
  ],
  [
    ' >==> ',
    '>>==> ',
    ' >==> ',
  ],
];

function castMagicBolt({ player, target, system, abilityLevel }) {
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const len = Math.hypot(dx, dy) || 1;

  system.createProjectile(player.x + 1.8, player.y, dx / len, dy / len, {
    color: '#7cc2ff',
    speed: 65 + abilityLevel * 6,
    damage: 3 + abilityLevel,
    ttl: 0.9,
    radius: 1.1,
    spriteFrames: projectileSprite,
  });
}

function castFireBurst({ player, system, abilityLevel }) {
  const radius = 6 + abilityLevel * 0.6;
  const damage = 4 + abilityLevel * 2;

  system.spawnEffect({
    type: 'burst',
    x: player.x,
    y: player.y,
    radius,
    color: '#ff8a3d',
    ttl: 0.22,
  });

  for (const enemy of system.enemies) {
    if (!enemy.alive) continue;
    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (dist <= radius) system.damageEnemy(enemy, damage);
  }
}

function castBlink({ player, target, system, abilityLevel }) {
  const maxRange = 8 + abilityLevel * 1.5;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const distance = Math.hypot(dx, dy) || 1;
  const clamped = Math.min(maxRange, distance);

  const nx = player.x + (dx / distance) * clamped;
  const ny = player.y + (dy / distance) * clamped;

  if (system.isWalkable(nx, ny)) {
    player.x = nx;
    player.y = ny;
  }
}

function castLightningArc({ player, system, abilityLevel }) {
  const targetRange = 12 + abilityLevel * 0.8;
  const chainRange = 8 + abilityLevel * 0.35;
  const baseDamage = 4 + abilityLevel * 2;
  const firstTarget = system.findClosestEnemyInRange(player.x, player.y, targetRange);

  if (!firstTarget) return;

  const hit = new Set();
  let sourceX = player.x;
  let sourceY = player.y;
  let sourceEnemy = firstTarget;

  const applyArcHit = (enemy, damage) => {
    system.spawnEffect({
      type: 'line',
      fromX: sourceX,
      fromY: sourceY,
      toX: enemy.x,
      toY: enemy.y,
      color: '#b8dbff',
      ttl: 0.14,
    });
    system.damageEnemy(enemy, damage);
    hit.add(enemy);
    sourceX = enemy.x;
    sourceY = enemy.y;
    sourceEnemy = enemy;
  };

  applyArcHit(firstTarget, baseDamage);

  const chains = 1 + Math.floor(abilityLevel / 2);
  for (let i = 0; i < chains; i += 1) {
    let nextEnemy = null;
    let nextDist = Infinity;

    for (const enemy of system.enemies) {
      if (!enemy.alive || hit.has(enemy)) continue;
      const dist = Math.hypot(enemy.x - sourceEnemy.x, enemy.y - sourceEnemy.y);
      if (dist <= chainRange && dist < nextDist) {
        nextDist = dist;
        nextEnemy = enemy;
      }
    }

    if (!nextEnemy) break;
    applyArcHit(nextEnemy, Math.max(1, Math.round(baseDamage * 0.7)));
  }
}

export const abilityDefinitions = [
  {
    id: 'magic-bolt',
    name: 'Magic Bolt',
    theme: 'Arcane',
    category: 'Projectile',
    description: 'Fire a fast magical projectile that damages enemies in a straight line.',
    gameplayRole: 'Core ranged DPS and builder starter.',
    cooldown: 0.22,
    manaCost: 4,
    baseDamage: 3,
    upgrades: [
      { level: 2, name: 'Magic Bolt Damage', cost: 35, effect: '+20% Magic Bolt damage per level.' },
      { level: 3, name: 'Arcane Velocity', cost: 75, effect: '+15% projectile speed per level.' },
      { level: 4, name: 'Piercing Sigil', cost: 130, effect: 'Bolts pierce one additional enemy.' },
    ],
    synergyNotes: 'Primes Arcane Charge stacks for high-tempo caster loops.',
    cast: castMagicBolt,
  },
  {
    id: 'fire-burst',
    name: 'Fire Burst',
    theme: 'Fire',
    category: 'Area Spell',
    description: 'Release a fiery explosion around the player that damages all nearby enemies.',
    gameplayRole: 'Close-range AoE clear and anti-swarm tool.',
    cooldown: 2.4,
    manaCost: 16,
    baseDamage: 6,
    upgrades: [
      { level: 2, name: 'Fire Burst Radius', cost: 45, effect: '+15% explosion radius per level.' },
      { level: 3, name: 'Lingering Embers', cost: 95, effect: 'Burst leaves a short burning zone.' },
      { level: 4, name: 'Flash Overheat', cost: 170, effect: '+25% bonus damage to burning targets.' },
    ],
    synergyNotes: 'Detonates Oil status and scales with Burn amplifiers.',
    cast: castFireBurst,
  },
  {
    id: 'blink',
    name: 'Blink',
    theme: 'Void',
    category: 'Mobility',
    description: 'Instantly teleport a short distance in the movement direction.',
    gameplayRole: 'Repositioning, dodge, and traversal utility.',
    cooldown: 4.2,
    manaCost: 12,
    baseDamage: 0,
    upgrades: [
      { level: 2, name: 'Blink Cooldown', cost: 40, effect: '-10% cooldown per level.' },
      { level: 3, name: 'Longstep', cost: 90, effect: '+20% blink range.' },
      { level: 4, name: 'Phase Armor', cost: 160, effect: 'Gain brief damage reduction after blinking.' },
    ],
    synergyNotes: 'Enables close-range Fire combos and safe setup for channel spells.',
    cast: castBlink,
  },
  {
    id: 'lightning-arc',
    name: 'Lightning Arc',
    theme: 'Lightning',
    category: 'Chain Magic',
    description: 'Strike the nearest enemy with lightning. The lightning can chain to nearby enemies.',
    gameplayRole: 'Medium-range chain DPS and soft crowd clear.',
    cooldown: 2,
    manaCost: 14,
    baseDamage: 5,
    upgrades: [
      { level: 2, name: 'Conductive Reach', cost: 50, effect: '+20% chain radius per level.' },
      { level: 3, name: 'Forked Current', cost: 110, effect: 'Lightning chains to one additional enemy.' },
      { level: 4, name: 'Storm Core', cost: 180, effect: 'Shocked enemies take +20% follow-up damage.' },
    ],
    synergyNotes: 'Deals extra chain value against Wet enemies and grouped packs.',
    cast: castLightningArc,
  },
];

export const abilityDesignCatalog = [
  {
    id: 'arcane-spear', name: 'Arcane Spear', theme: 'Arcane', category: 'Projectile',
    description: 'Piercing spear of condensed mana.', gameplayRole: 'Line clear and armor strip.',
    upgradePath: ['Longer pierce', 'Mana refund on kill', 'Split into shards'],
    synergyNotes: 'Excels after Blink flank angles.',
  },
  {
    id: 'rune-orbit', name: 'Rune Orbit', theme: 'Arcane', category: 'Control',
    description: 'Orbiting runes that block shots.', gameplayRole: 'Defensive control and setup.',
    upgradePath: ['More runes', 'Exploding rune end', 'Reflect projectiles'],
    synergyNotes: 'Stalls enemies for Fire Burst.',
  },
  {
    id: 'oil-flask', name: 'Oil Flask', theme: 'Fire', category: 'Control',
    description: 'Throws oil that slows and primes combustion.', gameplayRole: 'Debuff and combo primer.',
    upgradePath: ['Larger puddle', 'Longer slow', 'Volatile oil'],
    synergyNotes: 'Fire Burst detonates oil for bonus AoE.',
  },
  {
    id: 'meteor-call', name: 'Meteor Call', theme: 'Fire', category: 'Area Spell',
    description: 'Delayed meteor strike on target zone.', gameplayRole: 'Burst nuke and zone denial.',
    upgradePath: ['Faster impact', 'Secondary fragments', 'Burning crater'],
    synergyNotes: 'Pairs with Freeze Field root.',
  },
  {
    id: 'storm-lance', name: 'Storm Lance', theme: 'Lightning', category: 'Projectile',
    description: 'High-speed bolt that marks conductive targets.', gameplayRole: 'Single-target burst and mark.',
    upgradePath: ['Higher crit', 'Penetration', 'Chain on marked kill'],
    synergyNotes: 'Amplifies Lightning Arc chains.',
  },
  {
    id: 'thunder-totem', name: 'Thunder Totem', theme: 'Lightning', category: 'Control',
    description: 'Summons totem that periodically shocks.', gameplayRole: 'Area control and passive DPS.',
    upgradePath: ['Bigger pulse', 'Faster pulse', 'Wet application'],
    synergyNotes: 'Wet pulse empowers chain spells.',
  },
  {
    id: 'ice-shard', name: 'Ice Shard', theme: 'Ice', category: 'Projectile',
    description: 'Shard that slows on hit.', gameplayRole: 'Kiting and setup.',
    upgradePath: ['Higher slow', 'Extra projectile', 'Frost explosion'],
    synergyNotes: 'Sets up Shatter combos.',
  },
  {
    id: 'freeze-field', name: 'Freeze Field', theme: 'Ice', category: 'Control',
    description: 'Creates a chilling zone that can root enemies.', gameplayRole: 'Crowd control and objective hold.',
    upgradePath: ['Wider field', 'Guaranteed root', 'Damage amplification aura'],
    synergyNotes: 'Meteor and Fire Burst punish rooted enemies.',
  },
  {
    id: 'shatter', name: 'Shatter', theme: 'Ice', category: 'Area Spell',
    description: 'Detonates frozen enemies for bonus damage.', gameplayRole: 'Execute and AoE conversion.',
    upgradePath: ['Bigger detonation', 'Mana on shatter', 'Chain shatter'],
    synergyNotes: 'Massive with Freeze Field + Ice Shard stacks.',
  },
  {
    id: 'void-pull', name: 'Void Pull', theme: 'Void', category: 'Control',
    description: 'Pulls enemies to a central singularity.', gameplayRole: 'Grouping and setup.',
    upgradePath: ['Stronger pull', 'Longer hold', 'Applies vulnerable'],
    synergyNotes: 'Groups targets for Fire Burst and Lightning Arc.',
  },
  {
    id: 'rift-step', name: 'Rift Step', theme: 'Void', category: 'Mobility',
    description: 'Double blink with delayed return portal.', gameplayRole: 'Advanced reposition and bait.',
    upgradePath: ['Longer portal duration', 'Damage on traverse', 'Team portal'],
    synergyNotes: 'Lets players weave aggressive combo routes.',
  },
  {
    id: 'astral-prison', name: 'Astral Prison', theme: 'Void', category: 'Control',
    description: 'Traps a target in stasis bubble.', gameplayRole: 'Elite lockdown and interruption.',
    upgradePath: ['Longer stasis', 'AoE collapse', 'Mana siphon'],
    synergyNotes: 'Create windows for big cooldown setup.',
  },
];
