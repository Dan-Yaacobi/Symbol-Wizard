export function executeBehavior(instance, context) {
  const system = context?.system;
  const origin = context?.origin ?? context?.player;
  if (!system || !origin) return false;

  const count = Number.isFinite(instance.parameters?.count) ? Math.max(1, Math.floor(instance.parameters.count)) : 8;
  const speed = Number.isFinite(instance.parameters?.speed) ? instance.parameters.speed : 65;
  const damage = Number.isFinite(instance.parameters?.damage) ? instance.parameters.damage : 3;
  const ttl = Number.isFinite(instance.parameters?.ttl) ? instance.parameters.ttl : (Number.isFinite(instance.parameters?.lifetime) ? instance.parameters.lifetime : 0.9);

  let spawnCount = 0;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    const projectile = system.createProjectile(origin.x, origin.y, dx, dy, {
      speed,
      damage,
      ttl,
      radius: instance.parameters?.size ?? 1.1,
      color: instance.parameters?.color ?? '#c7d9ff',
      hitParticleColor: instance.parameters?.hitParticleColor,
      spriteFrames: instance.parameters?.spriteFrames,
      pierce: Boolean(instance.parameters?.pierce),
      pierceCount: Number.isFinite(instance.parameters?.pierceCount) ? instance.parameters.pierceCount : null,
      spellInstance: instance,
      onHit: (payload) => {
        if (!instance.parameters?.pierce) instance.state.hasHit = true;
        instance.handleEvent('onHit', payload);
      },
    });

    if (!projectile) continue;
    projectile.spellInstance = instance;
    spawnCount += 1;
  }

  instance.state.lifetime = ttl;
  return spawnCount > 0;
}
