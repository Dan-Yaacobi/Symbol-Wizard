import { activateEnemyAggro } from '../systems/AISystem.js';
import { trySpawnPosition } from './SpawnValidator.js';

export const ANT_DEN_PHASE = Object.freeze({
  IDLE: 'idle',
  ACTIVE: 'active',
  DEPLETED: 'depleted',
});

const SPAWN_ATTEMPTS = 30;

function randomInt(rng, min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(rng() * ((hi - lo) + 1));
}

function randomInRange(rng, min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 1;
  if (max <= min) return min;
  return min + (rng() * (max - min));
}

function getDenConfig(den) {
  const source = den?.antSpawner ?? den?.spawnController ?? {};
  const fallbackInterval = Math.max(0.05, Number(source.spawnInterval) || 1.1);
  const spawnIntervalMin = Math.max(0.05, Number(source.spawnIntervalMin) || Math.min(0.8, fallbackInterval));
  const spawnIntervalMax = Math.max(spawnIntervalMin, Number(source.spawnIntervalMax) || Math.max(1.5, fallbackInterval));
  return {
    triggerRadius: Math.max(1, Number(source.triggerRadius) || 10),
    spawnIntervalMin,
    spawnIntervalMax,
    spawnCountMin: Math.max(1, Math.floor(Number(source.spawnCountMin) || 5)),
    spawnCountMax: Math.max(1, Math.floor(Number(source.spawnCountMax) || 10)),
    spawnRadius: Math.max(1, Number(source.spawnRadius) || 3.2),
    spawnRingMinOffset: Math.max(1, Number(source.spawnRingMinOffset) || 1),
    spawnRingMaxOffset: Math.max(1, Number(source.spawnRingMaxOffset) || Math.max(3, Number(source.spawnRadius) || 3.2)),
    spawnBiasToPlayer: Math.min(1, Math.max(0, Number(source.spawnBiasToPlayer) || 0)),
    spawnPoints: Array.isArray(source.spawnPoints) ? source.spawnPoints : [],
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
  den.state.nextSpawnInterval ??= randomInRange(rng, config.spawnIntervalMin, config.spawnIntervalMax);
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

function isSpawnTileWalkable(room, x, y, blockedObjectTiles, enemyTiles, denTiles) {
  const tile = room?.tiles?.[y]?.[x];
  if (!tile?.walkable) return false;
  if (room?.collisionMap?.[y]?.[x]) return false;
  if (blockedObjectTiles.has(tileKey(x, y))) return false;
  if (enemyTiles.has(tileKey(x, y))) return false;
  if (denTiles.has(tileKey(x, y))) return false;
  return true;
}

function isTileInsideBlockingClearance(worldObjects = [], ignoredObject, x, y) {
  for (const object of worldObjects) {
    if (!object || object === ignoredObject || object.destroyed || !object.collision) continue;
    const clearance = Math.max(0, Number(object.clearanceRadius) || 0);
    if (clearance <= 0) continue;
    if (Math.hypot(x - object.x, y - object.y) < clearance) return true;
  }
  return false;
}

function collectDenFootprintTiles(den) {
  const tiles = new Set();
  for (const node of den?.footprint ?? den?.logicalShape?.tiles ?? [[0, 0]]) {
    const [dx, dy] = Array.isArray(node) ? node : [node?.x ?? 0, node?.y ?? 0];
    tiles.add(tileKey(Math.round(den.x + dx), Math.round(den.y + dy)));
  }
  return tiles;
}

function estimateDenRadius(den) {
  let furthest = 1;
  for (const node of den?.footprint ?? den?.logicalShape?.tiles ?? [[0, 0]]) {
    const [dx, dy] = Array.isArray(node) ? node : [node?.x ?? 0, node?.y ?? 0];
    furthest = Math.max(furthest, Math.hypot(dx, dy));
  }
  return furthest;
}

function normalizeSpawnPoints(spawnPoints) {
  return spawnPoints
    .map((node) => (Array.isArray(node) ? { x: node[0], y: node[1] } : node))
    .filter((node) => Number.isFinite(node?.x) && Number.isFinite(node?.y))
    .map((node) => ({ x: Math.round(node.x), y: Math.round(node.y) }));
}

function buildAntSpawnProbe(config) {
  return {
    radius: 1.3,
    ignoreCollisionWith: ['ant_den'],
    collisionGroup: 'enemy',
    spawnStyle: 'swarm',
    antConfig: config,
  };
}

function findSpawnPosition(den, config, room, worldObjects, enemies, player, rng = Math.random, debug = null) {
  const blockedObjectTiles = collectBlockedObjectTiles(worldObjects, den);
  const enemyTiles = collectEnemyTiles(enemies);
  const denTiles = collectDenFootprintTiles(den);
  const denRadius = estimateDenRadius(den);
  const minRadius = denRadius + Math.max(1, config.spawnRingMinOffset);
  const maxRadius = denRadius + Math.max(config.spawnRingMinOffset, config.spawnRingMaxOffset);
  const playerAngle = player ? Math.atan2(player.y - den.y, player.x - den.x) : null;
  const candidateMarkers = [];
  const probe = buildAntSpawnProbe(config);

  const extraValidation = ({ x, y }) => {
    if (isTileInsideBlockingClearance(worldObjects, den, x, y)) return { valid: false, reason: 'clearance_blocked' };
    if (!isSpawnTileWalkable(room, x, y, blockedObjectTiles, enemyTiles, denTiles)) return { valid: false, reason: 'blocked_tile' };
    return { valid: true };
  };

  const spawnOffsets = normalizeSpawnPoints(config.spawnPoints);
  for (const offset of spawnOffsets) {
    const target = { x: den.x + offset.x, y: den.y + offset.y };
    const result = trySpawnPosition(target, probe, {
      room,
      worldObjects,
      entities: enemies,
      rng,
      maxAttempts: 1,
      searchRadius: 1,
      extraValidation,
      debugAttempts: candidateMarkers,
    });
    if (result.position) {
      debug?.antDenSpawns?.push?.({ denId: den.id, x: result.position.x, y: result.position.y, valid: true });
      debug?.antDenSpawnAttempts?.push?.(...candidateMarkers.map((attempt) => ({ denId: den.id, ...attempt })));
      return result.position;
    }
  }

  for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt += 1) {
    const shouldBiasToPlayer = playerAngle !== null && config.spawnBiasToPlayer > 0 && rng() < config.spawnBiasToPlayer;
    const angle = shouldBiasToPlayer ? playerAngle + randomInRange(rng, -Math.PI / 6, Math.PI / 6) : rng() * Math.PI * 2;
    const distance = randomInRange(rng, minRadius, maxRadius);
    const target = { x: Math.round(den.x + Math.cos(angle) * distance), y: Math.round(den.y + Math.sin(angle) * distance) };
    const result = trySpawnPosition(target, probe, {
      room,
      worldObjects,
      entities: enemies,
      rng,
      maxAttempts: 1,
      searchRadius: 1,
      extraValidation,
      debugAttempts: candidateMarkers,
    });
    if (result.position) {
      debug?.antDenSpawns?.push?.({ denId: den.id, x: result.position.x, y: result.position.y, valid: true });
      debug?.antDenSpawnAttempts?.push?.(...candidateMarkers.map((attempt) => ({ denId: den.id, ...attempt })));
      return result.position;
    }
  }
  debug?.antDenSpawnAttempts?.push?.(...candidateMarkers.map((attempt) => ({ denId: den.id, ...attempt })));
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

function queueNextSpawn(state, config, rng) {
  state.nextSpawnInterval = randomInRange(rng, config.spawnIntervalMin, config.spawnIntervalMax);
  state.spawnTimer += state.nextSpawnInterval;
}

function spawnAntFromDen({ den, config, state, room, worldObjects, enemies, player, spawnEnemy, onSpawn, debug, effectSystem, rng }) {
  const spawnPoint = findSpawnPosition(den, config, room, worldObjects, enemies, player, rng, debug);
  if (!spawnPoint) {
    queueNextSpawn(state, config, rng);
    return false;
  }

  const ant = spawnEnemy(config.enemyType, spawnPoint, {
    den,
    room,
    collisionGroup: 'enemy',
    ignoreCollisionWith: ['ant_den'],
  });
  if (!ant) {
    queueNextSpawn(state, config, rng);
    return false;
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

  den.state.lastSpawnPulse = 0.3;
  return true;
}

function spawnActivationBurst({ den, config, state, room, worldObjects, enemies, player, spawnEnemy, onSpawn, debug, effectSystem, rng }) {
  const burstTarget = randomInt(rng, 1, 2);
  for (let i = 0; i < burstTarget; i += 1) {
    if (state.spawnedCount >= state.targetSpawnCount) break;
    if (countActiveDenAnts(enemies, den.id) >= config.maxActiveAnts) break;
    spawnAntFromDen({ den, config, state, room, worldObjects, enemies, player, spawnEnemy, onSpawn, debug, effectSystem, rng });
  }
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

    den.state.heatPulse = (den.state.heatPulse ?? 0) + dt;
    den.state.lastSpawnPulse = Math.max(0, (den.state.lastSpawnPulse ?? 0) - dt * 0.7);

    if (state.phase === ANT_DEN_PHASE.IDLE) {
      if (!isPlayerInsideTrigger(den, player, config.triggerRadius)) continue;
      state.phase = ANT_DEN_PHASE.ACTIVE;
      state.spawnTimer = 0;
      spawnActivationBurst({ den, config, state, room, worldObjects, enemies, player, spawnEnemy, onSpawn, debug, effectSystem, rng });
      queueNextSpawn(state, config, rng);
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

      const spawned = spawnAntFromDen({ den, config, state, room, worldObjects, enemies, player, spawnEnemy, onSpawn, debug, effectSystem, rng });
      if (!spawned) break;

      if (state.spawnedCount >= state.targetSpawnCount) {
        state.phase = ANT_DEN_PHASE.DEPLETED;
        break;
      }
      queueNextSpawn(state, config, rng);
    }
  }
}
