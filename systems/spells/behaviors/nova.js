export function executeBehavior(instance, context) {
  const system = context?.system;
  const origin = context?.origin ?? context?.player;
  if (!system || !origin) return false;

  const radius = Number.isFinite(instance.parameters?.radius)
    ? instance.parameters.radius
    : 3;

  const damage = Number.isFinite(instance.parameters?.damage)
    ? instance.parameters.damage
    : 3;

  const targets = system.getEntitiesInRadius(origin.x, origin.y, radius);

  targets.forEach(target => {
    // apply base damage
    system.applyDamage(target, damage);

    // trigger spell system
    instance.handleEvent('onHit', {
      x: target.x,
      y: target.y,
      target,
      system,
      instance,
    });
  });

  // short lifetime since it's instant
  instance.state.lifetime = 0;

  return targets.length > 0;
}
