export function createSpellDefinition(definition = {}) {
  return {
    id: definition.id ?? '',
    name: definition.name ?? '',
    description: definition.description ?? '',
    behavior: definition.behavior ?? '',
    targeting: definition.targeting ?? 'cursor',
    element: definition.element ?? null,
    components: Array.isArray(definition.components) ? [...definition.components] : [],
    parameters: definition.parameters && typeof definition.parameters === 'object' ? { ...definition.parameters } : {},
    cost: Number.isFinite(definition.cost) ? definition.cost : 0,
  };
}
