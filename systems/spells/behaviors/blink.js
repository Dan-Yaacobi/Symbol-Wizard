function resolveBlinkDestination(origin, targetPosition, maxRange) {
  const dx = targetPosition.x - origin.x;
  const dy = targetPosition.y - origin.y;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance <= 0) return { x: origin.x, y: origin.y };

  const clamped = Math.min(maxRange, distance);
  return {
    x: origin.x + (dx / distance) * clamped,
    y: origin.y + (dy / distance) * clamped,
  };
}

export function executeBehavior(instance, context) {
  const system = context?.system;
  const origin = context?.origin ?? context?.player;
  const targetPosition = context?.targetPosition;
  if (!system || !origin || !targetPosition) return false;

  const maxRange = Number.isFinite(instance.parameters?.range)
    ? Math.max(0, instance.parameters.range)
    : 9;
  const startX = origin.x;
  const startY = origin.y;
  const destination = resolveBlinkDestination(origin, targetPosition, maxRange);
  const destinationIsWalkable = system.isWalkable?.(destination.x, destination.y);
  if (!destinationIsWalkable) return false;

  origin.x = destination.x;
  origin.y = destination.y;

  instance.state.cast = {
    originX: startX,
    originY: startY,
    destinationX: destination.x,
    destinationY: destination.y,
  };
  instance.state.hasHit = true;
  instance.state.shouldExpire = true;
  instance.state.lifetime = 0.01;

  system.spawnEffect?.({
    type: 'burst',
    x: destination.x,
    y: destination.y,
    radius: 1.8,
    ttl: 0.12,
    color: instance.parameters?.color ?? '#b39bff',
  });

  return true;
}
