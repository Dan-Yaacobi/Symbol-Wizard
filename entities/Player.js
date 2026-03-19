import { Entity } from './Entity.js';
import { createInventory } from '../systems/InventorySystem.js';

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
      spriteKey: 'player',
      gold: 0,
      castCooldown: 0,
      castTimer: 0,
      inventory: createInventory(24),
      animationState: 'idle',
      frameDurations: {
        idle: 0.45,
        walk: 0.12,
        cast: 0.08,
      },
    });

    this.inventory = new Map();
    this.unlockedRecipes = new Set();
  }

  getItemCount(itemId) {
    return this.inventory.get(itemId) ?? 0;
  }

  hasItem(itemId, amount = 1) {
    return this.getItemCount(itemId) >= Math.max(0, amount);
  }

  addItem(itemId, amount = 1) {
    const normalizedAmount = Math.max(0, Number(amount) || 0);
    if (!itemId || normalizedAmount <= 0) return this.getItemCount(itemId);
    const nextAmount = this.getItemCount(itemId) + normalizedAmount;
    this.inventory.set(itemId, nextAmount);
    return nextAmount;
  }

  removeItem(itemId, amount = 1) {
    const normalizedAmount = Math.max(0, Number(amount) || 0);
    if (!itemId || normalizedAmount <= 0) return true;
    if (!this.hasItem(itemId, normalizedAmount)) return false;

    const nextAmount = this.getItemCount(itemId) - normalizedAmount;
    if (nextAmount <= 0) this.inventory.delete(itemId);
    else this.inventory.set(itemId, nextAmount);
    return true;
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
