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
      attackCooldown: slime ? 0.55 : 0.75,
      attackTimer: 0,
      attackWindup: slime ? 0.16 : 0.2,
      attackDuration: slime ? 0.3 : 0.36,
      attackElapsed: 0,
      attackDamageApplied: false,
      isAttacking: false,
      hitKnockback: slime ? 7 : 9,
      spriteKey: slime ? 'slime' : 'skeleton',
      animationState: 'idle',
      frozen: false,
      freezeTint: null,
      freezeGlow: null,
      hitFlashTimer: 0,
      hitFlashDuration: 0,
      hitKnockbackX: 0,
      hitKnockbackY: 0,
      hitKnockbackTimer: 0,
      frameDurations: {
        idle: 0.32,
        walk: 0.14,
        attack: 0.08,
      },
    });
  }
}
