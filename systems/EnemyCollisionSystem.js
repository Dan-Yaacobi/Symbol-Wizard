function isWalkableTile(map, x, y) {
  return Boolean(map?.[y]?.[x]?.walkable);
}

function getSolidTilePenetration(entity, tileX, tileY, sampleX, sampleY, map) {
  const radius = Math.max(0.01, entity.radius ?? 0.5);
  const minX = tileX - 0.5;
  const maxX = tileX + 0.5;
  const minY = tileY - 0.5;
  const maxY = tileY + 0.5;

  const nearestX = Math.max(minX, Math.min(sampleX, maxX));
  const nearestY = Math.max(minY, Math.min(sampleY, maxY));
  const deltaX = sampleX - nearestX;
  const deltaY = sampleY - nearestY;
  const distanceSq = (deltaX * deltaX) + (deltaY * deltaY);

  if (distanceSq > radius * radius) return null;

  if (distanceSq > 1e-8) {
    const distance = Math.sqrt(distanceSq);
    const overlap = radius - distance;
    return {
      x: (deltaX / distance) * overlap,
      y: (deltaY / distance) * overlap,
      overlap,
    };
  }

  const distancesToFaces = [
    {
      axis: 'x',
      sign: -1,
      distance: Math.abs(sampleX - minX),
      targetWalkable: isWalkableTile(map, tileX - 1, tileY),
    },
    {
      axis: 'x',
      sign: 1,
      distance: Math.abs(maxX - sampleX),
      targetWalkable: isWalkableTile(map, tileX + 1, tileY),
    },
    {
      axis: 'y',
      sign: -1,
      distance: Math.abs(sampleY - minY),
      targetWalkable: isWalkableTile(map, tileX, tileY - 1),
    },
    {
      axis: 'y',
      sign: 1,
      distance: Math.abs(maxY - sampleY),
      targetWalkable: isWalkableTile(map, tileX, tileY + 1),
    },
  ];
  distancesToFaces.sort((a, b) => {
    if (a.targetWalkable !== b.targetWalkable) return Number(b.targetWalkable) - Number(a.targetWalkable);
    return a.distance - b.distance;
  });
  const nearestFace = distancesToFaces[0] ?? { axis: 'x', sign: 1, distance: 0 };
  const correctionMagnitude = radius + nearestFace.distance + 1e-4;

  return nearestFace.axis === 'x'
    ? { x: nearestFace.sign * correctionMagnitude, y: 0, overlap: correctionMagnitude }
    : { x: 0, y: nearestFace.sign * correctionMagnitude, overlap: correctionMagnitude };
}

export function collidesWithWall(entity, x, y, map) {
  if (!map?.length) return false;
  const radius = Math.max(0.01, entity.radius ?? 0.5);
  const minTileX = Math.floor(x - radius - 0.5);
  const maxTileX = Math.ceil(x + radius + 0.5);
  const minTileY = Math.floor(y - radius - 0.5);
  const maxTileY = Math.ceil(y + radius + 0.5);

  for (let ty = minTileY; ty <= maxTileY; ty += 1) {
    for (let tx = minTileX; tx <= maxTileX; tx += 1) {
      if (map?.[ty]?.[tx]?.walkable) continue;
      if (getSolidTilePenetration(entity, tx, ty, x, y, map)) return true;
    }
  }
  return false;
}

export function attemptMoveWithCollision(entity, dx, dy, map, tileSize = 1) {
  if (!map?.length) {
    entity.x += dx;
    entity.y += dy;
    return;
  }
  const maxPushStep = tileSize / 2;
  const clampedDx = Math.max(-maxPushStep, Math.min(maxPushStep, dx));
  const clampedDy = Math.max(-maxPushStep, Math.min(maxPushStep, dy));

  if (clampedDx !== 0 && !collidesWithWall(entity, entity.x + clampedDx, entity.y, map)) {
    entity.x += clampedDx;
  }

  if (clampedDy !== 0 && !collidesWithWall(entity, entity.x, entity.y + clampedDy, map)) {
    entity.y += clampedDy;
  }
}

export function applyPush(entity, dx, dy, map, tileSize = 1) {
  if (!map?.length) {
    entity.x += dx;
    entity.y += dy;
    return;
  }
  const maxPushStep = tileSize / 2;
  const clampedDx = Math.max(-maxPushStep, Math.min(maxPushStep, dx));
  const clampedDy = Math.max(-maxPushStep, Math.min(maxPushStep, dy));
  const stepSize = tileSize / 4;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(clampedDx), Math.abs(clampedDy)) / stepSize));

  for (let index = 0; index < steps; index += 1) {
    attemptMoveWithCollision(entity, clampedDx / steps, clampedDy / steps, map, tileSize);
  }
}

export function getMinimalSeparationVector(entity, map, sampleX = entity.x, sampleY = entity.y) {
  if (!map?.length) return { x: 0, y: 0 };
  const radius = Math.max(0.01, entity.radius ?? 0.5);
  const minTileX = Math.floor(sampleX - radius - 0.5);
  const maxTileX = Math.ceil(sampleX + radius + 0.5);
  const minTileY = Math.floor(sampleY - radius - 0.5);
  const maxTileY = Math.ceil(sampleY + radius + 0.5);

  let strongest = null;

  for (let ty = minTileY; ty <= maxTileY; ty += 1) {
    for (let tx = minTileX; tx <= maxTileX; tx += 1) {
      if (map?.[ty]?.[tx]?.walkable) continue;
      const penetration = getSolidTilePenetration(entity, tx, ty, sampleX, sampleY, map);
      if (!penetration) continue;
      if (!strongest || penetration.overlap > strongest.overlap) strongest = penetration;
    }
  }

  return strongest ? { x: strongest.x, y: strongest.y } : { x: 0, y: 0 };
}

export function resolveWallOverlap(entity, map, maxIterations = 10) {
  if (!map?.length) return;
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    if (!collidesWithWall(entity, entity.x, entity.y, map)) break;

    const correction = getMinimalSeparationVector(entity, map);
    if (Math.abs(correction.x) < 1e-4 && Math.abs(correction.y) < 1e-4) break;

    entity.x += correction.x;
    entity.y += correction.y;
  }
}
