import { getItemDefinition } from '../data/ItemRegistry.js';
import { visualTheme } from '../data/VisualTheme.js';

const MAX_ACTIVE_TEXTS = 20;
const MIN_LIFETIME = 0.9;
const MAX_LIFETIME = 1.3;
const DEFAULT_UPWARD_SPEED = 13;
const VERTICAL_OFFSET = 3.8;
const DEBUG_COMBAT_TEXT = false;
const PICKUP_LIFETIME_MIN = 1.5;
const PICKUP_LIFETIME_MAX = 2.0;
const PICKUP_MERGE_WINDOW = 0.45;
const PICKUP_START_Y_PX = 20;
const PICKUP_ROW_HEIGHT_PX = 16;
// Toggle to true while diagnosing combat-text lifecycle issues without spamming normal gameplay logs.

const COLOR_MAP = {
  red: visualTheme.colors.damage,
  magenta: '#ff8ef0',
  green: visualTheme.colors.success,
  gold: visualTheme.colors.gold,
  white: visualTheme.colors.text,
};

const TEXT_STYLES = {
  damage: { color: COLOR_MAP.red, fontScale: 2.45, fontWeight: '800' },
  critical: {
    color: COLOR_MAP.magenta,
    fontScale: 3.05,
    fontWeight: '800',
    popAmplitude: 0.18,
    popDuration: 0.14,
  },
  gold: { color: COLOR_MAP.gold, fontScale: 2.35, fontWeight: '700' },
  heal: { color: COLOR_MAP.green, fontScale: 2.35, fontWeight: '700' },
  info: { color: COLOR_MAP.white, fontScale: 2.2, fontWeight: '700' },
  pickup: { color: COLOR_MAP.white, fontScale: 1.25, fontWeight: '700' },
};

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

export class CombatTextSystem {
  constructor(configRegistry = null) {
    this.configRegistry = configRegistry;
    this.combatTexts = [];
    this.pickupStack = [];
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
    this.#spawnText(entity.x, entity.y - this.#getConfig('combat.damageTextVerticalDrift', VERTICAL_OFFSET), text, isCritical ? this.#criticalStyle() : this.#damageStyle());
  }

  spawnGoldText(entity, amount) {
    if (!this.#hasValidEntityPosition(entity)) {
      // Entity references can be stale if combat and cleanup happen in the same frame.
      console.warn('[CombatText] skipped gold text: invalid entity position.', entity);
      return;
    }

    const value = Math.max(0, Math.round(amount));
    this.#spawnText(entity.x, entity.y - this.#getConfig('combat.damageTextVerticalDrift', VERTICAL_OFFSET), `+${value}$`, this.#goldStyle());
  }

  spawnHealText(entity, amount) {
    if (!this.#hasValidEntityPosition(entity)) {
      // Entity references can be stale if combat and cleanup happen in the same frame.
      console.warn('[CombatText] skipped heal text: invalid entity position.', entity);
      return;
    }

    const value = Math.max(0, Math.round(amount));
    this.#spawnText(entity.x, entity.y - this.#getConfig('combat.damageTextVerticalDrift', VERTICAL_OFFSET), `+${value}`, this.#healStyle());
  }

  spawnInfoText(entity, text) {
    if (!this.#hasValidEntityPosition(entity)) {
      // Entity references can be stale if combat and cleanup happen in the same frame.
      console.warn('[CombatText] skipped info text: invalid entity position.', entity);
      return;
    }

    this.#spawnText(entity.x, entity.y - this.#getConfig('combat.damageTextVerticalDrift', VERTICAL_OFFSET), text, TEXT_STYLES.info);
  }


  spawnPickupText(itemId, quantity, nowSeconds = performance.now() / 1000) {
    if (!itemId || !Number.isFinite(quantity) || quantity <= 0) return;

    const recentEntry = this.pickupStack.findLast?.((entry) => entry.itemId === itemId && nowSeconds - entry.time <= PICKUP_MERGE_WINDOW)
      ?? [...this.pickupStack].reverse().find((entry) => entry.itemId === itemId && nowSeconds - entry.time <= PICKUP_MERGE_WINDOW);

    if (recentEntry) {
      recentEntry.quantity += Math.max(1, Math.round(quantity));
      recentEntry.time = nowSeconds;
      recentEntry.createdAt = nowSeconds;
      recentEntry.lifetime = this.#pickupLifetime();
      recentEntry.opacity = 1;
      return;
    }

    this.pickupStack.push({
      id: `pickup_${this.nextId++}`,
      type: 'pickup',
      itemId,
      quantity: Math.max(1, Math.round(quantity)),
      time: nowSeconds,
      createdAt: nowSeconds,
      lifetime: this.#pickupLifetime(),
      opacity: 1,
      xOffsetPx: Math.round((Math.random() - 0.5) * 10),
    });
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
      entry.age = age;
      this.combatTexts[writeIndex] = entry;
      writeIndex += 1;
    }

