function toRadius(entityLike, fallback = 0.5) {
  return Math.max(0.05, Number(entityLike?.radius) || fallback);
}

function tileKey(x, y) {
  return `${x},${y}`;
}

function distanceSquared(a, b) {
  const dx = (a?.x ?? 0) - (b?.x ?? 0);
  const dy = (a?.y ?? 0) - (b?.y ?? 0);
  return (dx * dx) + (dy * dy);
}

function normalizeIgnoredGroups(entityLike = null) {
  if (!Array.isArray(entityLike?.ignoreCollisionWith)) return new Set();
  return new Set(entityLike.ignoreCollisionWith.filter((value) => typeof value === 'string'));
}

function objectCollisionGroup(object) {
  return object?.collisionGroup ?? object?.group ?? null;
}

function objectBlocksForEntity(entityLike, object) {
  if (!object || object.destroyed || !object.collision) return false;
  const ignoredGroups = normalizeIgnoredGroups(entityLike);
  const group = objectCollisionGroup(object);
  if (group && ignoredGroups.has(group)) return false;
  return true;
}

function collidesWithBlockedTerrain(room, x, y, radius) {
  const minTileX = Math.floor(x - radius - 0.5);
  const maxTileX = Math.ceil(x + radius + 0.5);
  const minTileY = Math.floor(y - radius - 0.5);
  const maxTileY = Math.ceil(y + radius + 0.5);

  for (let ty = minTileY; ty <= maxTileY; ty += 1) {
    for (let tx = minTileX; tx <= maxTileX; tx += 1) {
      const tile = room?.tiles?.[ty]?.[tx];
      if (!tile?.walkable || room?.collisionMap?.[ty]?.[tx]) {
        const nearestX = Math.max(tx - 0.5, Math.min(x, tx + 0.5));
        const nearestY = Math.max(ty - 0.5, Math.min(y, ty + 0.5));
        const dx = x - nearestX;
        const dy = y - nearestY;
        if ((dx * dx) + (dy * dy) <= radius * radius) return true;
      }
    }
  }
  return false;
}

function collidesWithObjects(position, entityLike, worldObjects = []) {
  const radius = toRadius(entityLike);
  for (const object of worldObjects) {
    if (!objectBlocksForEntity(entityLike, object)) continue;
    const minDistance = radius + toRadius(object, 0.5);
    const withinRadius = distanceSquared(position, object) < (minDistance * minDistance);
    if (!withinRadius) continue;
    return { collided: true, object };
  }
  return { collided: false, object: null };
}

function collidesWithEntities(position, entityLike, entities = [], ignoredEntityIds = null) {
  const radius = toRadius(entityLike);
  for (const other of entities) {
    if (!other || !other.alive) continue;
    if (ignoredEntityIds?.has?.(other.id)) continue;
    const minDistance = radius + toRadius(other);
    if (distanceSquared(position, other) < (minDistance * minDistance)) return { collided: true, other };
  }
  return { collided: false, other: null };
}

export function validateSpawnPosition(position, entityLike, {
  room = null,
  worldObjects = [],
  entities = [],
  ignoredEntityIds = null,
  extraValidation = null,
} = {}) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { valid: false, reason: 'invalid_position' };

  const roundedX = Math.round(x);
  const roundedY = Math.round(y);
  const tile = room?.tiles?.[roundedY]?.[roundedX];
  if (!tile?.walkable || room?.collisionMap?.[roundedY]?.[roundedX]) return { valid: false, reason: 'blocked_tile' };

  const radius = toRadius(entityLike);
  if (collidesWithBlockedTerrain(room, x, y, radius)) return { valid: false, reason: 'blocked_tile' };

  const objectCollision = collidesWithObjects({ x, y }, entityLike, worldObjects);
  if (objectCollision.collided) return { valid: false, reason: 'blocked_object', object: objectCollision.object };

  const entityCollision = collidesWithEntities({ x, y }, entityLike, entities, ignoredEntityIds);
  if (entityCollision.collided) return { valid: false, reason: 'enemy_overlap', entity: entityCollision.other };

  if (typeof extraValidation === 'function') {
    const extra = extraValidation({ x, y, tileKey: tileKey(roundedX, roundedY) });
    if (extra?.valid === false) return { valid: false, reason: extra.reason ?? 'custom_rejected' };
  }

  return { valid: true, reason: null };
}

export function isValidSpawnPosition(position, entityLike, options = {}) {
  return validateSpawnPosition(position, entityLike, options).valid;
}

export function trySpawnPosition(basePosition, entityLike, {
  room = null,
  worldObjects = [],
  entities = [],
  maxAttempts = 16,
  searchRadius = 4,
  rng = Math.random,
  extraValidation = null,
  debugAttempts = null,
} = {}) {
  const attempts = Math.max(1, maxAttempts);
  const radius = Math.max(1, Number(searchRadius) || 1);

  const candidateAt = (index) => {
    if (index === 0) return { x: basePosition.x, y: basePosition.y };
    const angle = rng() * Math.PI * 2;
    const distance = radius * Math.sqrt(rng());
    return {
      x: Math.round(basePosition.x + Math.cos(angle) * distance),
      y: Math.round(basePosition.y + Math.sin(angle) * distance),
    };
  };

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate = candidateAt(attempt);
    const validation = validateSpawnPosition(candidate, entityLike, {
      room,
      worldObjects,
      entities,
      extraValidation,
    });
    debugAttempts?.push({ x: candidate.x, y: candidate.y, valid: validation.valid, reason: validation.reason ?? null });
    if (validation.valid) return { position: candidate, validation };
  }

  return { position: null, validation: { valid: false, reason: 'max_attempts' } };
}
