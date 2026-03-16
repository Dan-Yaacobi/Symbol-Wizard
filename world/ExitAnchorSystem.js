function markRect(mask, minX, minY, maxX, maxY, width, height) {
  for (let y = Math.max(0, minY); y <= Math.min(height - 1, maxY); y += 1) {
    for (let x = Math.max(0, minX); x <= Math.min(width - 1, maxX); x += 1) {
      mask.add(`${x},${y}`);
    }
  }
}

function inwardOffset(direction) {
  if (direction === 'north') return { x: 0, y: 1 };
  if (direction === 'south') return { x: 0, y: -1 };
  if (direction === 'west') return { x: 1, y: 0 };
  return { x: -1, y: 0 };
}

function addCorridorBand(mask, x, y, direction, halfWidth, width, height) {
  for (let offset = -halfWidth; offset <= halfWidth; offset += 1) {
    const tx = direction === 'north' || direction === 'south' ? x + offset : x;
    const ty = direction === 'east' || direction === 'west' ? y + offset : y;
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
    mask.add(`${tx},${ty}`);
  }
}

function reserveCorridor(anchor, dimensions) {
  const { width, height } = dimensions;
  const halfWidth = Math.max(1, Math.floor((anchor.corridorWidth ?? 3) / 2));
  const length = Math.max(2, anchor.corridorLength ?? 6);
  const step = inwardOffset(anchor.direction);
  const tiles = new Set();
  for (let depth = 0; depth <= length; depth += 1) {
    const x = anchor.x + (step.x * depth);
    const y = anchor.y + (step.y * depth);
    addCorridorBand(tiles, x, y, anchor.direction, halfWidth, width, height);
  }
  return tiles;
}

export class ExitAnchorSystem {
  reserve(plan) {
    const { width, height } = plan.dimensions;
    const reservations = {
      anchorMask: new Set(),
      corridorMask: new Set(),
      spawnMask: new Set(),
      noDecorMask: new Set(),
      debugEvents: [],
    };

    const spawnRadius = plan.spawnArea.radius + 2;
    markRect(
      reservations.spawnMask,
      plan.spawnArea.center.x - spawnRadius,
      plan.spawnArea.center.y - spawnRadius,
      plan.spawnArea.center.x + spawnRadius,
      plan.spawnArea.center.y + spawnRadius,
      width,
      height,
    );

    const allAnchors = [
      ...Object.values(plan.exitAnchors),
      ...Object.values(plan.entranceAnchors),
    ];

    for (const anchor of allAnchors) {
      const clearance = Math.max(1, anchor.clearanceRadius ?? 2);
      markRect(reservations.anchorMask, anchor.x - clearance, anchor.y - clearance, anchor.x + clearance, anchor.y + clearance, width, height);
      const corridorTiles = reserveCorridor(anchor, plan.dimensions);
      for (const key of corridorTiles) reservations.corridorMask.add(key);
      plan.reservedCorridors[anchor.id] = [...corridorTiles].map((key) => {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
      });

      markRect(reservations.spawnMask, anchor.landingX - 1, anchor.landingY - 1, anchor.landingX + 1, anchor.landingY + 1, width, height);
      reservations.debugEvents.push({ type: 'EXIT_ANCHOR_PLACED', roomId: plan.roomId, anchorId: anchor.id, x: anchor.x, y: anchor.y, direction: anchor.direction });
    }

    reservations.noDecorMask = new Set([...reservations.anchorMask, ...reservations.corridorMask, ...reservations.spawnMask]);
    reservations.debugEvents.push({ type: 'RESERVED_ZONE_CLAIMED', roomId: plan.roomId, tiles: reservations.noDecorMask.size });
    return reservations;
  }
}
