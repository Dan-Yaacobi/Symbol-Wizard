import { getItemDefinition } from '../data/ItemRegistry.js';
import { visualTheme } from '../data/VisualTheme.js';

const MAX_ACTIVE_TEXTS = 20;
const MIN_LIFETIME = 1.6;
const MAX_LIFETIME = 1.8;
const DEFAULT_UPWARD_SPEED = 0.5;
const VERTICAL_OFFSET = 3.8;
const DEBUG_COMBAT_TEXT = false;
const PICKUP_LIFETIME_MIN = 2.5;
const PICKUP_LIFETIME_MAX = 3.0;
const PICKUP_MERGE_WINDOW = 0.45;
const PICKUP_WORLD_OFFSET_Y = 2;
const PICKUP_STACK_SPACING = 1.2;
const PICKUP_LINE_HEIGHT_MULTIPLIER = 1.4;
const PICKUP_STACK_PADDING = 2;
const PICKUP_DRIFT_SPEED = 0.5;
const GROUP_DISTANCE_THRESHOLD = 1.5;
const GROUP_MERGE_WINDOW = 0.2;
const GROUP_STACK_SPACING = 1.2;
const GROUP_JITTER_RANGE = 0.2;
const MAX_VISIBLE_PICKUP_TEXTS = 6;
// Toggle to true while diagnosing combat-text lifecycle issues without spamming normal gameplay logs.

const COLOR_MAP = {
  red: visualTheme.colors.damage,
  magenta: '#ff8ef0',
  green: visualTheme.colors.success,
  gold: visualTheme.colors.gold,
  white: visualTheme.colors.text,
  yellow: '#ffe066',
};

const TEXT_STYLES = {
  damage: { type: 'damage', mergeKey: 'damage', color: COLOR_MAP.red, fontScale: 2.45, fontWeight: '800' },
  critical: {
    type: 'damage',
    mergeKey: 'critical',
    color: COLOR_MAP.yellow,
    fontScale: 3.05,
    fontWeight: '800',
    popAmplitude: 0.18,
    popDuration: 0.14,
  },
  gold: { type: 'gold', mergeKey: 'gold', color: COLOR_MAP.gold, fontScale: 2.35, fontWeight: '700' },
  heal: { type: 'heal', mergeKey: 'heal', color: COLOR_MAP.green, fontScale: 2.35, fontWeight: '700' },
  info: { type: 'info', mergeKey: 'info', color: COLOR_MAP.white, fontScale: 2.2, fontWeight: '700' },
  pickup: { type: 'pickup', mergeKey: 'pickup', color: COLOR_MAP.white, fontScale: 1.5, fontWeight: '700' },
};

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

export class CombatTextSystem {
  constructor(configRegistry = null) {
    this.configRegistry = configRegistry;
    this.textGroups = [];
    this.combatTexts = this.textGroups;
    this.pickupStack = [];
    this.pickupStackAnchorX = 0;
    this.pickupStackAnchorY = 0;
    this.pickupStackDrift = 0;
    this.nextId = 1;
  }

  spawnDamageText(entity, damage, isCritical = false, nowSeconds = performance.now() / 1000) {
    if (!this.#hasValidEntityPosition(entity)) {
      console.warn('[CombatText] skipped damage text: invalid entity position.', entity);
      return;
    }

    const amount = Math.max(0, Math.round(damage));
    const text = isCritical ? `${amount}!` : `${amount}`;
    this.#spawnText(entity.x, entity.y - this.#getConfig('combat.damageTextVerticalDrift', VERTICAL_OFFSET), text, isCritical ? this.#criticalStyle() : this.#damageStyle(), nowSeconds);
  }

  spawnGoldText(entity, amount, nowSeconds = performance.now() / 1000) {
    if (!this.#hasValidEntityPosition(entity)) {
      console.warn('[CombatText] skipped gold text: invalid entity position.', entity);
      return;
    }

    const value = Math.max(0, Math.round(amount));
    this.#spawnText(entity.x, entity.y - this.#getConfig('combat.damageTextVerticalDrift', VERTICAL_OFFSET), `+${value}$`, this.#goldStyle(), nowSeconds);
  }

