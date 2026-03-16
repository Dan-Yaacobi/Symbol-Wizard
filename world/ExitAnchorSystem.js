function markRect(mask, minX, minY, maxX, maxY, width, height) {
  for (let y = Math.max(0, minY); y <= Math.min(height - 1, maxY); y += 1) {
    for (let x = Math.max(0, minX); x <= Math.min(width - 1, maxX); x += 1) {
      mask.add(`${x},${y}`);
    }
  }
}

function corridorBounds(anchor, center, halfWidth) {
  return {
    minX: Math.min(anchor.x, center.x) - halfWidth,
    maxX: Math.max(anchor.x, center.x) + halfWidth,
    minY: Math.min(anchor.y, center.y) - halfWidth,
    maxY: Math.max(anchor.y, center.y) + halfWidth,
  };
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
      const halfWidth = Math.max(1, Math.floor((anchor.corridorWidth ?? 3) / 2));
      markRect(reservations.anchorMask, anchor.x - clearance, anchor.y - clearance, anchor.x + clearance, anchor.y + clearance, width, height);
      const bounds = corridorBounds(anchor, plan.spawnArea.center, halfWidth);
      markRect(reservations.corridorMask, bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, width, height);
      reservations.debugEvents.push({ type: 'EXIT_ANCHOR_PLACED', roomId: plan.roomId, anchorId: anchor.id, x: anchor.x, y: anchor.y, direction: anchor.direction });
    }

    reservations.noDecorMask = new Set([...reservations.anchorMask, ...reservations.corridorMask, ...reservations.spawnMask]);
    reservations.debugEvents.push({ type: 'RESERVED_ZONE_CLAIMED', roomId: plan.roomId, tiles: reservations.noDecorMask.size });
    return reservations;
  }
}
