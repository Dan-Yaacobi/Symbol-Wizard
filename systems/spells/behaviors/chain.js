import { SpellEffectSystem } from '../SpellEffectSystem.js';
const DEFAULT_CAST_RANGE = 14;
const DEFAULT_JUMP_RANGE = 9;
const DEFAULT_MAX_JUMPS = 4;
const MIN_MAX_JUMPS = 4;
const MAX_MAX_JUMPS = 10;

function resolveInitialTarget(system, originX, originY, targetX, targetY, castRange) {
  const candidates = system?.enemies ?? [];
  let best = null;
  let bestCursorDistance = Number.POSITIVE_INFINITY;
  let bestPlayerDistance = Number.POSITIVE_INFINITY;

  for (const enemy of candidates) {
    if (!enemy?.alive) continue;
    const playerDistance = Math.hypot((enemy.x ?? 0) - originX, (enemy.y ?? 0) - originY);
    if (playerDistance > castRange) continue;

    const cursorDistance = Math.hypot((enemy.x ?? 0) - targetX, (enemy.y ?? 0) - targetY);
    if (cursorDistance > bestCursorDistance) continue;

    if (cursorDistance === bestCursorDistance && playerDistance >= bestPlayerDistance) continue;
    best = enemy;
    bestCursorDistance = cursorDistance;
    bestPlayerDistance = playerDistance;
  }

  return best;
}

function resolveNearestUnvisitedEnemy(system, fromX, fromY, jumpRadius, visited) {
  const candidates = system.getEntitiesInRadius?.(fromX, fromY, jumpRadius) ?? [];
  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const enemy of candidates) {
    if (!enemy?.alive || visited.has(enemy)) continue;
    const distance = Math.hypot((enemy.x ?? 0) - fromX, (enemy.y ?? 0) - fromY);
    if (distance > jumpRadius || distance > nearestDistance) continue;
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

  const castRange = Number.isFinite(instance.parameters?.range)
    ? Math.max(0, instance.parameters.range)
    : DEFAULT_CAST_RANGE;
  const jumpRadius = Number.isFinite(instance.parameters?.chainRange)
    ? Math.max(0, instance.parameters.chainRange)
    : DEFAULT_JUMP_RANGE;
  const maxJumpsRaw = Number.isFinite(instance.parameters?.maxJumps)
    ? instance.parameters.maxJumps
    : instance.parameters?.chainCount;
  const maxJumps = Number.isFinite(maxJumpsRaw)
    ? Math.max(MIN_MAX_JUMPS, Math.min(MAX_MAX_JUMPS, Math.round(maxJumpsRaw)))
    : DEFAULT_MAX_JUMPS;
  const baseDamage = Number.isFinite(instance.parameters?.damage) ? instance.parameters.damage : 2;
  const damageFalloff = Number.isFinite(instance.parameters?.damageFalloff) ? instance.parameters.damageFalloff : 1;

  const initialTarget = resolveInitialTarget(
    system,
    origin.x ?? 0,
    origin.y ?? 0,
    targetPosition.x,
    targetPosition.y,
    castRange,
  );
  if (!initialTarget) return false;

  const visited = new Set([initialTarget]);
  system.spawnEffect?.({
    type: 'lightning',
    fromX: origin.x ?? initialTarget.x,
    fromY: origin.y ?? initialTarget.y,
    toX: initialTarget.x,
    toY: initialTarget.y,
    color: instance.parameters?.hitParticleColor ?? '#ffe76a',
    glowColor: '#cfeaff',
    intensity: 1.4,
    ttl: 0.08,
  });

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

  let current = initialTarget;
  for (let jumpIndex = 0; jumpIndex < maxJumps; jumpIndex += 1) {
    const next = resolveNearestUnvisitedEnemy(system, current.x ?? 0, current.y ?? 0, jumpRadius, visited);
    if (!next) break;
    const jumpDamage = Math.max(0, baseDamage * Math.max(0, damageFalloff) ** (jumpIndex + 1));
    visited.add(next);

    const fromX = current.x ?? 0;
    const fromY = current.y ?? 0;
    const toX = next.x ?? 0;
    const toY = next.y ?? 0;
    system.spawnEffect?.({
      type: 'lightning',
      fromX,
      fromY,
      toX,
      toY,
      color: instance.parameters?.hitParticleColor ?? '#ffe76a',
      glowColor: '#ffffff',
      intensity: 1,
      ttl: 0.07,
    });
    system.applySpellDamage?.(next, jumpDamage, {
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
      target: next,
      sourceX: fromX,
      sourceY: fromY,
      damage: jumpDamage,
      system,
      chainIndex: jumpIndex + 1,
      chainVisited: visited,
    });
    current = next;
  }

  instance.state.hasHit = true;
  instance.state.lifetime = 0.01;
  return true;
}
