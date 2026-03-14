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

function isValidFootprint(footprint) {
  if (!Array.isArray(footprint) || footprint.length === 0) return false;

  const keySet = new Set();
  for (const cell of footprint) {
    if (!cell || !Number.isInteger(cell.x) || !Number.isInteger(cell.y)) return false;
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
    const neighbors = [`${cx + 1},${cy}`, `${cx - 1},${cy}`, `${cx},${cy + 1}`, `${cx},${cy - 1}`];

    for (const neighbor of neighbors) {
      if (!keySet.has(neighbor) || visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return visited.size === keySet.size;
}

function buildCategoryPool(category) {
  const entries = [];

  for (const definition of Object.values(objectLibrary)) {
    if (definition.category !== category) continue;
    if (!isValidFootprint(definition.footprint)) continue;
    entries.push(definition);
  }

  return entries;
}

function canPlaceObject(tiles, center, footprint, blockedMask) {
  for (const cell of footprint) {
    const x = center.x + cell.x;
    const y = center.y + cell.y;
    const tile = tiles[y]?.[x];
    if (!tile?.walkable) return false;
    if (tile.type === 'road') return false;
    if (blockedMask.has(`${x},${y}`)) return false;
  }
  return true;
}

function tileVariationScore(tiles, x, y) {
  const centerType = tiles[y]?.[x]?.type;
  if (!centerType) return 0;
  let differences = 0;
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
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
  for (const cell of footprint) {
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
  const variants = object.tileVariants ?? [];
  if (variants.length === 0) return;

  for (const [dx, dy] of object.footprint ?? [[0, 0]]) {
    const x = Math.round(object.x + dx);
    const y = Math.round(object.y + dy);
    if (!tiles[y]?.[x]) continue;

    const variant = object.variant ?? variants[Math.abs((dx * 17) + (dy * 11)) % variants.length];
    tiles[y][x] = {
      ...tiles[y][x],
      ...variant,
      type: `object-${object.type}`,
      walkable: object.collision ? false : tiles[y][x].walkable,
    };
  }
}

export class ObjectPlacementSystem {
  placeObjects({ tiles, rng, roadMask, blockedMask, roomId, biomeConfig = null }) {
    const roadPoints = collectRoadPoints(roadMask);
    const templates = buildPlacementTemplates();
    const density = Math.max(0, Math.min(1, biomeConfig?.objectDensity ?? 0.75));
    const minCount = Math.max(4, Math.floor(10 + (26 * density)));
    const maxCount = Math.max(minCount, Math.floor(14 + (34 * density)));
    const count = randomInt(rng, minCount, maxCount);
    const objects = [];

    for (let i = 0; i < count; i += 1) {
      const template = templates[randomInt(rng, 0, templates.length - 1)];
      if (!template) continue;

      for (let attempt = 0; attempt < 38; attempt += 1) {
        const road = roadPoints[randomInt(rng, 0, Math.max(0, roadPoints.length - 1))] ?? { x: Math.floor(tiles[0].length / 2), y: Math.floor(tiles.length / 2) };
        const angle = rng() * Math.PI * 2;
        const distance = randomInt(rng, 6, 18);
        const center = {
          x: Math.round(road.x + Math.cos(angle) * distance),
          y: Math.round(road.y + Math.sin(angle) * distance),
        };

        if (!canPlaceObject(tiles, center, template.footprint, blockedMask)) continue;

        const placed = spawnObject(template.type, center, {
          id: `${roomId}-object-${objects.length}`,
          footprint: structuredClone(template.footprint),
          state: { spawned: true },
        });

        if (!placed) break;

        objects.push(placed);
        stampObjectTiles(tiles, placed, rng);
        markObject(blockedMask, center, placed.footprint, placed.collision ? 1 : 0);
        break;
function placeFromPool({ tiles, rng, blockedMask, roomId, pools, targetMin, targetMax, idPrefix, padding }) {
  const objects = [];
  const targetCount = randomInt(rng, targetMin, targetMax);

  for (let i = 0; i < targetCount; i += 1) {
    const definition = weightedChoice(rng, pools);
    if (!definition) continue;

    let bestCenter = null;
    let bestScore = -1;

    for (let attempt = 0; attempt < 45; attempt += 1) {
      const center = samplePlacementCenter(tiles, rng);
      if (!canPlaceObject(tiles, center, definition.footprint, blockedMask)) continue;

      const score = tileVariationScore(tiles, center.x, center.y);
      if (score > bestScore) {
        bestScore = score;
        bestCenter = center;
      }
    }

    if (!bestCenter) continue;

    const placed = spawnObject(
      definition.id,
      bestCenter,
      {
        id: `${roomId}-${idPrefix}-${objects.length}`,
        footprint: structuredClone(definition.footprint),
        state: { spawned: true },
      },
      rng,
    );

    if (!placed) continue;

    objects.push(placed);
    stampObjectTiles(tiles, placed);
    markObject(blockedMask, bestCenter, definition.footprint, padding);
  }

  return objects;
}

const OBJECT_POOL = [
  ['pine_tree_small', 12],
  ['pine_tree_large', 10],
  ['oak_tree', 10],
  ['dead_tree', 4],
  ['fallen_log', 6],
  ['mossy_rock', 6],
  ['rock_cluster', 6],
  ['berry_bush', 8],
  ['thorn_bush', 5],
  ['mushroom_cluster', 8],
  ['tall_grass_patch', 9],
  ['flower_patch_red', 7],
  ['flower_patch_yellow', 7],
  ['barrel', 2],
  ['crate', 2],
  ['vase', 2],
  ['wooden_box', 2],
  ['supply_bag', 2],
  ['campfire', 1],
  ['shrine', 1],
  ['signpost', 1],
  ['well', 1],
].map(([id, weight]) => [objectLibrary[id], weight]);

const LANDMARK_POOL = [
  ['ancient_tree', 4],
  ['ruined_statue', 3],
  ['stone_circle', 3],
  ['abandoned_cart', 3],
].map(([id, weight]) => [objectLibrary[id], weight]);

export class ObjectPlacementSystem {
  placeObjects({ tiles, rng, blockedMask, roomId }) {
    const pool = OBJECT_POOL.filter(([entry]) => entry && entry.category !== OBJECT_CATEGORY.LANDMARK);
    return placeFromPool({
      tiles,
      rng,
      blockedMask,
      roomId,
      pools: pool,
      targetMin: 28,
      targetMax: 44,
      idPrefix: 'object',
      padding: 1,
    });
  }

  placeLandmarks({ tiles, rng, blockedMask, roomId }) {
    const pool = LANDMARK_POOL.filter(([entry]) => entry && entry.category === OBJECT_CATEGORY.LANDMARK);
    return placeFromPool({
      tiles,
      rng,
      blockedMask,
      roomId,
      pools: pool,
      targetMin: 1,
      targetMax: 3,
      idPrefix: 'landmark',
      padding: 2,
    });
  }
}

export function listObjectDefinitions(category = null) {
  const entries = buildCategoryPool(category ?? OBJECT_CATEGORY.ENVIRONMENT)
    .map((def) => def.id);
  if (category) return entries;
  return Object.values(objectLibrary).map((def) => def.id);
}
