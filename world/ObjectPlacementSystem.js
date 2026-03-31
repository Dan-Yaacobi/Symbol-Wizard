import { spawnObject, OBJECT_CATEGORY } from './ObjectLibrary.js';
import { getSpawnDefinitionsByCategory, spawnByCategory } from '../data/SpawnDefinitionRegistry.js';
import { biomeToneBias, colorVariation } from './ColorVariation.js';

function nowMs() {
  return globalThis?.performance?.now?.() ?? Date.now();
}

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

function tileKey(x, y) {
  return `${x},${y}`;
}

function toIndex(x, y, width) {
  return (y * width) + x;
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
  for (const cell of cells) keySet.add(tileKey(cell.x, cell.y));
  if (!keySet.has('0,0')) return false;

  const [first] = keySet;
  const queue = [first];
  const visited = new Set([first]);

  while (queue.length > 0) {
    const current = queue.shift();
    const [xString, yString] = current.split(',');
    const cx = Number(xString);
    const cy = Number(yString);

    for (const neighbor of [tileKey(cx + 1, cy), tileKey(cx - 1, cy), tileKey(cx, cy + 1), tileKey(cx, cy - 1)]) {
      if (!keySet.has(neighbor) || visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return visited.size === keySet.size;
}

function collectObjectTiles(center, footprint) {
  return normalizeFootprintCells(footprint).map((cell) => ({ x: center.x + cell.x, y: center.y + cell.y }));
}

function sanitizeClearanceRadius(source) {
  return Math.max(0, Number(source?.clearanceRadius ?? source?.clearRadius) || 0);
}

function rotateFootprintCells(footprint, quarterTurns = 0) {
  const turns = ((quarterTurns % 4) + 4) % 4;
  return normalizeFootprintCells(footprint).map((cell) => {
    if (turns === 1) return { x: -cell.y, y: cell.x };
    if (turns === 2) return { x: -cell.x, y: -cell.y };
    if (turns === 3) return { x: cell.y, y: -cell.x };
    return { x: cell.x, y: cell.y };
  });
}

function tileVariationScore(tiles, x, y) {
  const centerType = tiles[y]?.[x]?.type;
  if (!centerType) return 0;
  let differences = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const neighborType = tiles[y + dy]?.[x + dx]?.type;
    if (neighborType && neighborType !== centerType) differences += 1;
  }
  return differences;
}

function samplePlacementCenter(tiles, rng, minDistanceFromMapEdge = 2) {
  return {
    x: randomInt(rng, minDistanceFromMapEdge, tiles[0].length - 1 - minDistanceFromMapEdge),
    y: randomInt(rng, minDistanceFromMapEdge, tiles.length - 1 - minDistanceFromMapEdge),
  };
}

function stampObjectTiles(tiles, object, biomeType = 'forest') {
  const objectTiles = Array.isArray(object.tiles) && object.tiles.length > 0 ? object.tiles : object.tileVariants ?? [];
  if (objectTiles.length === 0) return;
  const tone = biomeToneBias(biomeType);

  for (const tile of objectTiles) {
    const dx = Number.isInteger(tile.x) ? tile.x : 0;
    const dy = Number.isInteger(tile.y) ? tile.y : 0;
    const x = Math.round(object.x + dx);
    const y = Math.round(object.y + dy);
    if (!tiles[y]?.[x]) continue;
    tiles[y][x] = {
      ...tiles[y][x],
      char: tile.char,
      fg: colorVariation(tile.fg ?? tiles[y][x].fg, { hue: 0.035, lightness: 0.08, saturation: 0.03 }, (x * 0.31) + (y * 0.27), tone),
      bg: tile.bg ? colorVariation(tile.bg, { hue: 0.02, lightness: 0.06, saturation: 0.02 }, (x * 0.17) + (y * 0.29), tone) : null,
      type: `object-${object.type}`,
      walkable: object.collision ? false : tiles[y][x].walkable,
    };
  }
}

function sanitizeClusterSize(definition) {
  const minSource = definition.clusterMin ?? definition.minClusterSize;
  if (!Number.isFinite(minSource)) return null;
  const min = Math.max(1, Math.floor(minSource));
  const maxSource = definition.clusterMax ?? definition.maxClusterSize;
  const max = Math.max(min, Number.isFinite(maxSource) ? Math.floor(maxSource) : min);
  return { min, max };
}

function buildPathDistanceField({ width, height, pathTiles }) {
  const total = width * height;
  const distances = new Int16Array(total);
  distances.fill(-1);
  if (!pathTiles?.size) return distances;

  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  for (const key of pathTiles) {
    const [x, y] = key.split(',').map(Number);
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const idx = toIndex(x, y, width);
    if (distances[idx] === 0) continue;
    distances[idx] = 0;
    queue[tail++] = idx;
  }

  const neighbors = [1, -1, width, -width];
  while (head < tail) {
    const idx = queue[head++];
    const x = idx % width;
    const y = Math.floor(idx / width);
    const baseDist = distances[idx];

    for (const offset of neighbors) {
      const n = idx + offset;
      if (n < 0 || n >= total) continue;
      const nx = n % width;
      const ny = Math.floor(n / width);
      if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
      if (distances[n] !== -1) continue;
      distances[n] = baseDist + 1;
      queue[tail++] = n;
    }
  }

  return distances;
}

function createObjectDensityField({ tiles, pathDistanceField }) {
  const height = tiles.length;
  const width = tiles[0]?.length ?? 0;
  const field = Array.from({ length: height }, () => Array.from({ length: width }, () => 0.5));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = tiles[y]?.[x];
      if (!tile?.walkable || tile.type === 'road') {
        field[y][x] = 0;
        continue;
      }
      let nearbyWalls = 0;
      for (let oy = -2; oy <= 2; oy += 1) {
        for (let ox = -2; ox <= 2; ox += 1) {
          if (ox === 0 && oy === 0) continue;
          const n = tiles[y + oy]?.[x + ox];
          if (n && !n.walkable) nearbyWalls += 1;
        }
      }
      const pathDistance = pathDistanceField[toIndex(x, y, width)];
      const normalizedPathDistance = pathDistance < 0 ? 8 : Math.min(8, pathDistance);
      const pathFactor = Math.min(1, normalizedPathDistance / 6);
      const wallFactor = Math.min(1, nearbyWalls / 8);
      field[y][x] = Math.max(0.05, Math.min(1, (0.25 + (wallFactor * 0.5) + (pathFactor * 0.25))));
    }
  }

  return field;
}

