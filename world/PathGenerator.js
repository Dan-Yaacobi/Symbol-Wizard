import { tiles } from './TilePalette.js';
import { LANDING_SAFE_RADIUS, PATH_CORRIDOR_WIDTH } from './GenerationConstants.js';

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

function carveDirectionalBand(grid, x, y, direction, width, mask) {
  const half = Math.floor(width / 2);
  if (direction === 'north' || direction === 'south') {
    for (let ox = -half; ox <= half; ox += 1) carveBrush(grid, x + ox, y, 1, mask);
    return;
  }
  for (let oy = -half; oy <= half; oy += 1) carveBrush(grid, x, y + oy, 1, mask);
}

function carveLine(grid, start, end, width, mask) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const steps = Math.max(1, Math.max(Math.abs(dx), Math.abs(dy)));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = Math.round(start.x + (dx * t));
    const y = Math.round(start.y + (dy * t));
    const px = i === 0 ? start.x : Math.round(start.x + (dx * ((i - 1) / steps)));
    const py = i === 0 ? start.y : Math.round(start.y + (dy * ((i - 1) / steps)));
    const stepDirection = Math.abs(x - px) >= Math.abs(y - py)
      ? (x >= px ? 'east' : 'west')
      : (y >= py ? 'south' : 'north');
    carveDirectionalBand(grid, x, y, stepDirection, width, mask);
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
      const width = Math.max(PATH_CORRIDOR_WIDTH, anchor.corridorWidth ?? PATH_CORRIDOR_WIDTH);
      carveLine(grid, hub, { x: anchor.x, y: anchor.y }, width, roadMask);
      carveBrush(grid, anchor.landingX, anchor.landingY, (LANDING_SAFE_RADIUS * 2) + 1, roadMask);
      debugEvents.push({ type: 'PATH_CARVED_TO_ANCHOR', roomId: plan.roomId, anchorId: anchor.id });
    }

    for (const corridor of Object.values(plan.reservedCorridors)) {
      for (const tile of corridor) {
        carveBrush(grid, tile.x, tile.y, 1, roadMask);
      }
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
