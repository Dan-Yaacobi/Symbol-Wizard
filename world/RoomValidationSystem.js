import { LANDING_SAFE_RADIUS, PATH_CORRIDOR_WIDTH } from './GenerationConstants.js';
import { isWalkable as isTileWalkable } from './PathConnectivity.js';

function oppositeDirection(direction) {
  if (direction === 'north') return 'south';
  if (direction === 'south') return 'north';
  if (direction === 'east') return 'west';
  return 'east';
}

function walkable(tile, grid = null, x = null, y = null) {
  if (grid && Number.isFinite(x) && Number.isFinite(y)) return isTileWalkable(grid, x, y);
  return Boolean(tile?.walkable);
}

function bfsReachable(grid, start, targetSet) {
  const queue = [start];
  const seen = new Set([`${start.x},${start.y}`]);
  const height = grid.length;
  const width = grid[0]?.length ?? 0;

  while (queue.length > 0) {
    const current = queue.shift();
    if (targetSet.has(`${current.x},${current.y}`)) return true;

    const neighbors = [
      [current.x + 1, current.y],
      [current.x - 1, current.y],
      [current.x, current.y + 1],
      [current.x, current.y - 1],
    ];

    for (const [x, y] of neighbors) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      if (!walkable(grid[y][x])) continue;
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }

  return false;
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
    if (walkable(grid[y]?.[x])) walkableCount += 1;
  }
  return walkableCount;
}

function objectCollisionAt(objects, x, y) {
  for (const object of objects ?? []) {
    if (!object?.collision) continue;
    const footprint = object.footprint ?? [[0, 0]];
    for (const [dx, dy] of footprint) {
      if (Math.round(object.x + dx) === x && Math.round(object.y + dy) === y) return true;
    }
  }
  return false;
}

export class RoomValidationSystem {
  validate({ roomNode, rooms, plan, grid, triggers, roomGraph, objects = [] }) {
    const errors = [];

    for (const connection of roomNode.connections ?? []) {
      const sourceMap = roomGraph[roomNode.id] ?? {};
      if (sourceMap[connection.direction] !== connection.targetRoomId) {
        errors.push({ type: 'GRAPH_CONSISTENCY', roomId: roomNode.id, exitId: connection.exitId, detail: 'Missing source direction mapping' });
      }

      const targetNode = rooms.get(connection.targetRoomId);
      if (!targetNode) {
        errors.push({ type: 'ANCHOR_CONSISTENCY', roomId: roomNode.id, exitId: connection.exitId, detail: 'Missing target room' });
        continue;
      }

      const reverse = (targetNode.connections ?? []).find((entry) => entry.targetRoomId === roomNode.id && entry.direction === oppositeDirection(connection.direction));
      if (!reverse) {
        errors.push({ type: 'BIDIRECTIONAL_TRAVEL', roomId: roomNode.id, exitId: connection.exitId, detail: 'Missing reverse connection' });
      }
    }

    const allAnchors = [...Object.values(plan.exitAnchors), ...Object.values(plan.entranceAnchors)];

    for (const anchor of allAnchors) {
      if (!Number.isFinite(anchor.landingX) || !Number.isFinite(anchor.landingY)) {
        errors.push({ type: 'LANDING_INVALID', roomId: roomNode.id, anchorId: anchor.id, detail: 'Landing tile missing' });
        continue;
      }

      if (!walkable(grid[anchor.landingY]?.[anchor.landingX], grid, anchor.landingX, anchor.landingY)) {
        errors.push({ type: 'LANDING_INVALID', roomId: roomNode.id, anchorId: anchor.id, detail: 'Landing tile not walkable' });
      }
      if (objectCollisionAt(objects, anchor.landingX, anchor.landingY)) {
        errors.push({ type: 'SPAWN_COLLISION', roomId: roomNode.id, anchorId: anchor.id, detail: 'Landing collides with object' });
      }

      let landingUnsafe = false;
      for (let oy = -LANDING_SAFE_RADIUS; oy <= LANDING_SAFE_RADIUS && !landingUnsafe; oy += 1) {
        for (let ox = -LANDING_SAFE_RADIUS; ox <= LANDING_SAFE_RADIUS; ox += 1) {
          if (!walkable(grid[anchor.landingY + oy]?.[anchor.landingX + ox], grid, anchor.landingX + ox, anchor.landingY + oy)) {
            landingUnsafe = true;
            break;
          }
        }
      }
      if (landingUnsafe) {
        errors.push({ type: 'LANDING_INVALID', roomId: roomNode.id, anchorId: anchor.id, detail: 'Landing safety area blocked' });
      }
    }

    for (const anchor of Object.values(plan.exitAnchors)) {
      if (!walkable(grid[anchor.y]?.[anchor.x], grid, anchor.x, anchor.y)) {
        errors.push({ type: 'TILE_CONSISTENCY', roomId: roomNode.id, anchorId: anchor.id, detail: 'Anchor tile blocked' });
      }

      const corridorDepth = Math.max(2, anchor.corridorLength ?? 6);
      for (let depth = 0; depth <= corridorDepth; depth += 1) {
        const width = corridorWidthAtDepth(grid, anchor, depth);
        if (width < PATH_CORRIDOR_WIDTH) {
          errors.push({ type: 'CORRIDOR_WIDTH', roomId: roomNode.id, anchorId: anchor.id, detail: 'Exit corridor below minimum width' });
          break;
        }
      }

      for (const tile of plan.reservedCorridors[anchor.id] ?? []) {
        if (!walkable(grid[tile.y]?.[tile.x])) {
          errors.push({ type: 'CORRIDOR_BLOCKED', roomId: roomNode.id, anchorId: anchor.id, detail: 'Reserved corridor tile blocked' });
          break;
        }
      }
    }

    const spawn = plan.spawnArea.center;
    for (const anchor of Object.values(plan.exitAnchors)) {
      const reachable = bfsReachable(grid, spawn, new Set([`${anchor.x},${anchor.y}`]));
      if (!reachable) {
        errors.push({ type: 'PATH_CONSISTENCY', roomId: roomNode.id, anchorId: anchor.id, detail: 'Anchor unreachable from spawn' });
      }
      const landingReachable = bfsReachable(grid, spawn, new Set([`${anchor.landingX},${anchor.landingY}`]));
      if (!landingReachable) {
        errors.push({ type: 'LANDING_REACHABILITY', roomId: roomNode.id, anchorId: anchor.id, detail: 'Landing unreachable from hub' });
      }
    }

    for (const [exitId, exit] of Object.entries(triggers.exits)) {
      if (!plan.exitAnchors[exitId]) {
        errors.push({ type: 'ANCHOR_CONSISTENCY', roomId: roomNode.id, exitId, detail: 'Trigger without anchor' });
      }
      if (!exit?.roadAnchor) {
        errors.push({ type: 'EXIT_TRIGGER', roomId: roomNode.id, exitId, detail: 'Missing road anchor in trigger' });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      debugEvents: errors.length ? [{ type: 'VALIDATION_FAILED', roomId: roomNode.id, errors }] : [],
    };
  }
}
