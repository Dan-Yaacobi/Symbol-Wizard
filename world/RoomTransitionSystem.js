function isWalkableTile(room, x, y) {
  const row = room?.tiles?.[y];
  const tile = row?.[x];
  return Boolean(tile?.walkable);
}

function isObjectBlocked(room, x, y) {
  const objects = room?.objects ?? [];
  for (const object of objects) {
    if (!object?.collision) continue;
    const footprint = object.footprint ?? [[0, 0]];
    for (const [dx, dy] of footprint) {
      const ox = Math.round(object.x + dx);
      const oy = Math.round(object.y + dy);
      if (ox === x && oy === y) return true;
    }
  }
  return false;
}

function isInExitCorridor(room, x, y) {
  if (!room?.exitCorridors?.length) return false;
  return room.exitCorridors.some((corridor) => corridor?.edgeTiles?.some((tile) => tile.x === x && tile.y === y));
}

function buildInwardSpawnPosition(room, entrance, inset = 4) {
  const direction = entrance?.direction;
  if (!direction) {
    return {
      x: entrance?.spawn?.x ?? entrance?.roadAnchor?.x ?? entrance?.x,
      y: entrance?.spawn?.y ?? entrance?.roadAnchor?.y ?? entrance?.y,
    };
  }

  const minEdgeX = Math.min(entrance?.edgeStart?.x ?? entrance.x ?? 0, entrance?.edgeEnd?.x ?? entrance.x ?? 0);
  const maxEdgeX = Math.max(entrance?.edgeStart?.x ?? entrance.x ?? 0, entrance?.edgeEnd?.x ?? entrance.x ?? 0);
  const minEdgeY = Math.min(entrance?.edgeStart?.y ?? entrance.y ?? 0, entrance?.edgeEnd?.y ?? entrance.y ?? 0);
  const maxEdgeY = Math.max(entrance?.edgeStart?.y ?? entrance.y ?? 0, entrance?.edgeEnd?.y ?? entrance.y ?? 0);

  const centerX = Math.round((minEdgeX + maxEdgeX) / 2);
  const centerY = Math.round((minEdgeY + maxEdgeY) / 2);

  if (direction === 'east') {
    return { x: maxEdgeX - inset, y: centerY };
  }

  if (direction === 'west') {
    return { x: minEdgeX + inset, y: centerY };
  }

  if (direction === 'north') {
    return { x: centerX, y: minEdgeY + inset };
  }

  if (direction === 'south') {
    return { x: centerX, y: maxEdgeY - inset };
  }

  return { x: centerX, y: centerY };
}

function findSpawnPosition(room, preferredX, preferredY, maxRadius = 6) {
  const startX = Math.round(preferredX);
  const startY = Math.round(preferredY);

  if (isWalkableTile(room, startX, startY) && !isInExitCorridor(room, startX, startY) && !isObjectBlocked(room, startX, startY)) {
    return { x: startX, y: startY };
  }

  let fallback = null;

  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let y = startY - radius; y <= startY + radius; y += 1) {
      for (let x = startX - radius; x <= startX + radius; x += 1) {
        if (Math.max(Math.abs(x - startX), Math.abs(y - startY)) !== radius) continue;
        if (!isWalkableTile(room, x, y)) continue;
        if (isObjectBlocked(room, x, y)) continue;

        if (!fallback) fallback = { x, y };
        if (!isInExitCorridor(room, x, y)) return { x, y };
      }
    }
  }

  return fallback ?? { x: startX, y: startY };
}

export class RoomTransitionSystem {
  constructor({ biomeGenerator, fadeDurationMs = 150 } = {}) {
    this.biomeGenerator = biomeGenerator;
    this.fadeDuration = fadeDurationMs / 1000;
    this.phase = 'idle';
    this.phaseTimer = 0;
    this.fadeAlpha = 0;
    this.pendingExit = null;
    this.exitTriggerLockTimer = 0;
  }

  update(dt, context) {
    this.exitTriggerLockTimer = Math.max(0, this.exitTriggerLockTimer - dt);

    if (this.phase === 'idle') {
      const hitExitId = this.exitTriggerLockTimer > 0 ? null : this.detectExit(context.activeRoom, context.player);
      if (!hitExitId) return null;

      this.pendingExit = hitExitId;
      this.phase = 'fadeOut';
      this.phaseTimer = 0;
      return null;
    }

    this.phaseTimer += dt;
    const progress = Math.min(1, this.phaseTimer / this.fadeDuration);

    if (this.phase === 'fadeOut') {
      this.fadeAlpha = progress;
      if (progress < 1) return null;

      const transitionResult = this.switchRoom(context, this.pendingExit);
      this.phase = 'fadeIn';
      this.phaseTimer = 0;
      this.pendingExit = null;
      return transitionResult;
    }

    if (this.phase === 'fadeIn') {
      this.fadeAlpha = 1 - progress;
      if (progress < 1) return null;
      this.phase = 'idle';
      this.phaseTimer = 0;
      this.fadeAlpha = 0;
    }

    return null;
  }

  detectExit(activeRoom, player) {
    if (!activeRoom?.exitCorridors?.length) return null;

    const tx = Math.round(player.x);
    const ty = Math.round(player.y);

    const hitZone = activeRoom.exitCorridors.find((corridor) => corridor?.edgeTiles?.some((tile) => tile.x === tx && tile.y === ty));

    return hitZone?.exitId ?? null;
  }

  switchRoom(context, exitId) {
    const roomNode = this.biomeGenerator.getRoomNode(context.activeRoom.id);
    if (!roomNode) return null;

    const connection = roomNode.connections.find((entry) => entry.exitId === exitId);
    if (!connection) return null;

    const targetRoom = this.biomeGenerator.loadRoom(connection.targetRoomId);
    const targetEntrance = targetRoom?.entrances?.[connection.targetEntranceId];
    if (!targetRoom || !targetEntrance) return null;

    context.activeRoom.state.visited = true;
    targetRoom.state.visited = true;

    const inwardSpawn = buildInwardSpawnPosition(targetRoom, targetEntrance, 4);
    const preferredSpawnX = inwardSpawn.x;
    const preferredSpawnY = inwardSpawn.y;
    const spawn = findSpawnPosition(targetRoom, preferredSpawnX, preferredSpawnY);
    context.player.x = spawn.x;
    context.player.y = spawn.y;

    this.exitTriggerLockTimer = 0.2;

    return {
      room: targetRoom,
    };
  }
}
