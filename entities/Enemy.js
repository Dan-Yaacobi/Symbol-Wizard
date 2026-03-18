import { Entity } from './Entity.js';

export const ENEMY_BEHAVIOR = {
  CHASER: 'chaser',
  RANGED: 'ranged',
  TANK: 'tank',
  SWARM: 'swarm',
  FLANKER: 'flanker',
};

export const ENEMY_TYPE_DEFS = {
  spider: {
    spriteKey: 'spider',
    behavior: ENEMY_BEHAVIOR.CHASER,
    hp: 14,
    speed: 10.5,
    attackDamage: 2,
    attackRange: 3.2,
    attackCooldown: 0.7,
    attackWindup: 0.35,
    attackDuration: 0.3,
    attackHitTime: 0.08,
    hitKnockback: 7,
    radius: 1.6,
    aggroRadius: 20,
  },
  wasp: {
    spriteKey: 'wasp',
    behavior: ENEMY_BEHAVIOR.RANGED,
    hp: 6,
    speed: 13,
    attackDamage: 2,
    attackRange: 10,
    orbitRadius: 8,
    orbitRepositionThreshold: 0.75,
    orbitPlayerDriftThreshold: 1.5,
    orbitWaitDuration: 0.35,
    attackCooldown: 1.2,
    attackWindup: 0.4,
    attackDuration: 0.3,
    attackHitTime: 0.08,
    hitKnockback: 6,
    radius: 1.4,
    aggroRadius: 24,
    projectileType: 'stingerProjectile',
  },
  forest_beetle: {
    spriteKey: 'forest_beetle',
    behavior: ENEMY_BEHAVIOR.TANK,
    hp: 56,
    speed: 4,
    attackDamage: 6,
    attackRange: 3.8,
    attackCooldown: 1.2,
    attackWindup: 0.5,
    attackDuration: 0.4,
    attackHitTime: 0.14,
    hitKnockback: 12,
    radius: 2.2,
    aggroRadius: 18,
  },
  swarm_bug: {
    spriteKey: 'swarm_bug',
    behavior: ENEMY_BEHAVIOR.SWARM,
    hp: 4,
    speed: 16.5,
    attackDamage: 1,
    attackRange: 2.8,
    attackCooldown: 0.45,
    attackWindup: 0.2,
    attackDuration: 0.24,
    attackHitTime: 0.06,
    hitKnockback: 5,
    radius: 1.3,
    aggroRadius: 16,
  },
  forest_mantis: {
    spriteKey: 'forest_mantis',
    behavior: ENEMY_BEHAVIOR.FLANKER,
    hp: 16,
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
    aggroRadius: 22,
  },
};

export const ENEMY_TUNABLE_PARAMS = [
  'hp',
  'speed',
  'attackDamage',
  'attackRange',
  'attackCooldown',
  'attackWindup',
  'attackDuration',
  'attackHitTime',
  'hitKnockback',
  'radius',
  'aggroRadius',
  'retreatDistance',
  'orbitRadius',
  'orbitRepositionThreshold',
  'orbitPlayerDriftThreshold',
  'orbitWaitDuration',
  'flankOrbitSpeed',
];

export const EnemyTuningOverrides = Object.fromEntries(
  Object.keys(ENEMY_TYPE_DEFS).map((type) => [type, {}]),
);

const LEGACY_KIND_ALIASES = {
  slime: 'spider',
  skeleton: 'spider',
  green_enemy: 'spider',

  forest_shooter: 'wasp',
  forest_brute: 'forest_beetle',
  forest_swarm_bug: 'swarm_bug',
  forest_flanker: 'forest_mantis',

  swarm: 'swarm_bug',
};

function resolveEnemyType(type) {
  const normalized = LEGACY_KIND_ALIASES[type] ?? type;
  if (ENEMY_TYPE_DEFS[normalized]) return normalized;
  return 'spider';
}

function getResolvedEnemyDef(type) {
  const enemyType = resolveEnemyType(type);
  return {
    ...ENEMY_TYPE_DEFS[enemyType],
    ...(EnemyTuningOverrides[enemyType] ?? {}),
  };
}

