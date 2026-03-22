import {
  getInteractablesAt,
  getBestInteractableAt,
  getNearbyInteractables,
} from '../systems/InteractionSystem.js';

export { getInteractablesAt, getBestInteractableAt, getNearbyInteractables };

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
  const targetMap = exit?.targetMapType ?? exit?.interactionData?.targetType ?? null;
  const targetBiome = exit?.targetRoomId ?? exit?.interactionData?.targetId ?? null;
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
    targetEntryId: exit?.targetEntryId ?? exit?.interactionData?.entryId ?? null,
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
  return getBestInteractableAt(room, x, y, { debug }) ?? null;
}
