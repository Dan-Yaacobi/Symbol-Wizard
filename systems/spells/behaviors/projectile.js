export function executeBehavior(instance, context) {
  const system = context?.system;
  const origin = context?.origin ?? context?.player;
  const targetPosition = context?.targetPosition;
  if (!system || !origin || !targetPosition) return false;

  const dx = targetPosition.x - origin.x;
  const dy = targetPosition.y - origin.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length === 0) return false;

  const projectile = system.createProjectile(origin.x, origin.y, dx / length, dy / length, {
    speed: instance.parameters?.speed ?? 65,
    damage: instance.parameters?.damage ?? 3,
    ttl: instance.parameters?.ttl ?? 0.9,
    radius: instance.parameters?.size ?? 1.1,
    color: instance.parameters?.color ?? '#8fe8ff',
    hitParticleColor: instance.parameters?.hitParticleColor,
    spriteFrames: instance.parameters?.spriteFrames,
    spellInstance: instance,
    onHit: (hitData) => {
      instance.state.hasHit = true;
      for (const component of context.components) {
        component.hooks?.onHit?.(instance, hitData);
      }
    },
  });

  const projectileTtl = Number.isFinite(projectile?.ttl) ? projectile.ttl : null;
  const behaviorDuration = Number.isFinite(instance.parameters?.duration) ? instance.parameters.duration : null;
  instance.state.lifetime = projectileTtl ?? behaviorDuration ?? 1;

  return Boolean(projectile);
}