export function setEnemyTuningOverride(type, parameter, value) {
  const enemyType = resolveEnemyType(type);
  if (!ENEMY_TUNABLE_PARAMS.includes(parameter)) return;
  EnemyTuningOverrides[enemyType] ??= {};
  if (value === null || value === undefined || !Number.isFinite(value)) {
    delete EnemyTuningOverrides[enemyType][parameter];
    return;
  }
  EnemyTuningOverrides[enemyType][parameter] = value;
}

export function clearEnemyTuningOverrides() {
  for (const type of Object.keys(EnemyTuningOverrides)) {
    EnemyTuningOverrides[type] = {};
  }
}

export function getEnemyTuningValue(type, parameter) {
  const resolved = getResolvedEnemyDef(type);
  return resolved[parameter];
}

export function applyEnemyTuningToEnemy(enemy) {
  if (!enemy) return;
  const enemyType = resolveEnemyType(enemy.enemyType ?? enemy.kind);
  const def = getResolvedEnemyDef(enemyType);

  enemy.radius = def.radius ?? enemy.radius;
  enemy.speed = def.speed ?? enemy.speed;
  enemy.attackDamage = def.attackDamage ?? enemy.attackDamage;
  enemy.attackRange = def.attackRange ?? enemy.attackRange;
  enemy.retreatDistance = def.retreatDistance ?? 4;
  enemy.orbitRadius = def.orbitRadius ?? 8;
  enemy.orbitRepositionThreshold = def.orbitRepositionThreshold ?? 0.75;
  enemy.orbitPlayerDriftThreshold = def.orbitPlayerDriftThreshold ?? 1.5;
  enemy.orbitWaitDuration = def.orbitWaitDuration ?? 0.35;
  enemy.attackCooldown = def.attackCooldown ?? enemy.attackCooldown;
  enemy.attackWindup = def.attackWindup ?? 0.4;
  enemy.attackDuration = def.attackDuration ?? 0.3;
  enemy.attackHitTime = def.attackHitTime ?? 0.08;
  enemy.hitKnockback = def.hitKnockback ?? 8;
  enemy.flankOrbitSpeed = def.flankOrbitSpeed ?? 1.2;
  enemy.aggroRadius = def.aggroRadius ?? 8;

  if (Number.isFinite(def.hp)) {
    const previousHp = Number.isFinite(enemy.hp) ? enemy.hp : def.hp;
    enemy.maxHp = def.hp;
    enemy.hp = Math.min(previousHp, def.hp);
  }
}

export class Enemy extends Entity {
  constructor(type, x, y) {
    const enemyType = resolveEnemyType(type);
    const def = getResolvedEnemyDef(enemyType);

    super({
      type: 'enemy',
      enemyType,
      kind: enemyType,
      behavior: def.behavior,
      x,
      y,
      targetX: x,
      targetY: y,
      radius: def.radius ?? 1.6,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed,
      attackDamage: def.attackDamage,
      attackRange: def.attackRange,
      retreatDistance: def.retreatDistance ?? 4,
      orbitRadius: def.orbitRadius ?? 8,
      orbitRepositionThreshold: def.orbitRepositionThreshold ?? 0.75,
      orbitPlayerDriftThreshold: def.orbitPlayerDriftThreshold ?? 1.5,
      orbitWaitDuration: def.orbitWaitDuration ?? 0.35,
      orbitAngle: Math.random() * Math.PI * 2,
      orbitTargetPlayerX: x,
      orbitTargetPlayerY: y,
      orbitPhase: 'reposition',
      orbitWaitTimer: 0,
      isChargingShot: false,
      chargeTimer: 0,
      chargeDuration: def.chargeDuration ?? 0.35,
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
      isAggroed: false,
      aggroLocked: false,
      aggroFlashTimer: 0,
      target: null,
      aggroRadius: def.aggroRadius ?? 8,
      minShootDistance: def.minShootDistance ?? 6,
      preferredDistance: def.preferredDistance ?? 8,
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
