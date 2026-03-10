import { Entity } from './Entity.js';

export class Enemy extends Entity {
  constructor(kind, x, y) {
    const slime = kind === 'slime';
    super({
      type: 'enemy',
      kind,
      x,
      y,
      radius: 1.6,
      hp: slime ? 5 : 7,
      maxHp: slime ? 5 : 7,
      speed: slime ? 10 : 13,
      spriteKey: slime ? 'slime' : 'skeleton',
    });
  }
}
