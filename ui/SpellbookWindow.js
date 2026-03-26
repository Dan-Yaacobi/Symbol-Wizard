export class SpellbookWindow {
  constructor({ root, abilitySystem, input }) {
    this.root = root;
    this.abilitySystem = abilitySystem;
    this.input = input;
    this.selectedSpellId = null;
    this.visible = false;
    this.pendingEquipSlot = 0;
    this.dragPayload = null;
    this.currentPage = 0;
    this.spellsPerPage = 16;

    this.el = document.createElement('section');
    this.el.className = 'spellbook-window spellbook-window--spellbook hidden';
    this.root.appendChild(this.el);

    window.addEventListener('keydown', (event) => this.onWindowKeyDown(event));

    this.render();
  }

  selectSpell(spellId, { render = true } = {}) {
    if (!spellId || this.selectedSpellId === spellId) return;
    this.selectedSpellId = spellId;
    const spells = this.abilitySystem.getAbilities();
    const selectedIndex = spells.findIndex((spell) => spell.id === spellId);
    if (selectedIndex >= 0) {
      this.currentPage = Math.floor(selectedIndex / this.spellsPerPage);
    }
    if (render) this.render();
  }

  setPage(pageIndex) {
    const spells = this.abilitySystem.getAbilities();
    const totalPages = this.getTotalPages(spells);
    const clampedPage = Math.min(Math.max(0, pageIndex), totalPages - 1);
    if (clampedPage === this.currentPage) return;
    this.currentPage = clampedPage;
    const pageSpells = this.getPageSpells(spells, this.currentPage);
    if (pageSpells.length && !pageSpells.some((spell) => spell.id === this.selectedSpellId)) {
      this.selectedSpellId = pageSpells[0].id;
    }
    this.render();
  }

  setPendingEquipSlot(slotIndex, { equip = false } = {}) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 2) return;
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

    if (['1', '2', '3'].includes(key)) {
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

  getTotalPages(spells) {
    return Math.max(1, Math.ceil(spells.length / this.spellsPerPage));
  }

  getPageSpells(spells, pageIndex) {
    const start = pageIndex * this.spellsPerPage;
    return spells.slice(start, start + this.spellsPerPage);
  }

  getSpellVisual(spell) {
    const iconByBehavior = {
      projectile: '➵',
      beam: '⌁',
      zone: '◎',
      aura: '✹',
      blink: '➠',
    };

    let icon = iconByBehavior[spell?.behavior] ?? spell?.icon ?? '✦';
    if ((spell?.components ?? []).includes('explode_on_hit')) icon = '✸';
    if ((spell?.components ?? []).includes('chain_on_hit')) icon = 'ϟ';
    if ((spell?.components ?? []).includes('apply_status_on_hit')) icon = '☄';
    if (spell?.id === 'time-freeze') icon = '⌛';

    const descriptor = Number.isFinite(spell?.damage)
      ? `${spell.damage} dmg`
      : (Number.isFinite(spell?.cooldown) ? `${spell.cooldown}s cd` : (spell?.behavior ?? 'utility'));

    return { icon, descriptor };
  }

  equipSelectedSpell(slotIndex) {
    if (!this.selectedSpellId) return;
    this.abilitySystem.assignAbilityToSlot(slotIndex, this.selectedSpellId);
    this.render();
  }

  render() {
    const spells = this.abilitySystem.getAbilities();
    const totalPages = this.getTotalPages(spells);
    this.currentPage = Math.min(Math.max(0, this.currentPage), totalPages - 1);

    if (!this.selectedSpellId || !spells.some((spell) => spell.id === this.selectedSpellId)) {
      this.selectedSpellId = spells[0]?.id ?? null;
      this.currentPage = 0;
    }

    const selected = spells.find((spell) => spell.id === this.selectedSpellId) ?? null;
    const pageSpells = this.getPageSpells(spells, this.currentPage);
    const leftPageSpells = pageSpells.slice(0, 8);
    const rightPageSpells = pageSpells.slice(8, 16);

    this.el.innerHTML = `
      <header class="spellbook-header">
        <h3>Spellbook</h3>
        <p>B / Esc to close • Arrows to navigate • Drag to equip</p>
        <div class="spellbook-pagination">
          <button type="button" class="spellbook-page-nav spellbook-page-nav--prev" ${this.currentPage === 0 ? 'disabled' : ''}>← Previous</button>
          <span class="spellbook-page-indicator">Page ${this.currentPage + 1} / ${totalPages}</span>
          <button type="button" class="spellbook-page-nav spellbook-page-nav--next" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''}>Next →</button>
        </div>
      </header>
      <div class="spellbook-layout">
        <section class="spellbook-book">
          <aside class="spellbook-page spellbook-page--left"></aside>
          <section class="spellbook-divider"></section>
          <article class="spellbook-page spellbook-page--right"></article>
        </section>
        <article class="spellbook-page spellbook-page--details"></article>
      </div>
      <footer class="spellbook-slots"></footer>
    `;

    const left = this.el.querySelector('.spellbook-page--left');
    const right = this.el.querySelector('.spellbook-page--right');
    const detailsPanel = this.el.querySelector('.spellbook-page--details');
    const slots = this.el.querySelector('.spellbook-slots');
    const prevPageButton = this.el.querySelector('.spellbook-page-nav--prev');
    const nextPageButton = this.el.querySelector('.spellbook-page-nav--next');

    prevPageButton?.addEventListener('click', () => this.setPage(this.currentPage - 1));
    nextPageButton?.addEventListener('click', () => this.setPage(this.currentPage + 1));

    const renderSpellButton = (spell) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'spellbook-list-item';
      if (spell.id === this.selectedSpellId) item.classList.add('selected');
      const visual = this.getSpellVisual(spell);
      item.innerHTML = `
        <span class="spell-icon">${visual.icon}</span>
        <span class="spellbook-list-copy">
          <strong>${spell.name}</strong>
          <small>${visual.descriptor}</small>
        </span>
      `;
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
      return item;
    };

    for (const spell of leftPageSpells) {
      left.appendChild(renderSpellButton(spell));
    }

    for (const spell of rightPageSpells) {
      right.appendChild(renderSpellButton(spell));
    }

    if (!leftPageSpells.length) {
      left.innerHTML = '<p>No spells unlocked.</p>';
      right.innerHTML = '';
    }

    if (!selected) {
      detailsPanel.innerHTML = '<p>No spells unlocked.</p>';
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
      if (Number.isFinite(maxJumps)) stats.push(`Max Jumps: +${Math.round(maxJumps)}`);
      if (Number.isFinite(chainRange)) stats.push(`Jump Radius: ${chainRange}`);
      if (selected.crafted) stats.push(`Profile: ${selected.profile?.name ?? 'Unknown'}`);
      const effectSummary = selected.crafted
        ? `Guaranteed: ${(selected.guaranteedEffects ?? []).map((effect) => effect.label).join(', ') || 'None'} • Bonus: ${(selected.bonusEffects ?? []).map((effect) => effect.label).join(', ') || 'None'}`
        : '';
      const selectedVisual = this.getSpellVisual(selected);
      detailsPanel.innerHTML = `
        <div class="spellbook-details-icon">${selectedVisual.icon}</div>
        <h4>${selected.name}</h4>
        <p>${selected.description ?? ''}</p>
        ${effectSummary ? `<p class="spellbook-crafted-summary">${effectSummary}</p>` : ''}
        <ul>${stats.map((s) => `<li>${s}</li>`).join('')}</ul>
      `;
    }

    for (let i = 0; i < 3; i += 1) {
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
