import { activateEnemyAggro } from '../systems/AISystem.js';
import { evaluateSpawnPosition } from './SpawnValidator.js';

export const ANT_DEN_PHASE = Object.freeze({
  IDLE: 'idle',
  ACTIVE: 'active',
  DEPLETED: 'depleted',
});

const SPAWN_ATTEMPTS = 30;
const DEFAULT_DEN_SPAWN_OFFSETS = [
  { x: 0, y: 3 },
  { x: 3, y: 0 },
  { x: 0, y: -3 },
  { x: -3, y: 0 },
  { x: 2, y: 2 },
  { x: -2, y: 2 },
  { x: 2, y: -2 },
  { x: -2, y: -2 },
];

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
    spawnPoints: Array.isArray(source.spawnPoints) && source.spawnPoints.length > 0
      ? source.spawnPoints
      : DEFAULT_DEN_SPAWN_OFFSETS,
    maxActiveAnts: Math.max(1, Math.floor(Number(source.maxActiveAnts) || 10)),
    enemyType: typeof source.enemyType === 'string' ? source.enemyType : 'fire_ant',
    clearRadius: Math.max(
      0,
      Number(source.clearRadius ?? den?.clearRadius ?? den?.clearanceRadius) || 0,
    ),
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

function isTileInsideBlockingClearance(worldObjects = [], ignoredObject, x, y) {
  for (const object of worldObjects) {
    if (!object || object === ignoredObject || object.destroyed || !object.collision) continue;
    const clearance = Math.max(0, Number(object.clearanceRadius) || 0);
    if (clearance <= 0) continue;
    if (Math.hypot(x - object.x, y - object.y) < clearance) return true;
  }
  return false;
}

function estimateDenRadius(den) {
  let furthest = 1;
  for (const node of den?.footprint ?? den?.logicalShape?.tiles ?? [[0, 0]]) {
    const [dx, dy] = Array.isArray(node) ? node : [node?.x ?? 0, node?.y ?? 0];
    furthest = Math.max(furthest, Math.hypot(dx, dy));
  }
  return furthest;
}

function worldPositionFromOffset(den, offset) {
  return {
    x: Math.round(den.x + (Number(offset?.x) || 0)),
    y: Math.round(den.y + (Number(offset?.y) || 0)),
  };
}

