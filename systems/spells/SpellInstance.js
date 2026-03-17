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
    config: deepClone(base.config ?? base.parameters ?? {}),
    parameters: deepClone(base.parameters ?? {}),

    handleEvent(eventName, payload) {
      this.components.forEach((component) => {
        if (typeof component?.hooks?.[eventName] === 'function') {
          component.hooks[eventName](this, payload);
        }
        if (typeof component?.[eventName] === 'function') {
          component[eventName](payload, this);
        }
      });
    },
    state: {
      age: 0,
      lifetime: Number.isFinite(base.parameters?.duration) ? base.parameters.duration : (Number.isFinite(base.parameters?.lifetime) ? base.parameters.lifetime : (Number.isFinite(base.config?.lifetime) ? base.config.lifetime : 1)),
      hasHit: false,
      tickTimer: 0,
    },
  };
}
