import { Entity } from './Entity.js';
import { addItem, createInventory, ensureInventory, getItemCount, hasItem, removeItem } from '../systems/InventorySystem.js';

export class Player extends Entity {
  constructor(x, y) {
    super({
      type: 'player',
      x,
      y,
      radius: 1.8,
      hp: 20,
      maxHp: 20,
      mana: 40,
      maxMana: 40,
      manaRegen: 8,
      speed: 20,
      spriteId: 'player',
      spriteKey: 'player',
      gold: 0,
      castCooldown: 0,
      castTimer: 0,
      inventory: createInventory(24),
      animationState: 'idle',
      animationTimings: {
        idle: 0.45,
        walk: 0.12,
        cast: 0.08,
      },
      frameDurations: null,
    });

    this.frameDurations = this.animationTimings;
    this.inventory = ensureInventory(this.inventory, { context: 'Player.constructor' });
    this.unlockedRecipes = new Set();
  }

  getItemCount(itemId) {
    return getItemCount(this.inventory, itemId);
  }

  hasItem(itemId, amount = 1) {
    return hasItem(this.inventory, itemId, Math.max(0, amount));
  }

  addItem(itemId, amount = 1) {
    return addItem(this.inventory, itemId, amount);
  }

  removeItem(itemId, amount = 1) {
    return removeItem(this.inventory, itemId, amount).success;
  }

  unlockRecipe(recipeId) {
    if (!recipeId) return false;
    const sizeBefore = this.unlockedRecipes.size;
    this.unlockedRecipes.add(recipeId);
    return this.unlockedRecipes.size > sizeBefore;
  }

  hasUnlockedRecipe(recipeId) {
    return this.unlockedRecipes.has(recipeId);
  }
}