function findSpawnPosition(den, config, room, worldObjects, enemies, player, debugMarkers, rng = Math.random) {
  const denRadius = estimateDenRadius(den);
  const minRadius = denRadius + Math.max(1, config.spawnRingMinOffset);
  const maxRadius = denRadius + Math.max(config.spawnRingMinOffset, config.spawnRingMaxOffset);
  const playerAngle = player ? Math.atan2(player.y - den.y, player.x - den.x) : null;

  const candidateOffsets = [...config.spawnPoints].sort(() => rng() - 0.5);
  for (const offset of candidateOffsets) {
    const candidate = worldPositionFromOffset(den, offset);
    const result = evaluateSpawnPosition(
      candidate,
      { radius: 1.25, ignoreCollisionWith: ['ant_den'] },
      { room, worldObjects, enemies, ignoredObjects: [den] },
    );
    debugMarkers.push({ ...candidate, valid: result.valid, reason: result.reason, denId: den.id, source: 'offset' });
    if (result.valid && !isTileInsideBlockingClearance(worldObjects, den, candidate.x, candidate.y)) return candidate;
  }

  for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt += 1) {
    const shouldBiasToPlayer = playerAngle !== null
      && config.spawnBiasToPlayer > 0
      && rng() < config.spawnBiasToPlayer;
    const angle = shouldBiasToPlayer
      ? playerAngle + randomInRange(rng, -Math.PI / 6, Math.PI / 6)
      : rng() * Math.PI * 2;
    const radius = randomInRange(rng, minRadius, maxRadius);
    const x = Math.round(den.x + Math.cos(angle) * radius);
    const y = Math.round(den.y + Math.sin(angle) * radius);
    const insideClearance = isTileInsideBlockingClearance(worldObjects, den, x, y);
    const result = evaluateSpawnPosition(
      { x, y },
      { radius: 1.25, ignoreCollisionWith: ['ant_den'] },
      { room, worldObjects, enemies, ignoredObjects: [den] },
    );
    const valid = !insideClearance && result.valid;
    debugMarkers.push({ x, y, valid, reason: insideClearance ? 'clearance_blocked' : result.reason, denId: den.id, source: 'ring' });
    if (valid) return { x, y };
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

function queueNextSpawn(state, config, rng) {
  state.nextSpawnInterval = randomInRange(rng, config.spawnIntervalMin, config.spawnIntervalMax);
  state.spawnTimer += state.nextSpawnInterval;
}

function spawnAntFromDen({ den, config, state, room, worldObjects, enemies, player, spawnEnemy, onSpawn, debug, effectSystem, rng }) {
  const spawnPoint = findSpawnPosition(den, config, room, worldObjects, enemies, player, debug?.markers ?? [], rng);
  if (!spawnPoint) {
    queueNextSpawn(state, config, rng);
    return false;
  }

  const ant = spawnEnemy(config.enemyType, spawnPoint, { den, room });
  if (!ant) {
    queueNextSpawn(state, config, rng);
    return false;
  }

  ant.sourceDenId = den.id;
  ant.sourceDenType = den.type;
  ant.collisionGroup = ant.collisionGroup ?? 'enemy';
  ant.ignoreCollisionWith = Array.isArray(ant.ignoreCollisionWith)
    ? [...new Set([...ant.ignoreCollisionWith, 'ant_den'])]
    : ['ant_den'];
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
  room.debugOverlay ??= {};
  room.debugOverlay.antDenSpawnAttempts = [];
  room.debugOverlay.antDenSpawnPoints = [];
  room.debugOverlay.antDenSpawnRings = [];

  for (const den of worldObjects) {
    const context = ensureDenState(den, rng);
    if (!context) continue;
    const { config, state } = context;
    den.collisionGroup = den.collisionGroup ?? 'ant_den';
    den.clearRadius = Math.max(Number(den.clearRadius) || 0, config.clearRadius);
    room.debugOverlay.antDenSpawnPoints.push(
      ...config.spawnPoints.map((offset) => ({ ...worldPositionFromOffset(den, offset), denId: den.id })),
    );
    room.debugOverlay.antDenSpawnRings.push({ x: den.x, y: den.y, minRadius: Math.max(1, estimateDenRadius(den) + config.spawnRingMinOffset), maxRadius: Math.max(1, estimateDenRadius(den) + config.spawnRingMaxOffset), denId: den.id });

    if (state.phase === ANT_DEN_PHASE.DEPLETED) continue;

    den.state.heatPulse = (den.state.heatPulse ?? 0) + dt;
    den.state.lastSpawnPulse = Math.max(0, (den.state.lastSpawnPulse ?? 0) - dt * 0.7);

    if (state.phase === ANT_DEN_PHASE.IDLE) {
      if (!isPlayerInsideTrigger(den, player, config.triggerRadius)) continue;
      state.phase = ANT_DEN_PHASE.ACTIVE;
      state.spawnTimer = 0;
      spawnActivationBurst({
        den,
        config,
        state,
        room,
        worldObjects,
        enemies,
        player,
        spawnEnemy,
        onSpawn,
        debug: { ...debug, markers: room.debugOverlay.antDenSpawnAttempts },
        effectSystem,
        rng,
      });
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

      const spawned = spawnAntFromDen({
        den,
        config,
        state,
        room,
        worldObjects,
        enemies,
        player,
        spawnEnemy,
        onSpawn,
        debug: { ...debug, markers: room.debugOverlay.antDenSpawnAttempts },
        effectSystem,
        rng,
      });
      if (!spawned) break;

      if (state.spawnedCount >= state.targetSpawnCount) {
        state.phase = ANT_DEN_PHASE.DEPLETED;
        break;
      }
      queueNextSpawn(state, config, rng);
    }
  }
}
