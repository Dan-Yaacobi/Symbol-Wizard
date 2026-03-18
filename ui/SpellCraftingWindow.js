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
    this.visible = false;

    this.allowedBases = Object.values(SpellRegistry)
      .filter((spell) => spell?.behavior)
      .map((spell) => spell.id)
      .filter((id) => DESIGN_DOC_BASE_SPELLS.includes(id));

    this.allowedElements = Object.keys(ElementRegistry).filter((element) => DESIGN_DOC_ELEMENTS.includes(element));

    this.allowedComponents = Object.keys(ComponentRegistry).filter((componentId) => DESIGN_DOC_COMPONENTS.includes(componentId));

    this.el = document.createElement('section');
    this.el.className = 'spell-crafting-window hidden';
    this.root.appendChild(this.el);

    this.selectedBase = this.allowedBases[0] ?? '';
  }

  isOpen() {
    return this.visible;
  }

  open() {
    if (this.visible) return;
    this.visible = true;
    this.el.classList.remove('hidden');
    this.render();
  }

  close() {
    if (!this.visible) return;
    this.visible = false;
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
  }

  toggle() {
    if (this.visible) {
      this.close();
      return;
    }
    this.open();
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

  toggleComponent(componentId) {
    if (!this.allowedComponents.includes(componentId)) return;

    if (this.selectedComponents.includes(componentId)) {
      this.selectedComponents = this.selectedComponents.filter((id) => id !== componentId);
      return;
    }

    this.selectedComponents = [...this.selectedComponents, componentId];
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
      console.info('[SpellCraftingWindow] Craft failed.', error);
      this.setFeedback(error instanceof Error ? error.message : 'Craft failed.', 'error');
      this.render();
    }
  }

  render() {
    if (!this.visible) return;

    const costSummary = this.getCostSummary();
    const craftDisabled = !costSummary.withinLimit;
    const baseCost = costSummary.breakdown.base ?? 0;

    const baseMarkup = this.allowedBases
      .map((baseId) => {
        const selected = this.selectedBase === baseId;
        return `
          <button type="button" class="craft-option-button ${selected ? 'selected' : ''}" data-base="${baseId}">
            <span>${SpellRegistry[baseId]?.name ?? toLabel(baseId)}</span>
            <strong class="craft-cost-chip">${selected ? `+${baseCost}` : `+${calculateSpellCost({ base: baseId, element: null, components: [] }).breakdown.base}`}</strong>
          </button>
        `;
      })
      .join('');

    const elementMarkup = this.allowedElements
      .map((element) => {
        const selected = this.selectedElement === element;
        const elementCost = calculateSpellCost({ base: this.selectedBase || this.allowedBases[0], element, components: [] }).breakdown.element;
        return `
          <button type="button" class="craft-option-button ${selected ? 'selected' : ''}" data-element="${element}">
            <span>${toLabel(element)}</span>
            <strong class="craft-cost-chip">+${elementCost}</strong>
          </button>
        `;
      })
      .join('');

    const componentMarkup = this.allowedComponents
      .map((componentId) => {
        const selected = this.selectedComponents.includes(componentId);
        const componentCost = calculateSpellCost({ base: this.selectedBase || this.allowedBases[0], element: null, components: [componentId] }).breakdown.components[0]?.cost ?? 0;
        return `
          <button type="button" class="craft-option-button craft-option-button--component ${selected ? 'selected' : ''}" data-component="${componentId}" aria-pressed="${selected}">
            <span>${toLabel(componentId)}</span>
            <strong class="craft-cost-chip">+${componentCost}</strong>
          </button>
        `;
      })
      .join('');

    this.el.innerHTML = `
      <header class="spell-crafting-header">
        <h3>Spell Crafting</h3>
        <p>C to close • Crafting pauses movement and casting</p>
      </header>
      <div class="spell-crafting-layout">
        <section class="craft-section">
          <h4>1. Base Spell Selection</h4>
          <div class="craft-option-list craft-option-list--compact">
            ${baseMarkup}
          </div>
        </section>
        <section class="craft-section">
          <h4>2. Element Selection</h4>
          <div class="craft-option-list craft-option-list--compact">
            <button type="button" class="craft-option-button ${this.selectedElement === '' ? 'selected' : ''}" data-element="">
              <span>None</span>
              <strong class="craft-cost-chip">+0</strong>
            </button>
            ${elementMarkup}
          </div>
        </section>
        <section class="craft-section">
          <h4>3. Component List</h4>
          <div class="craft-option-list craft-option-list--scroll">
            ${componentMarkup}
          </div>
        </section>
        <section class="craft-section craft-section--summary">
          <h4>4. Craft Button</h4>
          <div class="craft-cost-summary ${costSummary.withinLimit ? '' : 'over-limit'}">
            <p><strong>Cost:</strong> ${costSummary.totalCost} / ${costSummary.maxCost}</p>
            <p><strong>Selected:</strong> base ${costSummary.breakdown.base}, element ${costSummary.breakdown.element}, components ${costSummary.breakdown.components.map((part) => `${toLabel(part.id)} +${part.cost}`).join(', ') || 'none'}</p>
          </div>
          <button type="button" class="craft-button" ${craftDisabled ? 'disabled' : ''}>CRAFT</button>
          <p class="craft-feedback ${this.feedbackType} ${costSummary.withinLimit ? '' : 'error'}">${this.feedback || (!costSummary.withinLimit ? `Spell exceeds crafting limit (${costSummary.totalCost}/${costSummary.maxCost}).` : '')}</p>
        </section>
      </div>
    `;

    this.el.querySelectorAll('[data-base]').forEach((button) => {
      button.addEventListener('click', () => {
        this.selectedBase = button.dataset.base ?? '';
        this.render();
      });
    });

    this.el.querySelectorAll('[data-element]').forEach((button) => {
      button.addEventListener('click', () => {
        this.selectedElement = button.dataset.element ?? '';
        this.render();
      });
    });

    this.el.querySelectorAll('[data-component]').forEach((button) => {
      button.addEventListener('click', () => {
        const componentId = button.dataset.component;
        if (!componentId) return;
        this.toggleComponent(componentId);
        this.render();
      });
    });

    this.el.querySelector('.craft-button')?.addEventListener('click', () => this.onCraftClick());
  }
}
