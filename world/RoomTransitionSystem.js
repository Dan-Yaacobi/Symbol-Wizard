import { getBestInteractableAt } from '../systems/InteractionSystem.js';
import {
  entranceSpawnCacheKey,
  getEntranceSpawnTarget,
} from './TransitionCache.js';

function nowMs() {
  return globalThis?.performance?.now?.() ?? Date.now();
}

function wallClockIso() {
  return new Date().toISOString();
}

function getRoomTransitionCache(room) {
  const cache = room?.__transitionCache;
  if (cache) return cache;
  console.error('[RoomTransitionSystem] Missing precomputed transition cache for room', { roomId: room?.id ?? null });
  return null;
}

export class RoomTransitionSystem {
  constructor({ biomeGenerator, worldMapManager = null, fadeDurationMs = 150, debug = false, profilingEnabled = false, onPerfEvent = null } = {}) {
    this.biomeGenerator = biomeGenerator;
    this.worldMapManager = worldMapManager;
    this.fadeDuration = fadeDurationMs / 1000;
    this.debug = debug;
    this.profilingEnabled = profilingEnabled;
    this.onPerfEvent = typeof onPerfEvent === 'function' ? onPerfEvent : null;
    this.phase = 'idle';
    this.phaseTimer = 0;
    this.fadeAlpha = 0;
    this.maxFadeAlpha = 0.78;
    this.pendingExit = null;
    this.preparedTransition = null;
    this.exitTriggerLockTimer = 0;
    this.transitionSequence = 0;
    this.activeTimeline = null;
    this.lastTransitionTimeline = null;
    this.lastBlockingSummary = null;
    this.newRoomActivatedAtMs = null;
  }

  reset() {
    this.phase = 'idle';
    this.phaseTimer = 0;
    this.fadeAlpha = 0;
    this.pendingExit = null;
    this.preparedTransition = null;
    this.exitTriggerLockTimer = 0;
    this.activeTimeline = null;
    this.newRoomActivatedAtMs = null;
  }

  isTransitionActive() {
    return this.phase !== 'idle';
  }

  noteExternalTimeline(label, details = {}) {
    this.markTimeline(label, { details });
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
    if (this.phase !== 'idle') return;
    this.beginTimeline(exit, 'request_transition');
    this.markTimeline('on_exit_trigger');
    this.markTimeline('transition_start_requested');
    this.log('Transition trigger called', {
      exitId: exit.id ?? null,
      targetMapType: exit.targetMapType ?? exit.targetMap ?? exit.interactionData?.targetMap ?? null,
      targetRoomId: exit.targetRoomId ?? exit.targetBiome ?? exit.interactionData?.targetBiome ?? null,
    });
    this.pendingExit = exit;
    this.preparedTransition = null;
    this.markTimeline('input_lock_start');
    this.setPhase('fadeOut');
    this.phaseTimer = 0;
  }

  setPhase(nextPhase) {
    if (this.phase === nextPhase) return;
    this.phase = nextPhase;
    this.markTimeline('transition_state_changed', { details: { phase: nextPhase } });
  }

  beginTimeline(exit, source = 'unknown') {
    this.transitionSequence += 1;
    this.activeTimeline = {
      id: this.transitionSequence,
      source,
      exitId: exit?.id ?? null,
      startedAtMs: nowMs(),
      checkpoints: [],
      durations: {},
    };
  }

  markTimeline(label, details = {}) {
    if (!this.activeTimeline) return;
    this.activeTimeline.checkpoints.push({
      label,
      ms: nowMs(),
      ...details,
    });
  }

  hasTimelineCheckpoint(label) {
    if (!this.activeTimeline) return false;
    return this.activeTimeline.checkpoints.some((entry) => entry.label === label);
  }

  finalizeTimeline() {
    if (!this.activeTimeline) return;
    const ordered = [...this.activeTimeline.checkpoints].sort((a, b) => a.ms - b.ms);
    const start = ordered[0]?.ms ?? this.activeTimeline.startedAtMs;
    const timeline = {
      ...this.activeTimeline,
      checkpoints: ordered.map((entry, index) => ({
        ...entry,
        sinceStartMs: Number((entry.ms - start).toFixed(3)),
        sincePreviousMs: Number((entry.ms - (ordered[index - 1]?.ms ?? start)).toFixed(3)),
      })),
    };
    const countLabel = (label) => timeline.checkpoints.filter((entry) => entry.label === label).length;
    timeline.eventCounts = {
      exitTriggerDetected: countLabel('exit_trigger_detected') + countLabel('on_exit_trigger'),
      transitionStart: countLabel('transition_start_requested'),
      mapLookup: countLabel('map_lookup_start'),
      mapGeneration: countLabel('map_generation_start'),
      roomActivation: countLabel('room_activation_start'),
      fadeStart: countLabel('fade_black_screen_start'),
      fadeEnd: countLabel('fade_end_map_visible'),
      rendererSwap: countLabel('renderer_swap_start'),
      cameraViewportUpdate: countLabel('camera_viewport_update_start'),
      firstFrameRendered: countLabel('first_frame_new_room_rendered'),
    };
    this.lastTransitionTimeline = timeline;

    const ranked = timeline.checkpoints
      .filter((entry) => Number.isFinite(entry.sincePreviousMs) && entry.sincePreviousMs > 0)
      .sort((a, b) => b.sincePreviousMs - a.sincePreviousMs);
    this.lastBlockingSummary = ranked.slice(0, 3).map((entry) => ({
      label: entry.label,
      durationMs: entry.sincePreviousMs,
    }));

    if (this.profilingEnabled) console.info('[TransitionTimeline]', {
      transitionId: timeline.id,
      exitId: timeline.exitId,
      source: timeline.source,
      checkpoints: timeline.checkpoints.map((entry) => ({
        label: entry.label,
        sinceStartMs: entry.sinceStartMs,
        sincePreviousMs: entry.sincePreviousMs,
        details: entry.details ?? null,
      })),
      blockingHotspots: this.lastBlockingSummary,
      eventCounts: timeline.eventCounts,
    });
    this.activeTimeline = null;
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
    if (this.profilingEnabled) console.info('[TransitionTiming]', payload);
  }

