import { Entity } from './Entity.js';

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
      speed: 12,
      spriteKey: 'player',
      gold: 0,
      castCooldown: 0,
      animationState: 'idle',
      frameDurations: {
        idle: 0.45,
        walk: 0.11,
      },
    });
  }
}
