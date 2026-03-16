import { Enemy } from '../entities/Enemy.js';

const DEFAULT_ENEMY_SPAWN_TABLE = {
  forest: [
    { type: 'chaser', weight: 5 },
    { type: 'ranged', weight: 3 },
    { type: 'tank', weight: 2 },
    { type: 'swarm', weight: 4 },
  ],
  cave: [
    { type: 'chaser', weight: 3 },
    { type: 'ranged', weight: 4 },
    { type: 'tank', weight: 4 },
    { type: 'swarm', weight: 2 },
  ],
  river: [
    { type: 'chaser', weight: 4 },
    { type: 'ranged', weight: 4 },
    { type: 'tank', weight: 2 },
    { type: 'swarm', weight: 3 },
  ],
  mountain: [
    { type: 'chaser', weight: 3 },
    { type: 'ranged', weight: 2 },
    { type: 'tank', weight: 5 },
    { type: 'swarm', weight: 2 },
  ],
};

const ARCHETYPE_TO_KIND = {
  chaser: 'slime',
  ranged: 'skeleton',
  tank: 'skeleton',
  swarm: 'slime',
};

const DEFAULT_SETTINGS = {
  enemyDensityFactor: 0.0035,
  minEnemies: 3,
  maxEnemies: 25,
  groupSpawnChance: 0.25,
  swarmGroupMin: 3,
  swarmGroupMax: 6,
  minDistanceFromEntrance: 6,
  minDistanceFromExit: 5,
  minDistanceFromPath: 2,
  minDistanceBetweenEnemyGroups: 10,
  maxSpawnAttempts: 100,
};

function toInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
}

function resolveSettings(runtimeConfig = null) {
  return {
    enemyDensityFactor: Number(runtimeConfig?.get?.('enemyGeneration.enemyDensityFactor')) || DEFAULT_SETTINGS.enemyDensityFactor,
    minEnemies: toInt(runtimeConfig?.get?.('enemyGeneration.minEnemies'), DEFAULT_SETTINGS.minEnemies),
    maxEnemies: toInt(runtimeConfig?.get?.('enemyGeneration.maxEnemies'), DEFAULT_SETTINGS.maxEnemies),
    groupSpawnChance: Math.max(0, Math.min(1, Number(runtimeConfig?.get?.('enemyGeneration.groupSpawnChance')) || DEFAULT_SETTINGS.groupSpawnChance)),
    swarmGroupMin: toInt(runtimeConfig?.get?.('enemyGeneration.swarmGroupMin'), DEFAULT_SETTINGS.swarmGroupMin),
    swarmGroupMax: toInt(runtimeConfig?.get?.('enemyGeneration.swarmGroupMax'), DEFAULT_SETTINGS.swarmGroupMax),
    minDistanceFromEntrance: toInt(runtimeConfig?.get?.('enemyGeneration.minDistanceFromEntrance'), DEFAULT_SETTINGS.minDistanceFromEntrance),
    minDistanceFromExit: toInt(runtimeConfig?.get?.('enemyGeneration.minDistanceFromExit'), DEFAULT_SETTINGS.minDistanceFromExit),
    minDistanceFromPath: toInt(runtimeConfig?.get?.('enemyGeneration.minDistanceFromPath'), DEFAULT_SETTINGS.minDistanceFromPath),
    minDistanceBetweenEnemyGroups: toInt(runtimeConfig?.get?.('enemyGeneration.minDistanceBetweenEnemyGroups'), DEFAULT_SETTINGS.minDistanceBetweenEnemyGroups),
    maxSpawnAttempts: toInt(runtimeConfig?.get?.('enemyGeneration.maxSpawnAttempts'), DEFAULT_SETTINGS.maxSpawnAttempts),
  };
}

function weightedPick(entries, rng) {
  const total = entries.reduce((acc, entry) => acc + Math.max(0, entry.weight ?? 0), 0);
  if (total <= 0) return entries[0]?.type ?? 'chaser';
  let roll = rng() * total;
  for (const entry of entries) {
    roll -= Math.max(0, entry.weight ?? 0);
    if (roll <= 0) return entry.type;
  }
  return entries[entries.length - 1]?.type ?? 'chaser';
}

