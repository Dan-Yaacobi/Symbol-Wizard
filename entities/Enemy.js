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
      attackRange: slime ? 3.2 : 3.6,
      attackCooldown: slime ? 0.7 : 0.9,
      attackTimer: 0,
      attackWindup: slime ? 0.35 : 0.45,
      attackDuration: slime ? 0.3 : 0.36,
      attackHitTime: slime ? 0.08 : 0.1,
      attackElapsed: 0,
      attackDamageApplied: false,
      isWindingUp: false,
      isAttacking: false,
      hitKnockback: slime ? 7 : 9,
      spriteKey: slime ? 'slime' : 'skeleton',
      animationState: 'idle',
      frozen: false,
      freezeTint: null,
      freezeGlow: null,
      frameDurations: {
        idle: 0.32,
        walk: 0.14,
        attack: 0.08,
      },
    });
  }
}
