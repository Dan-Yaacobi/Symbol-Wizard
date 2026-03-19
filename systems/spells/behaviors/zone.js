export function executeBehavior(instance, context) {
  const system = context?.system;
  const targetPosition = context?.targetPosition;
  if (!system || !targetPosition) return false;

  const radius = Number.isFinite(instance.parameters?.radius) ? instance.parameters.radius : 4;
  const duration = Number.isFinite(instance.parameters?.duration) ? instance.parameters.duration : 1;
  const tickInterval = Number.isFinite(instance.parameters?.tickInterval) ? instance.parameters.tickInterval : 0.25;
  const damage = Number.isFinite(instance.parameters?.damage) ? instance.parameters.damage : 1;

  instance.state.cast = { originX: targetPosition.x, originY: targetPosition.y, dirX: 1, dirY: 0 };
  instance.state.zone = {
    x: targetPosition.x,
    y: targetPosition.y,
    radius,
    tickInterval,
    tickAccumulator: 0,
    damage,
  };
  instance.state.lifetime = duration;

  system.spawnEffect({
    type: 'burst',
    x: targetPosition.x,
    y: targetPosition.y,
    radius,
    ttl: duration,
    color: instance.parameters?.color ?? '#cfe7ff',
  });

  return true;
}
