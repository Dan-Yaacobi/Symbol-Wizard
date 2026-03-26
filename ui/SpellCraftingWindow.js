import { getItemName } from '../data/itemCatalog.js';
import { getRecipeGuaranteedEffects, SPELL_CRAFT_PROFILES } from '../data/spellCraftRecipes.js';
import { getUnlockedSpellCraftRecipes, craftRecipeSpell, getRecipeCraftingState } from '../systems/spells/SpellCrafting.js';

function toLabel(value) {
  return String(value)
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatStatValue(value) {
  if (!Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');
}

function ingredientMarkup(ingredient) {
  return `
    <li class="craft-ingredient-row ${ingredient.hasEnough ? 'ready' : 'missing'}">
      <span>${getItemName(ingredient.itemId)}</span>
      <strong>${ingredient.owned}/${ingredient.amount}</strong>
    </li>
  `;
}

function getBehaviorLabel(behavior) {
  switch (behavior) {
    case 'projectile': return 'Bolt';
    case 'beam': return 'Beam';
    case 'orbit':
    case 'zone':
    case 'nova': return 'Orb';
    case 'chain': return 'Chain';
    case 'blink': return 'Blink';
    default: return toLabel(behavior);
  }
}

function getBehaviorGlyph(behavior) {
  switch (behavior) {
    case 'projectile': return '➤';
    case 'beam': return '┃';
    case 'orbit':
    case 'zone':
    case 'nova': return '◉';
    case 'chain': return 'ϟ';
    case 'blink': return '✦';
    default: return '✧';
  }
}

function getElementColor(element) {
  switch (element) {
    case 'fire': return '#ff9f66';
    case 'frost': return '#bfe8ff';
    case 'lightning': return '#ffe76a';
    case 'poison': return '#8ed96f';
    case 'arcane':
    default:
      return '#b296ff';
  }
}

function augmentToPrefix(label) {
  if (!label) return '';
  const value = label.toLowerCase();
  if (value.includes('shock') || value.includes('lightning') || value.includes('static')) return 'Chain';
  if (value.includes('shadow')) return 'Shadow';
  if (value.includes('explode') || value.includes('burst')) return 'Explosive';
  if (value.includes('burn') || value.includes('cinder')) return 'Scorching';
  if (value.includes('slow') || value.includes('freeze')) return 'Frozen';
  return toLabel(label).split(' ')[0];
}

function getEffectPool(recipe) {
  return ['common', 'uncommon', 'rare'].flatMap((rarity) =>
    (recipe?.effectPool?.[rarity] ?? []).map((effect) => ({ ...effect, rarity })),
  );
}

function getPrimaryPreviewAugment(recipe) {
  const effects = getEffectPool(recipe).filter((effect) => Number.isFinite(effect.weight) || effect.label);
  if (!effects.length) return null;
  return effects.sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1))[0] ?? null;
}

function getMidpointStats(recipe) {
  const stats = {};
  for (const [key, [min, max]] of Object.entries(recipe?.statRanges ?? {})) {
    stats[key] = (min + max) / 2;
  }
  return stats;
}

function buildComposedName({ recipe, element, keyAugment }) {
  if (!recipe) return '';
  const behaviorLabel = getBehaviorLabel(recipe?.behavior);
  const elementLabel = toLabel(element || recipe?.validElements?.[0] || 'Arcane');
  const augmentPrefix = augmentToPrefix(keyAugment?.label);
  return `${augmentPrefix ? `${augmentPrefix} ` : ''}${elementLabel} ${behaviorLabel}`.replace(/\s+/g, ' ').trim();
}

