const SLOT_BINDING_LABELS = ['LMB', 'RMB', 'MMB'];
const SLOT_COUNT = 3;
const COOLDOWN_DOM_INTERVAL_MS = 100;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function formatValue(value) {
  return Math.max(0, Math.ceil(value));
}

function formatCooldownValue(value) {
  return value.toFixed(value >= 10 ? 0 : 1);
}

function buildCooldownBackground(remaining, duration) {
  const cooldownRatio = duration > 0 ? clamp01(remaining / duration) : 0;
  const readyRatio = 1 - cooldownRatio;
  return cooldownRatio > 0.001
    ? `conic-gradient(from -90deg, transparent 0turn ${readyRatio}turn, rgba(0, 0, 0, 0.7) ${readyRatio}turn 1turn)`
    : 'transparent';
}

function buildOrbBackground(ratio) {
  return `conic-gradient(from 180deg, var(--orb-fill) 0turn ${ratio}turn, rgba(10, 16, 28, 0.92) ${ratio}turn 1turn)`;
}

export class AbilityBar {
  constructor({ root = document.body, abilitySystem, player }) {
    this.root = root;
    this.abilitySystem = abilitySystem;
    this.player = player;
    this.slotElements = [];
    this.orbs = new Map();
    this.cooldownTimer = null;
    this.unsubscribe = null;
    this.el = document.createElement('section');
    this.el.className = 'combat-hud';
    this.el.setAttribute('aria-label', 'Combat interface');
    this.el.innerHTML = `
      <div class="combat-hud__group combat-hud__group--left"></div>
      <div class="combat-hud__center">
        <div class="combat-hud__ability-bar" role="group" aria-label="Ability bar"></div>
      </div>
      <div class="combat-hud__group combat-hud__group--right"></div>
    `;

    this.root.appendChild(this.el);

    this.leftGroup = this.el.querySelector('.combat-hud__group--left');
    this.rightGroup = this.el.querySelector('.combat-hud__group--right');
    this.barEl = this.el.querySelector('.combat-hud__ability-bar');

    this.createOrb({
      key: 'hp',
      parent: this.leftGroup,
      label: 'HP',
      accentClass: 'combat-orb--hp',
      getValue: () => ({
        current: this.player?.hp ?? 0,
        max: this.player?.maxHp ?? 0,
      }),
    });

    this.createSlots();

    this.createOrb({
      key: 'mana',
      parent: this.rightGroup,
      label: 'Mana',
      accentClass: 'combat-orb--mana',
      getValue: () => ({
        current: this.player?.mana ?? 0,
        max: this.player?.maxMana ?? 0,
      }),
    });

    this.refresh(true);
    this.unsubscribe = typeof this.abilitySystem?.subscribe === 'function'
      ? this.abilitySystem.subscribe(() => this.refresh())
      : null;
    this.startCooldownUpdates();
  }

