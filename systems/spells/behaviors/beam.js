import { SpellEffectSystem } from '../SpellEffectSystem.js';

export function executeBehavior(instance, context) {
  const system = context?.system;
  const origin = context?.origin ?? context?.player;
  const targetPosition = context?.targetPosition;
  if (!system || !origin || !targetPosition) return false;

  const dx = targetPosition.x - origin.x;
  const dy = targetPosition.y - origin.y;
  const rawLength = Math.hypot(dx, dy);
  const length = Number.isFinite(rawLength) && rawLength > 0 ? rawLength : 1;
  const dirX = dx / length;
  const dirY = dy / length;

  const beamLength = Number.isFinite(instance.parameters?.range) ? instance.parameters.range : length;
  const hitRadius = Number.isFinite(instance.parameters?.width) ? instance.parameters.width : 1;
  const damage = Number.isFinite(instance.parameters?.damage) ? instance.parameters.damage : 2;

  instance.state.beam = {
    originX: origin.x,
    originY: origin.y,
    targetX: targetPosition.x,
    targetY: targetPosition.y,
    dirX,
    dirY,
    range: beamLength,
    width: hitRadius,
  };
  instance.state.cast = { originX: origin.x, originY: origin.y, dirX, dirY };

  system.spawnEffect({
    type: 'line',
    fromX: origin.x,
    fromY: origin.y,
    toX: origin.x + dirX * beamLength,
    toY: origin.y + dirY * beamLength,
    color: instance.parameters?.color ?? '#d9ecff',
    ttl: instance.parameters?.duration ?? 0.15,
  });

  const targets = system.getEntitiesInRadius(origin.x + dirX * (beamLength * 0.5), origin.y + dirY * (beamLength * 0.5), beamLength * 0.6 + hitRadius);
  for (const target of targets) {
    const relX = target.x - origin.x;
    const relY = target.y - origin.y;
    const projected = relX * dirX + relY * dirY;
    if (projected < 0 || projected > beamLength) continue;

    const perpendicular = Math.abs(relX * dirY - relY * dirX);
    if (perpendicular > hitRadius + (target.radius ?? 1)) continue;

    system.applySpellDamage(target, damage, {
      eventName: 'onHit',
      instance,
      sourceX: origin?.x ?? target.x,
      sourceY: origin?.y ?? target.y,
      hitParticleColor: instance.parameters?.hitParticleColor,
    });
    const eventPayload = {
      x: target.x,
      y: target.y,
      target,
      system,
      instance,
      sourceX: origin.x,
      sourceY: origin.y,
      damage,
    };
    SpellEffectSystem.applyEffects('onHit', eventPayload);
    instance.handleEvent('onHit', eventPayload);
  }

  return true;
}
