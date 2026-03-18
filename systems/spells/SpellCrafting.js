import { SpellRegistry } from '../../data/spells.js';
import { ElementRegistry, composeSpellWithElement } from './ElementSystem.js';
import { validateSpell } from './SpellValidator.js';
import { resolveComponent } from './components/index.js';

export const MAX_CRAFTING_COST = 5;

export const BASE_SPELL_COSTS = Object.freeze({
  'magic-bolt': 1,
});

export const ELEMENT_COSTS = Object.freeze({
  arcane: 0,
  fire: 2,
  frost: 2,
  lightning: 2,
  poison: 1,
});

export const COMPONENT_COSTS = Object.freeze({
  apply_status_on_hit: 1,
  pierce: 1,
  explode_on_hit: 3,
  emit_projectiles: 3,
  spawn_zone_on_hit: 3,
});

function normalizeSpellId(baseId) {
  if (typeof baseId !== 'string') return null;
  if (SpellRegistry[baseId]) return baseId;

  const dashVariant = baseId.replaceAll('_', '-');
  if (SpellRegistry[dashVariant]) return dashVariant;

  const underscoreVariant = baseId.replaceAll('-', '_');
  if (SpellRegistry[underscoreVariant]) return underscoreVariant;

  return null;
}

function normalizeComponents(components) {
  if (!Array.isArray(components)) return [];

  const merged = [];
  const seen = new Set();

  for (const componentRef of components) {
    if (typeof componentRef !== 'string') continue;
    const component = resolveComponent(componentRef);
    if (!component) continue;
    if (seen.has(component.id)) continue;
    seen.add(component.id);
    merged.push(component.id);
  }

  return merged;
}

function buildConfig(spell) {
  const parameters = spell.parameters && typeof spell.parameters === 'object' ? spell.parameters : {};
  const config = spell.config && typeof spell.config === 'object' ? spell.config : {};
  return { ...config, ...parameters };
}

function getCostFromTable(table, id, label) {
  if (!id) return 0;
  const cost = table[id];
  if (!Number.isFinite(cost)) {
    throw new Error(`Missing ${label} cost for: ${String(id)}`);
  }
  return cost;
}

export function calculateSpellCost({ base, element = null, components = [] } = {}) {
  const normalizedBaseId = normalizeSpellId(base);
  if (!normalizedBaseId) {
    throw new Error(`Unknown base spell: ${String(base)}`);
  }

  const normalizedComponents = normalizeComponents(components);
  const totalCost = getCostFromTable(BASE_SPELL_COSTS, normalizedBaseId, 'base spell')
    + getCostFromTable(ELEMENT_COSTS, element, 'element')
    + normalizedComponents.reduce((sum, componentId) => sum + getCostFromTable(COMPONENT_COSTS, componentId, 'component'), 0);

  return {
    totalCost,
    maxCost: MAX_CRAFTING_COST,
    withinLimit: totalCost <= MAX_CRAFTING_COST,
    breakdown: {
      base: getCostFromTable(BASE_SPELL_COSTS, normalizedBaseId, 'base spell'),
      element: getCostFromTable(ELEMENT_COSTS, element, 'element'),
      components: normalizedComponents.map((componentId) => ({
        id: componentId,
        cost: getCostFromTable(COMPONENT_COSTS, componentId, 'component'),
      })),
    },
  };
}

export function craftSpell({ base, element = null, components = [] } = {}) {
  const normalizedBaseId = normalizeSpellId(base);
  if (!normalizedBaseId) {
    throw new Error(`Unknown base spell: ${String(base)}`);
  }

  const baseSpell = SpellRegistry[normalizedBaseId];
  if (!baseSpell || typeof baseSpell !== 'object') {
    throw new Error(`Invalid base spell definition for: ${normalizedBaseId}`);
  }

  if (!baseSpell.behavior) {
    throw new Error(`Base spell "${normalizedBaseId}" is not craftable (missing behavior).`);
  }

  const shouldApplyElement = element !== null && element !== undefined && element !== '';
  if (shouldApplyElement && !ElementRegistry[element]) {
    throw new Error(`Unknown element: ${String(element)}`);
  }

  const appliedElement = shouldApplyElement ? element : baseSpell.element ?? null;
  const elementAppliedSpell = composeSpellWithElement({ ...baseSpell }, appliedElement);

  const mergedComponents = normalizeComponents([
    ...(Array.isArray(elementAppliedSpell.components) ? elementAppliedSpell.components : []),
    ...components,
  ]);

  const costSummary = calculateSpellCost({
    base: normalizedBaseId,
    element: appliedElement,
    components: mergedComponents,
  });

  if (!costSummary.withinLimit) {
    throw new Error(`Spell is too complex to craft (${costSummary.totalCost}/${costSummary.maxCost}).`);
  }

  const craftedSpell = {
    ...elementAppliedSpell,
    components: mergedComponents,
    cost: costSummary.totalCost,
    config: buildConfig(elementAppliedSpell),
    craftingCost: costSummary.totalCost,
    craftingCostBreakdown: costSummary.breakdown,
    maxCraftingCost: costSummary.maxCost,
  };

  const validation = validateSpell(craftedSpell);
  if (!validation.valid) {
    throw new Error(`Invalid crafted spell combination: ${validation.message}`);
  }

  return craftedSpell;
}