  createSlots() {
    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const slot = document.createElement('div');
      slot.className = 'combat-slot';
      slot.dataset.slotIndex = String(i);
      slot.innerHTML = `
        <span class="combat-slot__hotkey">${SLOT_BINDING_LABELS[i] ?? String(i + 1)}</span>
        <div class="combat-slot__icon-wrap">
          <div class="combat-slot__icon-bg"></div>
          <span class="combat-slot__icon" aria-hidden="true">—</span>
          <div class="combat-slot__cooldown" aria-hidden="true"></div>
          <span class="combat-slot__cooldown-text"></span>
        </div>
        <span class="combat-slot__label">Empty</span>
      `;

      slot.addEventListener('dragover', (event) => {
        event.preventDefault();
      });

      slot.addEventListener('drop', (event) => {
        event.preventDefault();
        const spellId = event.dataTransfer?.getData('application/x-spell-id')
          || event.dataTransfer?.getData('text/plain');
        if (!spellId) return;
        this.abilitySystem.assignAbilityToSlot(i, spellId);
      });

      this.barEl.appendChild(slot);
      this.slotElements.push({
        root: slot,
        hotkey: slot.querySelector('.combat-slot__hotkey'),
        icon: slot.querySelector('.combat-slot__icon'),
        cooldown: slot.querySelector('.combat-slot__cooldown'),
        cooldownText: slot.querySelector('.combat-slot__cooldown-text'),
        label: slot.querySelector('.combat-slot__label'),
        state: {
          abilityId: null,
          isCoolingDown: null,
          cooldownText: null,
          cooldownValueText: null,
          maxCooldownValueText: null,
          cooldownBackground: null,
        },
      });
    }
  }

  createOrb({ key, parent, label, accentClass, getValue }) {
    const orb = document.createElement('div');
    orb.className = `combat-orb ${accentClass}`;
    orb.setAttribute('role', 'meter');
    orb.setAttribute('aria-label', label);
    orb.innerHTML = `
      <div class="combat-orb__shell">
        <div class="combat-orb__fill"></div>
        <div class="combat-orb__core">
          <span class="combat-orb__label">${label}</span>
          <span class="combat-orb__value">0/0</span>
        </div>
      </div>
    `;

    parent.appendChild(orb);
    this.orbs.set(key, {
      root: orb,
      fill: orb.querySelector('.combat-orb__fill'),
      value: orb.querySelector('.combat-orb__value'),
      getValue,
      state: {
        ratio: Number.NaN,
        valueText: null,
        max: null,
        current: null,
        fillBackground: null,
      },
    });
  }

  startCooldownUpdates() {
    if (this.cooldownTimer !== null) return;
    this.cooldownTimer = window.setInterval(() => {
      if (!this.el.isConnected) {
        this.stopCooldownUpdates();
        this.unsubscribe?.();
        this.unsubscribe = null;
        return;
      }
      this.updateCooldowns();
    }, COOLDOWN_DOM_INTERVAL_MS);
  }

  stopCooldownUpdates() {
    if (this.cooldownTimer === null) return;
    window.clearInterval(this.cooldownTimer);
    this.cooldownTimer = null;
    this.unsubscribe = null;
  }

  refresh(force = false) {
    this.updateStaticSlotState(force);
    this.updateCooldowns(force);
    this.updateOrbs(force);
  }

  updateStaticSlotState(force = false) {
    for (let i = 0; i < this.slotElements.length; i += 1) {
      const slotEl = this.slotElements[i];
      const ability = this.abilitySystem.getAbilityBySlot(i);
      const abilityId = ability?.id ?? '';

      if (force || slotEl.state.abilityId !== abilityId) {
        slotEl.state.abilityId = abilityId;
        slotEl.root.dataset.abilityId = abilityId;
        slotEl.root.classList.toggle('combat-slot--empty', !ability);
        slotEl.icon.textContent = ability?.icon ?? '—';
        slotEl.label.textContent = ability?.name ?? 'Empty';
        slotEl.root.setAttribute('aria-label', ability ? `${ability.name} on ${SLOT_BINDING_LABELS[i]}` : `Empty ${SLOT_BINDING_LABELS[i]} slot`);
      }
    }
  }

  updateCooldowns(force = false) {
    for (let i = 0; i < this.slotElements.length; i += 1) {
      const slotEl = this.slotElements[i];
      const ability = this.abilitySystem.getAbilityBySlot(i);
      const cooldown = ability ? this.abilitySystem.getCooldownRemaining(ability.id) : 0;
      const maxCooldown = ability ? this.abilitySystem.getCooldownDuration(ability.id) : 0;
      const isCoolingDown = cooldown > 0.001;
      const cooldownValueText = isCoolingDown ? formatCooldownValue(cooldown) : null;
      const maxCooldownValueText = maxCooldown > 0 ? formatCooldownValue(maxCooldown) : null;
      const cooldownText = isCoolingDown
        ? `${cooldownValueText} / ${maxCooldownValueText}`
        : 'Ready';
      const cooldownBackground = buildCooldownBackground(cooldown, maxCooldown);

      if (force || slotEl.state.isCoolingDown !== isCoolingDown) {
        slotEl.state.isCoolingDown = isCoolingDown;
        slotEl.root.classList.toggle('combat-slot--cooling-down', isCoolingDown);
        slotEl.cooldown.style.opacity = isCoolingDown ? '1' : '0';
        slotEl.cooldownText.classList.toggle('combat-slot__cooldown-text--ready', !isCoolingDown);
      }

      if (force || slotEl.state.cooldownBackground !== cooldownBackground) {
        slotEl.state.cooldownBackground = cooldownBackground;
        slotEl.cooldown.style.background = cooldownBackground;
      }

      if (
        force
        || slotEl.state.cooldownText !== cooldownText
        || slotEl.state.cooldownValueText !== cooldownValueText
        || slotEl.state.maxCooldownValueText !== maxCooldownValueText
      ) {
        slotEl.state.cooldownText = cooldownText;
        slotEl.state.cooldownValueText = cooldownValueText;
        slotEl.state.maxCooldownValueText = maxCooldownValueText;
        slotEl.cooldownText.textContent = cooldownText;
      }
    }
  }

  updateOrbs(force = false) {
    for (const orb of this.orbs.values()) {
      const { current, max } = orb.getValue();
      const safeMax = Math.max(0, max ?? 0);
      const ratio = safeMax > 0 ? clamp01((current ?? 0) / safeMax) : 0;
      const valueText = `${formatValue(current ?? 0)}/${formatValue(safeMax)}`;
      const roundedPercent = Math.round(ratio * 100);

      if (force || orb.state.ratio !== roundedPercent) {
        const fillBackground = buildOrbBackground(ratio);
        orb.state.ratio = roundedPercent;
        if (force || orb.state.fillBackground !== fillBackground) {
          orb.state.fillBackground = fillBackground;
          orb.fill.style.background = fillBackground;
        }
      }
      if (force || orb.state.valueText !== valueText) {
        orb.state.valueText = valueText;
        orb.value.textContent = valueText;
      }
      if (force || orb.state.max !== safeMax) {
        orb.state.max = safeMax;
        orb.root.setAttribute('aria-valuemin', '0');
        orb.root.setAttribute('aria-valuemax', String(formatValue(safeMax)));
      }
      if (force || orb.state.current !== current) {
        orb.state.current = current;
        orb.root.setAttribute('aria-valuenow', String(formatValue(current ?? 0)));
      }
    }
  }
}
