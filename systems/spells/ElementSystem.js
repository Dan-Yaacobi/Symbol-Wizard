const elementModifiers = {
  // Hook point for element-specific parameter mutation.
  // Example:
  // fire: (instance) => { instance.parameters.damage = (instance.parameters.damage ?? 0) + 1; },
  // ice: (instance) => { instance.parameters.speed = Math.max(1, (instance.parameters.speed ?? 0) - 5); },
};

export function applyElementModifiers(instance) {
  if (!instance || typeof instance !== 'object') return instance;
  instance.currentElement = instance.base?.element ?? instance.currentElement ?? null;
  const element = instance.currentElement;
  elementModifiers[element]?.(instance);
  return instance;
}
