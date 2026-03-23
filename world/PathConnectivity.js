import { tiles, tileFrom } from './TilePalette.js';
import { ENTRANCE_CLEAR_ZONE_RADIUS, MIN_ROAD_WIDTH } from './GenerationConstants.js';

function keyOf(x, y) {
  return `${x},${y}`;
}

function isWithinBounds(grid, x, y) {
  return y >= 0 && y < grid.length && x >= 0 && x < (grid[0]?.length ?? 0);
}

function getCollidableFootprintCells(object) {
  if (!object?.collision) return [];
  const footprint = object.footprint ?? object.logicalShape?.tiles ?? [[0, 0]];
  return footprint.map((cell) => {
    const dx = Array.isArray(cell) ? cell[0] : cell.x;
    const dy = Array.isArray(cell) ? cell[1] : cell.y;
    return {
      x: Math.round(object.x + dx),
      y: Math.round(object.y + dy),
    };
  });
}

export function buildCollidableMask(objects = []) {
  const mask = new Set();
  for (const object of objects) {
    for (const cell of getCollidableFootprintCells(object)) {
      mask.add(keyOf(cell.x, cell.y));
    }
  }
  return mask;
}

export function isWalkable(grid, x, y, objectMask = null) {
  if (!isWithinBounds(grid, x, y)) return false;
  if (!grid[y][x]?.walkable) return false;
  if (objectMask?.has(keyOf(x, y))) return false;
  return true;
}

export function floodFillWalkable(grid, start, objectMask = null) {
  const reachable = new Set();
  if (!isWalkable(grid, start.x, start.y, objectMask)) return reachable;

  const queue = [{ x: start.x, y: start.y }];
  reachable.add(keyOf(start.x, start.y));
  let index = 0;

  while (index < queue.length) {
    const current = queue[index++];
    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];

    for (const neighbor of neighbors) {
      const key = keyOf(neighbor.x, neighbor.y);
      if (reachable.has(key) || !isWalkable(grid, neighbor.x, neighbor.y, objectMask)) continue;
      reachable.add(key);
      queue.push(neighbor);
    }
  }

  return reachable;
}

function paintPathTile(grid, x, y, width, carvedMask) {
  const radius = Math.max(1, Math.floor(width / 2));
  for (let oy = -radius; oy <= radius; oy += 1) {
    for (let ox = -radius; ox <= radius; ox += 1) {
      const tx = x + ox;
      const ty = y + oy;
      if (!isWithinBounds(grid, tx, ty)) continue;
      const distance = Math.max(Math.abs(ox), Math.abs(oy));
      const edge = distance >= radius;
      const baseTile = edge ? tiles.dirtEdge : ((Math.abs(ox) + Math.abs(oy)) % 3 === 0 ? tiles.pathPebble : tiles.dirt);
      grid[ty][tx] = tileFrom(baseTile, { type: 'road', walkable: true });
      carvedMask.add(keyOf(tx, ty));
    }
  }
}

function chooseAxisStep(current, end, jitterBias, rng) {
  const dx = end.x - current.x;
  const dy = end.y - current.y;
  if (dx === 0 && dy === 0) return { x: 0, y: 0 };

  const favorHorizontal = Math.abs(dx) > Math.abs(dy)
    ? true
    : Math.abs(dy) > Math.abs(dx)
      ? false
      : rng() < 0.5;

  if (rng() < jitterBias) {
    if (favorHorizontal && dy !== 0) return { x: 0, y: Math.sign(dy) };
    if (!favorHorizontal && dx !== 0) return { x: Math.sign(dx), y: 0 };
  }

  if (favorHorizontal && dx !== 0) return { x: Math.sign(dx), y: 0 };
  if (dy !== 0) return { x: 0, y: Math.sign(dy) };
  return { x: Math.sign(dx), y: 0 };
}

function clearWalkableArea(grid, center, radius, carvedMask = null) {
  for (let oy = -radius; oy <= radius; oy += 1) {
    for (let ox = -radius; ox <= radius; ox += 1) {
      const tx = center.x + ox;
      const ty = center.y + oy;
      if (!isWithinBounds(grid, tx, ty)) continue;
      if ((ox * ox) + (oy * oy) > radius * radius) continue;
      const edge = Math.abs(ox) === radius || Math.abs(oy) === radius;
      grid[ty][tx] = tileFrom(edge ? tiles.dirtEdge : tiles.dirt, { type: 'road', walkable: true });
      carvedMask?.add(keyOf(tx, ty));
    }
  }
}