  spawnHealText(entity, amount, nowSeconds = performance.now() / 1000) {
    if (!this.#hasValidEntityPosition(entity)) {
      console.warn('[CombatText] skipped heal text: invalid entity position.', entity);
      return;
    }

    const value = Math.max(0, Math.round(amount));
    this.#spawnText(entity.x, entity.y - this.#getConfig('combat.damageTextVerticalDrift', VERTICAL_OFFSET), `+${value}`, this.#healStyle(), nowSeconds);
  }

  spawnInfoText(entity, text, nowSeconds = performance.now() / 1000) {
    if (!this.#hasValidEntityPosition(entity)) {
      console.warn('[CombatText] skipped info text: invalid entity position.', entity);
      return;
    }

    this.#spawnText(entity.x, entity.y - this.#getConfig('combat.damageTextVerticalDrift', VERTICAL_OFFSET), text, TEXT_STYLES.info, nowSeconds);
  }

  spawnPickupText(entity, itemId, quantity, nowSeconds = performance.now() / 1000) {
    if (!this.#hasValidEntityPosition(entity) || !itemId || !Number.isFinite(quantity) || quantity <= 0) return;

    this.pickupStackAnchorX = entity.x;
    this.pickupStackAnchorY = entity.y - PICKUP_WORLD_OFFSET_Y;

    const recentEntry = this.pickupStack.findLast?.((entry) => entry.itemId === itemId && nowSeconds - entry.time <= PICKUP_MERGE_WINDOW)
      ?? [...this.pickupStack].reverse().find((entry) => entry.itemId === itemId && nowSeconds - entry.time <= PICKUP_MERGE_WINDOW);

    if (recentEntry) {
      recentEntry.quantity += Math.max(1, Math.round(quantity));
      recentEntry.time = nowSeconds;
      recentEntry.createdAt = nowSeconds;
      recentEntry.lifetime = this.#pickupLifetime();
      recentEntry.opacity = 1;
      recentEntry.anchorX = this.pickupStackAnchorX;
      recentEntry.anchorY = this.pickupStackAnchorY;
      recentEntry.x = recentEntry.anchorX + recentEntry.xJitter;
      recentEntry.baseY = this.#pickupBaseY();
      recentEntry.y = recentEntry.baseY + this.#pickupYOffset(recentEntry.stackIndex) - this.pickupStackDrift;
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
      stackIndex: this.pickupStack.length,
      xJitter: this.#randomJitter(GROUP_JITTER_RANGE),
      drift: 0,
      anchorX: this.pickupStackAnchorX,
      anchorY: this.pickupStackAnchorY,
      x: entity.x,
      baseY: this.#pickupBaseY(),
      y: this.#pickupBaseY() + this.#pickupYOffset(this.pickupStack.length),
    });

    if (this.pickupStack.length > MAX_VISIBLE_PICKUP_TEXTS) {
      this.pickupStack.shift();
    }

    this.#reflowPickupStack();
  }

  update(dt, nowSeconds = performance.now() / 1000) {
    if (!isFiniteNumber(dt) || dt <= 0) return;

    let writeIndex = 0;

    for (let i = 0; i < this.textGroups.length; i += 1) {
      const group = this.textGroups[i];
      const age = nowSeconds - group.createdAt;
      if (age >= group.lifetime) continue;

      group.y -= group.velocityY * dt;
      group.opacity = 1 - age / group.lifetime;
      group.age = age;
      group.entries = group.entries.filter((entry) => nowSeconds - entry.time < group.lifetime);
      if (group.entries.length <= 0) continue;
      this.textGroups[writeIndex] = group;
      writeIndex += 1;
    }

    this.textGroups.length = writeIndex;

    let pickupWriteIndex = 0;
    this.pickupStackDrift += PICKUP_DRIFT_SPEED * dt;
    for (let i = 0; i < this.pickupStack.length; i += 1) {
      const entry = this.pickupStack[i];
      const age = nowSeconds - entry.createdAt;
      if (age >= entry.lifetime) continue;
      entry.stackIndex = pickupWriteIndex;
      entry.anchorX = this.pickupStackAnchorX;
      entry.anchorY = this.pickupStackAnchorY;
      entry.x = this.pickupStackAnchorX + (entry.xJitter ?? 0);
      entry.baseY = this.#pickupBaseY();
      entry.y = entry.baseY + this.#pickupYOffset(pickupWriteIndex) - this.pickupStackDrift;
      entry.opacity = 1 - age / entry.lifetime;
      this.pickupStack[pickupWriteIndex] = entry;
      pickupWriteIndex += 1;
    }
    this.pickupStack.length = pickupWriteIndex;

    if (this.pickupStack.length === 0) {
      this.pickupStackDrift = 0;
    }
  }

