function resolveAreaOrigin(context = {}) {
  const origin = context?.origin ?? context?.player;
  if (origin && Number.isFinite(origin.x) && Number.isFinite(origin.y)) return origin;
  return null;
}

export function executeBehavior(instance, context) {
  const system = context?.system;
  const origin = resolveAreaOrigin(context);
  if (!system || !origin) return false;

  const radius = Number.isFinite(instance.parameters?.radius) ? instance.parameters.radius : 5;
  const duration = Number.isFinite(instance.parameters?.duration) ? instance.parameters.duration : 0.6;
  const tickInterval = Number.isFinite(instance.parameters?.tickInterval)
    ? instance.parameters.tickInterval
    : (Number.isFinite(instance.parameters?.tickRate) ? instance.parameters.tickRate : 0.2);
  const damage = Number.isFinite(instance.parameters?.damage) ? instance.parameters.damage : 1;
  const dirX = Number.isFinite(origin.facingX) ? origin.facingX : 1;
  const dirY = Number.isFinite(origin.facingY) ? origin.facingY : 0;

  instance.state.cast = {
    originX: origin.x,
    originY: origin.y,
    dirX,
    dirY,
  };
  instance.state.zone = {
    x: origin.x,
    y: origin.y,
    radius,
    tickInterval,
    tickAccumulator: 0,
    damage,
    followSource: true,
    source: origin,
  };
  instance.state.lifetime = duration;

  system.spawnEffect?.({
    type: 'burst',
    x: origin.x,
    y: origin.y,
    radius,
    ttl: duration,
    color: instance.parameters?.color ?? '#f3b178',
  });

  return true;
}
