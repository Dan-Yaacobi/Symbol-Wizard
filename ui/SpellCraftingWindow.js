import { SpellRegistry } from '../data/spells.js';
import { craftSpell, calculateSpellCost } from '../systems/spells/SpellCrafting.js';
import { ElementRegistry } from '../systems/spells/ElementSystem.js';
import { ComponentRegistry } from '../systems/spells/components/index.js';

const DESIGN_DOC_BASE_SPELLS = ['magic-bolt'];
const DESIGN_DOC_ELEMENTS = ['fire', 'frost', 'electric', 'earth'];
const DESIGN_DOC_COMPONENTS = [
  'explode_on_hit',
  'spawn_zone_on_hit',
  'emit_projectiles',
  'spawn_on_expire',
  'split',
  'multi_cast',
  'chain',
  'fork',
  'ring',
  'cone',
  'spiral',
  'wave',
  'pierce',
  'bounce',
  'pull',
  'push',
  'orbit_attach',
  'delay',
  'grow',
  'ramp',
  'pulse',
];

function toLabel(value) {
  return String(value)
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildCraftedSpellId(base, element, components) {
  const sortedComponents = [...components].sort();
  const elementToken = element || 'none';
  const componentToken = sortedComponents.length > 0 ? sortedComponents.join('-') : 'none';
  return `${base}__${elementToken}__${componentToken}`;
}

function buildCraftedSpellName(baseSpellName, element, components) {
  const tags = [];
  if (element) tags.push(toLabel(element));
  if (components.length > 0) tags.push(components.map(toLabel).join(', '));
  if (tags.length === 0) return baseSpellName;
  return `${baseSpellName} [${tags.join(' • ')}]`;
}

export class SpellCraftingWindow {
  constructor({ root, spellbook, onCrafted }) {
    this.root = root;
    this.spellbook = spellbook;
    this.onCrafted = onCrafted;

    this.selectedBase = '';
    this.selectedElement = '';
    this.selectedComponents = [];
    this.feedback = '';
    this.feedbackType = '';

    this.allowedBases = Object.values(SpellRegistry)
      .filter((spell) => spell?.behavior)
      .map((spell) => spell.id)
      .filter((id) => DESIGN_DOC_BASE_SPELLS.includes(id));

    this.allowedElements = Object.keys(ElementRegistry).filter((element) => DESIGN_DOC_ELEMENTS.includes(element));

    this.allowedComponents = Object.keys(ComponentRegistry).filter((componentId) => DESIGN_DOC_COMPONENTS.includes(componentId));

    this.el = document.createElement('section');
    this.el.className = 'spell-crafting-window';
    this.root.appendChild(this.el);

    this.selectedBase = this.allowedBases[0] ?? '';
    this.render();
  }

  setFeedback(message, type) {
    this.feedback = message;
    this.feedbackType = type;
  }

  getCostSummary() {
    if (!this.selectedBase) {
      return { totalCost: 0, maxCost: 0, withinLimit: false, breakdown: { base: 0, element: 0, components: [] } };
    }

    try {
      return calculateSpellCost({
        base: this.selectedBase,
        element: this.selectedElement || null,
        components: this.selectedComponents,
      });
    } catch {
      return { totalCost: 0, maxCost: 0, withinLimit: false, breakdown: { base: 0, element: 0, components: [] } };
    }
  }

  toggleComponent(componentId, checked) {
    if (!this.allowedComponents.includes(componentId)) return;

    if (checked) {
      if (!this.selectedComponents.includes(componentId)) {
        this.selectedComponents = [...this.selectedComponents, componentId];
      }
      return;
    }

    this.selectedComponents = this.selectedComponents.filter((id) => id !== componentId);
  }

  validateSelection() {
    if (!this.selectedBase || !this.allowedBases.includes(this.selectedBase)) {
      return { valid: false, message: 'Select a valid base spell.' };
    }

    if (this.selectedElement && !this.allowedElements.includes(this.selectedElement)) {
      return { valid: false, message: 'Selected element is invalid.' };
    }

    const hasInvalidComponent = this.selectedComponents.some((component) => !this.allowedComponents.includes(component));
    if (hasInvalidComponent) {
      return { valid: false, message: 'One or more selected components are invalid.' };
    }

    const costSummary = this.getCostSummary();
    if (!costSummary.withinLimit) {
      return { valid: false, message: `Spell exceeds crafting limit (${costSummary.totalCost}/${costSummary.maxCost}).` };
    }

    return { valid: true, message: 'ok' };
  }

  onCraftClick() {
    const selectionCheck = this.validateSelection();
    if (!selectionCheck.valid) {
      this.setFeedback(selectionCheck.message, 'error');
      this.render();
      return;
    }

    try {
      const spell = craftSpell({
        base: this.selectedBase,
        element: this.selectedElement || null,
        components: this.selectedComponents,
      });

      const craftedSpell = {
        ...spell,
        id: buildCraftedSpellId(this.selectedBase, this.selectedElement || null, this.selectedComponents),
        name: buildCraftedSpellName(spell.name, this.selectedElement || null, this.selectedComponents),
      };

      const added = this.onCrafted?.(craftedSpell);
      if (!added) {
        this.setFeedback('Craft failed: spell already exists.', 'error');
        this.render();
        return;
      }

      this.setFeedback('Spell Crafted', 'success');
      this.selectedElement = '';
      this.selectedComponents = [];

      this.spellbook?.render?.();
      this.render();
    } catch (error) {
      this.setFeedback(error instanceof Error ? error.message : 'Craft failed.', 'error');
      this.render();
    }
  }

  render() {
    const costSummary = this.getCostSummary();
    const craftDisabled = !costSummary.withinLimit;
    const componentCostMarkup = this.allowedComponents
      .map(
        (componentId) => `
                <label>
                  <input type="checkbox" value="${componentId}" ${this.selectedComponents.includes(componentId) ? 'checked' : ''} />
                  <span>${toLabel(componentId)}</span>
                  <strong class="craft-cost-chip">+${calculateSpellCost({ base: this.selectedBase || this.allowedBases[0], element: null, components: [componentId] }).breakdown.components[0]?.cost ?? 0}</strong>
                </label>
              `,
      )
      .join('');

    this.el.innerHTML = `
      <header class="spell-crafting-header">
        <h3>Spell Crafting</h3>
      </header>
      <div class="spell-crafting-selectors">
        <label>
          <span>Base</span>
          <select class="craft-base-select">
            ${this.allowedBases
              .map((baseId) => `<option value="${baseId}" ${this.selectedBase === baseId ? 'selected' : ''}>${SpellRegistry[baseId]?.name ?? toLabel(baseId)} (${costSummary.breakdown.base})</option>`)
              .join('')}
          </select>
        </label>
        <label>
          <span>Element</span>
          <select class="craft-element-select">
            <option value="">None</option>
            ${this.allowedElements
              .map((element) => `<option value="${element}" ${this.selectedElement === element ? 'selected' : ''}>${toLabel(element)} (+${calculateSpellCost({ base: this.selectedBase || this.allowedBases[0], element, components: [] }).breakdown.element})</option>`)
              .join('')}
          </select>
        </label>
        <fieldset class="craft-components">
          <legend>Components</legend>
          ${componentCostMarkup}
        </fieldset>
      </div>
      <div class="craft-cost-summary ${costSummary.withinLimit ? '' : 'over-limit'}">
        <p><strong>Cost:</strong> ${costSummary.totalCost} / ${costSummary.maxCost}</p>
        <p><strong>Selected:</strong> base ${costSummary.breakdown.base}, element ${costSummary.breakdown.element}, components ${costSummary.breakdown.components.map((part) => `${toLabel(part.id)} +${part.cost}`).join(', ') || 'none'}</p>
      </div>
      <button type="button" class="craft-button" ${craftDisabled ? 'disabled' : ''}>CRAFT</button>
      <p class="craft-feedback ${this.feedbackType} ${costSummary.withinLimit ? '' : 'error'}">${this.feedback || (!costSummary.withinLimit ? `Spell exceeds crafting limit (${costSummary.totalCost}/${costSummary.maxCost}).` : '')}</p>
    `;

    const baseSelect = this.el.querySelector('.craft-base-select');
    const elementSelect = this.el.querySelector('.craft-element-select');
    const componentInputs = this.el.querySelectorAll('.craft-components input[type="checkbox"]');
    const craftButton = this.el.querySelector('.craft-button');

    baseSelect?.addEventListener('change', (event) => {
      this.selectedBase = event.target.value;
      this.render();
    });

    elementSelect?.addEventListener('change', (event) => {
      this.selectedElement = event.target.value;
      this.render();
    });

    componentInputs.forEach((input) => {
      input.addEventListener('change', (event) => {
        this.toggleComponent(event.target.value, event.target.checked);
        this.render();
      });
    });

    craftButton?.addEventListener('click', () => this.onCraftClick());
  }
}
