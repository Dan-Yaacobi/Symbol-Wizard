import { ensureEntityFacing } from './FacingSystem.js';
import { tryInteract } from './InteractionSystem.js';

function objectCollisionNodes(object) {
  if (Array.isArray(object.footprint) && object.footprint.length > 0) {
    return object.footprint.map(([ox, oy]) => ({ x: object.x + ox, y: object.y + oy, radius: 0.7 }));
  }
  return [{ x: object.x, y: object.y, radius: object.radius ?? 1 }];
}

export function objectIntersectsCircle(object, x, y, radius = 0.7) {
  for (const node of objectCollisionNodes(object)) {
    const dx = x - node.x;
    const dy = y - node.y;
    const reach = radius + node.radius;
    if (dx * dx + dy * dy <= reach * reach) return true;
  }
  return false;
}

export function applyAttackToObject(object, damage = 1) {
  if (!object?.attackable || object.destroyed) return { destroyed: false, damaged: false };
  if (!Number.isFinite(object.health)) object.health = object.maxHealth ?? 1;
  object.health = Math.max(0, object.health - damage);
  if (object.health > 0) return { destroyed: false, damaged: true };
  object.destroyed = true;
  object.collision = false;
  object.attackable = false;
  object.interactable = false;
  object.isInteractable = false;
  object.breakDuration = Number.isFinite(object.breakDuration) ? object.breakDuration : 0.28;
  object.breakTimer = object.breakDuration;
  return { destroyed: true, damaged: true };
}

export function tryInteractInFront(player, worldObjects, context = {}) {
  const facing = ensureEntityFacing(player);
  const positions = [
    { x: Math.round(player.x), y: Math.round(player.y) },
    { x: Math.round(player.x + facing.x), y: Math.round(player.y + facing.y) },
  ];

  const result = tryInteract({
    actor: player,
    room: context.activeRoom ?? { objects: worldObjects },
    positions,
    triggerMode: 'button',
    context,
    debug: context.debug ?? null,
  });

  return result.success ? result : null;
}

export function rollObjectLoot(object) {
  const table = Array.isArray(object?.lootTable) ? object.lootTable : [];
  if (table.length === 0) return null;
  const entry = table[Math.floor(Math.random() * table.length)];
  const min = Number.isFinite(entry.min) ? entry.min : 1;
  const max = Number.isFinite(entry.max) ? entry.max : min;
  return {
    type: entry.type ?? 'minor-item',
    x: object.x,
    y: object.y,
    radius: 1.2,
    amount: min + Math.floor(Math.random() * (Math.max(min, max) - min + 1)),
  };
}
