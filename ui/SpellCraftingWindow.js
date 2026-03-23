import { getItemName } from '../data/itemCatalog.js';
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

function buildStatMarkup(label, baseValue, finalValue) {
  const deltaClass = finalValue > baseValue ? 'positive' : (finalValue < baseValue ? 'negative' : 'neutral');
  return `
    <li class="craft-stat-row ${deltaClass}">
      <span>${label}</span>
      <strong>${formatStatValue(baseValue)} → ${formatStatValue(finalValue)}</strong>
    </li>
  `;
}

function effectMarkup(effect) {
  const rarity = effect.rarity ? `<span class="craft-tag craft-tag--rarity">${toLabel(effect.rarity)}</span>` : '';
  return `<li><span>${effect.label ?? toLabel(effect.type)}</span>${rarity}</li>`;
}

function ingredientMarkup(ingredient) {
  return `
    <li class="craft-ingredient-row ${ingredient.hasEnough ? 'ready' : 'missing'}">
      <span>${getItemName(ingredient.itemId)}</span>
      <strong>${ingredient.owned}/${ingredient.amount}</strong>
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
    this.selectedRecipeId = this.recipes[0]?.id ?? '';
    this.selectedElement = this.getSelectedRecipe()?.validElements?.[0] ?? '';

    this.el = document.createElement('section');
    this.el.className = 'spell-crafting-window hidden';
    this.root.appendChild(this.el);
  }

  getUnlockedRecipes() {
    return getUnlockedSpellCraftRecipes(this.player?.unlockedRecipes);
  }

  getSelectedRecipe() {
    this.recipes = this.getUnlockedRecipes();
    if (!this.recipes.some((recipe) => recipe.id === this.selectedRecipeId)) {
      this.selectedRecipeId = this.recipes[0]?.id ?? '';
    }
    const recipe = this.recipes.find((recipe) => recipe.id === this.selectedRecipeId) ?? null;
    if (!recipe) {
      this.selectedElement = '';
      return null;
    }
    if (!recipe.validElements.includes(this.selectedElement)) {
      this.selectedElement = recipe.validElements[0] ?? '';
    }
    return recipe;
  }

  getSelectedElement() {
    const recipe = this.getSelectedRecipe();
    if (!recipe) return '';
    return recipe.validElements.includes(this.selectedElement) ? this.selectedElement : (recipe.validElements[0] ?? '');
  }

  getCraftingState() {
    return getRecipeCraftingState({ recipeId: this.selectedRecipeId, player: this.player });
  }

  isOpen() { return this.visible; }

  open() {
    if (this.visible) return;
    this.visible = true;
    this.recipes = this.getUnlockedRecipes();
    if (!this.recipes.some((recipe) => recipe.id === this.selectedRecipeId)) {
      this.selectedRecipeId = this.recipes[0]?.id ?? '';
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
    this.selectedRecipeId = recipe.id;
    this.selectedElement = recipe.validElements[0] ?? '';
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

    const recipe = this.getSelectedRecipe();
    const selectedElement = this.getSelectedElement();
    const craftingState = this.getCraftingState();
    const canCraft = Boolean(recipe) && craftingState.canCraft && this.craftState !== 'charging';
    const result = this.lastCraftedSpell;
    const identityStats = result
      ? Object.entries(result.finalStats).map(([key, finalValue]) => buildStatMarkup(toLabel(key), result.baseStats[key], finalValue)).join('')
      : '<li class="craft-stat-row neutral"><span>No craft rolled yet</span><strong>Craft to reveal stats</strong></li>';

    const recipeMarkup = this.recipes.length > 0
      ? this.recipes.map((entry) => `
        <button type="button" class="craft-option-button ${entry.id === this.selectedRecipeId ? 'selected' : ''}" data-recipe="${entry.id}">
          <span>${entry.name}</span>
          <small>${toLabel(entry.behavior)}</small>
        </button>
      `).join('')
      : '<p class="craft-muted">No recipes unlocked yet.</p>';

    const elementMarkup = (recipe?.validElements ?? []).map((element) => `
      <button type="button" class="craft-option-button ${element === selectedElement ? 'selected' : ''}" data-element="${element}">
        <span>${toLabel(element)}</span>
        <small>${recipe.validElements.length === 1 ? 'Fixed' : 'Valid'}</small>
      </button>
    `).join('');

    const ingredientRows = craftingState.ingredients.length > 0
      ? craftingState.ingredients.map(ingredientMarkup).join('')
      : '<li class="craft-ingredient-row missing"><span>No ingredient list</span><strong>—</strong></li>';
    const missingIngredients = craftingState.ingredients.filter((ingredient) => !ingredient.hasEnough);
    const ingredientSummary = missingIngredients.length === 0
      ? 'Can craft now.'
      : `Missing: ${missingIngredients.map((ingredient) => `${getItemName(ingredient.itemId)} (${ingredient.amount - ingredient.owned})`).join(', ')}`;

    const guaranteedEffects = result?.guaranteedEffects?.map(effectMarkup).join('') ?? '<li><span>Recipe identity effect will appear here.</span></li>';
    const bonusEffects = result?.bonusEffects?.length
      ? result.bonusEffects.map(effectMarkup).join('')
      : '<li><span>No bonus effects rolled.</span></li>';

    this.el.innerHTML = `
      <header class="spell-crafting-header">
        <h3>Spell Crafting</h3>
        <p>C to close • Fixed recipes with required items</p>
      </header>
      <div class="spell-crafting-layout spell-crafting-layout--overhauled ${this.craftState}">
        <section class="craft-section">
          <h4>1. Unlocked Recipes</h4>
          <p class="craft-section-copy">Only unlocked recipes appear here for now.</p>
          <div class="craft-option-list">${recipeMarkup}</div>
        </section>
        <section class="craft-section">
          <h4>2. Elements & Ingredients</h4>
          <p class="craft-section-copy">Behavior and element are recipe-driven; materials gate the craft.</p>
          <div class="craft-option-list">${elementMarkup || '<p class="craft-muted">No elements available.</p>'}</div>
          <ul class="craft-ingredient-list">${ingredientRows}</ul>
          <p class="craft-recipe-status ${craftingState.canCraft ? 'ready' : 'missing'}">${ingredientSummary}</p>
        </section>
        <section class="craft-section craft-section--summary">
          <h4>3. Craft Action</h4>
          <div class="craft-result-banner ${this.craftState}">
            <strong>${recipe?.name ?? 'No Recipe Selected'}</strong>
            <span>${recipe?.craftingSummary ?? 'Unlock a recipe to begin.'}</span>
          </div>
          <button type="button" class="craft-button" ${canCraft ? '' : 'disabled'}>${this.craftState === 'charging' ? 'CRAFTING…' : 'CRAFT SPELL'}</button>
          <p class="craft-feedback ${this.feedbackType}">${this.feedback || (recipe ? ingredientSummary : 'Unlock a recipe to start crafting.')}</p>
        </section>
        <section class="craft-section craft-section--result">
          <h4>4. Result Preview</h4>
          <div class="craft-result-card ${result ? 'is-ready' : ''}">
            <div class="craft-result-heading">
              <div>
                <p class="craft-result-label">Spell Identity</p>
                <h5>${result?.name ?? recipe?.name ?? 'Awaiting Craft'}</h5>
              </div>
              <div class="craft-result-tags">
                <span class="craft-tag">${toLabel(result?.recipeId ?? recipe?.id ?? 'recipe')}</span>
                <span class="craft-tag">${toLabel(result?.element ?? (selectedElement || 'element'))}</span>
                <span class="craft-tag">${result?.profile?.name ?? 'Profile Pending'}</span>
              </div>
            </div>
            <div class="craft-result-grid">
              <section>
                <h6>Guaranteed Effects</h6>
                <ul class="craft-effect-list">${guaranteedEffects}</ul>
              </section>
              <section>
                <h6>Bonus Effects</h6>
                <ul class="craft-effect-list">${bonusEffects}</ul>
              </section>
            </div>
            <section>
              <h6>Stat Roll Breakdown</h6>
              <ul class="craft-stat-list">${identityStats}</ul>
            </section>
            <section class="craft-result-summary">
              <h6>Roll Readout</h6>
              <p>${result?.profile?.summary ?? 'The rolled profile summary will appear after crafting.'}</p>
            </section>
          </div>
        </section>
      </div>
    `;

    this.el.querySelectorAll('[data-recipe]').forEach((button) => {
      button.addEventListener('click', () => this.selectRecipe(button.dataset.recipe ?? ''));
    });

    this.el.querySelectorAll('[data-element]').forEach((button) => {
      button.addEventListener('click', () => {
        this.selectedElement = button.dataset.element ?? '';
        this.render();
      });
    });

    this.el.querySelector('.craft-button')?.addEventListener('click', () => {
      void this.onCraftClick();
    });
  }
}