function buildPreviewData({ recipe, element, lastCraftedSpell }) {
  if (!recipe) {
    return {
      selectedElement: element || '',
      guaranteedEffects: [],
      keyAugment: null,
      composedName: '',
      iconGlyph: '✧',
      iconColor: getElementColor(element || 'arcane'),
      behaviorSummary: 'Pick an element and spell to preview its crafted result.',
      estimatedStats: {},
      rolledStats: null,
    };
  }

  const selectedElement = element || recipe?.validElements?.[0] || '';
  const guaranteedEffects = getRecipeGuaranteedEffects(recipe, selectedElement);
  const keyAugment = lastCraftedSpell?.bonusEffects?.[0] ?? guaranteedEffects[0] ?? getPrimaryPreviewAugment(recipe);

  const baseStats = getMidpointStats(recipe);
  const efficientModifiers = SPELL_CRAFT_PROFILES.efficient?.modifiers ?? {};
  const estimatedStats = Object.fromEntries(
    Object.entries(baseStats).map(([key, value]) => [key, value * (efficientModifiers[key] ?? 1)]),
  );

  return {
    selectedElement,
    guaranteedEffects,
    keyAugment,
    composedName: buildComposedName({ recipe, element: selectedElement, keyAugment }),
    iconGlyph: getBehaviorGlyph(recipe?.behavior),
    iconColor: getElementColor(selectedElement),
    behaviorSummary: recipe?.craftingSummary ?? 'Configure spell behavior and element details.',
    estimatedStats,
    rolledStats: lastCraftedSpell?.finalStats ?? null,
  };
}

function buildStatRow(label, estimated, rolled) {
  return `
    <li class="craft-stat-row">
      <span>${label}</span>
      <strong>${formatStatValue(estimated)}${Number.isFinite(rolled) ? ` <em>(${formatStatValue(rolled)} rolled)</em>` : ''}</strong>
    </li>
  `;
}

export class SpellCraftingWindow {
  constructor({ root, spellbook, player, onCrafted }) {
    this.root = root;
    this.spellbook = spellbook;
    this.player = player;
    this.onCrafted = onCrafted;
    this.visible = false;
    this.feedback = '';
    this.feedbackType = '';
    this.craftState = 'idle';
    this.activeCraftToken = 0;
    this.lastCraftedSpell = null;

    this.recipes = this.getUnlockedRecipes();
    this.selectedRecipeId = '';
    this.selectedElement = '';

    this.el = document.createElement('section');
    this.el.className = 'spell-crafting-window hidden';
    this.root.appendChild(this.el);
  }

  getUnlockedRecipes() {
    return getUnlockedSpellCraftRecipes(this.player?.unlockedRecipes);
  }

  getSelectedRecipe() {
    this.recipes = this.getUnlockedRecipes();
    const recipe = this.recipes.find((entry) => entry.id === this.selectedRecipeId) ?? null;
    if (!recipe) return null;
    if (this.selectedElement && !recipe.validElements.includes(this.selectedElement)) return null;
    return recipe;
  }

  getRecipesForSelectedElement() {
    if (!this.selectedElement) return [];
    return this.recipes.filter((recipe) => recipe.validElements.includes(this.selectedElement));
  }

  getSelectedElement() {
    return this.selectedElement;
  }

  getCraftingState() {
    return getRecipeCraftingState({ recipeId: this.selectedRecipeId, player: this.player });
  }

  isOpen() { return this.visible; }

  open() {
    if (this.visible) return;
    this.visible = true;
    this.recipes = this.getUnlockedRecipes();
    if (this.selectedRecipeId && !this.recipes.some((recipe) => recipe.id === this.selectedRecipeId)) {
      this.selectedRecipeId = '';
    }
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
    if (this.visible) this.close();
    else this.open();
  }

  setFeedback(message, type) {
    this.feedback = message;
    this.feedbackType = type;
  }

  selectRecipe(recipeId) {
    const recipe = this.recipes.find((entry) => entry.id === recipeId);
    if (!recipe) return;
    if (!this.selectedElement || !recipe.validElements.includes(this.selectedElement)) return;
    if (this.selectedRecipeId === recipe.id) return;
    this.selectedRecipeId = recipe.id;
    this.render();
  }

