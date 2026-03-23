import { getRecipeGuaranteedEffects, getSpellCraftRecipe, SPELL_CRAFT_PROFILES, SPELL_CRAFT_RECIPES } from '../../data/spellCraftRecipes.js';
import { validateSpell } from './SpellValidator.js';

const PROFILE_STAT_KEYS = ['damage', 'speed', 'cooldown', 'manaCost', 'duration', 'radius', 'width', 'range'];
const BONUS_RARITY_ORDER = ['common', 'uncommon', 'rare'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundStatValue(key, value) {
  if (!Number.isFinite(value)) return value;
  if (['damage', 'speed', 'manaCost'].includes(key)) return Math.round(value);
  return Math.round(value * 100) / 100;
}

function createRng(random = Math.random) {
  return typeof random === 'function' ? random : Math.random;
}

function pickWeighted(weightMap, random) {
  const entries = Object.entries(weightMap ?? {}).filter(([, weight]) => Number.isFinite(weight) && weight > 0);
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries.at(-1)?.[0] ?? null;
}

function rollRange([min, max], random) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
  return min + (max - min) * random();
}

function deepClone(value) {
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function buildStatusComponent(effect) {
  return effect?.statusType ? 'apply_status_on_hit' : null;
}

function buildParameters(recipe, finalStats, element) {
  const visuals = recipe.visuals ?? {};
  const parameters = {
    damage: finalStats.damage,
    color: visuals.color,
    hitParticleColor: visuals.hitParticleColor,
  };

  if (recipe.behavior === 'projectile') {
    parameters.speed = finalStats.speed;
    parameters.ttl = finalStats.ttl;
    parameters.size = finalStats.size;
    parameters.spriteFrames = visuals.spriteFrames;
  }

  if (recipe.behavior === 'beam') {
    parameters.range = finalStats.range;
    parameters.width = finalStats.width;
    parameters.duration = finalStats.duration;
  }

  if (recipe.behavior === 'chain') {
    parameters.range = finalStats.range;
    parameters.chainCount = finalStats.chainCount;
    parameters.chainRange = finalStats.chainRange;
  }

  if (['zone', 'aura', 'nova'].includes(recipe.behavior)) {
    parameters.radius = finalStats.radius;
    parameters.duration = finalStats.duration;
    parameters.tickInterval = finalStats.tickInterval;
  }

  if (recipe.behavior === 'orbit') {
    parameters.radius = finalStats.radius;
    parameters.speed = finalStats.speed;
    parameters.duration = finalStats.duration;
    parameters.count = finalStats.count;
    parameters.hitRadius = finalStats.hitRadius;
  }

  const statusEffect = getRecipeGuaranteedEffects(recipe, element).find((effect) => effect.type === 'status');
  if (statusEffect?.statusType) {
    parameters.statusType = statusEffect.statusType;
    parameters.statusDuration = statusEffect.duration;
  }

  return parameters;
}

function isEffectCompatible(recipe, effect) {
  if (!effect?.type) return false;
  if (['zone', 'aura', 'nova'].includes(recipe.behavior) && ['pierce', 'bounce', 'split', 'emit_projectiles'].includes(effect.type)) return false;
  if (recipe.behavior === 'beam' && ['pierce', 'bounce', 'split'].includes(effect.type)) return false;
  return true;
}

function profileAffectsStat(statKey) {
  return PROFILE_STAT_KEYS.includes(statKey);
}

function applyProfile(baseStats, profile) {
  const finalStats = {};
  for (const [key, value] of Object.entries(baseStats)) {
    if (!Number.isFinite(value)) {
      finalStats[key] = value;
      continue;
    }
    const multiplier = profileAffectsStat(key) ? (profile?.modifiers?.[key] ?? 1) : 1;
    finalStats[key] = roundStatValue(key, value * multiplier);
  }
  if (Number.isFinite(finalStats.tickInterval)) {
    finalStats.tickInterval = clamp(finalStats.tickInterval, 0.12, 1.5);
  }
  return finalStats;
}

function rollStats(recipe, random) {
  const baseStats = {};
  for (const [key, range] of Object.entries(recipe.statRanges ?? {})) {
    baseStats[key] = roundStatValue(key, rollRange(range, random));
  }
  return baseStats;
}

function rollProfile(recipe, random) {
  const profileId = pickWeighted(recipe.weightedProfiles, random) ?? 'efficient';
  return SPELL_CRAFT_PROFILES[profileId] ?? SPELL_CRAFT_PROFILES.efficient;
}

function selectBonusEffects(recipe, random) {
  const rollCount = Number.parseInt(pickWeighted(recipe.effectPool?.rollCountWeights, random) ?? '0', 10);
  if (!Number.isFinite(rollCount) || rollCount <= 0) return [];

  const rarityPicks = [];
  for (let index = 0; index < rollCount; index += 1) {
    rarityPicks.push(pickWeighted({ common: 60, uncommon: 30, rare: 10 }, random) ?? 'common');
  }

  const selected = [];
  const seenTypes = new Set();

  for (const rarity of rarityPicks) {
    const poolsToTry = [rarity, ...BONUS_RARITY_ORDER.filter((entry) => entry !== rarity)];
    let picked = null;
    for (const poolName of poolsToTry) {
      const pool = (recipe.effectPool?.[poolName] ?? [])
        .filter((effect) => isEffectCompatible(recipe, effect) && !seenTypes.has(effect.type));
      if (pool.length === 0) continue;
      const total = pool.reduce((sum, effect) => sum + (Number.isFinite(effect.weight) ? effect.weight : 1), 0);
      let roll = random() * total;
      for (const effect of pool) {
        roll -= Number.isFinite(effect.weight) ? effect.weight : 1;
        if (roll <= 0) {
          picked = { ...effect, rarity: poolName };
          break;
        }
      }
      if (picked) break;
    }
    if (!picked) continue;
    selected.push(picked);
    seenTypes.add(picked.type);
  }

  return selected;
}

function buildDescription(recipe, profile, guaranteedEffects, bonusEffects) {
  const guaranteedText = guaranteedEffects.map((effect) => effect.label).join(', ') || 'identity magic';
  const bonusText = bonusEffects.length > 0 ? ` Bonus roll: ${bonusEffects.map((effect) => effect.label).join(', ')}.` : '';
  return `${recipe.craftingSummary} ${profile.name} profile. Guaranteed: ${guaranteedText}.${bonusText}`;
}

let craftedSpellCounter = 0;

function cloneRecipe(recipe) {
  return {
    ...recipe,
    validElements: [...(recipe.validElements ?? [])],
    ingredients: (recipe.ingredients ?? []).map((ingredient) => ({ ...ingredient })),
  };
}

export function getCraftableSpellRecipes() {
  return SPELL_CRAFT_RECIPES.map((recipe) => cloneRecipe(recipe));
}

export function getUnlockedSpellCraftRecipes(unlockedRecipeIds = null) {
  if (!(unlockedRecipeIds instanceof Set)) return getCraftableSpellRecipes();
  return SPELL_CRAFT_RECIPES.filter((recipe) => unlockedRecipeIds.has(recipe.id)).map((recipe) => cloneRecipe(recipe));
}

export function getRecipeCraftingState({ recipeId, player } = {}) {
  const recipe = getSpellCraftRecipe(recipeId);
  if (!recipe) return { recipe: null, unlocked: false, canCraft: false, ingredients: [] };

  const ingredients = (recipe.ingredients ?? []).map((ingredient) => ({
    ...ingredient,
    owned: typeof player?.getItemCount === 'function' ? player.getItemCount(ingredient.itemId) : 0,
    hasEnough: typeof player?.hasItem === 'function' ? player.hasItem(ingredient.itemId, ingredient.amount) : false,
  }));
  const unlocked = typeof player?.hasUnlockedRecipe === 'function' ? player.hasUnlockedRecipe(recipe.id) : true;
  return {
    recipe: cloneRecipe(recipe),
    unlocked,
    canCraft: unlocked && ingredients.every((ingredient) => ingredient.hasEnough),
    ingredients,
  };
}

export function craftRecipeSpell({ recipeId, player, addSpell, element = null, random = Math.random } = {}) {
  const craftingState = getRecipeCraftingState({ recipeId, player });
  const recipe = craftingState.recipe;
  if (!recipe) throw new Error(`Unknown spell recipe: ${String(recipeId)}`);
  if (!craftingState.unlocked) throw new Error(`${recipe.name} is still locked.`);

  const missing = craftingState.ingredients.filter((ingredient) => !ingredient.hasEnough);
  if (missing.length > 0) {
    const summary = missing.map((ingredient) => `${ingredient.amount - ingredient.owned} ${ingredient.itemId}`).join(', ');
    throw new Error(`Missing ingredients: ${summary}.`);
  }

  const consumed = [];
  for (const ingredient of recipe.ingredients ?? []) {
    const removed = player?.removeItem?.(ingredient.itemId, ingredient.amount);
    if (!removed) {
      for (const entry of consumed) player?.addItem?.(entry.itemId, entry.amount);
      throw new Error(`Failed to consume ${ingredient.itemId}.`);
    }
    consumed.push(ingredient);
  }

  try {
    const craftedSpell = craftSpell({ recipeId: recipe.id, element, random });
    const added = addSpell?.(craftedSpell);
    if (!added) throw new Error('Craft failed: spell could not be added to the player.');
    return craftedSpell;
  } catch (error) {
    for (const entry of consumed) player?.addItem?.(entry.itemId, entry.amount);
    throw error;
  }
}

export function craftSpell({ recipeId, element = null, random = Math.random } = {}) {
  const recipe = getSpellCraftRecipe(recipeId);
  if (!recipe) {
    throw new Error(`Unknown spell recipe: ${String(recipeId)}`);
  }

  const appliedElement = element ?? recipe.validElements[0] ?? null;
  if (!recipe.validElements.includes(appliedElement)) {
    throw new Error(`Element ${String(appliedElement)} is not valid for recipe ${recipe.name}.`);
  }

  const rng = createRng(random);
  const profile = rollProfile(recipe, rng);
  const baseStats = rollStats(recipe, rng);
  const finalStats = applyProfile(baseStats, profile);
  const guaranteedEffects = getRecipeGuaranteedEffects(recipe, appliedElement);
  const bonusEffects = selectBonusEffects(recipe, rng);
  const components = guaranteedEffects
    .map(buildStatusComponent)
    .filter(Boolean);
  const parameters = buildParameters(recipe, finalStats, appliedElement);

  const craftedSpell = {
    id: `crafted:${recipe.id}:${Date.now().toString(36)}:${craftedSpellCounter += 1}`,
    name: recipe.name,
    icon: recipe.icon ?? '*',
    description: buildDescription(recipe, profile, guaranteedEffects, bonusEffects),
    behavior: recipe.behavior,
    targeting: recipe.targeting ?? 'cursor',
    element: appliedElement,
    components,
    effects: bonusEffects.map((effect) => ({ ...effect })),
    parameters,
    config: { ...parameters },
    cost: Math.max(1, finalStats.manaCost),
    damage: finalStats.damage,
    range: finalStats.range ?? Math.round(((finalStats.speed ?? 0) * (finalStats.ttl ?? 0)) / 5 * 100) / 100,
    cooldown: finalStats.cooldown,
    manaCost: finalStats.manaCost,
    crafted: true,
    recipeId: recipe.id,
    profile: { id: profile.id, name: profile.name, summary: profile.summary },
    baseStats,
    finalStats,
    guaranteedEffects,
    bonusEffects,
  };

  const validation = validateSpell(craftedSpell);
  if (!validation.valid) {
    throw new Error(`Invalid crafted spell combination: ${validation.message}`);
  }

  return deepClone(craftedSpell);
}
