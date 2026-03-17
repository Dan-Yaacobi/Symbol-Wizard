export function applyElementModifiers(instance) {
  if (!instance || typeof instance !== 'object') return instance;
  instance.currentElement = instance.base?.element ?? instance.currentElement ?? null;
  return instance;
}
