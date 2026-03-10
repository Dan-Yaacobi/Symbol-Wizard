const MAX_ACTIVE_TEXTS = 20;
const MIN_LIFETIME = 0.8;
const MAX_LIFETIME = 1.2;
const DEFAULT_UPWARD_SPEED = 10;
const VERTICAL_OFFSET = 3.8;
const DEBUG_COMBAT_TEXT = false;
// Toggle to true while diagnosing combat-text lifecycle issues without spamming normal gameplay logs.

const COLOR_MAP = {
  red: '#ff5a5a',
  yellow: '#ffd65a',
  green: '#69de79',
  gold: '#e6c95a',
  white: '#ffffff',
};

const TEXT_STYLES = {
  damage: { color: COLOR_MAP.red, fontScale: 2.25, fontWeight: '700' },
  critical: { color: COLOR_MAP.yellow, fontScale: 2.45, fontWeight: '700' },
  gold: { color: COLOR_MAP.gold, fontScale: 2.2, fontWeight: '700' },
  heal: { color: COLOR_MAP.green, fontScale: 2.2, fontWeight: '700' },
  info: { color: COLOR_MAP.white, fontScale: 2.1, fontWeight: '600' },
};

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

export class CombatTextSystem {
  constructor() {
    this.combatTexts = [];
    this.nextId = 1;
  }

  spawnDamageText(entity, damage, isCritical = false) {
    if (!this.#hasValidEntityPosition(entity)) {
      // Entity references can be stale if combat and cleanup happen in the same frame.
      console.warn('[CombatText] skipped damage text: invalid entity position.', entity);
      return;
    }

    const amount = Math.max(0, Math.round(damage));
    const text = isCritical ? `*${amount}*` : `-${amount}`;
    this.#spawnText(entity.x, entity.y - VERTICAL_OFFSET, text, isCritical ? TEXT_STYLES.critical : TEXT_STYLES.damage);
  }

  spawnGoldText(entity, amount) {
    if (!this.#hasValidEntityPosition(entity)) {
      // Entity references can be stale if combat and cleanup happen in the same frame.
      console.warn('[CombatText] skipped gold text: invalid entity position.', entity);
      return;
    }

    const value = Math.max(0, Math.round(amount));
    this.#spawnText(entity.x, entity.y - VERTICAL_OFFSET, `+${value}$`, TEXT_STYLES.gold);
  }

  spawnHealText(entity, amount) {
    if (!this.#hasValidEntityPosition(entity)) {
      // Entity references can be stale if combat and cleanup happen in the same frame.
      console.warn('[CombatText] skipped heal text: invalid entity position.', entity);
      return;
    }

    const value = Math.max(0, Math.round(amount));
    this.#spawnText(entity.x, entity.y - VERTICAL_OFFSET, `+${value}`, TEXT_STYLES.heal);
  }

  spawnInfoText(entity, text) {
    if (!this.#hasValidEntityPosition(entity)) {
      // Entity references can be stale if combat and cleanup happen in the same frame.
      console.warn('[CombatText] skipped info text: invalid entity position.', entity);
      return;
    }

    this.#spawnText(entity.x, entity.y - VERTICAL_OFFSET, text, TEXT_STYLES.info);
  }

  update(dt, nowSeconds = performance.now() / 1000) {
    if (!isFiniteNumber(dt) || dt <= 0) return;

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
    if (!renderer?.drawEffectText || !camera) {
      // Render can be called during initialization/teardown, so fail gracefully.
      console.warn('[CombatText] skipped render: renderer or camera missing.');
      return;
    }

    const cameraX = isFiniteNumber(camera.x) ? camera.x : 0;
    const cameraY = isFiniteNumber(camera.y) ? camera.y : 0;

    for (let i = 0; i < this.combatTexts.length; i += 1) {
      const entry = this.combatTexts[i];
      const screenX = Math.round(entry.x) - cameraX;
      const screenY = Math.round(entry.y) - cameraY;

      if (DEBUG_COMBAT_TEXT) {
        console.debug('[CombatText] render', { id: entry.id, text: entry.text, screenX, screenY, opacity: entry.opacity });
      }

      renderer.drawEffectText(entry.text, entry.style.color, screenX, screenY, entry.opacity, 'rgba(0,0,0,0)', entry.style);
    }
  }

  #hasValidEntityPosition(entity) {
    return Boolean(entity) && isFiniteNumber(entity.x) && isFiniteNumber(entity.y);
  }

  #spawnText(x, y, text, style, nowSeconds = performance.now() / 1000) {
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
      // Defensive guard: never enqueue entries with invalid positions.
      console.warn('[CombatText] skipped spawn: invalid coordinates.', { x, y, text, style });
      return;
    }

    const safeText = String(text ?? '').trim();
    if (!safeText) {
      console.warn('[CombatText] skipped spawn: empty text value.', { x, y, text, style });
      return;
    }

    if (this.combatTexts.length >= MAX_ACTIVE_TEXTS) {
      this.combatTexts.shift();
    }

    const resolvedStyle = {
      color: style?.color ?? COLOR_MAP.white,
      fontScale: Number.isFinite(style?.fontScale) ? style.fontScale : 2,
      fontWeight: style?.fontWeight ?? '700',
    };

    const lifetime = MIN_LIFETIME + Math.random() * (MAX_LIFETIME - MIN_LIFETIME);
    const entry = {
      id: `ct_${this.nextId}`,
      x,
      y,
      text: safeText,
      style: resolvedStyle,
      createdAt: nowSeconds,
      lifetime,
      velocityY: DEFAULT_UPWARD_SPEED,
      opacity: 1,
    };

    this.combatTexts.push(entry);

    if (DEBUG_COMBAT_TEXT) {
      console.debug('[CombatText] spawned', entry);
    }

    this.nextId += 1;
  }
}
