export const ElementRegistry = {
  fire: {
    components: ['apply_status_on_hit'],
    configModifiers: {
      damage: { multiply: 1.25 },
      speed: { multiply: 0.95 },
      statusType: { set: 'burn' },
      statusDuration: { set: 2.4 },
    },
  },
  frost: {
    components: ['apply_status_on_hit'],
    configModifiers: {
      damage: { multiply: 0.9 },
      speed: { multiply: 0.85 },
      ttl: { multiply: 1.2 },
      statusType: { set: 'slow' },
      statusDuration: { set: 2.8 },
    },
  },
  lightning: {
    components: ['apply_status_on_hit'],
    configModifiers: {
      damage: { multiply: 1.1 },
      speed: { multiply: 1.3 },
      ttl: { multiply: 0.8 },
      statusType: { set: 'shock' },
      statusDuration: { set: 1.2 },
    },
  },
  poison: {
    components: ['apply_status_on_hit'],
    configModifiers: {
      damage: { multiply: 0.85 },
      ttl: { multiply: 1.35 },
      statusType: { set: 'poison' },
      statusDuration: { set: 3.2 },
    },
  },
  arcane: {
    components: [],
    configModifiers: {
      damage: { multiply: 1 },
    },
  },
};

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function applyModifier(currentValue, modifier) {
  if (!modifier || typeof modifier !== 'object') return currentValue;
  let next = currentValue;
  if (Object.prototype.hasOwnProperty.call(modifier, 'set')) next = modifier.set;
  if (isFiniteNumber(modifier.multiply) && isFiniteNumber(next)) next *= modifier.multiply;
  if (isFiniteNumber(modifier.add) && isFiniteNumber(next)) next += modifier.add;
  if (isFiniteNumber(modifier.min) && isFiniteNumber(next)) next = Math.max(modifier.min, next);
  if (isFiniteNumber(modifier.max) && isFiniteNumber(next)) next = Math.min(modifier.max, next);
  return next;
}

function mergeComponents(baseComponents = [], elementComponents = []) {
  const merged = [];
  const seen = new Set();

  [...baseComponents, ...elementComponents].forEach((component) => {
    const id = typeof component === 'string' ? component : component?.id;
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push(component);
  });

  return merged;
}

export function composeSpellWithElement(baseSpell = {}, elementName = null) {
  const normalizedElement = elementName ?? baseSpell.element ?? null;
  const elementDef = normalizedElement ? ElementRegistry[normalizedElement] : null;
  if (!elementDef) return { ...baseSpell };

  const baseParameters = baseSpell.parameters && typeof baseSpell.parameters === 'object' ? { ...baseSpell.parameters } : {};
  const mergedParameters = { ...baseParameters };

  Object.entries(elementDef.configModifiers ?? {}).forEach(([key, modifier]) => {
    mergedParameters[key] = applyModifier(mergedParameters[key], modifier);
  });

  return {
    ...baseSpell,
    element: normalizedElement,
    components: mergeComponents(baseSpell.components ?? [], elementDef.components ?? []),
    parameters: mergedParameters,
    config: { ...mergedParameters },
    damage: isFiniteNumber(baseSpell.damage) ? applyModifier(baseSpell.damage, elementDef.configModifiers?.damage) : baseSpell.damage,
  };
}

export function applyElementModifiers(instance) {
  if (!instance || typeof instance !== 'object') return instance;
  instance.currentElement = instance.base?.element ?? instance.currentElement ?? null;
  return instance;
}
