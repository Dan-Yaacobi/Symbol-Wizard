import { tiles } from './TilePalette.js';
import { LANDING_SAFE_RADIUS, PATH_CORRIDOR_WIDTH } from './GenerationConstants.js';

function tileFrom(baseTile, overrides = {}) {
  return { ...baseTile, ...overrides };
}

export class RoomRepairSystem {
  repair({ grid, plan, errors, roadMask, validationResult }) {
    const repairableIssues = Array.isArray(validationResult?.issues)
      ? validationResult.issues.filter((issue) => issue?.severity === 'repairable')
      : [];
    if (!repairableIssues.length) return { applied: false, debugEvents: [] };

    const normalizedErrors = repairableIssues.length
      ? repairableIssues.map((issue) => ({ type: issue.type, ...(issue.details ?? {}) }))
      : (errors ?? []);
    const debugEvents = [];
    for (const error of normalizedErrors) {
      if (![ 'TILE_CONSISTENCY', 'PATH_CONSISTENCY', 'CORRIDOR_WIDTH', 'CORRIDOR_BLOCKED', 'LANDING_INVALID', 'LANDING_REACHABILITY', 'SPAWN_COLLISION', 'SPAWN_SAFE_RADIUS_BLOCKED', 'EXIT_UNREACHABLE', 'ANCHOR_UNREACHABLE' ].includes(error.type)) continue;
      const anchor = plan.exitAnchors[error.anchorId] ?? plan.entranceAnchors[error.anchorId];
      if (!anchor) continue;

      for (const tile of plan.reservedCorridors[anchor.id] ?? []) {
        if (!grid[tile.y]?.[tile.x]) continue;
        grid[tile.y][tile.x] = tileFrom(tiles.pathPebble, { type: 'road', walkable: true });
        roadMask.add(`${tile.x},${tile.y}`);
      }

      const half = Math.floor((Math.max(PATH_CORRIDOR_WIDTH, anchor.corridorWidth ?? PATH_CORRIDOR_WIDTH) - 1) / 2);
      for (let oy = -half; oy <= half; oy += 1) {
        for (let ox = -half; ox <= half; ox += 1) {
          const x = anchor.x + ox;
          const y = anchor.y + oy;
          if (!grid[y]?.[x]) continue;
          grid[y][x] = tileFrom(tiles.pathPebble, { type: 'road', walkable: true });
          roadMask.add(`${x},${y}`);
        }
      }

      for (let oy = -LANDING_SAFE_RADIUS; oy <= LANDING_SAFE_RADIUS; oy += 1) {
        for (let ox = -LANDING_SAFE_RADIUS; ox <= LANDING_SAFE_RADIUS; ox += 1) {
          const x = anchor.landingX + ox;
          const y = anchor.landingY + oy;
          if (!grid[y]?.[x]) continue;
          grid[y][x] = tileFrom(tiles.pathPebble, { type: 'road', walkable: true });
          roadMask.add(`${x},${y}`);
        }
      }
      debugEvents.push({ type: 'LOCAL_REPAIR_APPLIED', roomId: plan.roomId, anchorId: anchor.id, reason: error.type });
    }

    return { applied: debugEvents.length > 0, debugEvents };
  }
}
