let transitionCachePerfHook = null;

export function setTransitionCachePerfHook(hook) {
  transitionCachePerfHook = typeof hook === 'function' ? hook : null;
}

function emitTransitionCachePerf(event, details = {}) {
  if (transitionCachePerfHook) transitionCachePerfHook(event, details);
}

function isWalkableTile(room, x, y) {
  const row = room?.tiles?.[y];
  const tile = row?.[x];
  return Boolean(tile?.walkable);
}

function tileKey(x, y) {
  return `${Math.round(x)},${Math.round(y)}`;
}

function entranceOffset(direction) {
  if (direction === 'north') return { x: 0, y: 2 };
  if (direction === 'south') return { x: 0, y: -2 };
  if (direction === 'west') return { x: 2, y: 0 };
  if (direction === 'east') return { x: -2, y: 0 };
  return { x: 0, y: 0 };
}

export function getEntranceSpawnTarget(room, entrance) {
  if (!entrance?.direction) {
    return {
      x: Math.round(entrance?.spawn?.x ?? entrance?.landingX ?? entrance?.x ?? 0),
      y: Math.round(entrance?.spawn?.y ?? entrance?.landingY ?? entrance?.y ?? 0),
    };
  }
  const anchorX = Math.round(entrance?.x ?? entrance?.spawn?.x ?? entrance?.landingX ?? 0);
  const anchorY = Math.round(entrance?.y ?? entrance?.spawn?.y ?? entrance?.landingY ?? 0);
  const offset = entranceOffset(entrance?.direction);
  const width = room?.tiles?.[0]?.length ?? 1;
  const height = room?.tiles?.length ?? 1;
  return {
    x: Math.max(0, Math.min(width - 1, anchorX + offset.x)),
    y: Math.max(0, Math.min(height - 1, anchorY + offset.y)),
  };
}

export function entranceSpawnCacheKey(entrance, preferredX, preferredY) {
  if (entrance?.id) return `entrance:${entrance.id}`;
  if (entrance?.direction) return `direction:${entrance.direction}:${Math.round(preferredX)},${Math.round(preferredY)}`;
  return `preferred:${Math.round(preferredX)},${Math.round(preferredY)}`;
}

function collectExitTriggerTiles(room) {
  const triggerTiles = new Set();
  const exits = Array.isArray(room?.exits)
    ? room.exits
    : Object.entries(room?.exits ?? {}).map(([id, exit]) => ({ id, ...exit }));
  const corridors = room?.exitCorridors ?? [];

  for (const exit of exits) {
    const px = Math.round(exit?.position?.x ?? Number.NaN);
    const py = Math.round(exit?.position?.y ?? Number.NaN);
    if (Number.isFinite(px) && Number.isFinite(py)) triggerTiles.add(tileKey(px, py));
  }
  for (const corridor of corridors) {
    for (const tile of corridor?.triggerTiles ?? []) {
      const tx = Math.round(tile?.x ?? Number.NaN);
      const ty = Math.round(tile?.y ?? Number.NaN);
      if (Number.isFinite(tx) && Number.isFinite(ty)) triggerTiles.add(tileKey(tx, ty));
    }
  }

  return triggerTiles;
}

function isOpenSpawnTile(room, blockedTiles, exitTriggerTiles, x, y) {
  const key = tileKey(x, y);
  return isWalkableTile(room, x, y) && !blockedTiles.has(key) && !exitTriggerTiles.has(key);
}

function findSpawnPosition(room, blockedTiles, exitTriggerTiles, preferredX, preferredY) {
  const startX = Math.round(preferredX);
  const startY = Math.round(preferredY);
  if (isOpenSpawnTile(room, blockedTiles, exitTriggerTiles, startX, startY)) return { x: startX, y: startY };

  const width = room?.tiles?.[0]?.length ?? 0;
  const height = room?.tiles?.length ?? 0;
  const maxRadius = Math.min(12, Math.max(width, height));
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    const left = Math.max(0, startX - radius);
    const right = Math.min(width - 1, startX + radius);
    const top = Math.max(0, startY - radius);
    const bottom = Math.min(height - 1, startY + radius);

    for (let x = left; x <= right; x += 1) {
      if (isOpenSpawnTile(room, blockedTiles, exitTriggerTiles, x, top)) return { x, y: top };
      if (bottom === top) continue;
      if (isOpenSpawnTile(room, blockedTiles, exitTriggerTiles, x, bottom)) return { x, y: bottom };
    }

    for (let y = top + 1; y < bottom; y += 1) {
      if (isOpenSpawnTile(room, blockedTiles, exitTriggerTiles, left, y)) return { x: left, y };
      if (right === left) continue;
      if (isOpenSpawnTile(room, blockedTiles, exitTriggerTiles, right, y)) return { x: right, y };
    }
  }

  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  const tiles = room?.tiles ?? [];
  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < (tiles[y]?.length ?? 0); x += 1) {
      if (!isOpenSpawnTile(room, blockedTiles, exitTriggerTiles, x, y)) continue;
      const distance = Math.abs(x - startX) + Math.abs(y - startY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { x, y };
      }
    }
  }

  if (nearest) return nearest;

  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < (tiles[y]?.length ?? 0); x += 1) {
      if (!isWalkableTile(room, x, y)) continue;
      const distance = Math.abs(x - startX) + Math.abs(y - startY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { x, y };
      }
    }
  }

  return nearest ?? { x: startX, y: startY };
}

function buildBlockedTiles(room) {
  const blockedTiles = new Set();
  for (const object of room?.objects ?? []) {
    if (!object?.collision) continue;
    const footprint = object.footprint ?? [[0, 0]];
    for (const [dx, dy] of footprint) blockedTiles.add(tileKey(object.x + dx, object.y + dy));
  }
  return blockedTiles;
}

export function buildRoomTransitionCache(room) {
  const startMs = globalThis?.performance?.now?.() ?? Date.now();
  emitTransitionCachePerf('buildRoomTransitionCache_start', { roomId: room?.id ?? null });
  const blockedTiles = buildBlockedTiles(room);
  const exitTriggerTiles = collectExitTriggerTiles(room);
  const spawnByEntrance = new Map();

  for (const entrance of Object.values(room?.entrances ?? {})) {
    const preferredSpawn = getEntranceSpawnTarget(room, entrance);
    const spawnKey = entranceSpawnCacheKey(entrance, preferredSpawn.x, preferredSpawn.y);
    const spawn = findSpawnPosition(room, blockedTiles, exitTriggerTiles, preferredSpawn.x, preferredSpawn.y);
    spawnByEntrance.set(spawnKey, { x: spawn.x, y: spawn.y });
  }

  room.__transitionCache = {
    spawnByEntrance,
  };

  emitTransitionCachePerf('buildRoomTransitionCache_end', {
    roomId: room?.id ?? null,
    entranceCount: spawnByEntrance.size,
    durationMs: Number((((globalThis?.performance?.now?.() ?? Date.now()) - startMs)).toFixed(3)),
  });

  return room.__transitionCache;
}