function randomInt(rng, min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function isInsideRoom(room, x, y) {
  return Boolean(room?.tiles?.[y]?.[x]);
}

function hasNearbyMask(mask, x, y, radius) {
  if (!mask || radius <= 0) return false;
  for (let oy = -radius; oy <= radius; oy += 1) {
    for (let ox = -radius; ox <= radius; ox += 1) {
      if ((ox * ox) + (oy * oy) > radius * radius) continue;
      if (!mask.has(`${x + ox},${y + oy}`)) continue;
      return true;
    }
  }
  return false;
}

function isNearAnchors(x, y, anchors, radius) {
  if (!Array.isArray(anchors) || radius <= 0) return false;
  const maxDistSq = radius * radius;
  for (const anchor of anchors) {
    const dx = x - anchor.x;
    const dy = y - anchor.y;
    if ((dx * dx) + (dy * dy) <= maxDistSq) return true;
  }
  return false;
}

function isValidSpawnTile(room, x, y, context) {
  if (!isInsideRoom(room, x, y)) return false;
  if (!room.tiles?.[y]?.[x]?.walkable) return false;
  if (room.collisionMap?.[y]?.[x]) return false;
  if (context.occupiedTiles.has(`${x},${y}`)) return false;
  if (hasNearbyMask(context.pathMask, x, y, context.settings.minDistanceFromPath)) return false;
  if (isNearAnchors(x, y, context.entranceAnchors, context.settings.minDistanceFromEntrance)) return false;
  if (isNearAnchors(x, y, context.exitAnchors, context.settings.minDistanceFromExit)) return false;
  return true;
}

function findValidPoint(room, context, center = null) {
  const width = room.tiles[0]?.length ?? 0;
  const height = room.tiles.length;

  for (let attempt = 0; attempt < context.settings.maxSpawnAttempts; attempt += 1) {
    let x;
    let y;
    if (center) {
      const angle = context.rng() * Math.PI * 2;
      const radius = context.rng() * 4;
      x = Math.round(center.x + Math.cos(angle) * radius);
      y = Math.round(center.y + Math.sin(angle) * radius);
    } else {
      x = randomInt(context.rng, 1, Math.max(1, width - 2));
      y = randomInt(context.rng, 1, Math.max(1, height - 2));
    }

    if (!isValidSpawnTile(room, x, y, context)) continue;
    return { x, y };
  }

  return null;
}

function resolveGroupSize(archetype, remaining, settings, rng) {
  if (archetype === 'swarm') {
    const size = randomInt(rng, settings.swarmGroupMin, settings.swarmGroupMax);
    return Math.max(1, Math.min(size, remaining));
  }
  if (remaining <= 1) return 1;
  if (rng() < settings.groupSpawnChance) return Math.min(2, remaining);
  return 1;
}

function isFarEnoughFromGroups(x, y, centers, minDistance) {
  const minDistSq = minDistance * minDistance;
  for (const center of centers) {
    const dx = x - center.x;
    const dy = y - center.y;
    if ((dx * dx) + (dy * dy) < minDistSq) return false;
  }
  return true;
}

function collectOccupiedTiles(room) {
  const occupied = new Set();
  for (const object of room?.objects ?? []) {
    const footprint = object?.footprint ?? object?.logicalShape?.tiles ?? [[0, 0]];
    for (const [dx, dy] of footprint) {
      occupied.add(`${Math.round(object.x + dx)},${Math.round(object.y + dy)}`);
    }
  }
  return occupied;
}

function collectPathMask(room, fallbackPathMask) {
  if (fallbackPathMask?.size) return new Set(fallbackPathMask);
  const mask = new Set();
  for (const tile of room?.debugOverlay?.reservedCorridorTiles ?? []) {
    mask.add(`${tile.x},${tile.y}`);
  }
  return mask;
}

function createEnemy(archetype, x, y) {
  const kind = ARCHETYPE_TO_KIND[archetype] ?? 'slime';
  return new Enemy(kind, x, y);
}

export function spawnEnemyGroup(type, centerX, centerY, options = {}) {
  const {
    room,
    occupiedTiles = new Set(),
    pathMask = new Set(),
    entranceAnchors = [],
    exitAnchors = [],
    settings = DEFAULT_SETTINGS,
    rng = Math.random,
    groupSize = 1,
    groupId = 'manual-group',
  } = options;

  if (!room) return { enemies: [], points: [] };

  const context = {
    rng,
    settings,
    occupiedTiles,
    pathMask,
    entranceAnchors,
    exitAnchors,
  };

  const enemies = [];
  const points = [];
  const center = { x: Math.round(centerX), y: Math.round(centerY) };
  for (let i = 0; i < groupSize; i += 1) {
    const point = findValidPoint(room, context, center);
    if (!point) continue;
    occupiedTiles.add(`${point.x},${point.y}`);
    enemies.push(createEnemy(type, point.x, point.y));
    points.push({ x: point.x, y: point.y, type, groupId });
  }

  return { enemies, points };
}

export function spawnEnemiesForRoom(room, options = {}) {
  if (!room?.tiles?.length) return { enemies: [], debug: {} };

  const settings = resolveSettings(options.runtimeConfig);
  settings.swarmGroupMax = Math.max(settings.swarmGroupMin, settings.swarmGroupMax);
  settings.maxEnemies = Math.max(settings.minEnemies, settings.maxEnemies);

  const roomArea = room.tiles.length * (room.tiles[0]?.length ?? 0);
  const desiredCount = Math.max(settings.minEnemies, Math.min(settings.maxEnemies, Math.round(roomArea * settings.enemyDensityFactor)));

  const spawnTable = DEFAULT_ENEMY_SPAWN_TABLE[options.biomeType] ?? DEFAULT_ENEMY_SPAWN_TABLE.forest;
  const occupiedTiles = collectOccupiedTiles(room);
  const pathMask = collectPathMask(room, options.pathMask);
  const entranceAnchors = options.entranceAnchors ?? [];
  const exitAnchors = options.exitAnchors ?? [];
  const rng = options.rng ?? Math.random;

  const context = {
    rng,
    settings,
    occupiedTiles,
    pathMask,
    entranceAnchors,
    exitAnchors,
  };

  const enemies = [];
  const spawnPoints = [];
  const groupCenters = [];
  let groupIndex = 0;

  while (enemies.length < desiredCount) {
    const archetype = weightedPick(spawnTable, rng);
    const remaining = desiredCount - enemies.length;
    const groupSize = resolveGroupSize(archetype, remaining, settings, rng);

    let center = null;
    for (let attempt = 0; attempt < settings.maxSpawnAttempts; attempt += 1) {
      const candidate = findValidPoint(room, context);
      if (!candidate) continue;
      if (!isFarEnoughFromGroups(candidate.x, candidate.y, groupCenters, settings.minDistanceBetweenEnemyGroups)) continue;
      center = candidate;
      break;
    }
    if (!center) break;

    const groupId = `group-${groupIndex}`;
    const group = spawnEnemyGroup(archetype, center.x, center.y, {
      room,
      occupiedTiles,
      pathMask,
      entranceAnchors,
      exitAnchors,
      settings,
      rng,
      groupSize,
      groupId,
    });

    if (group.enemies.length <= 0) {
      groupIndex += 1;
      continue;
    }

    groupCenters.push({ x: center.x, y: center.y, type: archetype, groupId });
    enemies.push(...group.enemies);
    spawnPoints.push(...group.points);
    groupIndex += 1;
  }

  const debug = {
    enemySpawnPoints: spawnPoints,
    enemyGroupCenters: groupCenters,
    entranceSafetyAnchors: entranceAnchors,
    exitSafetyAnchors: exitAnchors,
    pathSafetyTiles: [...pathMask].map((key) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    }),
    safetySettings: {
      minDistanceFromEntrance: settings.minDistanceFromEntrance,
      minDistanceFromExit: settings.minDistanceFromExit,
      minDistanceFromPath: settings.minDistanceFromPath,
    },
  };

  return { enemies, debug };
}
