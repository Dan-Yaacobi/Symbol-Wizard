export function executeBehavior(instance, context) {
  const system = context?.system;
  const origin = context?.origin ?? context?.player;
  const targetPosition = context?.targetPosition;
  if (!system || !origin || !targetPosition) return false;

  system.spawnEffect({
    type: 'line',
    fromX: origin.x,
    fromY: origin.y,
    toX: targetPosition.x,
    toY: targetPosition.y,
    color: instance.parameters?.color ?? '#d9ecff',
    ttl: instance.parameters?.duration ?? 0.15,
  });

  return true;
}
