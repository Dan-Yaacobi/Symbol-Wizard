import { getInteractableAt } from './InteractableResolver.js';

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

function findSpawnPosition(room, preferredX, preferredY, maxRadius = 6) {
  const startX = Math.round(preferredX);
  const startY = Math.round(preferredY);

  if (isWalkableTile(room, startX, startY) && !isObjectBlocked(room, startX, startY)) {
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
        return { x, y };
      }
    }
  }

  return fallback ?? { x: startX, y: startY };
}

export class RoomTransitionSystem {
  constructor({ biomeGenerator, worldMapManager = null, fadeDurationMs = 150, debug = false } = {}) {
    this.biomeGenerator = biomeGenerator;
    this.worldMapManager = worldMapManager;
    this.fadeDuration = fadeDurationMs / 1000;
    this.debug = debug;
    this.phase = 'idle';
    this.phaseTimer = 0;
    this.fadeAlpha = 0;
    this.pendingExit = null;
    this.exitTriggerLockTimer = 0;
  }

  reset() {
    this.phase = 'idle';
    this.phaseTimer = 0;
    this.fadeAlpha = 0;
    this.pendingExit = null;
    this.exitTriggerLockTimer = 0;
  }

  log(message, details = undefined) {
    if (!this.debug) return;
    if (details === undefined) {
      console.info('[ExitFlow]', message);
      return;
    }
    console.info('[ExitFlow]', message, details);
  }

  requestTransition(exit) {
    if (!exit) {
      this.log('FAIL: transition trigger — requestTransition called without exit');
      return;
    }
    this.log('Transition trigger called', {
      exitId: exit.id ?? null,
      targetMapType: exit.targetMapType ?? exit.targetMap ?? null,
      targetRoomId: exit.targetRoomId ?? exit.targetBiome ?? null,
    });
    this.pendingExit = exit;
    this.phase = 'fadeOut';
    this.phaseTimer = 0;
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
    const tx = Math.round(player.x);
    const ty = Math.round(player.y);
    this.log('Player movement tick', { x: player.x, y: player.y, tile: { x: tx, y: ty } });
    const interactable = getInteractableAt(activeRoom, tx, ty, {
      enabled: this.debug,
      prefix: '[ExitFlow]',
    });

    if (!interactable) {
      this.log('FAIL: exit detection — player tile has no interactable exit', { x: tx, y: ty });
      return null;
    }
    if (interactable.source !== 'exit') {
      this.log('FAIL: exit detection — interactable found but is not an exit', {
        x: tx,
        y: ty,
        source: interactable.source,
        id: interactable.id ?? null,
      });
      return null;
    }

    return interactable.exitRef ?? interactable;
  }

  resolveExit(activeRoom, exitRef) {
    if (!exitRef) return null;
    if (typeof exitRef === 'object') return exitRef;
    const exits = Array.isArray(activeRoom?.exits)
      ? activeRoom.exits
      : Object.entries(activeRoom?.exits ?? {}).map(([id, exit]) => ({ id, ...exit }));
    return exits.find((entry) => entry.id === exitRef) ?? null;
  }

  switchRoom(context, exitRef) {
    this.log('Transition trigger called', {
      exitRefType: typeof exitRef,
      exitId: typeof exitRef === 'object' ? exitRef?.id ?? null : exitRef,
    });
    const exit = this.resolveExit(context.activeRoom, exitRef);
    if (!exit) {
      this.log('FAIL: transition called but failed — exit could not be resolved', { exitRef });
      return null;
    }

    let targetRoom = null;
    let targetEntrance = null;

    if (exit.targetMapType && this.worldMapManager) {
      targetRoom = this.worldMapManager.resolveMapByExit(context.activeRoom, exit);
      targetEntrance = this.worldMapManager.getEntrance(targetRoom, exit.targetEntryId);
    } else if (exit.targetRoomId && exit.targetEntranceId) {
      targetRoom = this.biomeGenerator.loadRoom(exit.targetRoomId);
      targetEntrance = targetRoom?.entrances?.[exit.targetEntranceId];
    }

    if (!targetRoom || !targetEntrance) {
      this.log('FAIL: transition called but failed — target room or entrance missing', {
        exitId: exit.id ?? null,
        targetRoomResolved: Boolean(targetRoom),
        targetEntranceResolved: Boolean(targetEntrance),
        targetMapType: exit.targetMapType ?? null,
        targetRoomId: exit.targetRoomId ?? null,
        targetEntryId: exit.targetEntryId ?? null,
        targetEntranceId: exit.targetEntranceId ?? null,
      });
      return null;
    }

    context.activeRoom.state.visited = true;
    targetRoom.state = targetRoom.state ?? {};
    targetRoom.state.visited = true;

    const preferredSpawnX = targetEntrance.landingX ?? targetEntrance.spawn?.x ?? targetEntrance.x;
    const preferredSpawnY = targetEntrance.landingY ?? targetEntrance.spawn?.y ?? targetEntrance.y;
    const spawn = findSpawnPosition(targetRoom, preferredSpawnX, preferredSpawnY);
    context.player.x = spawn.x;
    context.player.y = spawn.y;

    this.log('Transition succeeded', { fromRoomId: context.activeRoom?.id ?? null, toRoomId: targetRoom?.id ?? null, spawn });
    this.exitTriggerLockTimer = 0.2;

    return {
      room: targetRoom,
    };
  }
}
