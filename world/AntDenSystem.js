import { activateEnemyAggro } from '../systems/AISystem.js';

export const ANT_DEN_PHASE = Object.freeze({
  IDLE: 'idle',
  ACTIVE: 'active',
  DEPLETED: 'depleted',
});

function randomInt(rng, min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(rng() * ((hi - lo) + 1));
}

function getDenConfig(den) {
  const source = den?.antSpawner ?? den?.spawnController ?? {};
  return {
    triggerRadius: Math.max(1, Number(source.triggerRadius) || 7),
    spawnInterval: Math.max(0.05, Number(source.spawnInterval) || 0.5),
    spawnCountMin: Math.max(1, Math.floor(Number(source.spawnCountMin) || 5)),
    spawnCountMax: Math.max(1, Math.floor(Number(source.spawnCountMax) || 10)),
    spawnRadius: Math.max(1, Number(source.spawnRadius) || 3.2),
    maxActiveAnts: Math.max(1, Math.floor(Number(source.maxActiveAnts) || 10)),
    enemyType: typeof source.enemyType === 'string' ? source.enemyType : 'fire_ant',
  };
}

function ensureDenState(den, rng = Math.random) {
  if (!den || den.type !== 'ant_den') return null;
  den.state ??= {};
  const config = getDenConfig(den);
  den.state.phase ??= ANT_DEN_PHASE.IDLE;
  den.state.spawnedCount ??= 0;
  den.state.spawnTimer ??= 0;
  den.state.targetSpawnCount ??= randomInt(rng, config.spawnCountMin, config.spawnCountMax);
  return { config, state: den.state };
}

function tileKey(x, y) {
  return `${x},${y}`;
}

function collectBlockedObjectTiles(worldObjects = [], ignoredObject = null) {
  const blocked = new Set();
  for (const object of worldObjects) {
    if (!object || object === ignoredObject || object.destroyed || !object.collision) continue;
    for (const node of object.footprint ?? object.logicalShape?.tiles ?? [[0, 0]]) {
      const [dx, dy] = Array.isArray(node) ? node : [node?.x ?? 0, node?.y ?? 0];
      blocked.add(tileKey(Math.round(object.x + dx), Math.round(object.y + dy)));
    }
  }
  return blocked;
}

function collectEnemyTiles(enemies = []) {
  const occupied = new Set();
  for (const enemy of enemies) {
    if (!enemy?.alive) continue;
    occupied.add(tileKey(Math.round(enemy.targetX ?? enemy.x), Math.round(enemy.targetY ?? enemy.y)));
  }
  return occupied;
}

function isSpawnTileWalkable(room, x, y, blockedObjectTiles, enemyTiles) {
  const tile = room?.tiles?.[y]?.[x];
  if (!tile?.walkable) return false;
  if (room?.collisionMap?.[y]?.[x]) return false;
  if (blockedObjectTiles.has(tileKey(x, y))) return false;
  if (enemyTiles.has(tileKey(x, y))) return false;
  return true;
}

function findSpawnPosition(den, room, worldObjects, enemies, rng = Math.random) {
  const { spawnRadius } = getDenConfig(den);
  const blockedObjectTiles = collectBlockedObjectTiles(worldObjects, den);
  const enemyTiles = collectEnemyTiles(enemies);
  for (let attempt = 0; attempt < 28; attempt += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = (0.75 + (rng() * 0.8)) * spawnRadius;
    const x = Math.round(den.x + Math.cos(angle) * radius);
    const y = Math.round(den.y + Math.sin(angle) * radius);
    if (isSpawnTileWalkable(room, x, y, blockedObjectTiles, enemyTiles)) return { x, y };
  }
  return null;
}

function countActiveDenAnts(enemies, denId) {
  let count = 0;
  for (const enemy of enemies) {
    if (!enemy?.alive) continue;
    if (enemy.sourceDenId !== denId) continue;
    count += 1;
  }
  return count;
}

function isPlayerInsideTrigger(den, player, triggerRadius) {
  if (!player) return false;
  const dx = player.x - den.x;
  const dy = player.y - den.y;
  return ((dx * dx) + (dy * dy)) <= (triggerRadius * triggerRadius);
}

export function updateAntDens({
  room = null,
  worldObjects = [],
  enemies = [],
  player = null,
  dt = 0,
  rng = Math.random,
  spawnEnemy = () => null,
  onSpawn = null,
  debug = null,
  effectSystem = null,
} = {}) {
  if (!room || !Array.isArray(worldObjects) || !Array.isArray(enemies) || dt <= 0) return;

  for (const den of worldObjects) {
    const context = ensureDenState(den, rng);
    if (!context) continue;
    const { config, state } = context;

    if (state.phase === ANT_DEN_PHASE.DEPLETED) continue;

    if (state.phase === ANT_DEN_PHASE.IDLE) {
      if (!isPlayerInsideTrigger(den, player, config.triggerRadius)) continue;
      state.phase = ANT_DEN_PHASE.ACTIVE;
      state.spawnTimer = config.spawnInterval;
    }

    if (state.phase !== ANT_DEN_PHASE.ACTIVE) continue;
    if (state.spawnedCount >= state.targetSpawnCount) {
      state.phase = ANT_DEN_PHASE.DEPLETED;
      continue;
    }

    const activeDenAnts = countActiveDenAnts(enemies, den.id);
    if (activeDenAnts >= config.maxActiveAnts) continue;

    state.spawnTimer -= dt;
    while (state.spawnTimer <= 0 && state.phase === ANT_DEN_PHASE.ACTIVE) {
      if (state.spawnedCount >= state.targetSpawnCount) {
        state.phase = ANT_DEN_PHASE.DEPLETED;
        break;
      }
      if (countActiveDenAnts(enemies, den.id) >= config.maxActiveAnts) {
        state.spawnTimer = Math.max(state.spawnTimer, 0);
        break;
      }

      const spawnPoint = findSpawnPosition(den, room, worldObjects, enemies, rng);
      if (!spawnPoint) {
        state.spawnTimer += config.spawnInterval;
        break;
      }

      const ant = spawnEnemy(config.enemyType, spawnPoint, { den, room });
      if (!ant) {
        state.spawnTimer += config.spawnInterval;
        break;
      }

      ant.sourceDenId = den.id;
      ant.sourceDenType = den.type;
      activateEnemyAggro(ant, player, effectSystem);

      state.spawnedCount += 1;
      if (typeof onSpawn === 'function') onSpawn({ den, enemy: ant, spawnedCount: state.spawnedCount, targetSpawnCount: state.targetSpawnCount });
      if (debug?.logSpawnCount) {
        console.debug('[AntDen] Spawned fire ant.', {
          denId: den.id,
          spawnedCount: state.spawnedCount,
          targetSpawnCount: state.targetSpawnCount,
          phase: state.phase,
        });
      }

      if (state.spawnedCount >= state.targetSpawnCount) {
        state.phase = ANT_DEN_PHASE.DEPLETED;
        break;
      }
      state.spawnTimer += config.spawnInterval;
    }
  }
}
