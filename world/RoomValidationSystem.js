function oppositeDirection(direction) {
  if (direction === 'north') return 'south';
  if (direction === 'south') return 'north';
  if (direction === 'east') return 'west';
  return 'east';
}

function walkable(tile) {
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

export class RoomValidationSystem {
  validate({ roomNode, rooms, plan, grid, triggers, roomGraph }) {
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

    for (const anchor of Object.values(plan.exitAnchors)) {
      if (!walkable(grid[anchor.y]?.[anchor.x])) {
        errors.push({ type: 'TILE_CONSISTENCY', roomId: roomNode.id, anchorId: anchor.id, detail: 'Anchor tile blocked' });
      }
    }

    const spawn = plan.spawnArea.center;
    for (const anchor of Object.values(plan.exitAnchors)) {
      const reachable = bfsReachable(grid, spawn, new Set([`${anchor.x},${anchor.y}`]));
      if (!reachable) {
        errors.push({ type: 'PATH_CONSISTENCY', roomId: roomNode.id, anchorId: anchor.id, detail: 'Anchor unreachable from spawn' });
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
