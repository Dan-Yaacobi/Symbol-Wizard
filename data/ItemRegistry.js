const ITEM_TYPES = Object.freeze({
  RESOURCE: 'resource',
  RARE: 'rare',
  BOSS: 'boss',
  CURRENCY: 'currency',
});

const ITEM_DEFINITIONS = [
  { id: 'wood', name: 'Wood', type: ITEM_TYPES.RESOURCE, tier: 1, stackable: true, maxStack: 99, icon: '🪵' },
  { id: 'stone', name: 'Stone', type: ITEM_TYPES.RESOURCE, tier: 1, stackable: true, maxStack: 99, icon: '🪨' },
  { id: 'essence', name: 'Essence', type: ITEM_TYPES.CURRENCY, tier: 1, stackable: true, maxStack: 999, icon: '✦' },
  { id: 'ember_dust', name: 'Ember Dust', type: ITEM_TYPES.RESOURCE, tier: 1, stackable: true, maxStack: 99, icon: '•' },
  { id: 'spider_eye', name: 'Spider Eye', type: ITEM_TYPES.RARE, tier: 1, stackable: true, maxStack: 99, icon: '◉' },
  { id: 'wasp_stinger', name: 'Wasp Stinger', type: ITEM_TYPES.RARE, tier: 1, stackable: true, maxStack: 99, icon: '/' },
  { id: 'skull_fragment', name: 'Skull Fragment', type: ITEM_TYPES.RARE, tier: 2, stackable: true, maxStack: 99, icon: '☠' },
  { id: 'fire_core', name: 'Fire Core', type: ITEM_TYPES.BOSS, tier: 3, stackable: true, maxStack: 99, icon: '🔥' },
  { id: 'frost_core', name: 'Frost Core', type: ITEM_TYPES.BOSS, tier: 3, stackable: true, maxStack: 99, icon: '❄' },
  { id: 'lightning_core', name: 'Lightning Core', type: ITEM_TYPES.BOSS, tier: 3, stackable: true, maxStack: 99, icon: '⚡' },
  { id: 'poison_gland', name: 'Poison Gland', type: ITEM_TYPES.RARE, tier: 2, stackable: true, maxStack: 99, icon: '☣' },
  { id: 'storm_shard', name: 'Storm Shard', type: ITEM_TYPES.RARE, tier: 2, stackable: true, maxStack: 99, icon: '⚡' },
];

export const ItemType = ITEM_TYPES;
export const ItemRegistry = Object.freeze(Object.fromEntries(ITEM_DEFINITIONS.map((item) => [item.id, Object.freeze({ ...item })])));
export const ItemList = Object.freeze(ITEM_DEFINITIONS.map((item) => ItemRegistry[item.id]));

export function getItemDefinition(itemId) {
  return ItemRegistry[itemId] ?? null;
}

export function assertItemDefinition(itemId) {
  const item = getItemDefinition(itemId);
  if (!item) throw new Error(`Unknown item id: ${itemId}`);
  return item;
}