  selectElement(element) {
    if (!element || this.selectedElement === element) return;
    this.selectedElement = element;
    const elementRecipes = this.getRecipesForSelectedElement();
    if (!elementRecipes.some((recipe) => recipe.id === this.selectedRecipeId)) {
      this.selectedRecipeId = '';
    }
    this.render();
  }

  async onCraftClick() {
    const recipe = this.getSelectedRecipe();
    const craftingState = this.getCraftingState();
    if (!recipe) {
      this.setFeedback('No unlocked recipe selected.', 'error');
      this.render();
      return;
    }
    if (!craftingState.canCraft) {
      this.setFeedback('Missing ingredients for this recipe.', 'error');
      this.render();
      return;
    }

    const craftToken = ++this.activeCraftToken;
    this.craftState = 'charging';
    this.setFeedback(`Channeling ${recipe.name}...`, 'info');
    this.render();

    await new Promise((resolve) => window.setTimeout(resolve, 220));
    if (craftToken !== this.activeCraftToken) return;

    try {
      const craftedSpell = craftRecipeSpell({
        recipeId: recipe.id,
        player: this.player,
        addSpell: this.onCrafted,
        element: this.getSelectedElement(),
      });

      this.lastCraftedSpell = craftedSpell;
      this.craftState = 'revealed';
      this.setFeedback(`Crafted ${craftedSpell.name}. Ingredients consumed.`, 'success');
      this.spellbook?.render?.();
      this.render();

      window.setTimeout(() => {
        if (this.craftState === 'revealed') {
          this.craftState = 'idle';
          this.render();
        }
      }, 520);
    } catch (error) {
      console.info('[SpellCraftingWindow] Craft failed.', error);
      this.craftState = 'idle';
      this.setFeedback(error instanceof Error ? error.message : 'Craft failed.', 'error');
      this.render();
    }
  }