function classifyZone({ tiles, x, y, densityValue, pathDistance }) {
  const variation = tileVariationScore(tiles, x, y);
  if (pathDistance <= 2.5) return 'pathside';
  if (densityValue >= 0.68 || variation >= 2) return 'denseForest';
  if (densityValue <= 0.35) return 'clearing';
  return 'sparseForest';
}

const OBJECT_RULES = {
  [OBJECT_CATEGORY.ENVIRONMENT]: {
    categoryTag: 'TREE',
    clusterAllowed: true,
    basePadding: 1,
    preferredZones: ['denseForest', 'sparseForest', 'clearing'],
  },
  [OBJECT_CATEGORY.DESTRUCTIBLE]: {
    categoryTag: 'ROCK',
    clusterAllowed: true,
    basePadding: 1,
    preferredZones: ['sparseForest', 'pathside', 'denseForest'],
  },
  [OBJECT_CATEGORY.INTERACTABLE]: {
    categoryTag: 'STRUCTURE',
    clusterAllowed: false,
    basePadding: 2,
    preferredZones: ['clearing', 'sparseForest'],
  },
  [OBJECT_CATEGORY.LANDMARK]: {
    categoryTag: 'LANDMARK',
    clusterAllowed: false,
    basePadding: 3,
    preferredZones: ['clearing', 'denseForest'],
  },
  [OBJECT_CATEGORY.PROP]: {
    categoryTag: 'PROP',
    clusterAllowed: true,
    basePadding: 0,
    preferredZones: ['clearing', 'sparseForest'],
  },
};

function mapTypeAllowsDefinition(definition, mapType = null) {
  if (!Array.isArray(definition?.allowedMapTypes) || definition.allowedMapTypes.length === 0) return true;
  if (!mapType) return true;
  return definition.allowedMapTypes.includes(mapType);
}

