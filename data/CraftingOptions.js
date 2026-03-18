import { SpellRegistry } from './spells.js';
import { BASE_SPELL_COSTS, COMPONENT_COSTS, ELEMENT_COSTS } from '../systems/spells/SpellCrafting.js';
import { ComponentRegistry } from '../systems/spells/components/index.js';
import { ElementRegistry } from '../systems/spells/ElementSystem.js';

const CANDIDATE_BEHAVIORS = ['projectile', 'beam', 'zone', 'orbit', 'chain'];
const CANDIDATE_ELEMENTS = ['arcane', 'fire', 'frost', 'lightning', 'poison'];
const CANDIDATE_COMPONENTS = [
  'explode_on_hit',
  'pierce',
  'spawn_zone_on_hit',
  'emit_projectiles',
  'apply_status_on_hit',
  'split',
  'chain',
  'bounce',
];

const craftableSpells = Object.values(SpellRegistry).filter((spell) => spell?.behavior && Number.isFinite(BASE_SPELL_COSTS[spell.id]));
const implementedBehaviorIds = new Set(craftableSpells.map((spell) => spell.behavior));

export const CraftingOptions = Object.freeze({
  behaviors: Object.freeze(CANDIDATE_BEHAVIORS.filter((behaviorId) => implementedBehaviorIds.has(behaviorId))),
  elements: Object.freeze(CANDIDATE_ELEMENTS.filter((elementId) => elementId in ElementRegistry && Number.isFinite(ELEMENT_COSTS[elementId]))),
  components: Object.freeze(CANDIDATE_COMPONENTS.filter((componentId) => componentId in ComponentRegistry && Number.isFinite(COMPONENT_COSTS[componentId]))),
});

export function getCraftableBaseSpellIds(behaviorId = null) {
  return craftableSpells
    .filter((spell) => !behaviorId || spell.behavior === behaviorId)
    .map((spell) => spell.id);
}
