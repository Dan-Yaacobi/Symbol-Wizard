export class AbilityBar {
  constructor({ root, abilitySystem }) {
    this.root = root;
    this.abilitySystem = abilitySystem;
    this.dragPayload = null;

    this.el = document.createElement('section');
    this.el.className = 'ability-bar';
    this.el.innerHTML = '<h3>Ability Slots</h3><div class="ability-slots"></div><div class="ability-pool"></div>';
    this.root.appendChild(this.el);

    this.slotsWrap = this.el.querySelector('.ability-slots');
    this.poolWrap = this.el.querySelector('.ability-pool');

    this.render();
  }

  render() {
    this.renderSlots();
    this.renderPool();
  }

  renderSlots() {
    this.slotsWrap.innerHTML = '';

    for (let i = 0; i < 4; i += 1) {
      const ability = this.abilitySystem.getAbilityBySlot(i);
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'ability-slot';
      slot.dataset.slotIndex = String(i);
      slot.innerHTML = `<span class="slot-hotkey">${i + 1}</span><span class="slot-label">${ability?.name ?? 'Empty'}</span>`;

      slot.draggable = true;
      slot.addEventListener('dragstart', () => {
        this.dragPayload = { type: 'slot', slotIndex: i, abilityId: ability?.id ?? null };
        slot.classList.add('dragging');
      });
      slot.addEventListener('dragend', () => {
        slot.classList.remove('dragging');
        this.dragPayload = null;
      });

      slot.addEventListener('dragover', (event) => event.preventDefault());
      slot.addEventListener('drop', () => {
        if (!this.dragPayload) return;

        if (this.dragPayload.type === 'slot') {
          this.abilitySystem.swapSlots(this.dragPayload.slotIndex, i);
        } else if (this.dragPayload.type === 'pool') {
          this.abilitySystem.assignAbilityToSlot(i, this.dragPayload.abilityId);
        }

        this.render();
      });

      slot.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        this.abilitySystem.assignAbilityToSlot(i, null);
        this.render();
      });

      this.slotsWrap.appendChild(slot);
    }
  }

  renderPool() {
    this.poolWrap.innerHTML = '<h4>Spellbook (drag to slot; right-click slot to clear)</h4>';
    const list = document.createElement('div');
    list.className = 'ability-pool-list';

    for (const ability of this.abilitySystem.getAbilities()) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'ability-pool-item';
      item.textContent = ability.name;
      item.draggable = true;

      item.addEventListener('dragstart', () => {
        this.dragPayload = { type: 'pool', abilityId: ability.id };
      });

      list.appendChild(item);
    }

    this.poolWrap.appendChild(list);
  }
}