function buildBiomePool(biome, category, mapType = null) {
  if (category === OBJECT_CATEGORY.LANDMARK) {
    return getSpawnDefinitionsByCategory(null, biome)
      .filter((definition) => definition?.placementCategory === OBJECT_CATEGORY.LANDMARK
        && isValidFootprint(definition.footprint)
        && mapTypeAllowsDefinition(definition, mapType));
  }
  return getSpawnDefinitionsByCategory(category, biome)
    .filter((definition) => definition && isValidFootprint(definition.footprint) && mapTypeAllowsDefinition(definition, mapType));
}

function hasClearanceConflict({ center, definition, placedObjects, metrics }) {
  const start = nowMs();
  const thisClearance = sanitizeClearanceRadius(definition);
  if (!Array.isArray(placedObjects) || placedObjects.length === 0) return false;

  for (const placed of placedObjects) {
    if (!placed || placed.destroyed) continue;
    const otherClearance = sanitizeClearanceRadius(placed);
    const minDistance = thisClearance + otherClearance;
    if (minDistance <= 0) continue;
    metrics.collisionChecks += 1;
    if (Math.hypot(center.x - placed.x, center.y - placed.y) < minDistance) {
      metrics.phaseMs.collisionChecks += nowMs() - start;
      return true;
    }
  }

  metrics.phaseMs.collisionChecks += nowMs() - start;
  return false;
}

function isFootprintValid({
  tiles,
  footprint,
  center,
  occupiedGrid,
  blockedGrid,
  pathForbiddenGrid,
  exitForbiddenGrid,
  entranceForbiddenGrid,
  safetyConfig,
  densityField,
  width,
  height,
}) {
  const cells = collectObjectTiles(center, footprint);
  if (cells.length === 0) return false;

  const mapEdge = safetyConfig.minDistanceFromMapEdge ?? 0;

  for (const cell of cells) {
    const inBounds = cell.x >= 0 && cell.x < width && cell.y >= 0 && cell.y < height;
    if (!inBounds) return false;

    if (cell.x <= 1 || cell.x >= width - 2 || cell.y <= 1 || cell.y >= height - 2) return false;
    if (cell.x < mapEdge || cell.y < mapEdge || cell.x >= width - mapEdge || cell.y >= height - mapEdge) return false;

    const tile = tiles[cell.y]?.[cell.x];
    if (!tile?.walkable || tile.type === 'road') return false;

    const idx = toIndex(cell.x, cell.y, width);
    if (blockedGrid[idx] !== 0 || occupiedGrid[idx] !== 0) return false;
    if (pathForbiddenGrid[idx] || exitForbiddenGrid[idx] || entranceForbiddenGrid[idx]) return false;
    if ((densityField[cell.y]?.[cell.x] ?? 0) <= 0) return false;
  }

  return true;
}

function validatePlacement({
  tiles,
  center,
  definition,
  footprint = definition.footprint,
  occupiedGrid,
  blockedGrid,
  pathForbiddenGrid,
  exitForbiddenGrid,
  entranceForbiddenGrid,
  safetyConfig,
  densityField,
  placedObjects = [],
  width,
  height,
  metrics,
}) {
  const start = nowMs();
  metrics.validationChecks += 1;
  if (hasClearanceConflict({ center, definition, placedObjects, metrics })) return false;
  const ok = isFootprintValid({
    tiles,
    footprint,
    center,
    occupiedGrid,
    blockedGrid,
    pathForbiddenGrid,
    exitForbiddenGrid,
    entranceForbiddenGrid,
    safetyConfig,
    densityField,
    width,
    height,
  });
  metrics.phaseMs.validation += nowMs() - start;
  return ok;
}

function reservePlacement({ occupiedTiles, occupiedGrid, blockedGrid, cells, padding = 0, width, height }) {
  for (const cell of cells) {
    const baseIdx = toIndex(cell.x, cell.y, width);
    occupiedGrid[baseIdx] = 1;
    blockedGrid[baseIdx] = 1;
    occupiedTiles.add(tileKey(cell.x, cell.y));

    for (let oy = -padding; oy <= padding; oy += 1) {
      const py = cell.y + oy;
      if (py < 0 || py >= height) continue;
      for (let ox = -padding; ox <= padding; ox += 1) {
        const px = cell.x + ox;
        if (px < 0 || px >= width) continue;
        blockedGrid[toIndex(px, py, width)] = 1;
      }
    }
  }
}

