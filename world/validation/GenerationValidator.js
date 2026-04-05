import { LANDING_SAFE_RADIUS, PATH_CORRIDOR_WIDTH } from '../GenerationConstants.js';
import { isWalkable as isTileWalkable } from '../PathConnectivity.js';

function key(x, y) {
  return `${x},${y}`;
}

function isWalkable(grid, x, y) {
  return isTileWalkable(grid, x, y);
}

function isInsideBounds(grid, x, y) {
  const width = grid?.[0]?.length ?? 0;
  const height = grid?.length ?? 0;
  return x >= 0 && y >= 0 && x < width && y < height;
}

function hasCollisionAt(objects, x, y) {
  for (const object of objects ?? []) {
    if (!object?.collision) continue;
    const footprint = object.footprint ?? object.logicalShape?.tiles ?? [[0, 0]];
    for (const cell of footprint) {
      const dx = Array.isArray(cell) ? cell[0] : cell?.x;
      const dy = Array.isArray(cell) ? cell[1] : cell?.y;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;
      if (Math.round(object.x + dx) === x && Math.round(object.y + dy) === y) return true;
    }
  }
  return false;
}

function bfsFrom(grid, start) {
  const reachable = new Set();
  if (!start || !Number.isFinite(start.x) || !Number.isFinite(start.y)) return reachable;
  if (!isWalkable(grid, start.x, start.y)) return reachable;

  const queue = [{ x: Math.round(start.x), y: Math.round(start.y) }];
  let index = 0;
  while (index < queue.length) {
    const point = queue[index++];
    const pointKey = key(point.x, point.y);
    if (reachable.has(pointKey)) continue;
    if (!isWalkable(grid, point.x, point.y)) continue;
    reachable.add(pointKey);

    queue.push(
      { x: point.x + 1, y: point.y },
      { x: point.x - 1, y: point.y },
      { x: point.x, y: point.y + 1 },
      { x: point.x, y: point.y - 1 },
    );
  }

  return reachable;
}

function corridorWidthAtDepth(grid, anchor, depth) {
  const half = Math.floor((PATH_CORRIDOR_WIDTH - 1) / 2);
  const offsets = [];
  if (anchor.direction === 'north') {
    for (let ox = -half; ox <= half; ox += 1) offsets.push([anchor.x + ox, anchor.y + depth]);
  } else if (anchor.direction === 'south') {
    for (let ox = -half; ox <= half; ox += 1) offsets.push([anchor.x + ox, anchor.y - depth]);
  } else if (anchor.direction === 'west') {
    for (let oy = -half; oy <= half; oy += 1) offsets.push([anchor.x + depth, anchor.y + oy]);
  } else {
    for (let oy = -half; oy <= half; oy += 1) offsets.push([anchor.x - depth, anchor.y + oy]);
  }

  let walkableCount = 0;
  for (const [x, y] of offsets) {
    if (isWalkable(grid, x, y)) walkableCount += 1;
  }
  return walkableCount;
}

function findSpawn(room, context) {
  return context?.plan?.spawnArea?.center
    ?? room?.spawn
    ?? room?.entrances?.['initial-spawn']?.spawn
    ?? null;
}

function buildRequiredAnchors(room, context) {
  if (Array.isArray(context?.requiredAnchors) && context.requiredAnchors.length) return context.requiredAnchors;
  const fromPlan = [
    ...Object.values(context?.plan?.exitAnchors ?? {}),
    ...Object.values(context?.plan?.entranceAnchors ?? {}),
  ];
  if (fromPlan.length) return fromPlan;
  return [
    ...Object.values(room?.exits ?? {}),
    ...Object.values(room?.entrances ?? {}),
  ];
}