    this.combatTexts.length = writeIndex;

    let pickupWriteIndex = 0;
    for (let i = 0; i < this.pickupStack.length; i += 1) {
      const entry = this.pickupStack[i];
      const age = nowSeconds - entry.createdAt;
      if (age >= entry.lifetime) continue;
      entry.opacity = 1 - age / entry.lifetime;
      this.pickupStack[pickupWriteIndex] = entry;
      pickupWriteIndex += 1;
    }
    this.pickupStack.length = pickupWriteIndex;
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

      const drawStyle = this.#getAnimatedStyle(entry);
      renderer.drawEffectText(entry.text, drawStyle.color, screenX, screenY, entry.opacity, '#09101a', drawStyle);
    }

    this.#renderPickupStack(renderer);
  }

  #getAnimatedStyle(entry) {
    const baseScale = entry.style.fontScale;
    const popAmplitude = Number.isFinite(entry.style.popAmplitude) ? entry.style.popAmplitude : 0;
    const popDuration = Number.isFinite(entry.style.popDuration) ? entry.style.popDuration : 0;

    if (popAmplitude <= 0 || popDuration <= 0 || entry.age >= popDuration) {
      return entry.style;
    }

    const popProgress = Math.max(0, Math.min(1, entry.age / popDuration));
    const popMultiplier = 1 + Math.sin(popProgress * Math.PI) * popAmplitude;

    return {
      ...entry.style,
      fontScale: baseScale * popMultiplier,
    };
  }


  #getConfig(path, fallback) {
    const value = this.configRegistry?.get?.(path);
    return Number.isFinite(value) ? value : fallback;
  }

  #damageStyle() {
    return { ...TEXT_STYLES.damage, color: this.configRegistry?.get?.('palette.damageColor') ?? TEXT_STYLES.damage.color };
  }

  #criticalStyle() {
    return {
      ...TEXT_STYLES.critical,
      color: this.configRegistry?.get?.('palette.critColor') ?? TEXT_STYLES.critical.color,
      fontScale: this.#getConfig('combat.critTextScale', TEXT_STYLES.critical.fontScale),
      popDuration: this.#getConfig('combat.critPopDuration', TEXT_STYLES.critical.popDuration),
    };
  }

  #goldStyle() { return { ...TEXT_STYLES.gold }; }
  #healStyle() { return { ...TEXT_STYLES.heal, color: this.configRegistry?.get?.('palette.healColor') ?? TEXT_STYLES.heal.color }; }
  #pickupStyle() { return { ...TEXT_STYLES.pickup }; }


  #pickupLifetime() {
    return PICKUP_LIFETIME_MIN + Math.random() * (PICKUP_LIFETIME_MAX - PICKUP_LIFETIME_MIN);
  }

  #renderPickupStack(renderer) {
    const baseY = PICKUP_START_Y_PX / renderer.cellH;
    const rowHeight = PICKUP_ROW_HEIGHT_PX / renderer.cellH;

    for (let i = 0; i < this.pickupStack.length; i += 1) {
      const entry = this.pickupStack[i];
      const item = getItemDefinition(entry.itemId);
      const icon = item?.icon ?? '*';
      const name = item?.name ?? entry.itemId;
      const label = `${icon} ${name} x${entry.quantity}`;
      const xOffsetCells = (entry.xOffsetPx ?? 0) / renderer.cellW;
      const y = baseY + i * rowHeight;
      const x = Math.max(1, renderer.cols - label.length - 2) + xOffsetCells;
      renderer.drawEffectText(label, this.#pickupStyle().color, x, y, entry.opacity, 'rgba(0,0,0,0)', this.#pickupStyle());
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
      popAmplitude: Number.isFinite(style?.popAmplitude) ? style.popAmplitude : 0,
      popDuration: Number.isFinite(style?.popDuration) ? style.popDuration : 0,
    };

    const minLifetime = this.#getConfig('combat.damageTextLifetimeMin', MIN_LIFETIME);
    const maxLifetime = Math.max(minLifetime, this.#getConfig('combat.damageTextLifetimeMax', MAX_LIFETIME));
    const lifetime = minLifetime + Math.random() * (maxLifetime - minLifetime);
    const entry = {
      id: `ct_${this.nextId}`,
      x,
      y,
      text: safeText,
      style: resolvedStyle,
      createdAt: nowSeconds,
      lifetime,
      velocityY: this.#getConfig('combat.damageTextSpeed', DEFAULT_UPWARD_SPEED),
      opacity: 1,
      age: 0,
    };

    this.combatTexts.push(entry);

    if (DEBUG_COMBAT_TEXT) {
      console.debug('[CombatText] spawned', entry);
    }

    this.nextId += 1;
  }
}
