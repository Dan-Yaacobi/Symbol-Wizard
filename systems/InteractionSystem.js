function buildDebugLogger(debug) {
  if (typeof debug === 'function') return debug;
  if (!debug?.enabled) return () => {};
  const prefix = debug.prefix ?? '[InteractionSystem]';
  return (message, details) => {
    if (details === undefined) console.info(prefix, message);
    else console.info(prefix, message, details);
  };
}

function normalizeMode(mode, fallback = 'button') {
  return mode === 'touch' || mode === 'button' || mode === 'either' ? mode : fallback;
}

function normalizePriority(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function objectOccupiesTile(object, x, y) {
  if (!object) return false;
  const footprint = object.footprint ?? object.logicalShape?.tiles ?? [[0, 0]];
  return footprint.some((cell) => {
    const dx = Array.isArray(cell) ? cell[0] : cell.x;
    const dy = Array.isArray(cell) ? cell[1] : cell.y;
    return Math.round(object.x + dx) === x && Math.round(object.y + dy) === y;
  });
}

function normalizeBaseInteraction({ sourceType, source, x, y, defaults = {} }) {
  const normalized = {
    sourceType,
    sourceId: source?.id ?? source?.type ?? `${sourceType}-${x}-${y}`,
    id: String(source?.id ?? source?.type ?? `${sourceType}-${x}-${y}`),
    category: String(source?.category ?? defaults.category ?? 'interactable'),
    isInteractable: Boolean(source?.isInteractable ?? source?.interactable ?? defaults.isInteractable ?? false),
    interactionType: String(source?.interactionType ?? defaults.interactionType ?? 'none'),
    interactionMode: normalizeMode(source?.interactionMode ?? defaults.interactionMode, defaults.interactionMode ?? 'button'),
    interactionPriority: normalizePriority(source?.interactionPriority, defaults.interactionPriority ?? 0),
    interactionData: {
      ...(defaults.interactionData ?? {}),
      ...(source?.interactionData ?? {}),
    },
    x,
    y,
    source,
  };
  return normalized;
}

function normalizeTileInteractable(tile, x, y) {
  const raw = tile?.interaction ?? tile?.interactable ?? null;
  if (!raw || typeof raw !== 'object') return null;
  return normalizeBaseInteraction({
    sourceType: 'tile',
    source: raw,
    x,
    y,
    defaults: {
      category: tile?.category ?? 'interactable',
      isInteractable: true,
      interactionMode: 'touch',
      interactionPriority: 0,
      interactionData: raw,
    },
  });
}

function normalizeObjectInteractable(object, x, y) {
  return normalizeBaseInteraction({
    sourceType: 'object',
    source: object,
    x,
    y,
    defaults: {
      category: object?.category ?? 'interactable',
      isInteractable: Boolean(object?.isInteractable ?? object?.interactable),
      interactionType: object?.interactionType ?? 'none',
      interactionMode: object?.interactionMode ?? 'button',
      interactionPriority: object?.interactionPriority ?? 0,
      interactionData: object?.interactionData ?? {},
    },
  });
}

function normalizeEntityInteractable(entity, x, y) {
  return normalizeBaseInteraction({
    sourceType: 'entity',
    source: entity,
    x,
    y,
    defaults: {
      category: entity?.category ?? entity?.type ?? 'interactable',
      isInteractable: Boolean(entity?.isInteractable ?? entity?.interactable),
      interactionType: entity?.interactionType ?? 'none',
      interactionMode: entity?.interactionMode ?? 'button',
      interactionPriority: entity?.interactionPriority ?? 0,
      interactionData: entity?.interactionData ?? {},
    },
  });
}

function normalizeExitInteractable(exit, x, y) {
  return normalizeBaseInteraction({
    sourceType: 'object',
    source: exit,
    x,
    y,
    defaults: {
      category: 'interactable',
      isInteractable: true,
      interactionType: 'exit',
      interactionMode: 'touch',
      interactionPriority: 100,
      interactionData: {
        targetMap: exit?.targetMap ?? exit?.targetMapType ?? null,
        targetBiome: exit?.targetBiome ?? exit?.targetRoomId ?? null,
        targetExitId: exit?.targetExitId ?? null,
        targetEntryId: exit?.targetEntryId ?? exit?.targetEntranceId ?? null,
        targetEntranceId: exit?.targetEntranceId ?? null,
        targetSeed: exit?.targetSeed ?? null,
        meta: exit?.meta ?? null,
      },
    },
  });
}

function collectExitAt(room, x, y) {
  const exits = Array.isArray(room?.exits)
    ? room.exits
    : Object.entries(room?.exits ?? {}).map(([id, exit]) => ({ id, ...exit }));

  const directExit = exits.find((candidate) => {
    const position = candidate?.position ?? null;
    return Math.round(position?.x ?? Number.NaN) === x && Math.round(position?.y ?? Number.NaN) === y;
  }) ?? null;
  if (directExit) return normalizeExitInteractable(directExit, x, y);

  const corridor = (room?.exitCorridors ?? []).find((candidate) => (candidate?.triggerTiles ?? []).some((tilePos) => tilePos.x === x && tilePos.y === y)) ?? null;
  if (!corridor) return null;
  const exit = exits.find((candidate) => candidate.id === corridor.exitId) ?? null;
  return exit ? normalizeExitInteractable(exit, x, y) : null;
}

export function getInteractablesAt(room, x, y, options = {}) {
  const log = buildDebugLogger(options.debug ?? null);
  const tx = Math.round(x);
  const ty = Math.round(y);
  const interactables = [];
  const tile = room?.tiles?.[ty]?.[tx] ?? null;

  const tileInteractable = normalizeTileInteractable(tile, tx, ty);
  if (tileInteractable?.isInteractable) interactables.push(tileInteractable);

  for (const object of room?.objects ?? []) {
    if (object?.destroyed || !objectOccupiesTile(object, tx, ty)) continue;
    const normalized = normalizeObjectInteractable(object, tx, ty);
    if (normalized.isInteractable) interactables.push(normalized);
  }

  for (const entity of [...(room?.entities ?? []), ...(room?.npcs ?? [])]) {
    if (!entity || Math.round(entity.x) !== tx || Math.round(entity.y) !== ty) continue;
    const normalized = normalizeEntityInteractable(entity, tx, ty);
    if (normalized.isInteractable) interactables.push(normalized);
  }

  const exitInteractable = collectExitAt(room, tx, ty);
  if (exitInteractable?.isInteractable) interactables.push(exitInteractable);

  log('Interactables collected', {
    position: { x: tx, y: ty },
    count: interactables.length,
    interactables: interactables.map((entry) => ({
      id: entry.id,
      sourceType: entry.sourceType,
      interactionType: entry.interactionType,
      interactionMode: entry.interactionMode,
      interactionPriority: entry.interactionPriority,
    })),
  });

  return interactables;
}

function supportsTriggerMode(interactable, triggerMode) {
  return interactable.interactionMode === 'either' || interactable.interactionMode === triggerMode;
}

export function getBestInteractableAt(room, x, y, options = {}) {
  const interactables = getInteractablesAt(room, x, y, options);
  const triggerMode = options.triggerMode ?? null;
  const filtered = triggerMode ? interactables.filter((entry) => supportsTriggerMode(entry, triggerMode)) : interactables;
  return [...filtered].sort((a, b) => b.interactionPriority - a.interactionPriority)[0] ?? null;
}

export function getNearbyInteractables(room, x, y, radius = 1, options = {}) {
  const matches = [];
  for (let ty = Math.round(y - radius); ty <= Math.round(y + radius); ty += 1) {
    for (let tx = Math.round(x - radius); tx <= Math.round(x + radius); tx += 1) {
      matches.push(...getInteractablesAt(room, tx, ty, options));
    }
  }
  return matches;
}

function validateInteractable(interactable, log) {
  if (!interactable) return { valid: false, reason: 'missing_interactable' };
  if (!interactable.isInteractable) return { valid: false, reason: 'not_interactable' };
  if (!interactable.id) {
    console.warn('[InteractionSystem] Malformed interactable skipped', { id: interactable.id ?? null, interactionType: interactable.interactionType ?? null, reason: 'missing id' });
    log('Malformed interactable skipped', { id: interactable.id ?? null, interactionType: interactable.interactionType ?? null, reason: 'missing id' });
    return { valid: false, reason: 'missing_id' };
  }
  if (!interactable.interactionType || interactable.interactionType === 'none') {
    console.warn('[InteractionSystem] Malformed interactable skipped', { id: interactable.id, interactionType: interactable.interactionType ?? null, reason: 'missing interactionType' });
    log('Malformed interactable skipped', { id: interactable.id, interactionType: interactable.interactionType ?? null, reason: 'missing interactionType' });
    return { valid: false, reason: 'missing_interaction_type' };
  }
  return { valid: true };
}

function buildResult(overrides = {}) {
  return {
    success: false,
    reason: 'unhandled',
    interactionType: null,
    targetId: null,
    ...overrides,
  };
}

const interactionHandlers = {
  exit(interactable, actor, context = {}) {
    const data = interactable.interactionData ?? {};
    if (!data.targetMap && !data.targetBiome) {
      return buildResult({ success: false, reason: 'missing_exit_target', interactionType: 'exit', targetId: interactable.id });
    }
    context.transitionSystem?.requestTransition(interactable.source ?? interactable);
    return buildResult({ success: true, reason: 'transition_requested', interactionType: 'exit', targetId: interactable.id });
  },
  dialogue(interactable, actor, context = {}) {
    if (!context.dialogueManager) {
      return buildResult({ success: false, reason: 'missing_dialogue_manager', interactionType: 'dialogue', targetId: interactable.id });
    }
    context.dialogueManager.openDialogue(interactable.source, interactable);
    return buildResult({ success: true, reason: 'dialogue_opened', interactionType: 'dialogue', targetId: interactable.id });
  },
  door(interactable, actor, context = {}) {
    const data = interactable.interactionData ?? {};
    if (data.locked && (!data.keyId || !actor?.hasItem?.(data.keyId))) {
      return buildResult({ success: false, reason: 'door_locked', interactionType: 'door', targetId: interactable.id });
    }
    if (data.targetRoom || data.targetMap || data.targetBiome) {
      context.transitionSystem?.requestTransition(interactable.source ?? interactable);
      return buildResult({ success: true, reason: 'door_transition_requested', interactionType: 'door', targetId: interactable.id });
    }
    interactable.source.state = interactable.source.state ?? {};
    interactable.source.state.opened = true;
    return buildResult({ success: true, reason: 'door_opened', interactionType: 'door', targetId: interactable.id });
  },
  loot(interactable) {
    interactable.source.state = interactable.source.state ?? {};
    if (interactable.source.state.opened) {
      return buildResult({ success: false, reason: 'already_opened', interactionType: 'loot', targetId: interactable.id });
    }
    interactable.source.state.opened = true;
    return buildResult({ success: true, reason: 'loot_opened', interactionType: 'loot', targetId: interactable.id });
  },
  shrine(interactable) {
    interactable.source.state = interactable.source.state ?? {};
    interactable.source.state.activated = true;
    return buildResult({ success: true, reason: 'shrine_activated', interactionType: 'shrine', targetId: interactable.id });
  },
  pickup(interactable) {
    interactable.source.state = interactable.source.state ?? {};
    interactable.source.state.collected = true;
    return buildResult({ success: true, reason: 'pickup_collected', interactionType: 'pickup', targetId: interactable.id });
  },
  activate(interactable) {
    interactable.source.state = interactable.source.state ?? {};
    interactable.source.state.activated = true;
    return buildResult({ success: true, reason: 'activated', interactionType: 'activate', targetId: interactable.id });
  },
  rest(interactable) {
    interactable.source.state = interactable.source.state ?? {};
    interactable.source.state.rested = true;
    return buildResult({ success: true, reason: 'rested', interactionType: 'rest', targetId: interactable.id });
  },
  heal(interactable) {
    interactable.source.state = interactable.source.state ?? {};
    interactable.source.state.used = true;
    return buildResult({ success: true, reason: 'healed', interactionType: 'heal', targetId: interactable.id });
  },
  message(interactable) {
    interactable.source.state = interactable.source.state ?? {};
    interactable.source.state.read = true;
    return buildResult({ success: true, reason: 'message_read', interactionType: 'message', targetId: interactable.id });
  },
};

export function executeInteraction(interactable, actor, context = {}) {
  const log = buildDebugLogger(context.debug ?? null);
  const validation = validateInteractable(interactable, log);
  if (!validation.valid) {
    const result = buildResult({ success: false, reason: validation.reason, interactionType: interactable?.interactionType ?? null, targetId: interactable?.id ?? null });
    log('Interaction validation failed', result);
    return result;
  }

  const handler = interactionHandlers[interactable.interactionType];
  if (!handler) {
    const result = buildResult({ success: false, reason: 'missing_handler', interactionType: interactable.interactionType, targetId: interactable.id });
    log('Interaction handler missing', result);
    return result;
  }

  const result = handler(interactable, actor, context);
  log('Interaction executed', { interactableId: interactable.id, interactionType: interactable.interactionType, result });
  return result;
}

export function tryInteract({ actor, room, positions = [], triggerMode, context = {}, debug = null }) {
  const log = buildDebugLogger(debug ?? context.debug ?? null);
  const normalizedPositions = positions.filter(Boolean).map((position) => ({ x: Math.round(position.x), y: Math.round(position.y) }));

  log('Interaction attempt started', {
    actor: actor?.id ?? actor?.type ?? 'actor',
    triggerMode,
    positions: normalizedPositions,
  });

  const discovered = normalizedPositions.flatMap((position) => getInteractablesAt(room, position.x, position.y, { debug: null }));
  log('Interactables discovered', discovered.map((entry) => ({
    id: entry.id,
    position: { x: entry.x, y: entry.y },
    interactionType: entry.interactionType,
    interactionMode: entry.interactionMode,
    interactionPriority: entry.interactionPriority,
  })));

  const valid = discovered.filter((entry) => supportsTriggerMode(entry, triggerMode));
  log('Valid interactables after mode filter', valid.map((entry) => ({
    id: entry.id,
    interactionType: entry.interactionType,
    interactionMode: entry.interactionMode,
    interactionPriority: entry.interactionPriority,
  })));

  const selected = [...valid].sort((a, b) => b.interactionPriority - a.interactionPriority)[0] ?? null;
  if (!selected) {
    const result = buildResult({ success: false, reason: 'no_valid_interactable' });
    log('Interaction attempt failed', result);
    return result;
  }

  log('Selected interactable', {
    id: selected.id,
    sourceType: selected.sourceType,
    interactionType: selected.interactionType,
    interactionPriority: selected.interactionPriority,
    position: { x: selected.x, y: selected.y },
  });

  return executeInteraction(selected, actor, { ...context, debug: debug ?? context.debug ?? null });
}

export { interactionHandlers };
