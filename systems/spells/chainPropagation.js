function resolveNearestUnvisitedEnemy(system, fromX, fromY, radius, visited) {
  const candidates = system.getEntitiesInRadius?.(fromX, fromY, radius) ?? [];
  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const enemy of candidates) {
    if (!enemy?.alive || visited.has(enemy)) continue;
    const distance = Math.hypot((enemy.x ?? 0) - fromX, (enemy.y ?? 0) - fromY);
    if (distance > radius || distance > nearestDistance) continue;

    if (distance === nearestDistance && nearest) {
      const candidateX = enemy.x ?? 0;
      const candidateY = enemy.y ?? 0;
      const nearestX = nearest.x ?? 0;
      const nearestY = nearest.y ?? 0;
      if (candidateX > nearestX) continue;
      if (candidateX === nearestX && candidateY >= nearestY) continue;
    }

    nearest = enemy;
    nearestDistance = distance;
  }

  return nearest;
}

function clampJumpCount(value, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

export function runChainPropagation({
  system,
  initialTarget,
  maxJumps,
  jumpRadius,
  baseDamage,
  damageFalloff = 1,
  onJump,
}) {
  if (!system || !initialTarget?.alive) return [];
  const safeRadius = Number.isFinite(jumpRadius) ? Math.max(0, jumpRadius) : 0;
  const safeMaxJumps = clampJumpCount(maxJumps, 0);
  if (safeMaxJumps <= 0 || safeRadius <= 0) return [];

  const visited = new Set([initialTarget]);
  const hits = [];
  let current = initialTarget;

  for (let jumpIndex = 0; jumpIndex < safeMaxJumps; jumpIndex += 1) {
    const next = resolveNearestUnvisitedEnemy(system, current.x ?? 0, current.y ?? 0, safeRadius, visited);
    if (!next) break;

    visited.add(next);
    const jumpDamage = Math.max(0, baseDamage * Math.max(0, damageFalloff) ** jumpIndex);
    const jumpPayload = {
      jumpIndex,
      target: next,
      fromX: current.x ?? 0,
      fromY: current.y ?? 0,
      toX: next.x ?? 0,
      toY: next.y ?? 0,
      damage: jumpDamage,
      visited,
    };

    onJump?.(jumpPayload);
    hits.push(jumpPayload);
    current = next;
  }

  return hits;
}
