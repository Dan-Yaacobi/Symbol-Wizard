import { assertItemDefinition } from '../data/ItemRegistry.js';

export function createInventory(maxSlots = 24) {
  return {
    slots: [],
    maxSlots,
  };
}

function findSlotsByItemId(inventory, itemId) {
  return inventory.slots.filter((slot) => slot?.itemId === itemId);
}

export function getItemCount(inventory, itemId) {
  return findSlotsByItemId(inventory, itemId).reduce((total, slot) => total + (slot.quantity ?? 0), 0);
}

export function hasItem(inventory, itemId, amount = 1) {
  return getItemCount(inventory, itemId) >= amount;
}

export function addItem(inventory, itemId, amount = 1) {
  const item = assertItemDefinition(itemId);
  const requested = Math.max(0, Math.floor(amount));
  if (!inventory || requested <= 0) return { success: false, added: 0, remaining: requested, slotsChanged: false };

  let remaining = requested;
  let slotsChanged = false;

  if (item.stackable) {
    for (const slot of inventory.slots) {
      if (slot.itemId !== itemId) continue;
      const capacity = Math.max(0, item.maxStack - slot.quantity);
      if (capacity <= 0) continue;
      const added = Math.min(capacity, remaining);
      slot.quantity += added;
      remaining -= added;
      slotsChanged = slotsChanged || added > 0;
      if (remaining <= 0) {
        return { success: true, added: requested, remaining: 0, slotsChanged };
      }
    }
  }

  while (remaining > 0 && inventory.slots.length < inventory.maxSlots) {
    const stackAmount = item.stackable ? Math.min(item.maxStack, remaining) : 1;
    inventory.slots.push({ itemId, quantity: stackAmount });
    remaining -= stackAmount;
    slotsChanged = true;
  }

  return {
    success: remaining === 0,
    added: requested - remaining,
    remaining,
    slotsChanged,
  };
}

export function removeItem(inventory, itemId, amount = 1) {
  const requested = Math.max(0, Math.floor(amount));
  if (!inventory || requested <= 0) return { success: false, removed: 0, remaining: requested, slotsChanged: false };
  if (!hasItem(inventory, itemId, requested)) return { success: false, removed: 0, remaining: requested, slotsChanged: false };

  let remaining = requested;
  let slotsChanged = false;

  for (let index = inventory.slots.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const slot = inventory.slots[index];
    if (slot.itemId !== itemId) continue;
    const removed = Math.min(slot.quantity, remaining);
    slot.quantity -= removed;
    remaining -= removed;
    slotsChanged = slotsChanged || removed > 0;
    if (slot.quantity <= 0) inventory.slots.splice(index, 1);
  }

  return {
    success: remaining === 0,
    removed: requested - remaining,
    remaining,
    slotsChanged,
  };
}
