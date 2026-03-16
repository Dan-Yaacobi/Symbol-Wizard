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

function tileKey(x, y) {
  return `${x},${y}`;
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

function rotateFootprintCells(footprint, quarterTurns = 0) {
  const turns = ((quarterTurns % 4) + 4) % 4;
  return normalizeFootprintCells(footprint).map((cell) => {
    if (turns === 1) return { x: -cell.y, y: cell.x };
    if (turns === 2) return { x: -cell.x, y: -cell.y };
    if (turns === 3) return { x: cell.y, y: -cell.x };
    return { x: cell.x, y: cell.y };
  });
}

function isFootprintValid({ tiles, footprint, center, occupiedTiles, blockedMask, safetyConfig, densityField }) {
  const cells = collectObjectTiles(center, footprint);
  if (cells.length === 0) return false;

  const mapHeight = tiles.length;
  const mapWidth = tiles[0]?.length ?? 0;
  const mapEdge = safetyConfig.minDistanceFromMapEdge ?? 0;

  for (const cell of cells) {
    const inBounds = cell.x >= 0 && cell.x < mapWidth && cell.y >= 0 && cell.y < mapHeight;
    if (!inBounds) return false;

    // Protect outer boundary walls regardless of runtime edge distance tuning.
    if (cell.x <= 1 || cell.x >= mapWidth - 2 || cell.y <= 1 || cell.y >= mapHeight - 2) return false;

    if (cell.x < mapEdge || cell.y < mapEdge || cell.x >= mapWidth - mapEdge || cell.y >= mapHeight - mapEdge) return false;

    const tile = tiles[cell.y]?.[cell.x];
    if (!tile?.walkable || tile.type === 'road') return false;
    if (blockedMask?.has(tileKey(cell.x, cell.y))) return false;
    if (occupiedTiles?.has(tileKey(cell.x, cell.y))) return false;
    if ((densityField[cell.y]?.[cell.x] ?? 0) <= 0) return false;
  }

  if (violatesAnchorDistance(cells, safetyConfig.pathAnchors, safetyConfig.minDistanceFromPath)) return false;
  if (violatesAnchorDistance(cells, safetyConfig.exitAnchors, safetyConfig.minDistanceFromExit)) return false;
  if (violatesAnchorDistance(cells, safetyConfig.entranceAnchors, safetyConfig.minDistanceFromExit)) return false;

  return true;
}

function isWithinDistanceSquared(ax, ay, bx, by, distance) {
  const dx = ax - bx;
  const dy = ay - by;
  return (dx * dx) + (dy * dy) <= distance * distance;
}

function nearestDistanceToPath(x, y, pathTiles, cap = 8) {
  if (!pathTiles?.size) return cap;
  let best = cap;
  for (let oy = -cap; oy <= cap; oy += 1) {
    for (let ox = -cap; ox <= cap; ox += 1) {
      if (!pathTiles.has(tileKey(x + ox, y + oy))) continue;
      best = Math.min(best, Math.hypot(ox, oy));
    }
  }
  return best;
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

function samplePlacementCenter(tiles, rng, minDistanceFromMapEdge) {
  return {
    x: randomInt(rng, minDistanceFromMapEdge, tiles[0].length - 1 - minDistanceFromMapEdge),
    y: randomInt(rng, minDistanceFromMapEdge, tiles.length - 1 - minDistanceFromMapEdge),
  };
}

function stampObjectTiles(tiles, object) {
  const objectTiles = Array.isArray(object.tiles) && object.tiles.length > 0 ? object.tiles : object.tileVariants ?? [];
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
  const minSource = definition.clusterMin ?? definition.minClusterSize;
  if (!Number.isFinite(minSource)) return null;
  const min = Math.max(1, Math.floor(minSource));
  const maxSource = definition.clusterMax ?? definition.maxClusterSize;
  const max = Math.max(min, Number.isFinite(maxSource) ? Math.floor(maxSource) : min);
  return { min, max };
}

function createObjectDensityField({ tiles, pathTiles }) {
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
      const pathDistance = nearestDistanceToPath(x, y, pathTiles, 8);
      const pathFactor = Math.min(1, pathDistance / 6);
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
};

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

function violatesAnchorDistance(tilesToCheck, anchors = [], minDistance = 0) {
  if (minDistance <= 0 || !Array.isArray(anchors)) return false;
  for (const tile of tilesToCheck) {
    for (const anchor of anchors) {
      if (isWithinDistanceSquared(tile.x, tile.y, anchor.x, anchor.y, minDistance)) return true;
    }
  }
  return false;
}

function validatePlacement({ tiles, center, definition, footprint = definition.footprint, occupiedTiles, blockedMask, safetyConfig, densityField }) {
  return isFootprintValid({
    tiles,
    footprint,
    center,
    occupiedTiles,
    blockedMask,
    safetyConfig,
    densityField,
  });
}

function reservePlacement({ occupiedTiles, blockedMask, cells, padding = 0 }) {
  for (const cell of cells) {
    occupiedTiles.add(tileKey(cell.x, cell.y));
    blockedMask.add(tileKey(cell.x, cell.y));
    for (let oy = -padding; oy <= padding; oy += 1) {
      for (let ox = -padding; ox <= padding; ox += 1) {
        blockedMask.add(tileKey(cell.x + ox, cell.y + oy));
      }
    }
  }
}

function zoneWeightForDefinition(zone, definition, categoryRule) {
  const preferred = Array.isArray(definition.preferredZones) && definition.preferredZones.length > 0
    ? definition.preferredZones
    : categoryRule.preferredZones;
  const idx = preferred.indexOf(zone);
  if (idx < 0) return 0.25;
  return Math.max(0.4, 1.2 - (idx * 0.2));
}

function weightedCenterScore({ tiles, center, definition, densityField, pathTiles, categoryRule }) {
  const zone = classifyZone({
    tiles,
    x: center.x,
    y: center.y,
    densityValue: densityField[center.y]?.[center.x] ?? 0.2,
    pathDistance: nearestDistanceToPath(center.x, center.y, pathTiles, 8),
  });
  const zoneWeight = zoneWeightForDefinition(zone, definition, categoryRule);
  const density = densityField[center.y]?.[center.x] ?? 0;
  const variation = tileVariationScore(tiles, center.x, center.y);
  return (density * 3) + (zoneWeight * 2) + variation;
}

function spawnPlacedObject(params) {
  const {
    tiles, rng, occupiedTiles, blockedMask, roomId, idPrefix, definition, center,
    idIndex, safetyConfig, densityField, categoryRule,
  } = params;

  const previewRotation = definition.rotations ? Math.floor(rng() * 4) : 0;
  const previewFootprint = rotateFootprintCells(definition.footprint, previewRotation);
  if (!validatePlacement({
    tiles,
    center,
    definition,
    footprint: previewFootprint,
    occupiedTiles,
    blockedMask,
    safetyConfig,
    densityField,
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
  reservePlacement({ occupiedTiles, blockedMask, cells, padding: categoryRule.basePadding });
  stampObjectTiles(tiles, placed);
  return placed;
}

function placeCluster(definition, center, options) {
  const limits = sanitizeClusterSize(definition);
  if (!limits) return [];

  const {
    tiles, rng, occupiedTiles, blockedMask, roomId, idPrefix,
    startIndex, safetyConfig, densityField, categoryRule,
  } = options;

  const clusterRadius = Math.max(1, Math.floor((definition.clusterRadius ?? 4) * (safetyConfig.clusterRadiusMultiplier ?? 1)));
  const clusterSize = randomInt(rng, limits.min, limits.max);
  const placedObjects = [];

  const seedObject = spawnPlacedObject({
    tiles, rng, occupiedTiles, blockedMask, roomId, idPrefix, definition, center,
    idIndex: startIndex, safetyConfig, densityField, categoryRule,
  });
  if (!seedObject) return [];
  placedObjects.push(seedObject);

  const maxAttempts = Math.max(clusterSize * 16, 24);
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
      tiles, rng, occupiedTiles, blockedMask, roomId, idPrefix, definition, center: candidate,
      idIndex: startIndex + placedObjects.length, safetyConfig, densityField, categoryRule,
    });

    if (placed) placedObjects.push(placed);
  }

  const majorityRequired = Math.max(1, Math.ceil(clusterSize * 0.6));
  return placedObjects.length >= majorityRequired ? placedObjects : [placedObjects[0]];
}

function selectBestCenter({ tiles, rng, occupiedTiles, blockedMask, definition, safetyConfig, densityField, categoryRule, attempts }) {
  let bestCenter = null;
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const center = samplePlacementCenter(tiles, rng, safetyConfig.minDistanceFromMapEdge ?? 2);
    if (!validatePlacement({ tiles, center, definition, occupiedTiles, blockedMask, safetyConfig, densityField })) continue;

    const score = weightedCenterScore({
      tiles,
      center,
      definition,
      densityField,
      pathTiles: safetyConfig.pathTiles,
      categoryRule,
    });

    if (score > bestScore) {
      bestScore = score;
      bestCenter = center;
    }
  }

  return bestCenter;
}

function placeFromPool(params) {
  const {
    tiles,
    rng,
    occupiedTiles,
    blockedMask,
    roomId,
    biomeType,
    category,
    targetMin,
    targetMax,
    idPrefix,
    allowClusters = true,
    safetyConfig = {},
    densityField,
    debugInfo,
  } = params;

  const categoryRule = OBJECT_RULES[category] ?? OBJECT_RULES[OBJECT_CATEGORY.ENVIRONMENT];
  const pools = buildBiomePool(biomeType, category);
  if (pools.length === 0) return [];

  const targetCount = Math.max(0, Math.floor(randomInt(rng, targetMin, targetMax) * (safetyConfig.objectDensity ?? 1)));
  const objects = [];

  for (let i = 0; i < targetCount; i += 1) {
    const definition = weightedChoice(rng, pools);
    if (!definition) continue;

    const center = selectBestCenter({
      tiles,
      rng,
      occupiedTiles,
      blockedMask,
      definition,
      safetyConfig,
      densityField,
      categoryRule,
      attempts: safetyConfig.maxAttemptsPerObjectType ?? 100,
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
        blockedMask,
        roomId,
        idPrefix,
        startIndex: objects.length,
        safetyConfig: { ...safetyConfig, clusterRadiusMultiplier: safetyConfig.clusterRadiusMultiplier * (safetyConfig.clusterDensity ?? 1) },
        densityField,
        categoryRule,
      });
      objects.push(...cluster);
      if (cluster.length > 0) debugInfo.clusterCenters.push(center);
      continue;
    }

    const placed = spawnPlacedObject({
      tiles,
      rng,
      occupiedTiles,
      blockedMask,
      roomId,
      idPrefix,
      definition,
      center,
      idIndex: objects.length,
      safetyConfig,
      densityField,
      categoryRule,
    });

    if (placed) objects.push(placed);
  }

  return objects;
}