function buildPlacementCandidates({
  tiles,
  densityField,
  pathDistanceField,
  safetyConfig,
  blockedGrid,
  pathForbiddenGrid,
  exitForbiddenGrid,
  entranceForbiddenGrid,
  width,
  height,
}) {
  const zones = {
    pathside: [],
    denseForest: [],
    clearing: [],
    sparseForest: [],
  };
  const all = [];
  const mapEdge = safetyConfig.minDistanceFromMapEdge ?? 0;

  for (let y = 2; y < height - 2; y += 1) {
    for (let x = 2; x < width - 2; x += 1) {
      if (x < mapEdge || y < mapEdge || x >= width - mapEdge || y >= height - mapEdge) continue;
      const tile = tiles[y]?.[x];
      if (!tile?.walkable || tile.type === 'road') continue;

      const idx = toIndex(x, y, width);
      if (blockedGrid[idx] !== 0) continue;
      if ((densityField[y]?.[x] ?? 0) <= 0) continue;

      if (pathForbiddenGrid[idx] || exitForbiddenGrid[idx] || entranceForbiddenGrid[idx]) continue;

      const pathDistance = pathDistanceField[idx] < 0 ? 8 : Math.min(8, pathDistanceField[idx]);
      const densityValue = densityField[y]?.[x] ?? 0.2;
      const zone = classifyZone({ tiles, x, y, densityValue, pathDistance });
      const variation = tileVariationScore(tiles, x, y);
      const candidate = { x, y, idx, zone, densityValue, variation, pathDistance };
      zones[zone].push(candidate);
      all.push(candidate);
    }
  }

  return { zones, all };
}

function buildAnchorForbiddenGrid({ width, height, anchors = [], radius = 0 }) {
  const grid = new Uint8Array(width * height);
  if (!Array.isArray(anchors) || anchors.length === 0 || radius <= 0) return grid;
  const r = Math.ceil(radius);
  const r2 = radius * radius;
  for (const anchor of anchors) {
    for (let oy = -r; oy <= r; oy += 1) {
      const y = anchor.y + oy;
      if (y < 0 || y >= height) continue;
      for (let ox = -r; ox <= r; ox += 1) {
        if ((ox * ox) + (oy * oy) > r2) continue;
        const x = anchor.x + ox;
        if (x < 0 || x >= width) continue;
        grid[toIndex(x, y, width)] = 1;
      }
    }
  }
  return grid;
}

function pickCandidateCenter({ definition, categoryRule, candidates, rng, maxAttempts, metrics }) {
  const start = nowMs();
  const preferredZones = Array.isArray(definition.preferredZones) && definition.preferredZones.length > 0
    ? definition.preferredZones
    : categoryRule.preferredZones;

  const tries = Math.max(5, Math.min(10, maxAttempts || 8));
  let retries = 0;

  const zoneCycle = [...preferredZones, 'denseForest', 'sparseForest', 'clearing', 'pathside'];
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const zone = zoneCycle[attempt % zoneCycle.length];
    const pool = candidates.zones[zone];
    if (pool?.length) {
      const pick = pool[Math.floor(rng() * pool.length)];
      metrics.candidateSelections += 1;
      metrics.retryAttempts += retries;
      const elapsed = nowMs() - start;
      metrics.phaseMs.candidateSelection += elapsed;
      metrics.phaseMs.retryLoops += elapsed * (retries / Math.max(1, attempt + 1));
      return { x: pick.x, y: pick.y };
    }
    retries += 1;
  }

  if (!candidates.all.length) {
    metrics.retryAttempts += retries;
    const elapsed = nowMs() - start;
    metrics.phaseMs.candidateSelection += elapsed;
    metrics.phaseMs.retryLoops += elapsed;
    return null;
  }

  metrics.candidateSelections += 1;
  metrics.retryAttempts += retries;
  const elapsed = nowMs() - start;
  metrics.phaseMs.candidateSelection += elapsed;
  metrics.phaseMs.retryLoops += elapsed * (retries / Math.max(1, tries));
  const pick = candidates.all[Math.floor(rng() * candidates.all.length)];
  return { x: pick.x, y: pick.y };
}

