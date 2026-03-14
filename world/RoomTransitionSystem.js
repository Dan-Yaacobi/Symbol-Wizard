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
    if (!activeRoom?.exitZones?.length) return null;

    const tx = Math.round(player.x);
    const ty = Math.round(player.y);

    const edgeThreshold = 1;
    const roomWidth = activeRoom.tiles?.[0]?.length ?? 0;
    const roomHeight = activeRoom.tiles?.length ?? 0;

    const hitZone = activeRoom.exitZones.find((zone) => {
      if (!zone?.edgeStart || !zone?.edgeEnd) return false;

      const minX = Math.min(zone.edgeStart.x, zone.edgeEnd.x);
      const maxX = Math.max(zone.edgeStart.x, zone.edgeEnd.x);
      const minY = Math.min(zone.edgeStart.y, zone.edgeEnd.y);
      const maxY = Math.max(zone.edgeStart.y, zone.edgeEnd.y);
      const inCorridor = tx >= minX && tx <= maxX && ty >= minY && ty <= maxY;
      if (!inCorridor) return false;

      if (zone.direction === 'east') return tx >= roomWidth - 1 - edgeThreshold;
      if (zone.direction === 'west') return tx <= edgeThreshold;
      if (zone.direction === 'north') return ty <= edgeThreshold;
      if (zone.direction === 'south') return ty >= roomHeight - 1 - edgeThreshold;
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

    const preferredSpawnX = targetEntrance.spawn?.x ?? targetEntrance.roadAnchor?.x ?? targetEntrance.x;
    const preferredSpawnY = targetEntrance.spawn?.y ?? targetEntrance.roadAnchor?.y ?? targetEntrance.y;
    const spawn = findSpawnPosition(targetRoom, preferredSpawnX, preferredSpawnY);
    context.player.x = spawn.x;
    context.player.y = spawn.y;

    this.exitTriggerLockTimer = 0.2;

    return {
      room: targetRoom,
    };
  }
}
