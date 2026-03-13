import { Entity } from './Entity.js';

export class WorldObject extends Entity {
  constructor(props = {}) {
    const hasLegacyCollisionFlag = Object.prototype.hasOwnProperty.call(props, 'blocksMovement');
    const collision = hasLegacyCollisionFlag ? props.blocksMovement : (props.collision ?? false);

    super({
      type: 'object',
      x: 0,
      y: 0,
      radius: 1,
      spriteKey: null,
      category: 'decorative',
      collision,
      interaction: null,
      logicalShape: { kind: 'single', tiles: [[0, 0]] },
      blocksMovement: collision,
      ...props,
    });

    this.collision = this.collision ?? this.blocksMovement ?? false;
    this.blocksMovement = this.collision;
    this.interaction = this.interaction ?? null;
    this.logicalShape = this.logicalShape ?? { kind: 'single', tiles: [[0, 0]] };
  }
}

export class StaticObject extends WorldObject {
  constructor(props = {}) {
    super({ category: 'terrain', collision: true, interaction: null, ...props });
  }
}

export class House extends StaticObject {
  constructor(x, y, variant = 'red') {
    super({ type: 'house', x, y, radius: 4.2, spriteKey: `house-${variant}`, variant, logicalShape: { kind: 'building', tiles: [[0, 0], [1, 0], [-1, 0], [2, 0], [-2, 0], [0, 1], [1, 1], [-1, 1], [0, -1], [1, -1], [-1, -1]] } });
  }
}

export class DestructibleObject extends WorldObject {
  constructor(props = {}) {
    super({
      category: 'interactable',
      interaction: 'destroy',
      hp: 4,
      maxHp: 4,
      breakTimer: 0,
      breakDuration: 0.45,
      destroyed: false,
      breakFrames: [],
      dropChance: 0.45,
      dropMin: 1,
      dropMax: 6,
      collision: true,
      ...props,
    });
  }

  applyDamage(amount) {
    if (this.destroyed) return false;
    this.hp -= amount;
    if (this.hp > 0) return false;
    this.destroyed = true;
    this.breakTimer = this.breakDuration;
    this.collision = false;
    this.blocksMovement = false;
    return true;
  }

  rollGoldDrop() {
    if (Math.random() > this.dropChance) return 0;
    return this.dropMin + Math.floor(Math.random() * (this.dropMax - this.dropMin + 1));
  }
}

export class BreakableProp extends DestructibleObject {
  constructor(kind, x, y) {
    const durabilityByKind = {
      barrel: 1,
      crate: 2,
      vase: 1,
    };

    const dropConfigByKind = {
      barrel: { dropChance: 0.12, dropMin: 1, dropMax: 3 },
      crate: { dropChance: 0.18, dropMin: 1, dropMax: 4 },
      vase: { dropChance: 0.1, dropMin: 1, dropMax: 2 },
    };

    const isBarrel = kind === 'barrel';
    const hp = durabilityByKind[kind] ?? 1;
    const dropConfig = dropConfigByKind[kind] ?? dropConfigByKind.barrel;

    super({
      type: kind,
      kind,
      x,
      y,
      radius: isBarrel ? 1.4 : 1.2,
      spriteKey: kind,
      hp,
      maxHp: hp,
      breakFrames: [`${kind}-break-1`, `${kind}-break-2`],
      ...dropConfig,
    });
  }
}

export class TownNPC extends WorldObject {
  constructor({ x, y, name, role, dialogue, wanderRadius = 0 }) {
    super({
      type: 'npc',
      x,
      y,
      radius: 1.8,
      spriteKey: `npc-${role}`,
      name,
      role,
      dialogue,
      interactRadius: 8,
      wanderRadius,
      homeX: x,
      homeY: y,
      wanderTimer: Math.random() * 1.2,
      speed: 4 + Math.random() * 2,
      vx: 0,
      vy: 0,
      animationState: 'idle',
      frameDurations: { idle: 0.45, walk: 0.2 },
      dialogueEngaged: false,
      dialoguePulse: 0,
    });
  }
}

export class NatureObject extends WorldObject {
  constructor(props = {}) {
    super({ category: 'decorative', collision: false, interaction: null, ...props });
  }
}
