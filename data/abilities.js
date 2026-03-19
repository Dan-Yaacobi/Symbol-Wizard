import { castSpell } from '../systems/spells/SpellCaster.js';
import { visualTheme } from './VisualTheme.js';

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
  const worldX = target?.x;
  const worldY = target?.y;
  const dx = worldX - player.x;
  const dy = worldY - player.y;
  const len = Math.hypot(dx, dy);

  if (!Number.isFinite(len) || len === 0) {
    console.warn('[Ability:Magic Bolt] Not fired: invalid or zero-length aim vector.', {
      playerX: player.x,
      playerY: player.y,
      worldX,
      worldY,
    });
    return;
  }

  const dirX = dx / len;
  const dirY = dy / len;

  console.log('Magic bolt fired toward:', dirX, dirY);

  const projectile = system.createProjectile(player.x, player.y, dirX, dirY, {
    color: visualTheme.colors.projectileArcane,
    speed: 65 + abilityLevel * 6,
    damage: 3 + abilityLevel,
    ttl: 0.9,
    radius: 1.1,
    spriteFrames: projectileSprite,
  });

  if (!projectile) {
    console.error('[Ability:Magic Bolt] Projectile creation failed.');
  }
}


function castFireBurst({ player, system, abilityLevel = 1 }) {
  const radius = 5.5 + ((abilityLevel - 1) * 0.6);
  const damage = 6 + ((abilityLevel - 1) * 2);

  return castSpell({
    id: 'fire-burst',
    name: 'Fire Burst',
    description: 'Release a fiery blast that radiates from the caster while it is active.',
    behavior: 'aura',
    targeting: 'self',
    element: 'fire',
    components: [],
    parameters: {
      damage,
      radius,
      duration: 0.45,
      tickRate: 0.15,
      tickInterval: 0.15,
      color: '#f3b178',
      hitParticleColor: '#ffd3a8',
    },
    cost: 20,
  }, {
    player,
    origin: player,
    system,
    activeSpellInstances: system?.activeSpellInstances,
  });
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

function castTimeFreeze({ system, abilityLevel }) {
  const extendedFreezeLevels = abilityLevel >= 2 ? 1 : 0;
  const reducedCooldownLevels = abilityLevel >= 3 ? 1 : 0;
  const shatterUnlocked = abilityLevel >= 4;
  const vulnerabilityUnlocked = abilityLevel >= 5;
  const largerRadiusUnlocked = abilityLevel >= 6;
  const chainFreezeUnlocked = abilityLevel >= 7;

  const freezeDuration = 2 + extendedFreezeLevels * 0.5;
  const cooldownReduction = reducedCooldownLevels * 1;
  const radiusPadding = largerRadiusUnlocked ? 8 : 0;
  const shatterDamage = shatterUnlocked ? 6 : 0;
  const vulnerabilityMultiplier = vulnerabilityUnlocked ? 1.3 : 1;

  system.applyTimeFreeze({
    freezeDuration,
    cooldownReduction,
    shatterDamage,
    vulnerabilityMultiplier,
    radiusPadding,
    chainFreeze: chainFreezeUnlocked,
  });
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
    id: 'time-freeze',
    name: 'Time Freeze',
    theme: 'Ice',
    category: 'Control',
    description: 'Freeze all visible enemies in time, stopping their movement and attacks for a short duration.',
    gameplayRole: 'Global crowd control with upgrade-driven utility and damage windows.',
    cooldown: 12,
    manaCost: 14,
    baseDamage: 0,
    upgrades: [
      { level: 2, name: 'Extended Freeze', cost: 60, effect: '+0.5s freeze duration.' },
      { level: 3, name: 'Reduced Cooldown', cost: 90, effect: '-1s cooldown.' },
      { level: 4, name: 'Shatter Damage', cost: 130, effect: 'Enemies take bonus damage when freeze ends.' },
      { level: 5, name: 'Frozen Vulnerability', cost: 165, effect: 'Frozen enemies take 30% increased damage.' },
      { level: 6, name: 'Larger Freeze Radius', cost: 195, effect: 'Also affects enemies slightly outside the screen.' },
      { level: 7, name: 'Chain Freeze', cost: 240, effect: 'Enemies entering view during freeze are also frozen.' },
    ],
    synergyNotes: 'Creates safe windows for burst combos and objective control.',
    cast: castTimeFreeze,
  },
];

export const defaultAbilitySlots = [
  'magic-bolt',
  'fire-burst',
  'blink',
  'time-freeze',
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
    synergyNotes: 'Amplifies Storm Lance chains.',
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
    synergyNotes: 'Groups targets for Fire Burst and Storm Lance.',
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
