export function executeBehavior(instance, context) {
  const system = context?.system;
  const origin = context?.origin ?? context?.player;
  if (!system || !origin) return false;

  const radius = Number.isFinite(instance.parameters?.radius) ? Math.max(0.1, instance.parameters.radius) : 3;
  const speed = Number.isFinite(instance.parameters?.speed) ? instance.parameters.speed : 2.5;
  const count = Number.isFinite(instance.parameters?.count) ? Math.max(1, Math.floor(instance.parameters.count)) : 3;
  const duration = Number.isFinite(instance.parameters?.duration) ? Math.max(0.05, instance.parameters.duration) : 2;

  instance.state.orbit = {
    radius,
    speed,
    count,
    damage: Number.isFinite(instance.parameters?.damage) ? instance.parameters.damage : 1,
    hitRadius: Number.isFinite(instance.parameters?.hitRadius) ? Math.max(1.15, instance.parameters.hitRadius) : 1.15,
    currentAngle: 0,
    hitCooldown: Number.isFinite(instance.parameters?.hitCooldown) ? Math.max(0, instance.parameters.hitCooldown) : 0.12,
    recentHits: new Map(),
    caster: origin,
    orbs: Array.from({ length: count }, (_, index) => ({
      phase: (Math.PI * 2 * index) / count,
      x: origin.x,
      y: origin.y,
    })),
  };
  instance.state.lifetime = duration;

  return true;
}

export function updateOrbitBehavior(instance, dt, context = {}) {
  if (instance?.base?.behavior !== 'orbit') return;
  const system = context?.system;
  const orbitState = instance.state?.orbit;
  if (!system || !orbitState) return;

  const caster = orbitState.caster ?? context?.player;
  if (!caster) return;

  orbitState.currentAngle += orbitState.speed * dt;

  for (const [target, remaining] of orbitState.recentHits.entries()) {
    const next = remaining - dt;
    if (next <= 0 || !target?.alive) {
      orbitState.recentHits.delete(target);
    } else {
      orbitState.recentHits.set(target, next);
    }
  }

  for (const orb of orbitState.orbs) {
    const angle = orbitState.currentAngle + orb.phase;
    orb.x = caster.x + Math.cos(angle) * orbitState.radius;
    orb.y = caster.y + Math.sin(angle) * orbitState.radius;

    const queryRadius = orbitState.hitRadius + 2.5;
    const targets = system.getEntitiesInRadius(orb.x, orb.y, queryRadius);
    for (const target of targets) {
      if (orbitState.recentHits.has(target)) continue;
      if (!target?.alive) continue;
      const targetRadius = Number.isFinite(target.radius) ? Math.max(0, target.radius) : 0;
      const distance = Math.hypot((target.x ?? 0) - orb.x, (target.y ?? 0) - orb.y);
      if (distance > orbitState.hitRadius + targetRadius) continue;

      system.applySpellDamage(target, orbitState.damage, {
        eventName: 'onHit',
        instance,
        sourceX: orb.x,
        sourceY: orb.y,
        hitParticleColor: instance.parameters?.hitParticleColor,
      });
      orbitState.recentHits.set(target, orbitState.hitCooldown);

      instance.handleEvent('onHit', {
        x: orb.x,
        y: orb.y,
        target,
        system,
        instance,
      });
    }
  }
}
