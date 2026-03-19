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

function castBlink({ player, target, system, spellLevel = 1 }) {
  const maxRange = 8 + spellLevel * 1.5;
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

function castTimeFreeze({ system, spellLevel = 1 }) {
  const extendedFreezeLevels = spellLevel >= 2 ? 1 : 0;
  const reducedCooldownLevels = spellLevel >= 3 ? 1 : 0;
  const shatterUnlocked = spellLevel >= 4;
  const vulnerabilityUnlocked = spellLevel >= 5;
  const largerRadiusUnlocked = spellLevel >= 6;
  const chainFreezeUnlocked = spellLevel >= 7;

  system.applyTimeFreeze({
    freezeDuration: 2 + extendedFreezeLevels * 0.5,
    cooldownReduction: reducedCooldownLevels,
    radiusPadding: largerRadiusUnlocked ? 8 : 0,
    shatterDamage: shatterUnlocked ? 6 : 0,
    vulnerabilityMultiplier: vulnerabilityUnlocked ? 1.3 : 1,
    chainFreeze: chainFreezeUnlocked,
  });
}

export const SpellRegistry = {
  'magic-bolt': {
    id: 'magic-bolt',
    name: 'Magic Bolt',
    icon: '*',
    description: 'A basic arcane projectile.',
    behavior: 'projectile',
    targeting: 'cursor',
    element: 'arcane',
    components: [],
    parameters: {
      speed: 65,
      damage: 4,
      ttl: 0.9,
      size: 1.1,
      color: visualTheme.colors.projectileArcane,
      spriteFrames: projectileSprite,
    },
    cost: 12,
    damage: 4,
    range: 14,
    cooldown: 0.22,
    manaCost: 4,
  },
  explosive_bolt: {
    id: 'explosive_bolt',
    name: 'Explosive Bolt',
    icon: '*',
    description: 'A test projectile that explodes on hit.',
    behavior: 'projectile',
    targeting: 'cursor',
    element: 'arcane',
    components: ['explode_on_hit'],
    config: {
      speed: 8,
      damage: 10,
      lifetime: 60,
    },
    parameters: {
      speed: 8,
      damage: 10,
      lifetime: 60,
      ttl: 60,
      size: 1.1,
      color: visualTheme.colors.projectileArcane,
      spriteFrames: projectileSprite,
    },
    cost: 12,
    damage: 10,
    range: 14,
    cooldown: 0.22,
    manaCost: 4,
  },
  beam_test: {
    id: 'beam_test',
    name: 'Beam Test',
    icon: '|',
    description: 'Test spell for beam behavior hitting multiple targets.',
    behavior: 'beam',
    targeting: 'cursor',
    element: 'arcane',
    components: [],
    parameters: {
      damage: 3,
      range: 16,
      width: 2,
      duration: 0.35,
      hitCooldownPerTarget: 0.15,
      tickInterval: 0.05,
      color: '#9dd8ff',
    },
    cost: 12,
    damage: 3,
    range: 12,
    cooldown: 0.4,
    manaCost: 5,
  },
  zone_test: {
    id: 'zone_test',
    name: 'Zone Test',
    icon: 'o',
    description: 'Test spell for persistent zone ticking.',
    behavior: 'zone',
    targeting: 'cursor',
    element: 'arcane',
    components: [],
    parameters: {
      radius: 3,
      damage: 1,
      duration: 1.5,
      tickInterval: 0.25,
      color: '#cfe7ff',
    },
    cost: 14,
    damage: 1,
    range: 12,
    cooldown: 0.8,
    manaCost: 6,
  },
  pierce_bolt: {
    id: 'pierce_bolt',
    name: 'Pierce Bolt',
    icon: '*',
    description: 'Projectile test spell with pierce augment.',
    behavior: 'projectile',
    targeting: 'cursor',
    element: 'arcane',
    components: ['pierce'],
    parameters: {
      speed: 65,
      damage: 3,
      ttl: 0.9,
      size: 1.1,
      pierceCount: 3,
      color: visualTheme.colors.projectileArcane,
      spriteFrames: projectileSprite,
    },
    cost: 14,
    damage: 3,
    range: 14,
    cooldown: 0.28,
    manaCost: 5,
  },
  status_bolt: {
    id: 'status_bolt',
    name: 'Status Bolt',
    icon: '*',
    description: 'Projectile test spell that applies a status on hit.',
    behavior: 'projectile',
    targeting: 'cursor',
    element: 'arcane',
    components: ['apply_status_on_hit'],
    parameters: {
      speed: 62,
      damage: 2,
      ttl: 0.9,
      size: 1.1,
      statusType: 'burn',
      statusDuration: 2,
      color: visualTheme.colors.projectileArcane,
      spriteFrames: projectileSprite,
    },
    cost: 14,
    damage: 2,
    range: 14,
    cooldown: 0.28,
    manaCost: 5,
  },
  'fire-burst': {
    id: 'fire-burst',
    name: 'Fire Burst',
    icon: '#',
    description: 'Release a fiery blast that radiates from the caster while it is active.',
    behavior: 'aura',
    targeting: 'self',
    element: 'fire',
    components: [],
    parameters: {
      damage: 6,
      radius: 5.5,
      duration: 0.45,
      tickRate: 0.15,
      tickInterval: 0.15,
      color: '#f3b178',
      hitParticleColor: '#ffd3a8',
    },
    cost: 20,
    damage: 6,
    range: 7,
    cooldown: 2.4,
    manaCost: 16,
  },
  blink: {
    id: 'blink',
    name: 'Blink',
    icon: '>',
    description: 'Teleport a short distance toward the target direction.',
    damage: null,
    range: 9,
    cooldown: 4.2,
    manaCost: 12,
    cast: castBlink,
  },
  'time-freeze': {
    id: 'time-freeze',
    name: 'Time Freeze',
    icon: '@',
    description: 'Freeze visible enemies in place for a short duration.',
    damage: null,
    range: null,
    cooldown: 12,
    manaCost: 14,
    cast: castTimeFreeze,
  },
};

export const defaultSpellSlots = ['magic-bolt', 'fire-burst', 'blink', 'time-freeze'];