function spawnPlacedObject(params) {
  const {
    tiles,
    rng,
    occupiedTiles,
    occupiedGrid,
    blockedGrid,
    pathForbiddenGrid,
    exitForbiddenGrid,
    entranceForbiddenGrid,
    roomId,
    idPrefix,
    definition,
    center,
    idIndex,
    safetyConfig,
    densityField,
    categoryRule,
    placedObjects,
    biomeType,
    width,
    height,
    metrics,
  } = params;

  const previewRotation = definition.rotations ? Math.floor(rng() * 4) : 0;
  const previewFootprint = rotateFootprintCells(definition.footprint, previewRotation);
  if (!validatePlacement({
    tiles,
    center,
    definition,
    footprint: previewFootprint,
    occupiedTiles,
    occupiedGrid,
    blockedGrid,
    pathForbiddenGrid,
    exitForbiddenGrid,
    entranceForbiddenGrid,
    safetyConfig,
    densityField,
    placedObjects,
    width,
    height,
    metrics,
  })) return null;

  const placed = spawnObject(
    definition.id,
    center,
    {
      id: `${roomId}-${idPrefix}-${idIndex}`,
      footprint: structuredClone(definition.footprint),
      state: { spawned: true },
      rotation: previewRotation,
    },
    rng,
  );
  if (!placed) return null;

  const cells = collectObjectTiles(center, placed.footprint);
  reservePlacement({ occupiedTiles, occupiedGrid, blockedGrid, cells, padding: categoryRule.basePadding, width, height });
  placedObjects.push(placed);
  stampObjectTiles(tiles, placed, biomeType);
  return placed;
}

function placeCluster(definition, center, options) {
  const clusterStart = nowMs();
  const limits = sanitizeClusterSize(definition);
  if (!limits) return [];

  const {
    tiles, rng, occupiedTiles, occupiedGrid, blockedGrid, roomId, idPrefix,
    pathForbiddenGrid, exitForbiddenGrid, entranceForbiddenGrid,
    startIndex, safetyConfig, densityField, categoryRule, placedObjects, width, height,
    metrics,
  } = options;

  const clusterRadius = Math.max(1, Math.floor((definition.clusterRadius ?? 4) * (safetyConfig.clusterRadiusMultiplier ?? 1)));
  const clusterSize = randomInt(rng, limits.min, limits.max);
  const clusterPlacedObjects = [];

  const seedObject = spawnPlacedObject({
    tiles,
    rng,
    occupiedTiles,
    occupiedGrid,
    blockedGrid,
    pathForbiddenGrid,
    exitForbiddenGrid,
    entranceForbiddenGrid,
    roomId,
    idPrefix,
    definition,
    center,
    idIndex: startIndex,
    safetyConfig,
    densityField,
    categoryRule,
    placedObjects,
    biomeType: options.biomeType,
    width,
    height,
    metrics,
  });
  if (!seedObject) return [];
  clusterPlacedObjects.push(seedObject);

  metrics.clustersGenerated += 1;

  const maxAttempts = Math.max(6, clusterSize * 4);
  let attempts = 0;
  while (clusterPlacedObjects.length < clusterSize && attempts < maxAttempts) {
    attempts += 1;
    metrics.clusterAttempts += 1;
    const angle = rng() * Math.PI * 2;
    const distance = rng() * clusterRadius;
    const candidate = {
      x: Math.round(center.x + Math.cos(angle) * distance),
      y: Math.round(center.y + Math.sin(angle) * distance),
    };

    const placed = spawnPlacedObject({
      tiles,
      rng,
      occupiedTiles,
      occupiedGrid,
      blockedGrid,
      pathForbiddenGrid,
      exitForbiddenGrid,
      entranceForbiddenGrid,
      roomId,
      idPrefix,
      definition,
      center: candidate,
      idIndex: startIndex + clusterPlacedObjects.length,
      safetyConfig,
      densityField,
      categoryRule,
      placedObjects,
      biomeType: options.biomeType,
      width,
      height,
      metrics,
    });

    if (placed) clusterPlacedObjects.push(placed);
  }

  const majorityRequired = Math.max(1, Math.ceil(clusterSize * 0.6));
  metrics.phaseMs.clusterGeneration += nowMs() - clusterStart;
  return clusterPlacedObjects.length >= majorityRequired ? clusterPlacedObjects : [clusterPlacedObjects[0]];
}

