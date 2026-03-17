import { SpellRegistry } from '../../data/spells.js';
import { ElementRegistry, composeSpellWithElement } from './ElementSystem.js';
import { validateSpell } from './SpellValidator.js';
import { resolveComponent } from './components/index.js';

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

  const elementAppliedSpell = composeSpellWithElement({ ...baseSpell }, shouldApplyElement ? element : baseSpell.element ?? null);

  const mergedComponents = normalizeComponents([
    ...(Array.isArray(elementAppliedSpell.components) ? elementAppliedSpell.components : []),
    ...components,
  ]);

  const craftedSpell = {
    ...elementAppliedSpell,
    components: mergedComponents,
    config: buildConfig(elementAppliedSpell),
  };

  const validation = validateSpell(craftedSpell);
  if (!validation.valid) {
    throw new Error(`Invalid crafted spell combination: ${validation.message}`);
  }

  return craftedSpell;
}