  render(renderer, camera) {
    if (!renderer?.drawEffectText || !camera) {
      console.warn('[CombatText] skipped render: renderer or camera missing.');
      return;
    }

    const cameraX = isFiniteNumber(camera.x) ? camera.x : 0;
    const cameraY = isFiniteNumber(camera.y) ? camera.y : 0;

    for (let i = 0; i < this.textGroups.length; i += 1) {
      const group = this.textGroups[i];
      const screenX = Math.round(group.x + (group.xJitter ?? 0)) - cameraX;

      for (let entryIndex = 0; entryIndex < group.entries.length; entryIndex += 1) {
        const entry = group.entries[entryIndex];
        const yOffset = entryIndex * -GROUP_STACK_SPACING;
        const screenY = Math.round(group.y + yOffset) - cameraY;

        if (DEBUG_COMBAT_TEXT) {
          console.debug('[CombatText] render', { id: group.id, text: entry.text, screenX, screenY, opacity: group.opacity, entryIndex });
        }

        const drawStyle = this.#getAnimatedStyle(entry, group.age);
        this.#drawOutlinedText(renderer, entry.text, drawStyle, screenX, screenY, group.opacity);
      }
    }

    this.#renderPickupStack(renderer, camera);
  }

  #getAnimatedStyle(entry, age = 0) {
    const baseScale = entry.style.fontScale;
    const popAmplitude = Number.isFinite(entry.style.popAmplitude) ? entry.style.popAmplitude : 0;
    const popDuration = Number.isFinite(entry.style.popDuration) ? entry.style.popDuration : 0;

    if (popAmplitude <= 0 || popDuration <= 0 || age >= popDuration) {
      return entry.style;
    }

    const popProgress = Math.max(0, Math.min(1, age / popDuration));
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