function placeFromPool(params) {
  const {
    tiles,
    rng,
    occupiedTiles,
    occupiedGrid,
    blockedGrid,
    pathForbiddenGrid,
    exitForbiddenGrid,
    entranceForbiddenGrid,
    roomId,
    biomeType,
    mapType,
    category,
    targetMin,
    targetMax,
    idPrefix,
    allowClusters = true,
    safetyConfig = {},
    densityField,
    debugInfo,
    placedObjects,
    candidates,
    width,
    height,
    metrics,
  } = params;

  const categoryRule = OBJECT_RULES[category] ?? OBJECT_RULES[OBJECT_CATEGORY.ENVIRONMENT];
  const pools = buildBiomePool(biomeType, category, mapType);
  if (pools.length === 0) return [];

  const targetCount = Math.max(0, Math.floor(randomInt(rng, targetMin, targetMax) * (safetyConfig.objectDensity ?? 1)));
  const objects = [];

  for (let i = 0; i < targetCount; i += 1) {
    const weightedPool = pools.map((definition) => [definition, definition.spawnWeight ?? 1]);
    const definition = category === OBJECT_CATEGORY.LANDMARK
      ? weightedChoice(rng, weightedPool)
      : (spawnByCategory(category, biomeType, rng) ?? weightedChoice(rng, weightedPool));
    if (definition && !mapTypeAllowsDefinition(definition, mapType)) continue;
    if (!definition) continue;

    const center = pickCandidateCenter({
      definition,
      categoryRule,
      candidates,
      rng,
      maxAttempts: safetyConfig.maxAttemptsPerObjectType ?? 10,
      metrics,
    });
    if (!center) continue;

    const supportsCluster = allowClusters
      && categoryRule.clusterAllowed
      && Number.isFinite(definition.clusterMin ?? definition.minClusterSize);

    if (supportsCluster) {
      const cluster = placeCluster(definition, center, {
        tiles,
        rng,
        occupiedTiles,
        occupiedGrid,
        blockedGrid,
        pathForbiddenGrid,
        exitForbiddenGrid,
        entranceForbiddenGrid,
        roomId,
        idPrefix,
        startIndex: objects.length,
        safetyConfig: { ...safetyConfig, clusterRadiusMultiplier: safetyConfig.clusterRadiusMultiplier * (safetyConfig.clusterDensity ?? 1) },
        densityField,
        categoryRule,
        placedObjects,
        biomeType,
        width,
        height,
        metrics,
      });
      objects.push(...cluster);
      if (cluster.length > 0) debugInfo.clusterCenters.push(center);
      continue;
    }

    const placed = spawnPlacedObject({
      tiles,
      rng,
      occupiedTiles,
      occupiedGrid,
      blockedGrid,
      pathForbiddenGrid,
      exitForbiddenGrid,
      entranceForbiddenGrid,
      roomId,
      idPrefix,
      definition,
      center,
      idIndex: objects.length,
      safetyConfig,
      densityField,
      categoryRule,
      placedObjects,
      biomeType,
      width,
      height,
      metrics,
    });

    if (placed) objects.push(placed);
  }

  return objects;
}

function buildBlockedGrid({ blockedMask, width, height }) {
  const grid = new Uint8Array(width * height);
  for (const key of blockedMask) {
    const [x, y] = key.split(',').map(Number);
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    grid[toIndex(x, y, width)] = 1;
  }
  return grid;
}

function buildOccupiedGrid({ occupiedTiles, width, height }) {
  const grid = new Uint8Array(width * height);
  for (const key of occupiedTiles) {
    const [x, y] = key.split(',').map(Number);
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    grid[toIndex(x, y, width)] = 1;
  }
  return grid;
}

export class ObjectPlacementSystem {
  constructor() {
    this.placedObjectsBuffer = [];
    this.lastDebugInfo = {
      clusterCenters: [],
      blockedPlacementTiles: [],
      pathSafetyTiles: [],
      exitSafetyTiles: [],
      occupiedFootprintTiles: [],
      objectClearanceZones: [],
      profiling: null,
    };
  }

