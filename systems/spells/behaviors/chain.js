function findNearestTarget(candidates, fromX, fromY, visited = null, range = Number.POSITIVE_INFINITY) {
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (!candidate?.alive) continue;
    if (visited?.has(candidate)) continue;

    const distance = Math.hypot(candidate.x - fromX, candidate.y - fromY);
    if (distance > range) continue;
    if (distance >= bestDistance) continue;

    best = candidate;
    bestDistance = distance;
  }

  return best;
}

export function executeBehavior(instance, context) {
  const system = context?.system;
  const origin = context?.origin ?? context?.player;
  const targetPosition = context?.targetPosition;
  if (!system || !origin || !targetPosition) return false;

  const chainCount = Number.isFinite(instance.parameters?.chainCount) ? Math.max(1, Math.floor(instance.parameters.chainCount)) : 1;
  const chainRange = Number.isFinite(instance.parameters?.chainRange) ? Math.max(0, instance.parameters.chainRange) : 6;
  const damage = Number.isFinite(instance.parameters?.damage) ? instance.parameters.damage : 2;

  const targets = Array.isArray(system.enemies) ? system.enemies : [];
  const visited = new Set();

  let currentTarget = findNearestTarget(targets, targetPosition.x, targetPosition.y);
  if (!currentTarget) return false;

  for (let hitIndex = 0; hitIndex < chainCount && currentTarget; hitIndex += 1) {
    visited.add(currentTarget);
    system.applyDamage(currentTarget, damage);

    instance.handleEvent('onHit', {
      x: currentTarget.x,
      y: currentTarget.y,
      target: currentTarget,
      system,
      instance,
      chainIndex: hitIndex,
    });

    if (hitIndex >= chainCount - 1) break;
    currentTarget = findNearestTarget(targets, currentTarget.x, currentTarget.y, visited, chainRange);
  }

  instance.state.hasHit = true;
  instance.state.lifetime = 0.01;
  return true;
}
