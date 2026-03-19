import assert from 'node:assert/strict';
import { Player } from '../entities/Player.js';
import { craftSpell, craftRecipeSpell, getCraftableSpellRecipes, getRecipeCraftingState } from '../systems/spells/SpellCrafting.js';
import { castSpell } from '../systems/spells/SpellCaster.js';

function sequenceRng(values) {
  let index = 0;
  return () => {
    const value = values[index] ?? values.at(-1) ?? 0.5;
    index += 1;
    return value;
  };
}

function buildCastingSystem() {
  return {
    projectiles: [],
    effects: [],
    statuses: [],
    activeSpellInstances: [],
    createProjectile(x, y, dx, dy, payload) {
      const projectile = { x, y, dx, dy, ...payload };
      this.projectiles.push(projectile);
      return projectile;
    },
    spawnEffect(effect) {
      this.effects.push(effect);
    },
    getEntitiesInRadius() {
      return [];
    },
    applySpellDamage() {},
    applyDamage() {},
    applyStatus(target, type, duration) {
      this.statuses.push({ target, type, duration });
      return true;
    },
  };
}

function testRecipesExposeFixedIdentity() {
  const recipes = getCraftableSpellRecipes();
  assert.deepEqual(recipes.map((recipe) => recipe.name), [
    'Fire Bolt',
    'Frost Beam',
    'Lightning Beam',
    'Poison Zone',
    'Arcane Orb',
  ]);
  assert.ok(recipes.every((recipe) => recipe.validElements.length >= 1));
  assert.deepEqual(recipes.find((recipe) => recipe.id === 'frost_beam')?.ingredients, [
    { itemId: 'frost_core', amount: 1 },
    { itemId: 'essence', amount: 5 },
    { itemId: 'stone', amount: 10 },
  ]);
}

function testCraftVariationAcrossRolls() {
  const first = craftSpell({ recipeId: 'fire_bolt', random: sequenceRng([0.02, 0.05, 0.1, 0.2, 0.3, 0.1, 0.2, 0.3, 0.9]) });
  const second = craftSpell({ recipeId: 'fire_bolt', random: sequenceRng([0.95, 0.92, 0.85, 0.8, 0.75, 0.6, 0.55, 0.5, 0.1]) });

  assert.equal(first.name, 'Fire Bolt');
  assert.equal(second.name, 'Fire Bolt');
  assert.notDeepEqual(first.baseStats, second.baseStats);
  assert.notEqual(first.profile.id, second.profile.id);
}

function testIdentityAndGuaranteedEffectsArePreserved() {
  const spell = craftSpell({ recipeId: 'lightning_beam', random: sequenceRng([0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]) });

  assert.equal(spell.recipeId, 'lightning_beam');
  assert.equal(spell.element, 'lightning');
  assert.equal(spell.behavior, 'beam');
  assert.deepEqual(spell.components, ['apply_status_on_hit']);
  assert.deepEqual(spell.guaranteedEffects.map((effect) => effect.label), ['Shock']);
  assert.equal(spell.parameters.statusType, 'shock');
}

function testBonusEffectsStayWithinValidPoolAndRemainUnique() {
  const spell = craftSpell({
    recipeId: 'arcane_orb',
    random: sequenceRng([0.8, 0.5, 0.5, 0.5, 0.5, 0.5, 0.8, 0.95, 0.2, 0.7, 0.7]),
  });

  const effectTypes = spell.bonusEffects.map((effect) => effect.type);
  assert.ok(effectTypes.length <= 2);
  assert.equal(new Set(effectTypes).size, effectTypes.length);
  assert.ok(effectTypes.every((type) => ['pierce', 'knockback', 'explode', 'trail', 'split'].includes(type)));
}

function testCraftedSpellRemainsRuntimeCastable() {
  const spell = craftSpell({
    recipeId: 'poison_zone',
    random: sequenceRng([0.65, 0.3, 0.4, 0.6, 0.7, 0.2, 0.5, 0.9]),
  });
  const system = buildCastingSystem();

  const result = castSpell(spell, {
    player: { x: 2, y: 2, facingX: 1, facingY: 0 },
    system,
    activeSpellInstances: system.activeSpellInstances,
    targetPosition: { x: 5, y: 5 },
  });

  assert.equal(result.ok, true);
  assert.equal(system.activeSpellInstances.length, 1);
  assert.equal(system.activeSpellInstances[0].instance.base.behavior, 'zone');
}

function testProfileModifiersChangeStatsFromBaseToFinal() {
  const spell = craftSpell({
    recipeId: 'fire_bolt',
    random: sequenceRng([0.41, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.2]),
  });

  assert.equal(spell.profile.id, 'heavy');
  assert.ok(spell.finalStats.damage > spell.baseStats.damage);
  assert.ok(spell.finalStats.speed < spell.baseStats.speed);
  assert.ok(spell.finalStats.cooldown > spell.baseStats.cooldown);
}

function testRecipeCraftingConsumesItemsAndAddsSpell() {
  const player = new Player(0, 0);
  player.unlockRecipe('frost_beam');
  player.addItem('frost_core', 1);
  player.addItem('essence', 5);
  player.addItem('stone', 10);
  const spells = [];

  const craftedSpell = craftRecipeSpell({
    recipeId: 'frost_beam',
    player,
    addSpell: (spell) => {
      spells.push(spell);
      return true;
    },
    random: sequenceRng([0.2, 0.3, 0.4, 0.5, 0.6, 0.7]),
  });

  assert.equal(craftedSpell.recipeId, 'frost_beam');
  assert.equal(spells.length, 1);
  assert.equal(player.hasItem('frost_core', 1), false);
  assert.equal(player.getItemCount('essence'), 0);
  assert.equal(player.getItemCount('stone'), 0);
}

function testRecipeCraftingStateReportsMissingIngredients() {
  const player = new Player(0, 0);
  player.unlockRecipe('frost_beam');
  player.addItem('essence', 2);

  const state = getRecipeCraftingState({ recipeId: 'frost_beam', player });

  assert.equal(state.unlocked, true);
  assert.equal(state.canCraft, false);
  assert.deepEqual(state.ingredients.map(({ itemId, owned, hasEnough }) => ({ itemId, owned, hasEnough })), [
    { itemId: 'frost_core', owned: 0, hasEnough: false },
    { itemId: 'essence', owned: 2, hasEnough: false },
    { itemId: 'stone', owned: 0, hasEnough: false },
  ]);
}

function run() {
  testRecipesExposeFixedIdentity();
  testCraftVariationAcrossRolls();
  testIdentityAndGuaranteedEffectsArePreserved();
  testBonusEffectsStayWithinValidPoolAndRemainUnique();
  testCraftedSpellRemainsRuntimeCastable();
  testProfileModifiersChangeStatsFromBaseToFinal();
  testRecipeCraftingConsumesItemsAndAddsSpell();
  testRecipeCraftingStateReportsMissingIngredients();
  console.log('Spell crafting tests passed.');
}

run();
