import { Entity } from './Entity.js';

export class Enemy extends Entity {
  constructor(kind, x, y) {
    const slime = kind === 'slime';
    const attackDamage = slime ? 2 : 3;
    super({
      type: 'enemy',
      kind,
      x,
      y,
      radius: 1.6,
      hp: slime ? 5 : 7,
      maxHp: slime ? 5 : 7,
      speed: slime ? 10 : 13,
      attackDamage,
      attackCooldown: slime ? 0.55 : 0.75,
      attackTimer: 0,
      hitKnockback: slime ? 7 : 9,
      spriteKey: slime ? 'slime' : 'skeleton',
    });
  }
}
