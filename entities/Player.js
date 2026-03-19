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
  }
}
