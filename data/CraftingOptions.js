import { getCraftableSpellRecipes } from '../systems/spells/SpellCrafting.js';

export const CraftingOptions = Object.freeze({
  recipes: Object.freeze(getCraftableSpellRecipes()),
});

export function getCraftableRecipeIds() {
  return CraftingOptions.recipes.map((recipe) => recipe.id);
}