function removeBlockedObjectsInMask(objects = [], carvedMask = new Set(), preserveObject = () => false) {
  if (!Array.isArray(objects) || objects.length === 0) return objects;
  const kept = [];
  for (const object of objects) {
    if (preserveObject(object)) {
      kept.push(object);
      continue;
    }
    const collides = getCollidableFootprintCells(object).some((cell) => carvedMask.has(keyOf(cell.x, cell.y)));
    if (!collides) kept.push(object);
  }
  objects.length = 0;
  objects.push(...kept);
  return objects;
}

export function carveBoundaryCrossing(grid, center, direction, options = {}) {
  const width = Math.max(MIN_ROAD_WIDTH, options.width ?? MIN_ROAD_WIDTH);
  const carvedMask = options.carvedMask ?? new Set();
  const removableObjects = options.removableObjects ?? null;
  const preserveObject = options.preserveObject ?? (() => false);
  const axisHalfSpan = Math.ceil((width + 2) / 2);
  const laneHalfSpan = Math.ceil(width / 2);
  const horizontal = direction === 'north' || direction === 'south';

  for (let forward = -1; forward <= 2; forward += 1) {
    for (let lateral = -axisHalfSpan; lateral <= axisHalfSpan; lateral += 1) {
      const tx = center.x + (horizontal ? lateral : forward);
      const ty = center.y + (horizontal ? forward : lateral);
      if (!isWithinBounds(grid, tx, ty)) continue;
      const onEdge = Math.abs(lateral) >= laneHalfSpan || Math.abs(forward) >= 2;
      grid[ty][tx] = tileFrom(onEdge ? tiles.dirtEdge : tiles.dirt, { type: 'road', walkable: true });
      carvedMask.add(keyOf(tx, ty));
    }
  }

  if (Array.isArray(removableObjects)) removeBlockedObjectsInMask(removableObjects, carvedMask, preserveObject);
  return carvedMask;
}

export function carveEntranceSafetyZone(grid, landing, options = {}) {
  const radius = Math.max(ENTRANCE_CLEAR_ZONE_RADIUS, options.radius ?? ENTRANCE_CLEAR_ZONE_RADIUS);
  const carvedMask = options.carvedMask ?? new Set();
  clearWalkableArea(grid, landing, radius, carvedMask);
  if (Array.isArray(options.removableObjects)) removeBlockedObjectsInMask(options.removableObjects, carvedMask, options.preserveObject ?? (() => false));
  return carvedMask;
}

export function carvePath(grid, start, end, options = {}) {
  const rng = options.rng ?? Math.random;
  const width = Math.max(MIN_ROAD_WIDTH, options.width ?? MIN_ROAD_WIDTH);
  const jitterBias = options.jitterBias ?? 0.28;
  const carvedMask = options.carvedMask ?? new Set();
  const removableObjects = options.removableObjects ?? null;
  const preserveObject = options.preserveObject ?? (() => false);

  const maxSteps = Math.max(grid.length + (grid[0]?.length ?? 0), Math.abs(end.x - start.x) + Math.abs(end.y - start.y) + 24);
  let current = { x: Math.round(start.x), y: Math.round(start.y) };
  const visited = new Set([keyOf(current.x, current.y)]);

  for (let stepIndex = 0; stepIndex <= maxSteps; stepIndex += 1) {
    paintPathTile(grid, current.x, current.y, width + (rng() < 0.15 ? 1 : 0), carvedMask);
    if (current.x === end.x && current.y === end.y) break;

    const step = chooseAxisStep(current, end, jitterBias, rng);
    const next = {
      x: Math.max(0, Math.min((grid[0]?.length ?? 1) - 1, current.x + step.x)),
      y: Math.max(0, Math.min(grid.length - 1, current.y + step.y)),
    };

    if (visited.has(keyOf(next.x, next.y)) && (next.x !== end.x || next.y !== end.y)) {
      if (current.x !== end.x) next.x = current.x + Math.sign(end.x - current.x);
      else if (current.y !== end.y) next.y = current.y + Math.sign(end.y - current.y);
    }

    current = next;
    visited.add(keyOf(current.x, current.y));
  }

  if (Array.isArray(removableObjects) && removableObjects.length > 0) {
    removeBlockedObjectsInMask(removableObjects, carvedMask, preserveObject);
  }

  return carvedMask;
}

export function nearestReachablePoint(reachable, point) {
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const key of reachable) {
    const [x, y] = key.split(',').map(Number);
    const distance = Math.abs(point.x - x) + Math.abs(point.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { x, y };
    }
  }
  return best;
}

