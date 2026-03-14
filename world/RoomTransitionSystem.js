function isWalkableTile(room, x, y) {
  const row = room?.tiles?.[y];
  const tile = row?.[x];
  return Boolean(tile?.walkable);
}

function isInExitZone(room, x, y) {
  if (!room?.exitZones?.length) return false;
  return room.exitZones.some((zone) => {
    if (!zone?.edgeStart || !zone?.edgeEnd) return false;

    const minX = Math.min(zone.edgeStart.x, zone.edgeEnd.x);
    const maxX = Math.max(zone.edgeStart.x, zone.edgeEnd.x);
    const minY = Math.min(zone.edgeStart.y, zone.edgeEnd.y);
    const maxY = Math.max(zone.edgeStart.y, zone.edgeEnd.y);

    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  });
}

function buildInwardSpawnPosition(room, entrance, inset = 4) {
  const roomWidth = room?.tiles?.[0]?.length ?? 0;
  const roomHeight = room?.tiles?.length ?? 0;
  const direction = entrance?.direction;

  if (direction === 'east') {
    return { x: Math.max(1, roomWidth - 1 - inset), y: entrance.y };
  }

  if (direction === 'west') {
    return { x: inset, y: entrance.y };
  }

  if (direction === 'north') {
    return { x: entrance.x, y: inset };
  }

  if (direction === 'south') {
    return { x: entrance.x, y: Math.max(1, roomHeight - 1 - inset) };
  }

  return {
    x: entrance?.spawn?.x ?? entrance?.roadAnchor?.x ?? entrance?.x,
    y: entrance?.spawn?.y ?? entrance?.roadAnchor?.y ?? entrance?.y,
  };
}

function findSpawnPosition(room, preferredX, preferredY, maxRadius = 6) {
  const startX = Math.round(preferredX);
  const startY = Math.round(preferredY);

  if (isWalkableTile(room, startX, startY) && !isInExitZone(room, startX, startY)) {
    return { x: startX, y: startY };
  }

  let fallback = null;

  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let y = startY - radius; y <= startY + radius; y += 1) {
      for (let x = startX - radius; x <= startX + radius; x += 1) {
        if (Math.max(Math.abs(x - startX), Math.abs(y - startY)) !== radius) continue;
        if (!isWalkableTile(room, x, y)) continue;

        if (!fallback) fallback = { x, y };
        if (!isInExitZone(room, x, y)) return { x, y };
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

    const roomWidth = activeRoom.tiles?.[0]?.length ?? 0;
    const roomHeight = activeRoom.tiles?.length ?? 0;

    const hitZone = activeRoom.exitCorridors.find((corridor) => {
      if (!corridor?.start || !corridor?.end) return false;

      const minX = Math.min(corridor.start.x, corridor.end.x);
      const maxX = Math.max(corridor.start.x, corridor.end.x);
      const minY = Math.min(corridor.start.y, corridor.end.y);
      const maxY = Math.max(corridor.start.y, corridor.end.y);
      const inCorridor = tx >= minX && tx <= maxX && ty >= minY && ty <= maxY;
      if (!inCorridor) return false;

      if (corridor.direction === 'east') return tx >= roomWidth - 2;
      if (corridor.direction === 'west') return tx <= 1;
      if (corridor.direction === 'north') return ty <= 1;
      if (corridor.direction === 'south') return ty >= roomHeight - 2;
      return false;
    });

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