export class GenerationValidator {
  static validateRoom(room, context = {}) {
    const issues = [];
    const grid = room?.tiles ?? context?.grid;
    const objects = context?.objects ?? room?.objects ?? [];
    if (!Array.isArray(grid) || !grid.length) {
      return {
        valid: false,
        issues: [{
          severity: 'fatal',
          type: 'ROOM_GRID_INVALID',
          message: 'Room grid is missing or malformed.',
          data: { roomId: room?.id ?? null },
        }],
      };
    }

    const spawn = findSpawn(room, context);
    if (!spawn || !Number.isFinite(spawn.x) || !Number.isFinite(spawn.y)) {
      issues.push({
        severity: 'fatal',
        type: 'SPAWN_MISSING',
        message: 'Spawn point is missing or malformed.',
        data: { roomId: room?.id ?? null },
      });
      return { valid: false, issues };
    }

    // 1. Spawn validity.
    if (!isWalkable(grid, spawn.x, spawn.y)) {
      issues.push({
        severity: 'fatal',
        type: 'SPAWN_INVALID',
        message: 'Spawn tile is not walkable.',
        data: { roomId: room?.id ?? null, spawn },
      });
    }

    let spawnUnsafe = false;
    for (let oy = -LANDING_SAFE_RADIUS; oy <= LANDING_SAFE_RADIUS && !spawnUnsafe; oy += 1) {
      for (let ox = -LANDING_SAFE_RADIUS; ox <= LANDING_SAFE_RADIUS; ox += 1) {
        if (!isWalkable(grid, spawn.x + ox, spawn.y + oy)) {
          spawnUnsafe = true;
          break;
        }
      }
    }
    if (spawnUnsafe) {
      issues.push({
        severity: 'repairable',
        type: 'SPAWN_SAFE_RADIUS_BLOCKED',
        message: 'Spawn safe radius contains blocked tiles.',
        data: { roomId: room?.id ?? null, spawn, radius: LANDING_SAFE_RADIUS },
      });
    }

    // 2. Exit validity.
    const reachable = bfsFrom(grid, spawn);
    const exits = Object.values(context?.plan?.exitAnchors ?? room?.exits ?? {});
    for (const exit of exits) {
      const targetX = exit?.landingX ?? exit?.x;
      const targetY = exit?.landingY ?? exit?.y;
      if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
        issues.push({
          severity: 'fatal',
          type: 'EXIT_COORDINATES_INVALID',
          message: 'Exit is missing valid tile coordinates.',
          data: { roomId: room?.id ?? null, exitId: exit?.id ?? null },
        });
        continue;
      }

      const x = Math.round(targetX);
      const y = Math.round(targetY);
      if (!isInsideBounds(grid, x, y)) {
        issues.push({
          severity: 'fatal',
          type: 'EXIT_OUT_OF_BOUNDS',
          message: 'Exit tile is outside room bounds.',
          data: { roomId: room?.id ?? null, exitId: exit?.id ?? null, x, y },
        });
        continue;
      }
      if (!isWalkable(grid, x, y)) {
        issues.push({
          severity: 'fatal',
          type: 'EXIT_TILE_BLOCKED',
          message: 'Exit entrance tile is not walkable.',
          data: { roomId: room?.id ?? null, exitId: exit?.id ?? null, x, y },
        });
      }
      if (hasCollisionAt(objects, x, y)) {
        issues.push({
          severity: 'fatal',
          type: 'EXIT_COLLIDES_BLOCKER',
          message: 'Exit entrance tile overlaps a blocking object.',
          data: { roomId: room?.id ?? null, exitId: exit?.id ?? null, x, y },
        });
      }
      if (!reachable.has(key(x, y))) {
        issues.push({
          severity: 'repairable',
          type: 'EXIT_UNREACHABLE',
          message: 'Exit is not reachable from spawn.',
          data: { roomId: room?.id ?? null, exitId: exit?.id ?? null, anchorId: exit?.id ?? null, x, y },
        });
      }
    }

    // 4. Corridor width.
    for (const anchor of exits) {
      const corridorDepth = Math.max(2, anchor?.corridorLength ?? 6);
      for (let depth = 0; depth <= corridorDepth; depth += 1) {
        const width = corridorWidthAtDepth(grid, anchor, depth);
        if (width < PATH_CORRIDOR_WIDTH) {
          issues.push({
            severity: 'repairable',
            type: 'CORRIDOR_WIDTH',
            message: 'Corridor width is below minimum requirement.',
            data: { roomId: room?.id ?? null, anchorId: anchor?.id ?? null, width, minimum: PATH_CORRIDOR_WIDTH, depth },
          });
          break;
        }
      }
    }

    // 3. Reachability from spawn to required exits/anchors.
    for (const anchor of buildRequiredAnchors(room, context)) {
      const targetX = anchor?.landingX ?? anchor?.x;
      const targetY = anchor?.landingY ?? anchor?.y;
      if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) continue;
      if (!reachable.has(key(Math.round(targetX), Math.round(targetY)))) {
        issues.push({
          severity: 'repairable',
          type: 'ANCHOR_UNREACHABLE',
          message: 'Required anchor is unreachable from spawn.',
          data: { roomId: room?.id ?? null, anchorId: anchor?.id ?? null, x: targetX, y: targetY },
        });
      }
    }

    return {
      valid: !issues.some((issue) => issue.severity === 'fatal' || issue.severity === 'repairable'),
      issues,
    };
  }
}
