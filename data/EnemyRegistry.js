import { createDefinition, SPAWN_CATEGORY } from './DefinitionUtils.js';

export const DEFAULT_ENEMY_ROLE = 'melee';
export const ENEMY_SPAWN_STYLE = Object.freeze({
  SCATTERED: 'scattered',
  SWARM: 'swarm',
  ELITE: 'elite',
});

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
  spider: createDefinition({
    id: 'spider', category: SPAWN_CATEGORY.ENEMY, assetId: 'spider', spriteId: 'spider', biomeTags: ['forest', 'cave', 'river', 'mountain'], spawnWeight: 4,
    role: 'melee', behavior: 'chaser',
    spawnStyle: ENEMY_SPAWN_STYLE.SCATTERED,
    stats: { hp: 14, speed: 10.5, damage: 2, attackCooldown: 0.7 },
    combat: { attackRange: 3.2, attackWindup: 0.35, attackDuration: 0.3, attackHitTime: 0.08, hitKnockback: 7, radius: 1.6, aggroRadius: 20 },
    animationTimings: { idle: 0.4, walk: 0.2, attack: 0.15 },
  }),
  wasp: createDefinition({
    id: 'wasp', category: SPAWN_CATEGORY.ENEMY, assetId: 'wasp', spriteId: 'wasp', biomeTags: ['forest', 'cave', 'river', 'mountain'], spawnWeight: 3,
    role: 'ranged', behavior: 'ranged',
    spawnStyle: ENEMY_SPAWN_STYLE.SCATTERED,
    stats: { hp: 6, speed: 13, damage: 2, attackCooldown: 1.2 },
    combat: { attackRange: 10, orbitRadius: 8, orbitRepositionThreshold: 0.75, orbitPlayerDriftThreshold: 1.5, orbitWaitDuration: 0.35, attackWindup: 0.4, attackDuration: 0.3, attackHitTime: 0.08, hitKnockback: 6, radius: 1.4, aggroRadius: 24, projectileType: 'stingerProjectile' },
    animationTimings: { idle: 0.4, walk: 0.2, attack: 0.15 },
  }),
  forest_beetle: createDefinition({
    id: 'forest_beetle', category: SPAWN_CATEGORY.ENEMY, assetId: 'forest_beetle', spriteId: 'forest_beetle', biomeTags: ['forest', 'cave', 'river', 'mountain'], spawnWeight: 1,
    role: 'tank', behavior: 'tank',
    spawnStyle: ENEMY_SPAWN_STYLE.ELITE,
    stats: { hp: 56, speed: 4, damage: 6, attackCooldown: 1.2 },
    combat: { attackRange: 3.8, attackWindup: 0.5, attackDuration: 0.4, attackHitTime: 0.14, hitKnockback: 12, radius: 2.2, aggroRadius: 18 },
    animationTimings: { idle: 0.4, walk: 0.2, attack: 0.15 },
  }),
  swarm_bug: createDefinition({
    id: 'swarm_bug', category: SPAWN_CATEGORY.ENEMY, assetId: 'swarm_bug', spriteId: 'swarm_bug', biomeTags: ['forest', 'cave', 'river', 'mountain'], spawnWeight: 3, clusterMin: 4, clusterMax: 7, clusterRadius: 4,
    role: 'swarm', behavior: 'swarm',
    spawnStyle: ENEMY_SPAWN_STYLE.SWARM,
    stats: { hp: 4, speed: 16.5, damage: 1, attackCooldown: 0.45 },
    combat: { attackRange: 2.8, attackWindup: 0.2, attackDuration: 0.24, attackHitTime: 0.06, hitKnockback: 5, radius: 1.3, aggroRadius: 16 },
    animationTimings: { idle: 0.4, walk: 0.2, attack: 0.15 },
  }),
  forest_mantis: createDefinition({
    id: 'forest_mantis', category: SPAWN_CATEGORY.ENEMY, assetId: 'forest_mantis', spriteId: 'forest_mantis', biomeTags: ['forest', 'cave', 'river', 'mountain'], spawnWeight: 2,
    role: 'flanker', behavior: 'flanker',
    spawnStyle: ENEMY_SPAWN_STYLE.SCATTERED,
    stats: { hp: 16, speed: 12, damage: 3, attackCooldown: 0.8 },
    combat: { attackRange: 3.2, attackWindup: 0.34, attackDuration: 0.32, attackHitTime: 0.1, hitKnockback: 8, radius: 1.6, flankOrbitSpeed: 1.6, aggroRadius: 22 },
    animationTimings: { idle: 0.4, walk: 0.2, attack: 0.15 },
  }),
  fire_ant: createDefinition({
    id: 'fire_ant', category: SPAWN_CATEGORY.ENEMY, assetId: 'fire_ant', spriteId: 'fire_ant', biomeTags: ['forest'], spawnWeight: 0.45,
    spawnSource: 'structure',
    role: 'swarm', behavior: 'chaser',
    spawnStyle: ENEMY_SPAWN_STYLE.SWARM,
    stats: { hp: 9, speed: 13.5, damage: 2, attackCooldown: 0.45 },
    combat: { attackRange: 2.4, attackWindup: 0.12, attackDuration: 0.2, attackHitTime: 0.05, hitKnockback: 4, radius: 1.3, aggroRadius: 28 },
    animationTimings: { idle: 0.36, walk: 0.14, attack: 0.1 },
  }),
};

export function getEnemyDefinition(enemyId) {
  if (!enemyId) return null;
  return ENEMY_REGISTRY[enemyId] ?? null;
}

export function getAllEnemyDefinitions() {
  return Object.values(ENEMY_REGISTRY);
}
