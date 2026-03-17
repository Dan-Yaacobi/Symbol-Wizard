export function executeBehavior(instance, context) {
  const system = context?.system;
  const targetPosition = context?.targetPosition;
  if (!system || !targetPosition) return false;

  system.spawnEffect({
    type: 'burst',
    x: targetPosition.x,
    y: targetPosition.y,
    radius: instance.parameters?.radius ?? 4,
    ttl: instance.parameters?.duration ?? 1,
    color: instance.parameters?.color ?? '#cfe7ff',
  });

  return true;
}