export class ObjectPlacementSystem {
  constructor() {
    this.lastDebugInfo = {
      clusterCenters: [],
      blockedPlacementTiles: [],
      pathSafetyTiles: [],
      exitSafetyTiles: [],
      occupiedFootprintTiles: [],
    };
  }

  placeObjects({ tiles, rng, blockedMask, roomId, biomeType = 'forest', safetyConfig = {}, occupiedTiles = null }) {
    const localOccupied = occupiedTiles ?? new Set();
    const densityField = createObjectDensityField({ tiles, pathTiles: safetyConfig.pathTiles });
    const debugInfo = {
      clusterCenters: [],
      blockedPlacementTiles: Array.from(blockedMask).map((key) => {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
      }),
      pathSafetyTiles: [],
      exitSafetyTiles: [],
      occupiedFootprintTiles: [],
    };

    const categories = [OBJECT_CATEGORY.ENVIRONMENT, OBJECT_CATEGORY.DESTRUCTIBLE, OBJECT_CATEGORY.INTERACTABLE];
    const objects = [];

    for (const category of categories) {
      const placed = placeFromPool({
        tiles,
        rng,
        occupiedTiles: localOccupied,
        blockedMask,
        roomId,
        biomeType,
        category,
        targetMin: 8,
        targetMax: 16,
        idPrefix: 'object',
        allowClusters: true,
        safetyConfig,
        densityField,
        debugInfo,
      });
      objects.push(...placed);
    }

    debugInfo.occupiedFootprintTiles = Array.from(localOccupied).map((key) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    });
    this.lastDebugInfo = debugInfo;
    return objects;
  }

  placeLandmarks({ tiles, rng, blockedMask, roomId, biomeType = 'forest', safetyConfig = {}, occupiedTiles = null }) {
    const localOccupied = occupiedTiles ?? new Set();
    const densityField = createObjectDensityField({ tiles, pathTiles: safetyConfig.pathTiles });
    return placeFromPool({
      tiles,
      rng,
      occupiedTiles: localOccupied,
      blockedMask,
      roomId,
      biomeType,
      category: OBJECT_CATEGORY.LANDMARK,
      targetMin: 1,
      targetMax: 2,
      idPrefix: 'landmark',
      allowClusters: false,
      safetyConfig,
      densityField,
      debugInfo: this.lastDebugInfo,
    });
  }

  getDebugInfo() {
    return structuredClone(this.lastDebugInfo);
  }
}

export function listObjectDefinitions(category = null) {
  if (category) return buildBiomePool(null, category).map(([definition]) => definition.id);
  return Object.values(objectLibrary).map((def) => def.id);
}

export { buildBiomePool, placeCluster };
