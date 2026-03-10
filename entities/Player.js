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
      spriteKey: 'player',
      gold: 0,
      castCooldown: 0,
    });
  }
}
