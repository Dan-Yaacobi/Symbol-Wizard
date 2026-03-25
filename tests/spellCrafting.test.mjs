import assert from 'node:assert/strict';
import { Player } from '../entities/Player.js';
import { craftSpell, craftRecipeSpell, getCraftableSpellRecipes, getRecipeCraftingState } from '../systems/spells/SpellCrafting.js';
import { castSpell, updateSpellInstances } from '../systems/spells/SpellCaster.js';
import { SpellRegistry, defaultSpellSlots } from '../data/spells.js';

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
    enemies: [{ x: 6, y: 4, alive: true, radius: 0.8 }],
    createProjectile(x, y, dx, dy, payload) {
      const projectile = { x, y, dx, dy, ...payload };
      this.projectiles.push(projectile);
      return projectile;
    },
    spawnEffect(effect) {
      this.effects.push(effect);
    },
    getEntitiesInRadius(x, y, radius) {
      return this.enemies.filter((enemy) => Math.hypot(enemy.x - x, enemy.y - y) <= radius + (enemy.radius ?? 0));
    },
    applySpellDamage(target, damage) {
      target.lastDamage = damage;
      target.hitCount = (target.hitCount ?? 0) + 1;
    },
    applyDamage() {},
    applyStatus(target, type, duration) {
      this.statuses.push({ target, type, duration });
      return true;
    },
    isWalkable() {
      return true;
    },
  };
}

function testRecipesExposeSupportedBehaviorsAndElements() {
  const recipes = getCraftableSpellRecipes();
  assert.deepEqual(recipes.map((recipe) => recipe.name), [
    'Fire Bolt',
    'Frost Beam',
    'Lightning Chain',
    'Poison Zone',
    'Fire Aura',
    'Frost Orbit',
    'Arcane Nova',
    'Blink',
    'Arcane Orb',
  ]);
  assert.deepEqual([...new Set(recipes.map((recipe) => recipe.behavior))], [
    'projectile',
    'beam',
    'chain',
    'zone',
    'aura',
    'orbit',
    'nova',
    'blink',
  ]);
  assert.deepEqual([...new Set(recipes.flatMap((recipe) => recipe.validElements))].sort(), [
    'arcane',
    'fire',
    'frost',
    'lightning',
    'poison',
    'void',
  ]);
  assert.deepEqual(recipes.find((recipe) => recipe.id === 'frost_beam')?.ingredients, [
    { itemId: 'frost_core', amount: 1 },
    { itemId: 'essence', amount: 5 },
    { itemId: 'stone', amount: 10 },
  ]);
}

function testDefaultSpellbookIsClean() {
  const defaultSpellbookIds = ['magic-bolt', 'blink', 'fire-burst'];
  assert.deepEqual(defaultSpellSlots, defaultSpellbookIds);
  assert.deepEqual(defaultSpellbookIds.map((spellId) => SpellRegistry[spellId]?.name), ['Magic Bolt', 'Blink', 'Fire Burst']);
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
  const spell = craftSpell({ recipeId: 'lightning_chain', random: sequenceRng([0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]) });

  assert.equal(spell.recipeId, 'lightning_chain');
  assert.equal(spell.element, 'lightning');
  assert.equal(spell.behavior, 'chain');
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
  assert.ok(effectTypes.every((type) => ['pierce', 'knockback', 'gravity_pull', 'explode', 'trail', 'zone_trail', 'split', 'periodic_explosion'].includes(type)));
}

function testEveryCraftableBehaviorCastsAtRuntime() {
  const recipeIds = ['fire_bolt', 'frost_beam', 'lightning_chain', 'poison_zone', 'fire_aura', 'frost_orbit', 'arcane_nova', 'void_blink', 'arcane_orb'];

  for (const recipeId of recipeIds) {
    const spell = craftSpell({ recipeId, random: sequenceRng([0.4, 0.5, 0.45, 0.55, 0.35, 0.65, 0.5, 0.5, 0.5]) });
    const system = buildCastingSystem();
    const result = castSpell(spell, {
      player: { x: 2, y: 2, facingX: 1, facingY: 0 },
      system,
      activeSpellInstances: system.activeSpellInstances,
      targetPosition: { x: 7, y: 4 },
    });

    assert.equal(result.ok, true, `Expected ${recipeId} to cast successfully.`);

    if (spell.behavior === 'projectile') {
      assert.equal(system.projectiles.length, 1, `${recipeId} should spawn a projectile.`);
    } else {
      assert.ok(system.activeSpellInstances.length >= 1, `${recipeId} should create an active spell instance.`);
      assert.ok(system.activeSpellInstances.some((entry) => entry.instance.base.behavior === spell.behavior));
    }
  }
}

