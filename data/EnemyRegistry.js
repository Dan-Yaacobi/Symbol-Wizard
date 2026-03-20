export const DEFAULT_ENEMY_ROLE = 'melee';

export const DEFAULT_ENEMY_STATS = Object.freeze({
  hp: 10,
  speed: 1,
  damage: 2,
  attackCooldown: 1.2,
});

export const DEFAULT_ENEMY_ANIMATION_TIMINGS = Object.freeze({
  idle: 0.4,
  walk: 0.2,
  attack: 0.15,
});

export const ENEMY_REGISTRY = {
  spider: {
    id: 'spider',
    spriteId: 'spider',
    role: 'melee',
    behavior: 'chaser',
    stats: { hp: 14, speed: 10.5, damage: 2, attackCooldown: 0.7 },
    combat: { attackRange: 3.2, attackWindup: 0.35, attackDuration: 0.3, attackHitTime: 0.08, hitKnockback: 7, radius: 1.6, aggroRadius: 20 },
    animationTimings: { idle: 0.4, walk: 0.2, attack: 0.15 },
  },
  wasp: {
    id: 'wasp',
    spriteId: 'wasp',
    role: 'ranged',
    behavior: 'ranged',
    stats: { hp: 6, speed: 13, damage: 2, attackCooldown: 1.2 },
    combat: { attackRange: 10, orbitRadius: 8, orbitRepositionThreshold: 0.75, orbitPlayerDriftThreshold: 1.5, orbitWaitDuration: 0.35, attackWindup: 0.4, attackDuration: 0.3, attackHitTime: 0.08, hitKnockback: 6, radius: 1.4, aggroRadius: 24, projectileType: 'stingerProjectile' },
    animationTimings: { idle: 0.4, walk: 0.2, attack: 0.15 },
  },
  forest_beetle: {
    id: 'forest_beetle',
    spriteId: 'forest_beetle',
    role: 'tank',
    behavior: 'tank',
    stats: { hp: 56, speed: 4, damage: 6, attackCooldown: 1.2 },
    combat: { attackRange: 3.8, attackWindup: 0.5, attackDuration: 0.4, attackHitTime: 0.14, hitKnockback: 12, radius: 2.2, aggroRadius: 18 },
    animationTimings: { idle: 0.4, walk: 0.2, attack: 0.15 },
  },
  swarm_bug: {
    id: 'swarm_bug',
    spriteId: 'swarm_bug',
    role: 'swarm',
    behavior: 'swarm',
    stats: { hp: 4, speed: 16.5, damage: 1, attackCooldown: 0.45 },
    combat: { attackRange: 2.8, attackWindup: 0.2, attackDuration: 0.24, attackHitTime: 0.06, hitKnockback: 5, radius: 1.3, aggroRadius: 16 },
    animationTimings: { idle: 0.4, walk: 0.2, attack: 0.15 },
  },
  forest_mantis: {
    id: 'forest_mantis',
    spriteId: 'forest_mantis',
    role: 'flanker',
    behavior: 'flanker',
    stats: { hp: 16, speed: 12, damage: 3, attackCooldown: 0.8 },
    combat: { attackRange: 3.2, attackWindup: 0.34, attackDuration: 0.32, attackHitTime: 0.1, hitKnockback: 8, radius: 1.6, flankOrbitSpeed: 1.6, aggroRadius: 22 },
    animationTimings: { idle: 0.4, walk: 0.2, attack: 0.15 },
  },
};

export function getEnemyDefinition(enemyId) {
  if (!enemyId) return null;
  return ENEMY_REGISTRY[enemyId] ?? null;
}

export function getAllEnemyDefinitions() {
  return Object.values(ENEMY_REGISTRY);
}
