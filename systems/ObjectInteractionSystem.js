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
  object.breakDuration = Number.isFinite(object.breakDuration) ? object.breakDuration : 0.28;
  object.breakTimer = object.breakDuration;
  return { destroyed: true, damaged: true };
}

export function interactWithObject(object, context = {}) {
  if (!object?.interactable || object.destroyed) return false;
  if (object.interactionType === 'activate') {
    object.state.activated = true;
    return true;
  }
  if (object.interactionType === 'open') {
    if (object.state.opened) return false;
    object.state.opened = true;
    return true;
  }
  if (object.interactionType === 'rest') {
    object.state.rested = true;
    return true;
  }
  if (object.interactionType === 'heal') {
    object.state.used = true;
    return true;
  }
  if (object.interactionType === 'message') {
    object.state.read = true;
    return true;
  }
  if (typeof object.interact === 'function') {
    object.interact(context);
    return true;
  }
  return false;
}

export function tryInteractInFront(player, worldObjects, reach = 2.4) {
  const facing = player.facing ?? { x: 0, y: 1 };
  const probeX = Math.round(player.x + facing.x);
  const probeY = Math.round(player.y + facing.y);

  let best = null;
  let bestDist = Infinity;
  for (const object of worldObjects) {
    if (object.destroyed || !object.interactable) continue;
    if (!objectIntersectsCircle(object, probeX, probeY, 0.8)) continue;
    const distance = Math.hypot(object.x - player.x, object.y - player.y);
    if (distance > reach || distance >= bestDist) continue;
    best = object;
    bestDist = distance;
  }

  if (!best) return null;
  const handled = interactWithObject(best, { player });
  return handled ? best : null;
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
