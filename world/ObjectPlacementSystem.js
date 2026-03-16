import { objectLibrary, spawnObject, OBJECT_CATEGORY } from './ObjectLibrary.js';

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function weightedChoice(rng, weightedEntries) {
  const total = weightedEntries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return weightedEntries[0]?.[0] ?? null;

  let roll = rng() * total;
  for (const [value, weight] of weightedEntries) {
    roll -= weight;
    if (roll <= 0) return value;
  }

  return weightedEntries[weightedEntries.length - 1]?.[0] ?? null;
}

function normalizeFootprintCells(footprint) {
  if (!Array.isArray(footprint)) return [];
  return footprint
    .map((cell) => (Array.isArray(cell) ? { x: cell[0], y: cell[1] } : cell))
    .filter((cell) => cell && Number.isInteger(cell.x) && Number.isInteger(cell.y));
}

function isValidFootprint(footprint) {
  const cells = normalizeFootprintCells(footprint);
  if (cells.length === 0) return false;

  const keySet = new Set();
  for (const cell of cells) {
    keySet.add(`${cell.x},${cell.y}`);
  }

  if (!keySet.has('0,0')) return false;

  const [first] = keySet;
  const queue = [first];
  const visited = new Set([first]);

  while (queue.length > 0) {
    const current = queue.shift();
    const [xString, yString] = current.split(',');
    const cx = Number(xString);
    const cy = Number(yString);

    const neighbors = [
      `${cx + 1},${cy}`,
      `${cx - 1},${cy}`,
      `${cx},${cy + 1}`,
      `${cx},${cy - 1}`,
    ];

    for (const neighbor of neighbors) {
      if (!keySet.has(neighbor) || visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return visited.size === keySet.size;
}

function buildBiomePool(biome, category) {
  const entries = [];

  for (const definition of Object.values(objectLibrary)) {
    if (!definition) continue;
    if (category && definition.category !== category) continue;
    if (!isValidFootprint(definition.footprint)) continue;

    const tags = Array.isArray(definition.biomeTags) ? definition.biomeTags : [];
    if (biome && !tags.includes(biome)) continue;

    entries.push([definition, definition.spawnWeight ?? 1]);
  }

  return entries;
}

function isWithinDistanceSquared(ax, ay, bx, by, distance) {
  const dx = ax - bx;
  const dy = ay - by;
  return (dx * dx) + (dy * dy) <= distance * distance;
}

function violatesSafetyBuffer(x, y, safetyConfig) {
  const { pathTiles, minDistanceFromPath, exitAnchors, minDistanceFromExit } = safetyConfig;

  if (pathTiles?.has(`${x},${y}`)) return true;

  if (minDistanceFromPath > 0 && pathTiles && pathTiles.size > 0) {
    for (let oy = -minDistanceFromPath; oy <= minDistanceFromPath; oy += 1) {
      for (let ox = -minDistanceFromPath; ox <= minDistanceFromPath; ox += 1) {
        if (ox === 0 && oy === 0) continue;
        if (!isWithinDistanceSquared(0, 0, ox, oy, minDistanceFromPath)) continue;
        if (pathTiles.has(`${x + ox},${y + oy}`)) return true;
      }
    }
  }

  if (minDistanceFromExit > 0 && Array.isArray(exitAnchors)) {
    for (const exit of exitAnchors) {
      if (isWithinDistanceSquared(x, y, exit.x, exit.y, minDistanceFromExit)) return true;
    }
  }

  return false;
}

function canPlaceObject(tiles, center, footprint, blockedMask, allowOverlap = false, safetyConfig = {}) {
  for (const cell of normalizeFootprintCells(footprint)) {
    const x = center.x + cell.x;
    const y = center.y + cell.y;

    const tile = tiles[y]?.[x];
    if (!tile?.walkable) return false;
    if (tile.type === 'road') return false;
    if (!allowOverlap && blockedMask.has(`${x},${y}`)) return false;
    if (violatesSafetyBuffer(x, y, safetyConfig)) return false;
  }

  return true;
}

function tileVariationScore(tiles, x, y) {
  const centerType = tiles[y]?.[x]?.type;
  if (!centerType) return 0;

  let differences = 0;
  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (const [dx, dy] of neighbors) {
    const neighborType = tiles[y + dy]?.[x + dx]?.type;
    if (neighborType && neighborType !== centerType) differences += 1;
  }

  return differences;
}

function samplePlacementCenter(tiles, rng) {
  return {
    x: randomInt(rng, 2, tiles[0].length - 3),
    y: randomInt(rng, 2, tiles.length - 3),
  };
}

function markObject(mask, center, footprint, padding = 1) {
  for (const cell of normalizeFootprintCells(footprint)) {
    const cx = center.x + cell.x;
    const cy = center.y + cell.y;

    for (let oy = -padding; oy <= padding; oy += 1) {
      for (let ox = -padding; ox <= padding; ox += 1) {
        mask.add(`${cx + ox},${cy + oy}`);
      }
    }
  }
}

function stampObjectTiles(tiles, object) {
  const objectTiles = Array.isArray(object.tiles) && object.tiles.length > 0
    ? object.tiles
    : object.tileVariants ?? [];
  if (objectTiles.length === 0) return;

  for (const tile of objectTiles) {
    const dx = Number.isInteger(tile.x) ? tile.x : 0;
    const dy = Number.isInteger(tile.y) ? tile.y : 0;
    const x = Math.round(object.x + dx);
    const y = Math.round(object.y + dy);
    if (!tiles[y]?.[x]) continue;

    tiles[y][x] = {
      ...tiles[y][x],
      char: tile.char,
      fg: tile.fg,
      bg: tile.bg ?? null,
      type: `object-${object.type}`,
      walkable: object.collision ? false : tiles[y][x].walkable,
    };
  }
}

function sanitizeClusterSize(definition) {
  if (!Number.isFinite(definition.clusterMin)) return null;

  const min = Math.max(1, Math.floor(definition.clusterMin));
  const rawMax = Number.isFinite(definition.clusterMax) ? Math.floor(definition.clusterMax) : min;
  const max = Math.max(min, rawMax);
  return { min, max };
}

function spawnPlacedObject({ tiles, rng, blockedMask, roomId, idPrefix, padding, definition, center, idIndex, safetyConfig }) {
  if (!canPlaceObject(tiles, center, definition.footprint, blockedMask, false, safetyConfig)) return null;

  const placed = spawnObject(
    definition.id,
    center,
    {
      id: `${roomId}-${idPrefix}-${idIndex}`,
      footprint: structuredClone(definition.footprint),
      state: { spawned: true },
    },
    rng,
  );

  if (!placed) return null;

  stampObjectTiles(tiles, placed);
  markObject(blockedMask, center, definition.footprint, padding);
  return placed;
}

function placeCluster(definition, center, options) {
  const {
    tiles,
    rng,
    blockedMask,
    roomId,
    idPrefix,
    padding,
    startIndex,
    safetyConfig,
  } = options;
  const limits = sanitizeClusterSize(definition);
  if (!limits) return [];

  const clusterRadius = Math.max(1, Math.floor(definition.clusterRadius ?? 4));
  const clusterSize = randomInt(rng, limits.min, limits.max);
  const placedObjects = [];

  const first = spawnPlacedObject({
    tiles,
    rng,
    blockedMask,
    roomId,
    idPrefix,
    padding,
    definition,
    center,
    idIndex: startIndex,
    safetyConfig,
  });

  if (!first) return [];
  placedObjects.push(first);

  const maxAttempts = Math.max(20, clusterSize * 12);
  let attempts = 0;

  while (placedObjects.length < clusterSize && attempts < maxAttempts) {
    attempts += 1;
    const angle = rng() * Math.PI * 2;
    const distance = rng() * clusterRadius;
    const candidate = {
      x: Math.round(center.x + Math.cos(angle) * distance),
      y: Math.round(center.y + Math.sin(angle) * distance),
    };

    const placed = spawnPlacedObject({
      tiles,
      rng,
      blockedMask,
      roomId,
      idPrefix,
      padding,
      definition,
      center: candidate,
      idIndex: startIndex + placedObjects.length,
      safetyConfig,
    });

    if (placed) placedObjects.push(placed);
  }

  return placedObjects;
}

function selectBestCenter({ tiles, rng, blockedMask, definition, attempts = 45, safetyConfig }) {
  let bestCenter = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const center = samplePlacementCenter(tiles, rng);
    if (!canPlaceObject(tiles, center, definition.footprint, blockedMask, false, safetyConfig)) continue;

    const score = tileVariationScore(tiles, center.x, center.y);
    if (score > bestScore) {
      bestScore = score;
      bestCenter = center;
    }
  }

  return bestCenter;
}

function placeFromPool({
  tiles,
  rng,
  blockedMask,
  roomId,
  biomeType,
  category,
  targetMin,
  targetMax,
  idPrefix,
  padding,
  allowClusters = true,
  safetyConfig = {},
}) {
  const pools = buildBiomePool(biomeType, category);
  if (pools.length === 0) return [];

  const objects = [];
  const targetCount = randomInt(rng, targetMin, targetMax);

  for (let i = 0; i < targetCount; i += 1) {
    const definition = weightedChoice(rng, pools);
    if (!definition) continue;

    const bestCenter = selectBestCenter({ tiles, rng, blockedMask, definition, safetyConfig });
    if (!bestCenter) continue;

    const canCluster = allowClusters && Number.isFinite(definition.clusterMin);
    if (canCluster) {
      const cluster = placeCluster(definition, bestCenter, {
        tiles,
        rng,
        blockedMask,
        roomId,
        idPrefix,
        padding,
        startIndex: objects.length,
        safetyConfig,
      });
      objects.push(...cluster);
      continue;
    }

    const placed = spawnPlacedObject({
      tiles,
      rng,
      blockedMask,
      roomId,
      idPrefix,
      padding,
      definition,
      center: bestCenter,
      idIndex: objects.length,
      safetyConfig,
    });

    if (placed) objects.push(placed);
  }

  return objects;
}

export class ObjectPlacementSystem {
  placeObjects({ tiles, rng, blockedMask, roomId, biomeType = 'forest', safetyConfig = {} }) {
    const categories = [
      OBJECT_CATEGORY.ENVIRONMENT,
      OBJECT_CATEGORY.DESTRUCTIBLE,
      OBJECT_CATEGORY.INTERACTABLE,
    ];

    const objects = [];
    for (const category of categories) {
      const placed = placeFromPool({
        tiles,
        rng,
        blockedMask,
        roomId,
        biomeType,
        category,
        targetMin: 8,
        targetMax: 16,
        idPrefix: 'object',
        padding: 1,
        allowClusters: true,
        safetyConfig,
      });
      objects.push(...placed);
    }

    return objects;
  }

  placeLandmarks({ tiles, rng, blockedMask, roomId, biomeType = 'forest', safetyConfig = {} }) {
    return placeFromPool({
      tiles,
      rng,
      blockedMask,
      roomId,
      biomeType,
      category: OBJECT_CATEGORY.LANDMARK,
      targetMin: 1,
      targetMax: 3,
      idPrefix: 'landmark',
      padding: 2,
      allowClusters: false,
      safetyConfig,
    });
  }
}

export function listObjectDefinitions(category = null) {
  if (category) {
    return buildBiomePool(null, category).map(([definition]) => definition.id);
  }

  return Object.values(objectLibrary).map((def) => def.id);
}

export { buildBiomePool, placeCluster };
