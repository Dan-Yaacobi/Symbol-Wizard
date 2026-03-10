export class Entity {
  constructor(props) {
    Object.assign(this, {
      id: crypto.randomUUID(),
      type: 'entity',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 1.4,
      hp: 1,
      maxHp: 1,
      alive: true,
      spriteFrames: null,
      animationFrames: null,
      frameIndex: 0,
      currentFrame: 0,
      frameTimer: 0,
      ...props,
    });
  }
}