function testOrbitAndAreaSpellsContinueUpdatingAfterCast() {
  const orbitSpell = craftSpell({ recipeId: 'frost_orbit', random: sequenceRng([0.3, 0.5, 0.5, 0.5, 0.4, 0.6, 0.5, 0.5]) });
  const zoneSpell = craftSpell({ recipeId: 'poison_zone', random: sequenceRng([0.65, 0.3, 0.4, 0.6, 0.7, 0.2, 0.5, 0.9]) });
  const system = buildCastingSystem();
  system.enemies = [{ x: 6, y: 4, alive: true, radius: 0.8 }];
  const player = { x: 2, y: 2, facingX: 1, facingY: 0 };

  assert.equal(castSpell(orbitSpell, { player, system, activeSpellInstances: system.activeSpellInstances, targetPosition: { x: 7, y: 4 } }).ok, true);
  assert.equal(castSpell(zoneSpell, { player, system, activeSpellInstances: system.activeSpellInstances, targetPosition: { x: 6, y: 4 } }).ok, true);

  updateSpellInstances(system.activeSpellInstances, 1, { system, player });

  const orbitInstance = system.activeSpellInstances.find((entry) => entry.instance.base.behavior === 'orbit');
  const zoneInstance = system.activeSpellInstances.find((entry) => entry.instance.base.behavior === 'zone');

  assert.ok(orbitInstance?.instance.state.orbit?.orbs?.length >= 1);
  assert.ok(zoneInstance?.instance.state.zone?.tickAccumulator >= 0);
  assert.ok(system.enemies[0].hitCount >= 1);
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

function testArcaneOrbHasSlowHeavyPersistentProjectileIdentity() {
  const spell = craftSpell({ recipeId: 'arcane_orb', random: sequenceRng([0.55, 0.4, 0.55, 0.5, 0.6, 0.4, 0.4, 0.4]) });
  const system = buildCastingSystem();
  const player = { x: 2, y: 2, facingX: 1, facingY: 0 };

  assert.equal(castSpell(spell, {
    player,
    system,
    activeSpellInstances: system.activeSpellInstances,
    targetPosition: { x: 9, y: 2 },
  }).ok, true);

  const orb = system.projectiles[0];
  assert.ok(orb);
  assert.ok(orb.speed < SpellRegistry['magic-bolt'].parameters.speed);
  assert.ok(orb.damage > SpellRegistry['magic-bolt'].parameters.damage);
  assert.ok(orb.ttl > SpellRegistry['magic-bolt'].parameters.ttl);
  assert.ok((orb.radius ?? 0) > SpellRegistry['magic-bolt'].parameters.size);
  assert.equal(orb.directionalSpriteFrames, null);
  assert.ok(Array.isArray(orb.spriteFrames) && orb.spriteFrames[0]?.length >= 5);
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

function testLightningChainMaxJumpsRollsAsIntegerWithinBounds() {
  const lowRoll = craftSpell({ recipeId: 'lightning_chain', random: sequenceRng([0.2, 0, 0, 0.4, 0.4, 0.4, 0.4, 0.4]) });
  const highRoll = craftSpell({ recipeId: 'lightning_chain', random: sequenceRng([0.2, 1, 1, 0.4, 0.4, 0.4, 0.4, 0.4]) });

  for (const spell of [lowRoll, highRoll]) {
    assert.ok(Number.isInteger(spell.baseStats.maxJumps));
    assert.ok(Number.isInteger(spell.finalStats.maxJumps));
    assert.ok(Number.isInteger(spell.parameters.maxJumps));
    assert.ok(spell.parameters.maxJumps >= 4);
    assert.ok(spell.parameters.maxJumps <= 10);
  }
}

function testLightningChainJumpRangeIsMeaningfullyLargerByDefault() {
  const spell = craftSpell({ recipeId: 'lightning_chain', random: sequenceRng([0.2, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]) });
  assert.ok(spell.parameters.chainRange >= 9);
}

function testBlinkCraftingRollsRangeManaCooldownAndBlinkAugments() {
  const spell = craftSpell({ recipeId: 'void_blink', random: sequenceRng([0.95, 0.5, 0.5, 0.5, 0.4, 0.9, 0.5]) });
  assert.equal(spell.behavior, 'blink');
  assert.ok(Number.isFinite(spell.parameters.range));
  assert.ok(Number.isFinite(spell.parameters.cooldown));
  assert.ok(Number.isFinite(spell.parameters.manaCost));
  assert.ok(spell.bonusEffects.some((effect) => ['double_blink', 'thunder_blink', 'shadow_blink'].includes(effect.type)));
}

function testBlinkCraftingCanRollThreeUniqueAugments() {
  const spell = craftSpell({
    recipeId: 'void_blink',
    random: sequenceRng([
      0.95, // profile
      0.5, 0.5, 0.5, // stat rolls
      0.99, // roll count => 3
      0.1, 0.7, 0.95, // rarity picks => common, uncommon, rare
      0.2, 0.2, 0.2, // pool picks
    ]),
  });
  assert.equal(spell.bonusEffects.length, 3);
  assert.deepEqual(
    spell.bonusEffects.map((effect) => effect.type).sort(),
    ['double_blink', 'shadow_blink', 'thunder_blink'],
  );
}

function run() {
  testRecipesExposeSupportedBehaviorsAndElements();
  testDefaultSpellbookIsClean();
  testCraftVariationAcrossRolls();
  testIdentityAndGuaranteedEffectsArePreserved();
  testBonusEffectsStayWithinValidPoolAndRemainUnique();
  testEveryCraftableBehaviorCastsAtRuntime();
  testOrbitAndAreaSpellsContinueUpdatingAfterCast();
  testProfileModifiersChangeStatsFromBaseToFinal();
  testArcaneOrbHasSlowHeavyPersistentProjectileIdentity();
  testRecipeCraftingConsumesItemsAndAddsSpell();
  testRecipeCraftingStateReportsMissingIngredients();
  testLightningChainMaxJumpsRollsAsIntegerWithinBounds();
  testLightningChainJumpRangeIsMeaningfullyLargerByDefault();
  testBlinkCraftingRollsRangeManaCooldownAndBlinkAugments();
  testBlinkCraftingCanRollThreeUniqueAugments();
  console.log('Spell crafting tests passed.');
}

run();
