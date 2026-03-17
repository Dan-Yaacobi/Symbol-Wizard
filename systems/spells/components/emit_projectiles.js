function clampSpreadDegrees(value) {
  if (!Number.isFinite(value)) return 30;
  return Math.max(15, Math.min(30, value));
}

function normalize(vx, vy) {
  const length = Math.hypot(vx, vy) || 1;
  return { x: vx / length, y: vy / length };
}

function rotateVector(vx, vy, radians) {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: vx * cos - vy * sin, y: vx * sin + vy * cos };
}

export const emitProjectilesComponent = {
  id: 'emit_projectiles',
  hooks: {
    onCast(instance, context) {
      const system = context?.system;
      const origin = context?.origin ?? context?.player;
      const target = context?.targetPosition;
      if (!system || !origin || !target) return;

      const count = Math.max(2, Math.floor(instance?.parameters?.emitCount ?? 3));
      const spreadDegrees = clampSpreadDegrees(instance?.parameters?.emitSpreadDegrees ?? 30);
      const step = count > 1 ? spreadDegrees / (count - 1) : 0;
      const start = -spreadDegrees / 2;

      const baseDirection = normalize(target.x - origin.x, target.y - origin.y);

      for (let i = 0; i < count; i += 1) {
        const offsetDegrees = start + step * i;
        const direction = rotateVector(baseDirection.x, baseDirection.y, (offsetDegrees * Math.PI) / 180);
        system.createProjectile(origin.x, origin.y, direction.x, direction.y, {
          speed: instance?.parameters?.speed ?? 60,
          damage: instance?.parameters?.damage ?? 2,
          ttl: instance?.parameters?.ttl ?? 0.85,
          color: instance?.parameters?.color ?? '#9cc7ff',
          radius: instance?.parameters?.size ?? 1,
          hitParticleColor: '#ffd2ad',
        });
      }
    },
    onHit() {},
    onExpire() {},
    onTick() {},
  },
};
