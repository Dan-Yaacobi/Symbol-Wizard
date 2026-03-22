export function objectOccupiesTile(object, x, y) {
  if (!object) return false;
  const footprint = object.footprint ?? object.logicalShape?.tiles ?? [[0, 0]];
  return footprint.some((cell) => {
    const dx = Array.isArray(cell) ? cell[0] : cell.x;
    const dy = Array.isArray(cell) ? cell[1] : cell.y;
    return Math.round(object.x + dx) === x && Math.round(object.y + dy) === y;
  });
}

function buildDebugLogger(debug) {
  if (typeof debug === 'function') return debug;
  if (!debug?.enabled) return () => {};
  const prefix = debug.prefix ?? '[InteractableResolver]';
  return (message, details) => {
    if (details === undefined) console.info(prefix, message);
    else console.info(prefix, message, details);
  };
}

function normalizeExitInteractable(exit, x, y) {
  const targetMap = exit?.targetMapType ?? null;
  const targetBiome = exit?.targetRoomId ?? null;
  return {
    id: exit?.id ?? `exit-${x}-${y}`,
    x,
    y,
    category: 'interactable',
    isInteractable: true,
    interactable: true,
    interactionType: 'exit',
    targetMap,
    targetBiome,
    targetEntryId: exit?.targetEntryId ?? null,
    targetEntranceId: exit?.targetEntranceId ?? null,
    exitRef: exit,
    source: 'exit',
  };
}

function normalizeObjectInteractable(object) {
  return {
    ...object,
    category: 'interactable',
    isInteractable: true,
    source: 'object',
  };
}

export function getInteractableAt(room, x, y, debug = null) {
  const log = buildDebugLogger(debug);
  const tx = Math.round(x);
  const ty = Math.round(y);
  const tile = room?.tiles?.[ty]?.[tx] ?? null;
  log('Tile lookup', { x: tx, y: ty, tile });
  if (!tile) {
    log('FAIL: tile lookup — no tile at coordinates', { x: tx, y: ty });
    return null;
  }

  const object = (room?.objects ?? []).find((candidate) => !candidate?.destroyed && objectOccupiesTile(candidate, tx, ty)) ?? null;
  log('Object lookup', {
    x: tx,
    y: ty,
    object: object ? {
      id: object.id ?? null,
      type: object.type ?? null,
      category: object.category ?? null,
      interactable: object.interactable ?? null,
      interactionType: object.interactionType ?? null,
    } : null,
  });

  if (object?.interactable) {
    const interactable = normalizeObjectInteractable(object);
    log('Exit/interactable detection', { x: tx, y: ty, source: interactable.source, id: interactable.id ?? interactable.type ?? null });
    return interactable;
  }

  const exits = Array.isArray(room?.exits)
    ? room.exits
    : Object.entries(room?.exits ?? {}).map(([id, exit]) => ({ id, ...exit }));
  const corridor = (room?.exitCorridors ?? []).find((candidate) => (candidate?.triggerTiles ?? []).some((tilePos) => tilePos.x === tx && tilePos.y === ty)) ?? null;
  const exit = corridor ? (exits.find((candidate) => candidate.id === corridor.exitId) ?? null) : null;

  if (corridor && !exit) {
    log('FAIL: interactable resolution — exit corridor found but exit definition missing', { x: tx, y: ty, exitId: corridor.exitId });
    return null;
  }

  if (!exit) {
    log('FAIL: interactable resolution — no interactable object or exit at tile', { x: tx, y: ty });
    return null;
  }

  const interactable = normalizeExitInteractable(exit, tx, ty);
  if (!interactable.targetMap && !interactable.targetBiome) {
    log('FAIL: exit detection — exit missing targetMap/targetBiome', { x: tx, y: ty, exitId: interactable.id });
    return null;
  }

  log('Exit/interactable detection', {
    x: tx,
    y: ty,
    source: interactable.source,
    id: interactable.id,
    targetMap: interactable.targetMap,
    targetBiome: interactable.targetBiome,
  });
  return interactable;
}