  #pickupLineHeight(style = TEXT_STYLES.pickup) {
    const fontSize = Number.isFinite(style?.fontScale) ? style.fontScale : TEXT_STYLES.pickup.fontScale;
    return Math.max(PICKUP_STACK_SPACING, (fontSize * PICKUP_LINE_HEIGHT_MULTIPLIER) + PICKUP_STACK_PADDING);
  }

  #pickupYOffset(index, style = TEXT_STYLES.pickup) {
    return index * -this.#pickupLineHeight(style);
  }

  #pickupBaseY() {
    return this.pickupStackAnchorY;
  }

  #reflowPickupStack() {
    const baseY = this.#pickupBaseY();
    for (let i = 0; i < this.pickupStack.length; i += 1) {
      const entry = this.pickupStack[i];
      entry.stackIndex = i;
      entry.anchorX = this.pickupStackAnchorX;
      entry.anchorY = this.pickupStackAnchorY;
      entry.baseY = baseY;
      entry.x = this.pickupStackAnchorX + (entry.xJitter ?? 0);
      entry.y = baseY + this.#pickupYOffset(i) - this.pickupStackDrift;
    }
  }

  #pickupLifetime() {
    return PICKUP_LIFETIME_MIN + Math.random() * (PICKUP_LIFETIME_MAX - PICKUP_LIFETIME_MIN);
  }

  #renderPickupStack(renderer, camera) {
    const cameraX = isFiniteNumber(camera?.x) ? camera.x : 0;
    const cameraY = isFiniteNumber(camera?.y) ? camera.y : 0;

    for (let i = 0; i < this.pickupStack.length; i += 1) {
      const entry = this.pickupStack[i];
      const item = getItemDefinition(entry.itemId);
      const name = item?.name ?? entry.itemId;
      const label = `+ ${name} x${entry.quantity}`;
      const x = entry.x - cameraX;
      const y = entry.y - cameraY;
      this.#drawOutlinedText(renderer, label, this.#pickupStyle(), x, y, entry.opacity);
    }
  }

  #drawOutlinedText(renderer, text, style, x, y, opacity) {
    const outlineOffsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [offsetX, offsetY] of outlineOffsets) {
      renderer.drawEffectText(text, '#000000', x + offsetX, y + offsetY, opacity, 'rgba(0,0,0,0)', style);
    }
    renderer.drawEffectText(text, style.color, x, y, opacity, 'rgba(0,0,0,0)', style);
  }

  #hasValidEntityPosition(entity) {
    return Boolean(entity) && isFiniteNumber(entity.x) && isFiniteNumber(entity.y);
  }

  #spawnText(x, y, text, style, nowSeconds = performance.now() / 1000) {
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
      console.warn('[CombatText] skipped spawn: invalid coordinates.', { x, y, text, style });
      return;
    }

    const safeText = String(text ?? '').trim();
    if (!safeText) {
      console.warn('[CombatText] skipped spawn: empty text value.', { x, y, text, style });
      return;
    }

    while (this.textGroups.length >= MAX_ACTIVE_TEXTS) {
      this.textGroups.shift();
    }

    const resolvedStyle = {
      type: style?.type ?? 'info',
      mergeKey: style?.mergeKey ?? style?.type ?? 'info',
      color: style?.color ?? COLOR_MAP.white,
      fontScale: Number.isFinite(style?.fontScale) ? style.fontScale : 2,
      fontWeight: style?.fontWeight ?? '700',
      popAmplitude: Number.isFinite(style?.popAmplitude) ? style.popAmplitude : 0,
      popDuration: Number.isFinite(style?.popDuration) ? style.popDuration : 0,
    };

    const minLifetime = this.#getConfig('combat.damageTextLifetimeMin', MIN_LIFETIME);
    const maxLifetime = Math.max(minLifetime, this.#getConfig('combat.damageTextLifetimeMax', MAX_LIFETIME));
    const lifetime = minLifetime + Math.random() * (maxLifetime - minLifetime);
    const group = this.#findReusableGroup(x, y, nowSeconds);

    if (group) {
      this.#appendToGroup(group, safeText, resolvedStyle, nowSeconds);
      group.createdAt = nowSeconds;
      group.lifetime = lifetime;
      group.opacity = 1;
      return;
    }

    const entry = this.#createEntry(safeText, resolvedStyle, nowSeconds);
    this.textGroups.push({
      id: `ct_${this.nextId++}`,
      x,
      y,
      entries: [entry],
      createdAt: nowSeconds,
      lifetime,
      velocityY: this.#getConfig('combat.damageTextSpeed', DEFAULT_UPWARD_SPEED),
      opacity: 1,
      age: 0,
      xJitter: this.#randomJitter(GROUP_JITTER_RANGE),
    });
  }

  #findReusableGroup(x, y, nowSeconds) {
    for (let i = this.textGroups.length - 1; i >= 0; i -= 1) {
      const group = this.textGroups[i];
      const dx = group.x - x;
      const dy = group.y - y;
      const distance = Math.hypot(dx, dy);
      if (distance < GROUP_DISTANCE_THRESHOLD && nowSeconds - group.createdAt <= GROUP_MERGE_WINDOW) {
        return group;
      }
    }
    return null;
  }

  #appendToGroup(group, text, style, nowSeconds) {
    const mergeTarget = [...group.entries].reverse().find((entry) => entry.style.mergeKey === style.mergeKey && nowSeconds - entry.time <= GROUP_MERGE_WINDOW);
    if (mergeTarget && this.#canMergeTextValue(mergeTarget.text, text)) {
      mergeTarget.text = this.#mergeNumericText(mergeTarget.text, text, style.type === 'gold');
      mergeTarget.time = nowSeconds;
      mergeTarget.style = style;
      return;
    }

    group.entries.push(this.#createEntry(text, style, nowSeconds));
  }

  #createEntry(text, style, nowSeconds) {
    return {
      value: text,
      text,
      color: style.color,
      time: nowSeconds,
      style,
    };
  }

  #canMergeTextValue(previousText, nextText) {
    return Number.isFinite(this.#parseNumericText(previousText)) && Number.isFinite(this.#parseNumericText(nextText));
  }

  #mergeNumericText(previousText, nextText, isGold = false) {
    const total = this.#parseNumericText(previousText) + this.#parseNumericText(nextText);
    if (isGold) return `+${total}$`;
    return previousText.endsWith('!') || nextText.endsWith('!') ? `${total}!` : `${total}`;
  }

  #parseNumericText(text) {
    const match = String(text ?? '').match(/-?\d+/);
    return match ? Number.parseInt(match[0], 10) : Number.NaN;
  }

  #randomJitter(range) {
    return (Math.random() * (range * 2)) - range;
  }
}