  placeObjects({ tiles, rng, blockedMask, roomId, biomeType = 'forest', mapType = null, safetyConfig = {}, occupiedTiles = null }) {
    const profileStart = nowMs();
    const localOccupied = occupiedTiles ?? new Set();
    const height = tiles.length;
    const width = tiles[0]?.length ?? 0;

    const metrics = {
      validationChecks: 0,
      retryAttempts: 0,
      collisionChecks: 0,
      candidateSelections: 0,
      clustersGenerated: 0,
      clusterAttempts: 0,
      phaseMs: {
        setup: 0,
        candidateSelection: 0,
        validation: 0,
        retryLoops: 0,
        collisionChecks: 0,
        clusterGeneration: 0,
      },
    };

    const setupStart = nowMs();
    const blockedGrid = buildBlockedGrid({ blockedMask, width, height });
    const occupiedGrid = buildOccupiedGrid({ occupiedTiles: localOccupied, width, height });
    const pathForbiddenGrid = buildAnchorForbiddenGrid({
      width,
      height,
      anchors: safetyConfig.pathAnchors,
      radius: safetyConfig.minDistanceFromPath ?? 0,
    });
    const exitForbiddenGrid = buildAnchorForbiddenGrid({
      width,
      height,
      anchors: safetyConfig.exitAnchors,
      radius: safetyConfig.minDistanceFromExit ?? 0,
    });
    const entranceForbiddenGrid = buildAnchorForbiddenGrid({
      width,
      height,
      anchors: safetyConfig.entranceAnchors,
      radius: safetyConfig.minDistanceFromExit ?? 0,
    });
    const pathDistanceField = buildPathDistanceField({ width, height, pathTiles: safetyConfig.pathTiles });
    const densityField = createObjectDensityField({ tiles, pathDistanceField });
    metrics.phaseMs.setup += nowMs() - setupStart;

    const candidateStart = nowMs();
    const candidates = buildPlacementCandidates({
      tiles,
      densityField,
      pathDistanceField,
      safetyConfig,
      blockedGrid,
      pathForbiddenGrid,
      exitForbiddenGrid,
      entranceForbiddenGrid,
      width,
      height,
    });
    metrics.phaseMs.candidateSelection += nowMs() - candidateStart;

    const debugInfo = {
      clusterCenters: [],
      blockedPlacementTiles: Array.from(blockedMask).map((key) => {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
      }),
      pathSafetyTiles: [],
      exitSafetyTiles: [],
      occupiedFootprintTiles: [],
      objectClearanceZones: [],
      profiling: null,
    };
    const placedObjects = [...this.placedObjectsBuffer];

    const categories = [OBJECT_CATEGORY.ENVIRONMENT, OBJECT_CATEGORY.DESTRUCTIBLE, OBJECT_CATEGORY.INTERACTABLE, OBJECT_CATEGORY.PROP];
    const objects = [];

    for (const category of categories) {
      const placed = placeFromPool({
        tiles,
        rng,
        occupiedTiles: localOccupied,
        occupiedGrid,
        blockedGrid,
        pathForbiddenGrid,
        exitForbiddenGrid,
        entranceForbiddenGrid,
        roomId,
        biomeType,
        mapType,
        category,
        targetMin: category === OBJECT_CATEGORY.PROP ? 0 : 8,
        targetMax: category === OBJECT_CATEGORY.PROP ? 0 : 16,
        idPrefix: 'object',
        allowClusters: true,
        safetyConfig,
        densityField,
        debugInfo,
        placedObjects,
        candidates,
        width,
        height,
        metrics,
      });
      objects.push(...placed);
    }

    debugInfo.occupiedFootprintTiles = Array.from(localOccupied).map((key) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    });
    debugInfo.objectClearanceZones = placedObjects
      .filter((object) => sanitizeClearanceRadius(object) > 0)
      .map((object) => ({ x: object.x, y: object.y, radius: sanitizeClearanceRadius(object), type: object.type }));

    debugInfo.profiling = {
      ...metrics,
      totalMs: Number((nowMs() - profileStart).toFixed(3)),
      candidatePoolSize: candidates.all.length,
      placedCount: objects.length,
    };

