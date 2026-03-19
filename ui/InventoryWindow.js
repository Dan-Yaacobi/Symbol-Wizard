import { getItemDefinition } from '../data/ItemRegistry.js';
import { getAllItems } from '../systems/InventorySystem.js';

function formatInventoryItem(entry) {
  const item = getItemDefinition(entry.itemId);
  return {
    itemId: entry.itemId,
    quantity: entry.quantity,
    name: item?.name ?? entry.itemId,
    icon: item?.icon ?? '•',
  };
}

export class InventoryWindow {
  constructor({ root, player }) {
    this.root = root;
    this.player = player;
    this.visible = false;

    this.el = document.createElement('section');
    this.el.className = 'spellbook-window hidden';
    this.root.appendChild(this.el);
  }

  isOpen() {
    return this.visible;
  }

  open() {
    if (this.visible) return;
    this.visible = true;
    this.el.classList.remove('hidden');
    this.render();
  }

  close() {
    if (!this.visible) return;
    this.visible = false;
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
  }

  toggle() {
    if (this.visible) this.close();
    else this.open();
  }

  render() {
    if (!this.visible) return;

    const items = getAllItems(this.player?.inventory).map(formatInventoryItem);
    const itemMarkup = items.length > 0
      ? items.map((item) => `<li>[${item.icon} ${item.name} x${item.quantity}]</li>`).join('')
      : '<li>Inventory empty.</li>';

    this.el.innerHTML = `
      <header class="spellbook-header">
        <h3>Inventory</h3>
        <p>I to close</p>
      </header>
      <div class="spellbook-layout">
        <article class="spellbook-page spellbook-page--left">
          <ul>${itemMarkup}</ul>
        </article>
      </div>
    `;
  }
}
