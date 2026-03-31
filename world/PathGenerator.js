import { tiles } from './TilePalette.js';
import { LANDING_SAFE_RADIUS } from './GenerationConstants.js';
import { normalizePathGenerationConfig } from './PathGenerationConfig.js';

function tileFrom(baseTile, overrides = {}) {
  return { ...baseTile, ...overrides };
}

function keyOf(x, y) {
  return `${x},${y}`;
}

function directionDelta(direction) {
  if (direction === 'north') return { x: 0, y: -1 };
  if (direction === 'south') return { x: 0, y: 1 };
  if (direction === 'west') return { x: -1, y: 0 };
  return { x: 1, y: 0 };
}

function perpendicularOptions(direction) {
  if (direction === 'north' || direction === 'south') return [{ x: -1, y: 0 }, { x: 1, y: 0 }];
  return [{ x: 0, y: -1 }, { x: 0, y: 1 }];
}

function detectDirection(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'east' : 'west';
  return dy >= 0 ? 'south' : 'north';
}

function chooseStepToward(current, target) {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return { x: Math.sign(dx), y: 0 };
  if (dy !== 0) return { x: 0, y: Math.sign(dy) };
  return { x: 0, y: 0 };
}

function carveTrailTile(grid, x, y, radius, mask) {
  for (let oy = -radius; oy <= radius; oy += 1) {
    for (let ox = -radius; ox <= radius; ox += 1) {
      const tx = x + ox;
      const ty = y + oy;
      if (!grid[ty]?.[tx]) continue;
      grid[ty][tx] = tileFrom(tiles.pathPebble, { type: 'road', walkable: true });
      mask.add(keyOf(tx, ty));
    }
  }
}

function expandLanding(grid, anchor, mask) {
  carveTrailTile(grid, anchor.landingX, anchor.landingY, LANDING_SAFE_RADIUS, mask);
}

function clearExitArea(grid, anchor, radius, mask) {
  carveTrailTile(grid, anchor.x, anchor.y, radius, mask);
}

function floodRoadMask(mask, start) {
  const reachable = new Set();
  const startKey = keyOf(start.x, start.y);
  if (!mask.has(startKey)) return reachable;
  const queue = [{ x: start.x, y: start.y }];
  let index = 0;
  while (index < queue.length) {
    const current = queue[index++];
    const currentKey = keyOf(current.x, current.y);
    if (reachable.has(currentKey) || !mask.has(currentKey)) continue;
    reachable.add(currentKey);
    queue.push(
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    );
  }
  return reachable;
}

function makeTrailPoints(start, target, anchorDirection, config, rng, dimensions) {
  const points = [{ x: start.x, y: start.y }];
  let current = { x: start.x, y: start.y };
  const maxSteps = Math.max(12, (dimensions.width + dimensions.height) * 3);
  let steps = 0;

  while ((current.x !== target.x || current.y !== target.y) && steps < maxSteps) {
    steps += 1;
    const toward = chooseStepToward(current, target);
    let next = { x: current.x + toward.x, y: current.y + toward.y };

    if (rng() < config.wanderChance) {
      const mainDirection = toward.x === 0 && toward.y === 0 ? anchorDirection : detectDirection(current, next);
      const options = perpendicularOptions(mainDirection);
      const side = options[rng() < 0.5 ? 0 : 1];
      const shifted = { x: next.x + side.x, y: next.y + side.y };
      if (shifted.x > 1 && shifted.y > 1 && shifted.x < dimensions.width - 2 && shifted.y < dimensions.height - 2) {
        next = shifted;
      }
    }

    next.x = Math.max(1, Math.min(dimensions.width - 2, next.x));
    next.y = Math.max(1, Math.min(dimensions.height - 2, next.y));

    if (next.x === current.x && next.y === current.y) {
      const fallback = directionDelta(anchorDirection);
      next = {
        x: Math.max(1, Math.min(dimensions.width - 2, current.x + fallback.x)),
        y: Math.max(1, Math.min(dimensions.height - 2, current.y + fallback.y)),
      };
      if (next.x === current.x && next.y === current.y) break;
    }

    points.push(next);
    current = next;
  }

  if (points.at(-1).x !== target.x || points.at(-1).y !== target.y) {
    points.push({ x: target.x, y: target.y });
  }

  return points;
}

function carveTrailPoints(grid, points, anchor, config, mask, rng) {
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    const prev = points[i - 1] ?? point;
    const next = points[i + 1] ?? point;
    const isTurn = (prev.x !== point.x || prev.y !== point.y)
      && (next.x !== point.x || next.y !== point.y)
      && ((prev.x - point.x) !== (point.x - next.x) || (prev.y - point.y) !== (point.y - next.y));
    const nearExit = i >= Math.max(0, points.length - 4);

    let radius = config.baseTrailRadius;
    if (isTurn) radius = Math.max(radius, config.turnTrailRadius);
    if (nearExit) radius = Math.max(radius, config.exitTrailRadius);

    if (rng() < 0.14) {
      radius += 1;
    }

    carveTrailTile(grid, point.x, point.y, radius, mask);
  }

  expandLanding(grid, anchor, mask);
  clearExitArea(grid, anchor, config.exitClearingRadius, mask);
}

export class PathGenerator {
  carveRequiredPaths({ grid, plan, reservations, rng = Math.random, pathConfig = {} }) {
    const config = normalizePathGenerationConfig(pathConfig);
    const roadMask = new Set();
    const debugEvents = [];
    const hub = plan.entryFocusArea.center;

    carveTrailTile(grid, hub.x, hub.y, config.turnTrailRadius, roadMask);

    const allAnchors = [...Object.values(plan.exitAnchors), ...Object.values(plan.entranceAnchors)];
    for (const anchor of allAnchors) {
      const trailPoints = makeTrailPoints(hub, { x: anchor.x, y: anchor.y }, anchor.direction, config, rng, plan.dimensions);
      carveTrailPoints(grid, trailPoints, anchor, config, roadMask, rng);
      debugEvents.push({ type: 'PATH_CARVED_TO_ANCHOR', roomId: plan.roomId, anchorId: anchor.id, points: trailPoints.length });
    }

    for (const corridor of Object.values(plan.reservedCorridors)) {
      for (const tile of corridor) {
        carveTrailTile(grid, tile.x, tile.y, 1, roadMask);
      }
    }

    for (const key of reservations.anchorMask) {
      const [x, y] = key.split(',').map(Number);
      if (!grid[y]?.[x]) continue;
      grid[y][x] = tileFrom(tiles.dirt, { type: 'exit-anchor', walkable: true });
      roadMask.add(key);
    }

    const reachableFromHub = floodRoadMask(roadMask, hub);
    for (const anchor of allAnchors) {
      const landingKey = keyOf(anchor.landingX, anchor.landingY);
      if (reachableFromHub.has(landingKey)) continue;
      const repairPoints = makeTrailPoints(
        { x: anchor.landingX, y: anchor.landingY },
        hub,
        anchor.direction,
        config,
        rng,
        plan.dimensions,
      );
      carveTrailPoints(grid, repairPoints, anchor, config, roadMask, rng);
      debugEvents.push({
        type: 'PATH_CONNECTIVITY_REPAIRED',
        roomId: plan.roomId,
        anchorId: anchor.id,
        repairedPoints: repairPoints.length,
      });
    }

    return { roadMask, debugEvents };
  }
}
