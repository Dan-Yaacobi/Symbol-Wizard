import { getBestInteractableAt } from '../systems/InteractionSystem.js';
import { buildCollidableMask, floodFillWalkable, nearestReachablePoint } from './PathConnectivity.js';

function nowMs() {
  return globalThis?.performance?.now?.() ?? Date.now();
}

function wallClockIso() {
  return new Date().toISOString();
}

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

function isExitTriggerTile(room, x, y) {
  const interactable = getBestInteractableAt(room, x, y, { triggerMode: 'touch' });
  return interactable?.interactionType === 'exit';
}

function entranceOffset(direction) {
  if (direction === 'north') return { x: 0, y: 2 };
  if (direction === 'south') return { x: 0, y: -2 };
  if (direction === 'west') return { x: 2, y: 0 };
  if (direction === 'east') return { x: -2, y: 0 };
  return { x: 0, y: 0 };
}

function getEntranceSpawnTarget(room, entrance) {
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

function findSpawnPosition(room, preferredX, preferredY) {
  const startX = Math.round(preferredX);
  const startY = Math.round(preferredY);

  if (isWalkableTile(room, startX, startY) && !isObjectBlocked(room, startX, startY) && !isExitTriggerTile(room, startX, startY)) {
    return { x: startX, y: startY };
  }

  const objectMask = buildCollidableMask(room?.objects ?? []);
  const reachable = floodFillWalkable(room?.tiles ?? [], { x: startX, y: startY }, objectMask);
  if (reachable.size > 0) {
    const filteredReachable = new Set([...reachable].filter((key) => {
      const [x, y] = key.split(',').map(Number);
      return !isExitTriggerTile(room, x, y);
    }));
    return nearestReachablePoint(filteredReachable.size > 0 ? filteredReachable : reachable, { x: startX, y: startY }) ?? { x: startX, y: startY };
  }

  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  const tiles = room?.tiles ?? [];
  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < (tiles[y]?.length ?? 0); x += 1) {
      if (!isWalkableTile(room, x, y) || isObjectBlocked(room, x, y) || isExitTriggerTile(room, x, y)) continue;
      const distance = Math.abs(x - startX) + Math.abs(y - startY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { x, y };
      }
    }
  }

  return nearest ?? { x: startX, y: startY };
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
    this.maxFadeAlpha = 0.78;
    this.pendingExit = null;
    this.preparedTransition = null;
    this.exitTriggerLockTimer = 0;
  }

  reset() {
    this.phase = 'idle';
    this.phaseTimer = 0;
    this.fadeAlpha = 0;
    this.pendingExit = null;
    this.preparedTransition = null;
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
      targetMapType: exit.targetMapType ?? exit.targetMap ?? exit.interactionData?.targetMap ?? null,
      targetRoomId: exit.targetRoomId ?? exit.targetBiome ?? exit.interactionData?.targetBiome ?? null,
    });
    this.pendingExit = exit;
    this.phase = 'fadeOut';
    this.phaseTimer = 0;
  }

  logPhase(phase, startMs, endMs, details = {}) {
    const payload = {
      phase,
      startTimestamp: wallClockIso(),
      startMs: Number(startMs.toFixed(3)),
      endMs: Number(endMs.toFixed(3)),
      durationMs: Number((endMs - startMs).toFixed(3)),
      ...details,
    };
    console.info('[TransitionTiming]', payload);
  }

  normalizeExit(activeRoom, exit) {
    const data = exit?.interactionData ?? {};
    const normalizedExit = {
      ...exit,
      targetMapType: exit?.targetMapType ?? exit?.targetMap ?? data.targetMap ?? null,
      targetMap: exit?.targetMap ?? exit?.targetMapType ?? data.targetMap ?? null,
      targetRoomId: exit?.targetRoomId ?? exit?.targetBiome ?? data.targetBiome ?? null,
      targetBiome: exit?.targetBiome ?? exit?.targetRoomId ?? data.targetBiome ?? null,
      targetEntryId: exit?.targetEntryId ?? exit?.targetEntranceId ?? data.targetEntryId ?? data.targetExitId ?? null,
      targetEntranceId: exit?.targetEntranceId ?? data.targetEntryId ?? data.targetExitId ?? null,
      targetSeed: exit?.targetSeed ?? data.targetSeed ?? null,
      meta: exit?.meta ?? data.meta ?? null,
    };

    if (normalizedExit.targetMapType === 'house_interior') {
      normalizedExit.meta = {
        ...(normalizedExit.meta ?? {}),
        houseId: normalizedExit.meta?.houseId ?? exit?.id,
        parentTownSeed: normalizedExit.meta?.parentTownSeed ?? activeRoom?.seed,
        houseIndex: normalizedExit.meta?.houseIndex ?? (Number.parseInt(String(exit?.id).split('-').pop(), 10) || 0),
        returnPosition: normalizedExit.meta?.returnPosition ?? (exit?.door ? { x: exit.door.x, y: exit.door.y + 2 } : null),
        returnMapId: normalizedExit.meta?.returnMapId ?? activeRoom?.id,
        returnEntryId: normalizedExit.meta?.returnEntryId ?? `return-${exit?.id}`,
      };
    }

    return normalizedExit;
  }

  prepareTransitionTarget(context, exitRef) {
    const startMs = nowMs();
    const exit = this.resolveExit(context.activeRoom, exitRef);
    if (!exit) return null;
    const normalizedExit = this.normalizeExit(context.activeRoom, exit);

    let targetRoom = null;
    let targetEntrance = null;
    if (normalizedExit.targetMapType && this.worldMapManager) {
      targetRoom = this.worldMapManager.resolveMapByExit(context.activeRoom, normalizedExit);
      targetEntrance = this.worldMapManager.getEntrance(targetRoom, normalizedExit.targetEntryId);
    } else if (normalizedExit.targetRoomId && normalizedExit.targetEntranceId) {
      targetRoom = this.biomeGenerator.loadRoom(normalizedExit.targetRoomId);
      targetEntrance = targetRoom?.entrances?.[normalizedExit.targetEntranceId];
    }

    const endMs = nowMs();
    this.logPhase('transition_target_resolve', startMs, endMs, {
      exitId: normalizedExit.id ?? null,
      fromRoomId: context.activeRoom?.id ?? null,
      targetMapType: normalizedExit.targetMapType ?? null,
      targetRoomResolved: Boolean(targetRoom),
      targetEntranceResolved: Boolean(targetEntrance),
      mapCacheHit: Boolean(targetRoom && this.worldMapManager?.mapCache?.has?.(targetRoom.id)),
    });

    if (!targetRoom || !targetEntrance) {
      return {
        exit,
        normalizedExit,
        targetRoom: null,
        targetEntrance: null,
      };
    }

    return {
      exit,
      normalizedExit,
      targetRoom,
      targetEntrance,
      fromRoomId: context.activeRoom?.id ?? null,
    };
  }

  prewarmExitTarget(activeRoom, exitRef) {
    if (!activeRoom || !exitRef) return null;
    return this.prepareTransitionTarget({ activeRoom, player: null }, exitRef);
  }

  update(dt, context) {
    this.exitTriggerLockTimer = Math.max(0, this.exitTriggerLockTimer - dt);

    if (this.phase === 'idle') {
      const hitExitId = this.exitTriggerLockTimer > 0 ? null : this.detectExit(context.activeRoom, context.player);
      if (!hitExitId) return null;

      this.pendingExit = hitExitId;
      this.preparedTransition = this.prepareTransitionTarget(context, hitExitId);
      this.phase = 'fadeOut';
      this.phaseTimer = 0;
      return null;
    }

    if (this.phase === 'fadeOut' && !this.preparedTransition && this.pendingExit) {
      this.preparedTransition = this.prepareTransitionTarget(context, this.pendingExit);
    }

    this.phaseTimer += dt;
    const progress = Math.min(1, this.phaseTimer / this.fadeDuration);
    const easedProgress = progress * progress * (3 - (2 * progress));

    if (this.phase === 'fadeOut') {
      this.fadeAlpha = easedProgress * this.maxFadeAlpha;
      if (progress < 1) return null;

      const transitionResult = this.switchRoom(context, this.pendingExit);
      this.phase = 'fadeIn';
      this.phaseTimer = 0;
      this.pendingExit = null;
      this.preparedTransition = null;
      return transitionResult;
    }

    if (this.phase === 'fadeIn') {
      this.fadeAlpha = (1 - easedProgress) * this.maxFadeAlpha;
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

    const interactable = getBestInteractableAt(activeRoom, tx, ty, {
      triggerMode: 'touch',
      debug: this.debug ? { enabled: true, prefix: '[ExitFlow]' } : null,
    });

    if (!interactable) {
      this.log('FAIL: exit detection — player tile has no touch interactable', { x: tx, y: ty });
      return null;
    }
    if (interactable.interactionType !== 'exit') {
      this.log('FAIL: exit detection — touch interactable found but is not an exit', {
        x: tx,
        y: ty,
        interactionType: interactable.interactionType,
        id: interactable.id ?? null,
      });
      return null;
    }

    return interactable.source ?? interactable;
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

    const prepared = this.preparedTransition?.fromRoomId === context.activeRoom?.id
      && (this.preparedTransition?.exit?.id ?? null) === (exit?.id ?? null)
      ? this.preparedTransition
      : this.prepareTransitionTarget(context, exit);
    const normalizedExit = prepared?.normalizedExit ?? this.normalizeExit(context.activeRoom, exit);
    const targetRoom = prepared?.targetRoom ?? null;
    const targetEntrance = prepared?.targetEntrance ?? null;

    if (!targetRoom || !targetEntrance) {
      this.log('FAIL: transition called but failed — target room or entrance missing', {
        exitId: normalizedExit.id ?? null,
        targetRoomResolved: Boolean(targetRoom),
        targetEntranceResolved: Boolean(targetEntrance),
        targetMapType: normalizedExit.targetMapType ?? null,
        targetRoomId: normalizedExit.targetRoomId ?? null,
        targetEntryId: normalizedExit.targetEntryId ?? null,
        targetEntranceId: normalizedExit.targetEntranceId ?? null,
      });
      return null;
    }

    context.activeRoom.state.visited = true;
    targetRoom.state = targetRoom.state ?? {};
    targetRoom.state.visited = true;

    const preferredSpawn = getEntranceSpawnTarget(targetRoom, targetEntrance);
    const preferredSpawnX = preferredSpawn.x;
    const preferredSpawnY = preferredSpawn.y;
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
