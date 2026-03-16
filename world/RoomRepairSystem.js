import { tiles } from './TilePalette.js';

function tileFrom(baseTile, overrides = {}) {
  return { ...baseTile, ...overrides };
}

export class RoomRepairSystem {
  repair({ grid, plan, errors, roadMask }) {
    const debugEvents = [];
    for (const error of errors) {
      if (error.type !== 'TILE_CONSISTENCY' && error.type !== 'PATH_CONSISTENCY') continue;
      const anchor = plan.exitAnchors[error.anchorId];
      if (!anchor) continue;

      for (let oy = -2; oy <= 2; oy += 1) {
        for (let ox = -2; ox <= 2; ox += 1) {
          const x = anchor.x + ox;
          const y = anchor.y + oy;
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
