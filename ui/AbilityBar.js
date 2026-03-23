const SLOT_BINDING_LABELS = ['LMB', 'RMB', 'MMB'];
const SLOT_COUNT = 3;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function formatValue(value) {
  return Math.max(0, Math.ceil(value));
}

export class AbilityBar {
  constructor({ root = document.body, abilitySystem, player }) {
    this.root = root;
    this.abilitySystem = abilitySystem;
    this.player = player;
    this.slotElements = [];
    this.orbs = new Map();
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

    this.update(true);
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
          cooldownPercent: Number.NaN,
          cooldownText: null,
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
      },
    });
  }

  update(force = false) {
    this.updateSlots(force);
    this.updateOrbs(force);
  }

  updateSlots(force = false) {
    for (let i = 0; i < this.slotElements.length; i += 1) {
      const slotEl = this.slotElements[i];
      const ability = this.abilitySystem.getAbilityBySlot(i);
      const cooldown = ability ? this.abilitySystem.getCooldownRemaining(ability.id) : 0;
      const maxCooldown = ability ? this.abilitySystem.getCooldownDuration(ability.id) : 0;
      const cooldownRatio = maxCooldown > 0 ? clamp01(cooldown / maxCooldown) : 0;
      const readyRatio = 1 - cooldownRatio;
      const isCoolingDown = cooldown > 0.001;
      const cooldownText = isCoolingDown
        ? `${cooldown.toFixed(cooldown >= 10 ? 0 : 1)} / ${maxCooldown.toFixed(maxCooldown >= 10 ? 0 : 1)}`
        : 'Ready';
      const cooldownPercent = Math.round(cooldownRatio * 100);
      const shouldUpdateCooldownVisual = force
        || slotEl.state.isCoolingDown !== isCoolingDown
        || Math.abs(cooldownPercent - slotEl.state.cooldownPercent) >= 1;

      if (force || slotEl.state.abilityId !== (ability?.id ?? '')) {
        slotEl.state.abilityId = ability?.id ?? '';
        slotEl.root.dataset.abilityId = slotEl.state.abilityId;
        slotEl.root.classList.toggle('combat-slot--empty', !ability);
        slotEl.icon.textContent = ability?.icon ?? '—';
        slotEl.label.textContent = ability?.name ?? 'Empty';
        slotEl.root.setAttribute('aria-label', ability ? `${ability.name} on ${SLOT_BINDING_LABELS[i]}` : `Empty ${SLOT_BINDING_LABELS[i]} slot`);
      }

      if (force || slotEl.state.isCoolingDown !== isCoolingDown) {
        slotEl.state.isCoolingDown = isCoolingDown;
        slotEl.root.classList.toggle('combat-slot--cooling-down', isCoolingDown);
        slotEl.cooldown.style.opacity = isCoolingDown ? '1' : '0';
        slotEl.cooldownText.classList.toggle('combat-slot__cooldown-text--ready', !isCoolingDown);
      }

      if (shouldUpdateCooldownVisual) {
        slotEl.state.cooldownPercent = cooldownPercent;
        slotEl.cooldown.style.background = isCoolingDown
          ? `conic-gradient(from -90deg, transparent 0turn ${readyRatio}turn, rgba(0, 0, 0, 0.7) ${readyRatio}turn 1turn)`
          : 'transparent';
      }

      if (force || slotEl.state.cooldownText !== cooldownText) {
        slotEl.state.cooldownText = cooldownText;
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
        orb.state.ratio = roundedPercent;
        orb.fill.style.background = `conic-gradient(from 180deg, var(--orb-fill) 0turn ${ratio}turn, rgba(10, 16, 28, 0.92) ${ratio}turn 1turn)`;
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
