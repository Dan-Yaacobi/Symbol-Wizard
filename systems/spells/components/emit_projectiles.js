import { SpellEffectSystem } from '../SpellEffectSystem.js';

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
  type: 'override',
  stacking: 'replace',
  hooks: {
    onCast() {},
    onBehavior(instance, context) {
      const system = context?.system;
      const origin = context?.origin ?? context?.player;
      const target = context?.targetPosition;
      if (!system || !origin || !target) return false;

      const count = Math.max(2, Math.floor(instance?.parameters?.emitCount ?? 3));
      const spreadDegrees = clampSpreadDegrees(instance?.parameters?.emitSpreadDegrees ?? 30);
      const step = count > 1 ? spreadDegrees / (count - 1) : 0;
      const start = -spreadDegrees / 2;

      const baseDirection = normalize(target.x - origin.x, target.y - origin.y);
      let spawnCount = 0;

      for (let i = 0; i < count; i += 1) {
        const offsetDegrees = start + step * i;
        const direction = rotateVector(baseDirection.x, baseDirection.y, (offsetDegrees * Math.PI) / 180);
        const projectile = system.createProjectile(origin.x, origin.y, direction.x, direction.y, {
          speed: instance?.parameters?.speed ?? 60,
          damage: instance?.parameters?.damage ?? 2,
          ttl: instance?.parameters?.ttl ?? instance?.parameters?.lifetime ?? 0.85,
          color: instance?.parameters?.color ?? '#9cc7ff',
          radius: instance?.parameters?.size ?? 1,
          pierce: Boolean(instance?.parameters?.pierce),
          pierceCount: Number.isFinite(instance?.parameters?.pierceCount) ? instance.parameters.pierceCount : null,
          hitParticleColor: '#ffd2ad',
          spellInstance: instance,
          onHit: (payload) => {
            if (!instance?.parameters?.pierce) instance.state.hasHit = true;
            instance.handleEvent('onHit', payload);
          },
        });

        if (projectile) {
          projectile.spellInstance = instance;
          SpellEffectSystem.initializeProjectile(projectile, instance);
          spawnCount += 1;
        }
      }

      const behaviorDuration = Number.isFinite(instance?.parameters?.duration) ? instance.parameters.duration : null;
      const projectileLifetime = Number.isFinite(instance?.parameters?.ttl) ? instance.parameters.ttl : null;
      instance.state.lifetime = projectileLifetime ?? behaviorDuration ?? 1;

      return spawnCount > 0;
    },
    onHit() {},
    onExpire() {},
    onTick() {},
  },
};
