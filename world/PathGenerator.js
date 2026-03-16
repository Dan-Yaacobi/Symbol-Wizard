import { tiles } from './TilePalette.js';

function tileFrom(baseTile, overrides = {}) {
  return { ...baseTile, ...overrides };
}

function carveBrush(grid, x, y, width, mask) {
  const half = Math.floor(width / 2);
  for (let oy = -half; oy <= half; oy += 1) {
    for (let ox = -half; ox <= half; ox += 1) {
      const tx = x + ox;
      const ty = y + oy;
      if (!grid[ty]?.[tx]) continue;
      grid[ty][tx] = tileFrom(tiles.pathPebble, { type: 'road', walkable: true });
      mask.add(`${tx},${ty}`);
    }
  }
}

function carveLine(grid, start, end, width, mask) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const steps = Math.max(1, Math.max(Math.abs(dx), Math.abs(dy)));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = Math.round(start.x + (dx * t));
    const y = Math.round(start.y + (dy * t));
    carveBrush(grid, x, y, width, mask);
  }
}

export class PathGenerator {
  carveRequiredPaths({ grid, plan, reservations }) {
    const roadMask = new Set();
    const debugEvents = [];
    const hub = plan.entryFocusArea.center;
    carveBrush(grid, hub.x, hub.y, 3, roadMask);

    const allAnchors = [...Object.values(plan.exitAnchors), ...Object.values(plan.entranceAnchors)];
    for (const anchor of allAnchors) {
      const width = Math.max(3, anchor.corridorWidth ?? 3);
      carveLine(grid, hub, { x: anchor.x, y: anchor.y }, width, roadMask);
      debugEvents.push({ type: 'PATH_CARVED_TO_ANCHOR', roomId: plan.roomId, anchorId: anchor.id });
    }

    for (const key of reservations.anchorMask) {
      const [x, y] = key.split(',').map(Number);
      if (!grid[y]?.[x]) continue;
      grid[y][x] = tileFrom(tiles.dirt, { type: 'exit-anchor', walkable: true });
      roadMask.add(key);
    }

    return { roadMask, debugEvents };
  }
}
