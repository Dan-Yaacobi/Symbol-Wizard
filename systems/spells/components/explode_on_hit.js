export const explodeOnHitComponent = {
  id: 'explode_on_hit',
  hooks: {
    onCast() {},
    onHit(instance, target) {
      const system = target?.context?.system;
      const x = target?.x ?? target?.position?.x;
      const y = target?.y ?? target?.position?.y;
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
