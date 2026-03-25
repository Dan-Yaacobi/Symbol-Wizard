import { SpellEffectSystem } from '../SpellEffectSystem.js';
import { runChainPropagation } from '../chainPropagation.js';

function resolveNearestEnemy(system, x, y, radius = Number.POSITIVE_INFINITY) {
  const candidates = system.getEntitiesInRadius?.(x, y, radius) ?? system.enemies ?? [];
  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const enemy of candidates) {
    if (!enemy?.alive) continue;
    const distance = Math.hypot((enemy.x ?? 0) - x, (enemy.y ?? 0) - y);
    if (distance > radius || distance > nearestDistance) continue;
    nearest = enemy;
    nearestDistance = distance;
  }

  return nearest;
}

function dispatchHit(instance, payload) {
  SpellEffectSystem.applyEffects('onHit', payload);
  instance.handleEvent('onHit', payload);
}

export function executeBehavior(instance, context) {
  const system = context?.system;
  const origin = context?.origin ?? context?.player;
  const targetPosition = context?.targetPosition;
  if (!system || !origin || !targetPosition) return false;

  const jumpRadius = Number.isFinite(instance.parameters?.chainRange)
    ? Math.max(0, instance.parameters.chainRange)
    : 6;
  const maxJumps = Number.isFinite(instance.parameters?.chainCount)
    ? Math.max(0, Math.floor(instance.parameters.chainCount))
    : 2;
  const baseDamage = Number.isFinite(instance.parameters?.damage) ? instance.parameters.damage : 2;
  const damageFalloff = Number.isFinite(instance.parameters?.damageFalloff) ? instance.parameters.damageFalloff : 0.8;

  const initialTarget = resolveNearestEnemy(system, targetPosition.x, targetPosition.y);
  if (!initialTarget) return false;

  system.applySpellDamage?.(initialTarget, baseDamage, {
    eventName: 'onHit',
    instance,
    sourceX: origin.x ?? initialTarget.x,
    sourceY: origin.y ?? initialTarget.y,
    hitParticleColor: instance.parameters?.hitParticleColor,
  });

  dispatchHit(instance, {
    ...context,
    x: initialTarget.x,
    y: initialTarget.y,
    target: initialTarget,
    sourceX: origin.x ?? initialTarget.x,
    sourceY: origin.y ?? initialTarget.y,
    damage: baseDamage,
    system,
  });

  runChainPropagation({
    system,
    initialTarget,
    maxJumps,
    jumpRadius,
    baseDamage,
    damageFalloff,
    onJump: ({ target, damage, fromX, fromY, toX, toY, jumpIndex, visited }) => {
      system.spawnEffect?.({
        type: 'lightning',
        fromX,
        fromY,
        toX,
        toY,
        color: instance.parameters?.hitParticleColor ?? '#ffe76a',
        ttl: 0.1,
      });
      system.applySpellDamage?.(target, damage, {
        eventName: 'onHit',
        instance,
        sourceX: fromX,
        sourceY: fromY,
        hitParticleColor: instance.parameters?.hitParticleColor,
        meta: { chainVisited: visited, chainIndex: jumpIndex + 1 },
      });
      dispatchHit(instance, {
        ...context,
        x: toX,
        y: toY,
        target,
        sourceX: fromX,
        sourceY: fromY,
        damage,
        system,
        chainIndex: jumpIndex + 1,
        chainVisited: visited,
      });
    },
  });

  instance.state.hasHit = true;
  instance.state.lifetime = 0.01;
  return true;
}