  render() {
    if (!this.visible) return;

    this.recipes = this.getUnlockedRecipes();
    const recipe = this.getSelectedRecipe();
    const selectedElement = this.getSelectedElement();
    const elementRecipes = this.getRecipesForSelectedElement();
    const craftingState = this.getCraftingState();
    const canCraft = Boolean(recipe) && Boolean(selectedElement) && craftingState.canCraft && this.craftState !== 'charging';
    const scopedLastResult = this.lastCraftedSpell?.recipeId === recipe?.id && this.lastCraftedSpell?.element === selectedElement
      ? this.lastCraftedSpell
      : null;
    const preview = buildPreviewData({ recipe, element: selectedElement, lastCraftedSpell: scopedLastResult });

    const recipeMarkup = !selectedElement
      ? '<p class="craft-muted">Select an element to view available spells.</p>'
      : elementRecipes.length > 0
        ? elementRecipes.map((entry) => `
        <button type="button" class="craft-option-button ${entry.id === this.selectedRecipeId ? 'selected' : ''}" data-recipe="${entry.id}">
          <span>${toLabel(entry.name)}</span>
          <small>${getBehaviorLabel(entry.behavior)}</small>
        </button>
      `).join('')
        : '<p class="craft-muted">No spells unlocked for this element.</p>';

    const availableElements = [...new Set(this.recipes.flatMap((entry) => entry.validElements ?? []))];
    const elementMarkup = availableElements.map((element) => `
      <button type="button" class="craft-element-button craft-element-button--${element} ${element === selectedElement ? 'selected' : ''}" data-element="${element}">
        <span>${toLabel(element)}</span>
      </button>
    `).join('');

    const ingredientRows = craftingState.ingredients.length > 0
      ? craftingState.ingredients.map(ingredientMarkup).join('')
      : '<li class="craft-ingredient-row missing"><span>No ingredient list</span><strong>—</strong></li>';
    const missingIngredients = craftingState.ingredients.filter((ingredient) => !ingredient.hasEnough);
    const ingredientSummary = missingIngredients.length === 0
      ? 'All required materials are available.'
      : `Missing: ${missingIngredients.map((ingredient) => `${getItemName(ingredient.itemId)} (${ingredient.amount - ingredient.owned})`).join(', ')}`;

    const statsMarkup = [
      buildStatRow('Damage', preview.estimatedStats.damage, preview.rolledStats?.damage),
      buildStatRow('Cooldown', preview.estimatedStats.cooldown, preview.rolledStats?.cooldown),
      buildStatRow('Mana Cost', preview.estimatedStats.manaCost, preview.rolledStats?.manaCost),
      buildStatRow('Range', preview.estimatedStats.range ?? ((preview.estimatedStats.speed ?? 0) * (preview.estimatedStats.ttl ?? 0)) / 5, preview.rolledStats?.range),
      ...Object.entries(preview.estimatedStats)
        .filter(([key]) => !['damage', 'cooldown', 'manaCost', 'range', 'speed', 'ttl'].includes(key))
        .map(([key, value]) => buildStatRow(toLabel(key), value, preview.rolledStats?.[key])),
    ].join('');

    const actionLabel = this.craftState === 'charging' ? 'CRAFTING…' : 'CRAFT SPELL';
    const actionHint = !selectedElement
      ? 'Select an element first.'
      : !recipe
        ? 'Select a spell to continue.'
        : (canCraft ? 'Ready to craft.' : ingredientSummary);

    this.el.innerHTML = `
      <header class="spell-crafting-header">
        <h3>Spell Crafting</h3>
        <p>C to close • Choose element, then spell, then craft</p>
      </header>
      <div class="spell-crafting-layout ${this.craftState}">
        <section class="craft-panel craft-panel--inputs">
          <div class="craft-subsection">
            <h4>1) Element</h4>
            <div class="craft-element-grid">${elementMarkup || '<p class="craft-muted">No elements available.</p>'}</div>
          </div>
          <div class="craft-subsection">
            <h4>2) Spell</h4>
            <div class="craft-option-list">${recipeMarkup}</div>
          </div>
        </section>

        <section class="craft-panel craft-panel--preview">
          <p class="craft-result-label">Result Preview</p>
          <h4>${preview.composedName || 'Awaiting Spell Selection'}</h4>
          <div class="craft-live-icon" style="--element-color:${preview.iconColor}">
            <span>${preview.iconGlyph}</span>
            <em>${preview.keyAugment?.label ? preview.keyAugment.label[0].toUpperCase() : '•'}</em>
          </div>
          <p class="craft-preview-description">${preview.behaviorSummary}</p>
          <div class="craft-result-tags">
            <span class="craft-tag">${recipe ? getBehaviorLabel(recipe?.behavior) : 'No Spell Selected'}</span>
            <span class="craft-tag">${toLabel(preview.selectedElement || 'Select Element')}</span>
          </div>
        </section>

        <section class="craft-panel craft-panel--stats">
          <h4>Stats & Parameters</h4>
          <ul class="craft-stat-list">${statsMarkup}</ul>
        </section>

        <section class="craft-panel craft-panel--action">
          <div>
            <h4>Materials</h4>
            <ul class="craft-ingredient-list">${ingredientRows}</ul>
            <p class="craft-recipe-status ${craftingState.canCraft ? 'ready' : 'missing'}">${actionHint}</p>
          </div>
          <div>
            <button type="button" class="craft-button" ${canCraft ? '' : 'disabled'}>${actionLabel}</button>
            <p class="craft-feedback ${this.feedbackType}">${this.feedback || actionHint}</p>
          </div>
        </section>
      </div>
    `;

    this.el.querySelectorAll('[data-recipe]').forEach((button) => {
      const recipeId = button.dataset.recipe ?? '';
      button.addEventListener('click', () => this.selectRecipe(recipeId));
    });

    this.el.querySelectorAll('[data-element]').forEach((button) => {
      const element = button.dataset.element ?? '';
      button.addEventListener('click', () => this.selectElement(element));
    });

    this.el.querySelector('.craft-button')?.addEventListener('click', () => {
      void this.onCraftClick();
    });
  }
}