  emitPerfEvent(name, details = {}) {
    if (this.onPerfEvent) this.onPerfEvent(name, details);
    if (!this.profilingEnabled) return;
    console.info('[TransitionPerf]', { name, at: wallClockIso(), ...details });
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
    this.markTimeline('map_lookup_start');
    const exit = this.resolveExit(context.activeRoom, exitRef);
    if (!exit) return null;
    const normalizedExit = this.normalizeExit(context.activeRoom, exit);

    let targetRoom = null;
    let targetEntrance = null;
    let targetWasCached = null;
    if (normalizedExit.targetMapType && this.worldMapManager) {
      const mapCache = this.worldMapManager.mapCache;
      if (mapCache?.has && normalizedExit.targetMapType === 'town') {
        const townMapId = this.worldMapManager.buildTownMapId(normalizedExit.targetSeed);
        targetWasCached = mapCache.has(townMapId);
      } else if (mapCache?.has && normalizedExit.targetMapType === 'house_interior') {
        const houseMapId = this.worldMapManager.buildMapId('house', normalizedExit.targetSeed);
        targetWasCached = mapCache.has(houseMapId);
      } else if (mapCache?.has && normalizedExit.targetMapType === 'forest') {
        const forestSeed = normalizedExit.targetSeed ?? context.activeRoom?.seed;
        const forestMapId = normalizedExit.targetRoomId
          ? this.worldMapManager.buildForestMapId(forestSeed, normalizedExit.targetRoomId)
          : null;
        targetWasCached = forestMapId ? mapCache.has(forestMapId) : null;
      }
      targetRoom = this.worldMapManager.resolveMapByExit(context.activeRoom, normalizedExit);
      targetEntrance = this.worldMapManager.getEntrance(targetRoom, normalizedExit.targetEntryId);
    } else if (normalizedExit.targetRoomId && normalizedExit.targetEntranceId) {
      targetWasCached = this.biomeGenerator?.hasCachedRoom?.(normalizedExit.targetRoomId) ?? null;
      targetRoom = this.biomeGenerator.loadRoom(normalizedExit.targetRoomId);
      targetEntrance = targetRoom?.entrances?.[normalizedExit.targetEntranceId];
    }

    this.log('prepareTransitionTarget resolved room target', {
      targetRoomId: targetRoom?.id ?? normalizedExit.targetRoomId ?? null,
      alreadyCached: targetWasCached,
      newlyGenerated: targetWasCached === false && Boolean(targetRoom),
    });

    const endMs = nowMs();
    this.markTimeline('map_lookup_end', {
      details: {
        targetRoomResolved: Boolean(targetRoom),
        targetEntranceResolved: Boolean(targetEntrance),
      },
    });
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

  getDebugSnapshot() {
    return {
      phase: this.phase,
      fadeAlpha: this.fadeAlpha,
      pendingExitId: typeof this.pendingExit === 'object' ? this.pendingExit?.id ?? null : this.pendingExit,
      loading: false,
      lastTransitionTimeline: this.lastTransitionTimeline,
      blockingHotspots: this.lastBlockingSummary,
    };
  }

  update(dt, context) {
    this.exitTriggerLockTimer = Math.max(0, this.exitTriggerLockTimer - dt);

    if (this.phase === 'idle') {
      const hitExitId = this.exitTriggerLockTimer > 0 ? null : this.detectExit(context.activeRoom, context.player);
      if (!hitExitId) return null;
      this.markTimeline('exit_trigger_detected');
      this.requestTransition(hitExitId);
      return null;
    }

    this.phaseTimer += dt;
    const progress = Math.min(1, this.phaseTimer / this.fadeDuration);
    const easedProgress = progress * progress * (3 - (2 * progress));

    if (this.phase === 'fadeOut') {
      this.fadeAlpha = easedProgress * this.maxFadeAlpha;
      if (this.fadeAlpha > 0 && !this.hasTimelineCheckpoint('fade_black_screen_start')) this.markTimeline('fade_black_screen_start');
      if (progress < 1) return null;
      this.fadeAlpha = this.maxFadeAlpha;
      const prepareStartMs = nowMs();
      this.preparedTransition = this.prepareTransitionTarget(context, this.pendingExit);
      this.logPhase('transition_target_prepare', prepareStartMs, nowMs(), {
        success: Boolean(this.preparedTransition?.targetRoom && this.preparedTransition?.targetEntrance),
      });
      if (!this.preparedTransition?.targetRoom || !this.preparedTransition?.targetEntrance) {
        this.log('FAIL: transition preparation failed');
        this.setPhase('fadeIn');
        this.phaseTimer = 0;
        this.pendingExit = null;
        this.preparedTransition = null;
        return null;
      }
      this.markTimeline('renderer_swap_start');
      const transitionResult = this.switchRoom(context, this.pendingExit);
      this.markTimeline('renderer_swap_end');
      this.setPhase('fadeIn');
      this.phaseTimer = 0;
      this.pendingExit = null;
      if (!transitionResult?.room) {
        this.preparedTransition = null;
      }
      return transitionResult;
    }

    if (this.phase === 'fadeIn') {
      this.fadeAlpha = (1 - easedProgress) * this.maxFadeAlpha;
      if (progress < 1) return null;
      this.setPhase('idle');
      this.phaseTimer = 0;
      this.fadeAlpha = 0;
      this.markTimeline('fade_end_map_visible');
      this.markTimeline('input_lock_end');
      this.markTimeline('player_control_restored');
      this.finalizeTimeline();
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
    const switchStartMs = nowMs();
    const switchProfile = {
      sections: {},
    };
    const markSection = (key, startMs) => {
      switchProfile.sections[key] = Number(((switchProfile.sections[key] ?? 0) + (nowMs() - startMs)).toFixed(3));
    };

    this.log('Transition trigger called', {
      exitRefType: typeof exitRef,
      exitId: typeof exitRef === 'object' ? exitRef?.id ?? null : exitRef,
    });
    const resolveStart = nowMs();
    const exit = this.resolveExit(context.activeRoom, exitRef);
    markSection('resolve_exit', resolveStart);
    if (!exit) {
      this.log('FAIL: transition called but failed — exit could not be resolved', { exitRef });
      return null;
    }

    const targetResolveStart = nowMs();
    const prepared = this.preparedTransition?.fromRoomId === context.activeRoom?.id
      && (this.preparedTransition?.exit?.id ?? null) === (exit?.id ?? null)
      ? this.preparedTransition
      : null;
    if (!prepared) {
      throw new Error('❌ Transition attempted without prewarmed room');
    }
    markSection('resolve_target', targetResolveStart);
    const normalizedExit = prepared?.normalizedExit ?? this.normalizeExit(context.activeRoom, exit);
    const targetRoom = prepared?.targetRoom ?? null;
    const targetEntrance = prepared?.targetEntrance ?? null;
    this.log('switchRoom entered', {
      roomId: targetRoom?.id ?? normalizedExit?.targetRoomId ?? null,
      preparedTransitionExists: Boolean(prepared),
    });

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

    this.markTimeline('room_activation_start');
    context.activeRoom.state.visited = true;
    targetRoom.state = targetRoom.state ?? {};
    targetRoom.state.visited = true;

    const spawnResolveStart = nowMs();
    const preferredSpawn = getEntranceSpawnTarget(targetRoom, targetEntrance);
    const cache = getRoomTransitionCache(targetRoom);
    if (!cache) return null;
    const spawnKey = entranceSpawnCacheKey(targetEntrance, preferredSpawn.x, preferredSpawn.y);
    const spawn = cache.spawnByEntrance.get(spawnKey);
    if (!spawn) {
      this.log('FAIL: transition called but failed — missing precomputed spawn for entrance', {
        roomId: targetRoom?.id ?? null,
        entranceId: targetEntrance?.id ?? null,
        spawnKey,
      });
      return null;
    }
    markSection('resolve_spawn', spawnResolveStart);

    const playerUpdateStart = nowMs();
    context.player.x = spawn.x;
    context.player.y = spawn.y;
    markSection('player_state_update', playerUpdateStart);
    this.newRoomActivatedAtMs = nowMs();
    this.markTimeline('room_activation_end', {
      details: {
        fromRoomId: context.activeRoom?.id ?? null,
        toRoomId: targetRoom?.id ?? null,
      },
    });

    this.log('Transition succeeded', { fromRoomId: context.activeRoom?.id ?? null, toRoomId: targetRoom?.id ?? null, spawn });
    const switchEndMs = nowMs();
    if (this.profilingEnabled) console.info('[TransitionTimingDetailed]', {
      phase: 'switch_room_internal',
      fromRoomId: context.activeRoom?.id ?? null,
      toRoomId: targetRoom?.id ?? null,
      totalDurationMs: Number((switchEndMs - switchStartMs).toFixed(3)),
      sections: switchProfile.sections,
    });
    this.exitTriggerLockTimer = 0.2;

    return {
      room: targetRoom,
    };
  }

}
