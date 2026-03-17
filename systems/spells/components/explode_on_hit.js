export const explodeOnHitComponent = {
  id: 'explode_on_hit',
  type: 'trigger',
  stacking: 'ignore',
  hooks: {
    onCast() {},
    onHit(instance, hitData) {
      const system = hitData?.system;
      const x = hitData?.x;
      const y = hitData?.y;
      if (!system || !Number.isFinite(x) || !Number.isFinite(y)) return;
      system.spawnEffect({
        type: 'burst',
        x,
        y,
        radius: instance?.parameters?.explosionRadius ?? 3,
        color: '#ffb36e',
        ttl: 0.2,
      });
    },
    onExpire() {},
    onTick() {},
  },
};
