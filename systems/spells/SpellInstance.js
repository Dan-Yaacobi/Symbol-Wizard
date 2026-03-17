function deepClone(value) {
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function createSpellInstance(baseSpell) {
  const base = deepClone(baseSpell ?? {});
  return {
    base,
    currentElement: base.element ?? null,
    components: deepClone(base.components ?? []),
    parameters: deepClone(base.parameters ?? {}),
    state: {
      age: 0,
      lifetime: Number.isFinite(base.parameters?.duration) ? base.parameters.duration : (Number.isFinite(base.parameters?.lifetime) ? base.parameters.lifetime : 1),
      hasHit: false,
      tickTimer: 0,
    },
  };
}
