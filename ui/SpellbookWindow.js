export class SpellbookWindow {
  constructor({ root, abilitySystem, input }) {
    this.root = root;
    this.abilitySystem = abilitySystem;
    this.input = input;
    this.selectedSpellId = null;
    this.visible = false;
    this.pendingEquipSlot = 0;
    this.dragPayload = null;

    this.el = document.createElement('section');
    this.el.className = 'spellbook-window hidden';
    this.root.appendChild(this.el);

    window.addEventListener('keydown', (event) => this.onWindowKeyDown(event));

    this.render();
  }

  selectSpell(spellId, { render = true } = {}) {
    if (!spellId || this.selectedSpellId === spellId) return;
    this.selectedSpellId = spellId;
    if (render) this.render();
  }

  setPendingEquipSlot(slotIndex, { equip = false } = {}) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 3) return;
    if (this.pendingEquipSlot === slotIndex && !equip) return;
    this.pendingEquipSlot = slotIndex;
    if (equip) this.equipSelectedSpell(slotIndex);
    else this.render();
  }

  onWindowKeyDown(event) {
    const key = event.key.toLowerCase();
    if (key === 'b') {
      this.toggle();
      event.preventDefault();
      return;
    }

    if (!this.visible) return;

    if (key === 'escape') {
      this.close();
      event.preventDefault();
      return;
    }

    if (key === 'arrowdown' || key === 'arrowright') {
      this.moveSelection(1);
      event.preventDefault();
      return;
    }

    if (key === 'arrowup' || key === 'arrowleft') {
      this.moveSelection(-1);
      event.preventDefault();
      return;
    }

    if (key === 'enter') {
      this.equipSelectedSpell(this.pendingEquipSlot);
      this.pendingEquipSlot = (this.pendingEquipSlot + 1) % 4;
      event.preventDefault();
      return;
    }

    if (['1', '2', '3', '4'].includes(key)) {
      this.pendingEquipSlot = Number(key) - 1;
      this.equipSelectedSpell(this.pendingEquipSlot);
      event.preventDefault();
    }
  }

  toggle() {
    this.visible = !this.visible;
    this.el.classList.toggle('hidden', !this.visible);
    this.render();
  }

  close() {
    this.visible = false;
    this.el.classList.add('hidden');
  }

  isOpen() {
    return this.visible;
  }

  moveSelection(direction) {
    const spells = this.abilitySystem.getAbilities();
    if (!spells.length) return;

    const currentIndex = spells.findIndex((spell) => spell.id === this.selectedSpellId);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + direction + spells.length) % spells.length;
    this.selectSpell(spells[nextIndex].id);
  }

  equipSelectedSpell(slotIndex) {
    if (!this.selectedSpellId) return;
    this.abilitySystem.assignAbilityToSlot(slotIndex, this.selectedSpellId);
    this.render();
  }

  render() {
    const spells = this.abilitySystem.getAbilities();

    if (!this.selectedSpellId || !spells.some((spell) => spell.id === this.selectedSpellId)) {
      this.selectedSpellId = spells[0]?.id ?? null;
    }

    const selected = spells.find((spell) => spell.id === this.selectedSpellId) ?? null;

    this.el.innerHTML = `
      <header class="spellbook-header">
        <h3>Spellbook</h3>
        <p>B / Esc to close • Arrows to navigate • Enter to equip</p>
      </header>
      <div class="spellbook-layout">
        <aside class="spellbook-page spellbook-page--left"></aside>
        <section class="spellbook-divider"></section>
        <article class="spellbook-page spellbook-page--right"></article>
      </div>
      <footer class="spellbook-slots"></footer>
    `;

    const left = this.el.querySelector('.spellbook-page--left');
    const right = this.el.querySelector('.spellbook-page--right');
    const slots = this.el.querySelector('.spellbook-slots');

    for (const spell of spells) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'spellbook-list-item';
      if (spell.id === this.selectedSpellId) item.classList.add('selected');
      item.innerHTML = `<span class="spell-icon">${spell.icon ?? '?'}</span><span>${spell.name}</span>`;
      item.draggable = true;

      item.addEventListener('mouseenter', () => {
        this.selectSpell(spell.id);
      });

      item.addEventListener('focus', () => {
        this.selectSpell(spell.id);
      });

      item.addEventListener('click', () => {
        this.selectSpell(spell.id);
      });

      item.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('application/x-spell-id', spell.id);
        event.dataTransfer?.setData('text/plain', spell.id);
        this.dragPayload = spell.id;
      });

      left.appendChild(item);
    }

    if (!selected) {
      right.innerHTML = '<p>No spells unlocked.</p>';
    } else {
      const stats = [];
      const effectiveRadius = Number.isFinite(selected?.parameters?.radius)
        ? selected.parameters.radius
        : (Number.isFinite(selected?.finalStats?.radius) ? selected.finalStats.radius : null);
      const maxJumps = Number.isFinite(selected?.parameters?.maxJumps)
        ? selected.parameters.maxJumps
        : (Number.isFinite(selected?.finalStats?.maxJumps) ? selected.finalStats.maxJumps : null);
      const chainRange = Number.isFinite(selected?.parameters?.chainRange)
        ? selected.parameters.chainRange
        : (Number.isFinite(selected?.finalStats?.chainRange) ? selected.finalStats.chainRange : null);
      if (Number.isFinite(selected.damage)) stats.push(`Damage: ${selected.damage}`);
      if (Number.isFinite(selected.cooldown)) stats.push(`Cooldown: ${selected.cooldown}s`);
      if (Number.isFinite(selected.range)) stats.push(`Range: ${selected.range}`);
      if (Number.isFinite(effectiveRadius)) stats.push(`AoE Radius: ${effectiveRadius}`);
      if (Number.isFinite(maxJumps)) stats.push(`Max Jumps: +${maxJumps}`);
      if (Number.isFinite(chainRange)) stats.push(`Jump Radius: ${chainRange}`);
      if (selected.crafted) stats.push(`Profile: ${selected.profile?.name ?? 'Unknown'}`);
      const effectSummary = selected.crafted
        ? `Guaranteed: ${(selected.guaranteedEffects ?? []).map((effect) => effect.label).join(', ') || 'None'} • Bonus: ${(selected.bonusEffects ?? []).map((effect) => effect.label).join(', ') || 'None'}`
        : '';
      right.innerHTML = `
        <div class="spellbook-details-icon">${selected.icon ?? '?'}</div>
        <h4>${selected.name}</h4>
        <p>${selected.description ?? ''}</p>
        ${effectSummary ? `<p class="spellbook-crafted-summary">${effectSummary}</p>` : ''}
        <ul>${stats.map((s) => `<li>${s}</li>`).join('')}</ul>
      `;
    }

    for (let i = 0; i < 4; i += 1) {
      const equipped = this.abilitySystem.getAbilityBySlot(i);
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'spellbook-slot';
      if (this.pendingEquipSlot === i) slot.classList.add('active');
      slot.innerHTML = `<span>[Slot ${i + 1}]</span><strong>${equipped?.name ?? 'Empty'}</strong>`;

      slot.addEventListener('mouseenter', () => {
        this.setPendingEquipSlot(i);
      });

      slot.addEventListener('focus', () => {
        this.setPendingEquipSlot(i);
      });

      slot.addEventListener('click', () => {
        this.setPendingEquipSlot(i, { equip: true });
      });

      slot.addEventListener('dragover', (event) => event.preventDefault());
      slot.addEventListener('drop', (event) => {
        event.preventDefault();
        const spellId = event.dataTransfer?.getData('application/x-spell-id') || this.dragPayload;
        if (!spellId) return;
        this.selectSpell(spellId, { render: false });
        this.abilitySystem.assignAbilityToSlot(i, spellId);
        this.pendingEquipSlot = i;
        this.render();
      });

      slots.appendChild(slot);
    }
  }
}
