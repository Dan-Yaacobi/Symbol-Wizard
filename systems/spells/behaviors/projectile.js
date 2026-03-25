import { SpellEffectSystem } from '../SpellEffectSystem.js';

function rotateDirection(dirX, dirY, degrees) {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    dx: dirX * cos - dirY * sin,
    dy: dirX * sin + dirY * cos,
  };
}

export function executeBehavior(instance, context) {
  const system = context?.system;
  const origin = context?.origin ?? context?.player;
  const targetPosition = context?.targetPosition;
  if (!system || !origin || !targetPosition) return false;

  const dx = targetPosition.x - origin.x;
  const dy = targetPosition.y - origin.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length === 0) return false;

  const normX = dx / length;
  const normY = dy / length;
  instance.state.cast = { originX: origin.x, originY: origin.y, dirX: normX, dirY: normY };

  const doubleBoltEffect = (instance.effects ?? []).find((effect) => effect?.type === 'double_bolt');
  const hasDoubleBolt = Boolean(doubleBoltEffect);
  const projectileCount = hasDoubleBolt ? Math.max(2, Math.floor(doubleBoltEffect.count ?? 2)) : 1;
  const spreadDegrees = hasDoubleBolt && Number.isFinite(doubleBoltEffect.spreadDegrees) ? doubleBoltEffect.spreadDegrees : 14;
  const damageMultiplier = hasDoubleBolt
    ? Math.min(0.9, Math.max(0.1, doubleBoltEffect.damageMultiplier ?? 0.7))
    : 1;
  const step = projectileCount > 1 ? spreadDegrees / (projectileCount - 1) : 0;
  const start = -spreadDegrees / 2;
  const isArcaneOrb = instance?.recipeId === 'arcane_orb' || instance?.base?.recipeId === 'arcane_orb';

  let firstProjectile = null;
  let spawnedProjectileCount = 0;
  for (let i = 0; i < projectileCount; i += 1) {
    const offset = start + step * i;
    const direction = hasDoubleBolt ? rotateDirection(normX, normY, offset) : { dx: normX, dy: normY };
    const projectileOverrides = {
      speed: instance.parameters?.speed ?? 65,
      damage: Math.max(1, Math.round((instance.parameters?.damage ?? 3) * damageMultiplier)),
      ttl: instance.parameters?.ttl ?? instance.parameters?.lifetime ?? 0.9,
      radius: instance.parameters?.size ?? 1.1,
      color: instance.parameters?.color ?? '#8fe8ff',
      hitParticleColor: instance.parameters?.hitParticleColor,
      spriteFrames: instance.parameters?.spriteFrames,
      pierce: Boolean(instance.parameters?.pierce),
      pierceCount: Number.isFinite(instance.parameters?.pierceCount) ? instance.parameters.pierceCount : null,
      spellInstance: instance,
      onHit: (payload) => {
        if (!instance.parameters?.pierce) instance.state.hasHit = true;
        instance.handleEvent('onHit', payload);
      },
    };
    if (instance.parameters?.directionalSpriteFrames !== undefined) {
      projectileOverrides.directionalSpriteFrames = instance.parameters.directionalSpriteFrames;
    } else if (isArcaneOrb) {
      projectileOverrides.directionalSpriteFrames = null;
      projectileOverrides.trailSpawnInterval = 0.065;
      projectileOverrides.trailParticleLifetime = { min: 0.2, max: 0.35 };
    }
    const projectile = system.createProjectile(origin.x, origin.y, direction.dx, direction.dy, projectileOverrides);
    if (!projectile) continue;
    if (!firstProjectile) firstProjectile = projectile;
    spawnedProjectileCount += 1;
    projectile.spellInstance = instance;
    SpellEffectSystem.initializeProjectile(projectile, instance);
  }

  const projectileTtl = Number.isFinite(firstProjectile?.ttl) ? firstProjectile.ttl : null;
  const behaviorDuration = Number.isFinite(instance.parameters?.duration) ? instance.parameters.duration : null;
  instance.state.lifetime = projectileTtl ?? behaviorDuration ?? 1;

  return spawnedProjectileCount > 0;
}