    this.lastDebugInfo = debugInfo;
    this.placedObjectsBuffer = placedObjects;
    return objects;
  }

  placeLandmarks({ tiles, rng, blockedMask, roomId, biomeType = 'forest', mapType = null, safetyConfig = {}, occupiedTiles = null }) {
    const localOccupied = occupiedTiles ?? new Set();
    const height = tiles.length;
    const width = tiles[0]?.length ?? 0;
    const blockedGrid = buildBlockedGrid({ blockedMask, width, height });
    const occupiedGrid = buildOccupiedGrid({ occupiedTiles: localOccupied, width, height });
    const pathForbiddenGrid = buildAnchorForbiddenGrid({
      width,
      height,
      anchors: safetyConfig.pathAnchors,
      radius: safetyConfig.minDistanceFromPath ?? 0,
    });
    const exitForbiddenGrid = buildAnchorForbiddenGrid({
      width,
      height,
      anchors: safetyConfig.exitAnchors,
      radius: safetyConfig.minDistanceFromExit ?? 0,
    });
    const entranceForbiddenGrid = buildAnchorForbiddenGrid({
      width,
      height,
      anchors: safetyConfig.entranceAnchors,
      radius: safetyConfig.minDistanceFromExit ?? 0,
    });
    const pathDistanceField = buildPathDistanceField({ width, height, pathTiles: safetyConfig.pathTiles });
    const densityField = createObjectDensityField({ tiles, pathDistanceField });

    const placedObjects = [];
    const metrics = {
      validationChecks: 0,
      retryAttempts: 0,
      collisionChecks: 0,
      candidateSelections: 0,
      clustersGenerated: 0,
      clusterAttempts: 0,
      phaseMs: {
        setup: 0,
        candidateSelection: 0,
        validation: 0,
        retryLoops: 0,
        collisionChecks: 0,
        clusterGeneration: 0,
      },
    };

    const pools = buildBiomePool(biomeType, OBJECT_CATEGORY.LANDMARK, mapType);
    const targetCount = pools.length > 0 ? randomInt(rng, 1, 2) : 0;
    const placed = [];
    for (let i = 0; i < targetCount; i += 1) {
      const weightedPool = pools.map((definition) => [definition, definition.spawnWeight ?? 1]);
      const definition = weightedChoice(rng, weightedPool);
      if (!definition) continue;

      let center = null;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = samplePlacementCenter(tiles, rng, safetyConfig.minDistanceFromMapEdge ?? 2);
        if (!validatePlacement({
          tiles,
          center: candidate,
          definition,
          occupiedTiles: localOccupied,
          occupiedGrid,
          blockedGrid,
          pathForbiddenGrid,
          exitForbiddenGrid,
          entranceForbiddenGrid,
          safetyConfig,
          densityField,
          placedObjects,
          width,
          height,
          metrics,
        })) continue;
        center = candidate;
        break;
      }
      if (!center) continue;

      const landmark = spawnPlacedObject({
        tiles,
        rng,
        occupiedTiles: localOccupied,
        occupiedGrid,
        blockedGrid,
        pathForbiddenGrid,
        exitForbiddenGrid,
        entranceForbiddenGrid,
        roomId,
        idPrefix: 'landmark',
        definition,
        center,
        idIndex: placed.length,
        safetyConfig,
        densityField,
        categoryRule: OBJECT_RULES[OBJECT_CATEGORY.LANDMARK],
        placedObjects,
        biomeType,
        width,
        height,
        metrics,
      });
      if (landmark) placed.push(landmark);
    }
    this.placedObjectsBuffer = placedObjects;
    return placed;
  }

  getDebugInfo() {
    return structuredClone(this.lastDebugInfo);
  }
}

export function listObjectDefinitions(category = null) {
  if (category) return buildBiomePool(null, category).map((definition) => definition.id);
  return [
    ...buildBiomePool(null, OBJECT_CATEGORY.ENVIRONMENT),
    ...buildBiomePool(null, OBJECT_CATEGORY.DESTRUCTIBLE),
    ...buildBiomePool(null, OBJECT_CATEGORY.INTERACTABLE),
    ...buildBiomePool(null, OBJECT_CATEGORY.PROP),
  ].map((definition) => definition.id);
}

export { buildBiomePool, placeCluster };
