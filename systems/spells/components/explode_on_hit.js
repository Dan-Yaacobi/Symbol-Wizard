export const explodeOnHitComponent = {
  id: 'explode_on_hit',
  type: 'trigger',
  stacking: 'ignore',
  onHit(payload, instance) {
    const { x, y, system } = payload ?? {};
    if (!system || !Number.isFinite(x) || !Number.isFinite(y)) return;

    console.log('[COMPONENT TRIGGER]', 'explode_on_hit');

    const radius = 2;
    const targets = system.getEntitiesInRadius(x, y, radius);

    targets.forEach((target) => {
      system.applyDamage(target, instance.config?.damage ?? instance.parameters?.damage ?? 0);
    });
  },
};
