const SLOT_BINDING_LABELS = ['LMB', 'RMB', 'MMB', '—'];

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
      slot.innerHTML = `<span class="slot-hotkey">${SLOT_BINDING_LABELS[i] ?? '—'}</span><span class="slot-label">${ability?.name ?? 'Empty'}</span>`;

      slot.draggable = Boolean(ability);
      slot.addEventListener('dragstart', (event) => {
        if (!ability) {
          event.preventDefault();
          return;
        }

        event.dataTransfer?.setData('application/x-ability-source', 'slot');
        event.dataTransfer?.setData('text/plain', String(i));
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';

        this.dragPayload = { type: 'slot', slotIndex: i, abilityId: ability.id };
        slot.classList.add('dragging');
      });
      slot.addEventListener('dragend', () => {
        slot.classList.remove('dragging');
        this.dragPayload = null;
      });

      slot.addEventListener('dragover', (event) => {
        event.preventDefault();
      });
      slot.addEventListener('drop', (event) => {
        event.preventDefault();

        const sourceType = event.dataTransfer?.getData('application/x-ability-source') || this.dragPayload?.type;

        if (sourceType === 'slot') {
          const fromIndexRaw = event.dataTransfer?.getData('text/plain');
          const fromIndex = Number(fromIndexRaw);
          if (Number.isNaN(fromIndex)) return;

          this.abilitySystem.swapSlots(fromIndex, i);
        } else if (sourceType === 'pool') {
          const abilityId =
            event.dataTransfer?.getData('application/x-ability-id') ||
            event.dataTransfer?.getData('text/plain') ||
            this.dragPayload?.abilityId;
          if (!abilityId) return;

          this.abilitySystem.assignAbilityToSlot(i, abilityId);
        } else {
          return;
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

      item.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('application/x-ability-source', 'pool');
        event.dataTransfer?.setData('application/x-ability-id', ability.id);
        event.dataTransfer?.setData('text/plain', ability.id);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copyMove';
        this.dragPayload = { type: 'pool', abilityId: ability.id };
      });

      list.appendChild(item);
    }

    this.poolWrap.appendChild(list);
  }
}
