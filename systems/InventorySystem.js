import { assertItemDefinition } from '../data/ItemRegistry.js';

const DEFAULT_MAX_SLOTS = 24;
let inventoryShapeWarningShown = false;

export function createInventory(maxSlots = DEFAULT_MAX_SLOTS) {
  const normalizedMaxSlots = Number.isFinite(Number(maxSlots)) ? Math.max(0, Math.floor(Number(maxSlots))) : DEFAULT_MAX_SLOTS;
  return {
    slots: [],
    maxSlots: normalizedMaxSlots,
  };
}

export function isInventory(value) {
  return Boolean(value) && Array.isArray(value.slots) && Number.isFinite(value.maxSlots);
}

export function ensureInventory(inventory, options = {}) {
  const { fallbackMaxSlots = DEFAULT_MAX_SLOTS, warn = false, context = 'InventorySystem' } = options;
  if (isInventory(inventory)) return inventory;

  if (warn && !inventoryShapeWarningShown && typeof console !== 'undefined' && typeof console.warn === 'function') {
    inventoryShapeWarningShown = true;
    console.warn(`[${context}] Invalid inventory shape encountered; using an empty fallback inventory.`, inventory);
  }

  return createInventory(fallbackMaxSlots);
}

function findSlotsByItemId(inventory, itemId) {
  const safeInventory = ensureInventory(inventory, { warn: true, context: 'InventorySystem.findSlotsByItemId' });
  return safeInventory.slots.filter((slot) => slot?.itemId === itemId);
}

export function getItemCount(inventory, itemId) {
  return findSlotsByItemId(inventory, itemId).reduce((total, slot) => total + (slot.quantity ?? 0), 0);
}

export function hasItem(inventory, itemId, amount = 1) {
  return getItemCount(inventory, itemId) >= amount;
}

export function getAllItems(inventory) {
  const safeInventory = ensureInventory(inventory, { warn: true, context: 'InventorySystem.getAllItems' });
  return safeInventory.slots
    .filter((slot) => slot && typeof slot.itemId === 'string' && Number.isFinite(slot.quantity) && slot.quantity > 0)
    .map((slot) => ({ itemId: slot.itemId, quantity: slot.quantity }));
}

export function addItem(inventory, itemId, amount = 1) {
  const item = assertItemDefinition(itemId);
  const requested = Math.max(0, Math.floor(amount));
  const safeInventory = ensureInventory(inventory, { warn: true, context: 'InventorySystem.addItem' });
  if (requested <= 0) return { success: false, added: 0, remaining: requested, slotsChanged: false };

  let remaining = requested;
  let slotsChanged = false;

  if (item.stackable) {
    for (const slot of safeInventory.slots) {
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

  while (remaining > 0 && safeInventory.slots.length < safeInventory.maxSlots) {
    const stackAmount = item.stackable ? Math.min(item.maxStack, remaining) : 1;
    safeInventory.slots.push({ itemId, quantity: stackAmount });
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
  const safeInventory = ensureInventory(inventory, { warn: true, context: 'InventorySystem.removeItem' });
  if (requested <= 0) return { success: false, removed: 0, remaining: requested, slotsChanged: false };
  if (!hasItem(safeInventory, itemId, requested)) return { success: false, removed: 0, remaining: requested, slotsChanged: false };

  let remaining = requested;
  let slotsChanged = false;

  for (let index = safeInventory.slots.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const slot = safeInventory.slots[index];
    if (slot.itemId !== itemId) continue;
    const removed = Math.min(slot.quantity, remaining);
    slot.quantity -= removed;
    remaining -= removed;
    slotsChanged = slotsChanged || removed > 0;
    if (slot.quantity <= 0) safeInventory.slots.splice(index, 1);
  }

  return {
    success: remaining === 0,
    removed: requested - remaining,
    remaining,
    slotsChanged,
  };
}
