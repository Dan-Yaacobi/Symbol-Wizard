const MAX_ACTIVE_TEXTS = 20;
const MIN_LIFETIME = 0.8;
const MAX_LIFETIME = 1.2;
const DEFAULT_UPWARD_SPEED = 10;
const VERTICAL_OFFSET = 3.8;

const COLOR_MAP = {
  red: '#ff5a5a',
  yellow: '#ffd65a',
  green: '#69de79',
  gold: '#e6c95a',
  white: '#ffffff',
};

export class CombatTextSystem {
  constructor() {
    this.combatTexts = [];
    this.nextId = 1;
  }

  spawnDamageText(entity, damage, isCritical = false) {
    const amount = Math.max(0, Math.round(damage));
    const text = isCritical ? `*${amount}*` : `-${amount}`;
    const color = isCritical ? 'yellow' : 'red';
    this.#spawnText(entity.x, entity.y - VERTICAL_OFFSET, text, color);
  }

  spawnGoldText(entity, amount) {
    const value = Math.max(0, Math.round(amount));
    this.#spawnText(entity.x, entity.y - VERTICAL_OFFSET, `+${value}$`, 'gold');
  }

  spawnHealText(entity, amount) {
    const value = Math.max(0, Math.round(amount));
    this.#spawnText(entity.x, entity.y - VERTICAL_OFFSET, `+${value}`, 'green');
  }

  spawnInfoText(entity, text) {
    this.#spawnText(entity.x, entity.y - VERTICAL_OFFSET, text, 'white');
  }

  update(dt, nowSeconds = performance.now() / 1000) {
    let writeIndex = 0;

    for (let i = 0; i < this.combatTexts.length; i += 1) {
      const entry = this.combatTexts[i];
      const age = nowSeconds - entry.createdAt;
      if (age >= entry.lifetime) continue;

      entry.y -= entry.velocityY * dt;
      entry.opacity = 1 - age / entry.lifetime;
      this.combatTexts[writeIndex] = entry;
      writeIndex += 1;
    }

    this.combatTexts.length = writeIndex;
  }

  render(renderer, camera) {
    for (let i = 0; i < this.combatTexts.length; i += 1) {
      const entry = this.combatTexts[i];
      const screenX = Math.round(entry.x) - camera.x;
      const screenY = Math.round(entry.y) - camera.y;
      renderer.drawEffectText(entry.text, entry.color, screenX, screenY, entry.opacity);
    }
  }

  #spawnText(x, y, text, colorName, nowSeconds = performance.now() / 1000) {
    if (this.combatTexts.length >= MAX_ACTIVE_TEXTS) {
      this.combatTexts.shift();
    }

    const lifetime = MIN_LIFETIME + Math.random() * (MAX_LIFETIME - MIN_LIFETIME);

    this.combatTexts.push({
      id: `ct_${this.nextId}`,
      x,
      y,
      text,
      color: COLOR_MAP[colorName] ?? COLOR_MAP.white,
      createdAt: nowSeconds,
      lifetime,
      velocityY: DEFAULT_UPWARD_SPEED,
      opacity: 1,
    });

    this.nextId += 1;
  }
}
