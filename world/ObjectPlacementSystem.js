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

function canPlaceObject(tiles, center, footprint, blockedMask, allowOverlap = false) {
  for (const cell of normalizeFootprintCells(footprint)) {
    const x = center.x + cell.x;
    const y = center.y + cell.y;
    const tile = tiles[y]?.[x];
    if (!tile?.walkable) return false;
    if (tile.type === 'road') return false;
    if (!allowOverlap && blockedMask.has(`${x},${y}`)) return false;
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

function placeFromPool({ tiles, rng, blockedMask, roomId, pools, targetMin, targetMax, idPrefix, padding }) {
  const objects = [];
  const targetCount = randomInt(rng, targetMin, targetMax);

  for (let i = 0; i < targetCount; i += 1) {
    const definition = weightedChoice(rng, pools);
    if (!definition) continue;

    let best = null;

    for (let attempt = 0; attempt < 45; attempt += 1) {
      const center = samplePlacementCenter(tiles, rng);
      const candidate = spawnObject(
        definition.id,
        center,
        {
          id: `${roomId}-${idPrefix}-${objects.length}`,
          state: { spawned: true },
        },
        rng,
      );

      if (!candidate) continue;
      if (!canPlaceObject(tiles, center, candidate.footprint, blockedMask, definition.allowOverlap)) continue;

      const score = tileVariationScore(tiles, center.x, center.y) + (rng() * 0.5);
      if (!best || score > best.score) best = { candidate, center, score };
    }

    if (!best) continue;

    objects.push(best.candidate);
    stampObjectTiles(tiles, best.candidate);
    markObject(blockedMask, best.center, best.candidate.footprint, padding);
  }

  return objects;
}

const NON_LANDMARK_POOL = Object.values(objectLibrary)
  .filter((definition) => definition && definition.category !== OBJECT_CATEGORY.LANDMARK)
  .map((definition) => [definition, Math.max(0.01, Number(definition.spawnWeight) || 1)]);

const LANDMARK_POOL = Object.values(objectLibrary)
  .filter((definition) => definition && definition.category === OBJECT_CATEGORY.LANDMARK)
  .map((definition) => [definition, Math.max(0.01, Number(definition.spawnWeight) || 1)]);

export class ObjectPlacementSystem {
  placeObjects({ tiles, rng, blockedMask, roomId }) {
    return placeFromPool({
      tiles,
      rng,
      blockedMask,
      roomId,
      pools: NON_LANDMARK_POOL,
      targetMin: 28,
      targetMax: 44,
      idPrefix: 'object',
      padding: 1,
    });
  }

  placeLandmarks({ tiles, rng, blockedMask, roomId }) {
    return placeFromPool({
      tiles,
      rng,
      blockedMask,
      roomId,
      pools: LANDMARK_POOL,
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
