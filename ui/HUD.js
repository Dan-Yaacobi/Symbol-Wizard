import { visualPalette, visualTheme } from '../data/VisualTheme.js';
import { ensureInventory, getItemCount } from '../systems/InventorySystem.js';

const c = visualTheme.colors;

export function drawHUD(renderer, player) {
  renderer.drawUiText(`Gold:${player.gold}`, visualPalette.gold.coin, c.night, 1, 1);
  const inventory = ensureInventory(player?.inventory, { warn: true, context: 'HUD.drawHUD' });
  const essence = getItemCount(inventory, 'essence');
  const inventorySlots = inventory.slots.length;
  const inventoryMax = inventory.maxSlots;
  renderer.drawUiText(`Essence:${essence}`, c.text, c.night, 1, 2);
  renderer.drawUiText(`Bag:${inventorySlots}/${inventoryMax}`, c.textMuted, c.night, 20, 2);
}
