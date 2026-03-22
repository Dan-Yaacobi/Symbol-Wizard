import { tiles, tileFrom } from './TilePalette.js';

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

export function carvePath(grid, start, end, options = {}) {
  const rng = options.rng ?? Math.random;
  const width = Math.max(2, options.width ?? 3);
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
    const kept = [];
    for (const object of removableObjects) {
      if (preserveObject(object)) {
        kept.push(object);
        continue;
      }
      const collides = getCollidableFootprintCells(object).some((cell) => carvedMask.has(keyOf(cell.x, cell.y)));
      if (!collides) kept.push(object);
    }
    removableObjects.length = 0;
    removableObjects.push(...kept);
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

