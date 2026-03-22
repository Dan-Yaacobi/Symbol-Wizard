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

export function getInteractableAt(room, x, y, debug = null) {
  return getBestInteractableAt(room, x, y, { debug }) ?? null;
}
