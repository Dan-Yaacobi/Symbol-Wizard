import { Entity } from './Entity.js';

export const ENEMY_BEHAVIOR = {
  CHASER: 'chaser',
  RANGED: 'ranged',
  TANK: 'tank',
  SWARM: 'swarm',
  FLANKER: 'flanker',
};

const ENEMY_TYPE_DEFS = {
  spider: {
    spriteKey: 'slime',
    behavior: ENEMY_BEHAVIOR.CHASER,
    hp: 5,
    speed: 10,
    attackDamage: 2,
    attackRange: 3.2,
    attackCooldown: 0.7,
    attackWindup: 0.35,
    attackDuration: 0.3,
    attackHitTime: 0.08,
    hitKnockback: 7,
    radius: 1.6,
  },
  green_enemy: {
    spriteKey: 'skeleton',
    behavior: ENEMY_BEHAVIOR.CHASER,
    hp: 7,
    speed: 13,
    attackDamage: 3,
    attackRange: 3.6,
    attackCooldown: 0.9,
    attackWindup: 0.45,
    attackDuration: 0.36,
    attackHitTime: 0.1,
    hitKnockback: 9,
    radius: 1.6,
  },
  forest_shooter: {
    spriteKey: 'skeleton',
    behavior: ENEMY_BEHAVIOR.RANGED,
    hp: 4,
    speed: 9,
    attackDamage: 2,
    attackRange: 10,
    retreatDistance: 4,
    attackCooldown: 1.5,
    hitKnockback: 6,
    radius: 1.5,
  },
  forest_brute: {
    spriteKey: 'skeleton',
    behavior: ENEMY_BEHAVIOR.TANK,
    hp: 18,
    speed: 5,
    attackDamage: 6,
    attackRange: 3.8,
    attackCooldown: 1.2,
    attackWindup: 0.5,
    attackDuration: 0.4,
    attackHitTime: 0.14,
    hitKnockback: 12,
    radius: 2,
  },
  forest_swarm_bug: {
    spriteKey: 'slime',
    behavior: ENEMY_BEHAVIOR.SWARM,
    hp: 3,
    speed: 16,
    attackDamage: 1,
    attackRange: 2.8,
    attackCooldown: 0.45,
    attackWindup: 0.2,
    attackDuration: 0.24,
    attackHitTime: 0.06,
    hitKnockback: 5,
    radius: 1.3,
  },
  forest_flanker: {
    spriteKey: 'skeleton',
    behavior: ENEMY_BEHAVIOR.FLANKER,
    hp: 8,
    speed: 12,
    attackDamage: 3,
    attackRange: 3.2,
    attackCooldown: 0.8,
    attackWindup: 0.34,
    attackDuration: 0.32,
    attackHitTime: 0.1,
    hitKnockback: 8,
    radius: 1.6,
    flankOrbitSpeed: 1.6,
  },
};

const LEGACY_KIND_ALIASES = {
  slime: 'spider',
  skeleton: 'green_enemy',
};

function resolveEnemyType(type) {
  const normalized = LEGACY_KIND_ALIASES[type] ?? type;
  if (ENEMY_TYPE_DEFS[normalized]) return normalized;
  return 'spider';
}

export class Enemy extends Entity {
  constructor(type, x, y) {
    const enemyType = resolveEnemyType(type);
    const def = ENEMY_TYPE_DEFS[enemyType];

    super({
      type: 'enemy',
      enemyType,
      kind: enemyType,
      behavior: def.behavior,
      x,
      y,
      radius: def.radius ?? 1.6,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed,
      attackDamage: def.attackDamage,
      attackRange: def.attackRange,
      retreatDistance: def.retreatDistance ?? 4,
      attackCooldown: def.attackCooldown,
      attackTimer: 0,
      attackWindup: def.attackWindup ?? 0.4,
      attackDuration: def.attackDuration ?? 0.3,
      attackHitTime: def.attackHitTime ?? 0.08,
      attackElapsed: 0,
      attackDamageApplied: false,
      isWindingUp: false,
      isAttacking: false,
      hitKnockback: def.hitKnockback ?? 8,
      spriteKey: def.spriteKey,
      animationState: 'idle',
      frozen: false,
      freezeTint: null,
      freezeGlow: null,
      hitFlashTimer: 0,
      hitFlashDuration: 0,
      hitKnockbackX: 0,
      hitKnockbackY: 0,
      hitKnockbackTimer: 0,
      aggroMemoryTimer: 0,
      flankAngleOffset: Math.random() * Math.PI * 2,
      flankDirection: Math.random() < 0.5 ? -1 : 1,
      flankOrbitSpeed: def.flankOrbitSpeed ?? 1.2,
      frameDurations: {
        idle: 0.32,
        walk: 0.14,
        attack: 0.08,
      },
    });
  }
}
