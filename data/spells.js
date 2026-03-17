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

function castFireBurst({ player, system, spellLevel = 1 }) {
  const radius = 6 + spellLevel * 0.6;
  const damage = 4 + spellLevel * 2;

  system.spawnEffect({ type: 'burst', x: player.x, y: player.y, radius, color: '#f3b178', ttl: 0.22 });

  for (const enemy of system.enemies) {
    if (!enemy.alive) continue;
    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (dist <= radius) {
      system.damageEnemy(enemy, damage, {
        sourceX: player.x,
        sourceY: player.y,
        strongHit: true,
        particleColor: '#ffd3a8',
      });
    }
  }
}

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
  'fire-burst': {
    id: 'fire-burst',
    name: 'Fire Burst',
    icon: '#',
    description: 'Release a fiery blast around the caster.',
    damage: 6,
    range: 7,
    cooldown: 2.4,
    manaCost: 16,
    cast: castFireBurst,
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
