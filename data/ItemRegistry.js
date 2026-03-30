import { ITEM_CATALOG } from './itemCatalog.js';

const ITEM_TYPES = Object.freeze({
  RESOURCE: 'resource',
  RARE: 'rare',
  BOSS: 'boss',
  CURRENCY: 'currency',
});

const DEFAULT_ITEM_TYPE = ITEM_TYPES.RESOURCE;
const DEFAULT_SAFE_MAX_STACK = 999;

const DEFAULT_DROP_ANIMATION = Object.freeze({
  bobAmplitude: 0.35,
  bobSpeed: 3.6,
});

const DEFAULT_DROP_TINT_BY_TYPE = Object.freeze({
  [ITEM_TYPES.RESOURCE]: '#f5f1de',
  [ITEM_TYPES.RARE]: '#ffe07d',
  [ITEM_TYPES.BOSS]: '#ffba6a',
  [ITEM_TYPES.CURRENCY]: '#b2f6ff',
});

function getItemSpriteId(itemId) {
  return `item_${String(itemId ?? '').trim()}`;
}

function withDropVisualDefaults(item) {
  const itemId = String(item?.id ?? '').trim();
  const type = item?.type ?? DEFAULT_ITEM_TYPE;
  return {
    ...item,
    spriteId: String(item?.spriteId ?? '').trim() || getItemSpriteId(itemId),
    dropTint: item?.dropTint ?? DEFAULT_DROP_TINT_BY_TYPE[type] ?? DEFAULT_DROP_TINT_BY_TYPE[DEFAULT_ITEM_TYPE],
    dropAnimation: {
      ...DEFAULT_DROP_ANIMATION,
      ...(item?.dropAnimation ?? {}),
    },
  };
}

const ITEM_DEFINITIONS = [
  { id: 'wood', name: 'Wood', type: ITEM_TYPES.RESOURCE, tier: 1, stackable: true, maxStack: 99, icon: '🪵', spriteId: 'item_wood' },
  { id: 'stone', name: 'Stone', type: ITEM_TYPES.RESOURCE, tier: 1, stackable: true, maxStack: 99, icon: '🪨', spriteId: 'item_stone' },
  { id: 'essence', name: 'Essence', type: ITEM_TYPES.CURRENCY, tier: 1, stackable: true, maxStack: 999, icon: '✦', spriteId: 'item_essence' },
  { id: 'ember_dust', name: 'Ember Dust', type: ITEM_TYPES.RESOURCE, tier: 1, stackable: true, maxStack: 99, icon: '•', spriteId: 'item_ember_dust' },
  { id: 'spider_eye', name: 'Spider Eye', type: ITEM_TYPES.RARE, tier: 1, stackable: true, maxStack: 99, icon: '◉', spriteId: 'item_spider_eye' },
  { id: 'wasp_stinger', name: 'Wasp Stinger', type: ITEM_TYPES.RARE, tier: 1, stackable: true, maxStack: 99, icon: '/', spriteId: 'item_wasp_stinger' },
  { id: 'skull_fragment', name: 'Skull Fragment', type: ITEM_TYPES.RARE, tier: 2, stackable: true, maxStack: 99, icon: '☠', spriteId: 'item_skull_fragment' },
  { id: 'fire_core', name: 'Fire Core', type: ITEM_TYPES.BOSS, tier: 3, stackable: true, maxStack: 99, icon: '🔥', spriteId: 'item_fire_core' },
  { id: 'frost_core', name: 'Frost Core', type: ITEM_TYPES.BOSS, tier: 3, stackable: true, maxStack: 99, icon: '❄', spriteId: 'item_frost_core' },
  { id: 'lightning_core', name: 'Lightning Core', type: ITEM_TYPES.BOSS, tier: 3, stackable: true, maxStack: 99, icon: '⚡', spriteId: 'item_lightning_core' },
  { id: 'poison_gland', name: 'Poison Gland', type: ITEM_TYPES.RARE, tier: 2, stackable: true, maxStack: 99, icon: '☣', spriteId: 'item_poison_gland' },
  { id: 'storm_shard', name: 'Storm Shard', type: ITEM_TYPES.RARE, tier: 2, stackable: true, maxStack: 99, icon: '⚡', spriteId: 'item_storm_shard' },
  { id: 'chitin_fragment', name: 'Chitin Fragment', type: ITEM_TYPES.RESOURCE, tier: 1, stackable: true, maxStack: 99, icon: '⌬', spriteId: 'item_chitin_fragment' },
].map(withDropVisualDefaults);

const ITEM_DEFINITION_MAP = new Map(ITEM_DEFINITIONS.map((item) => [item.id, item]));

for (const catalogEntry of Object.values(ITEM_CATALOG)) {
  if (!catalogEntry?.id || ITEM_DEFINITION_MAP.has(catalogEntry.id)) continue;
  ITEM_DEFINITION_MAP.set(catalogEntry.id, withDropVisualDefaults({
    id: catalogEntry.id,
    name: catalogEntry.name ?? catalogEntry.id,
    type: DEFAULT_ITEM_TYPE,
    tier: 1,
    stackable: true,
    maxStack: DEFAULT_SAFE_MAX_STACK,
    icon: '•',
    spriteId: getItemSpriteId(catalogEntry.id),
  }));
}

const ALL_ITEM_DEFINITIONS = Object.freeze(Array.from(ITEM_DEFINITION_MAP.values()));

export const ItemType = ITEM_TYPES;
export const ItemRegistry = Object.freeze(Object.fromEntries(ALL_ITEM_DEFINITIONS.map((item) => [item.id, Object.freeze({ ...item })])));
export const ItemList = Object.freeze(ALL_ITEM_DEFINITIONS.map((item) => ItemRegistry[item.id]));

export function getItemDefinition(itemId) {
  return ItemRegistry[itemId] ?? null;
}

export function assertItemDefinition(itemId) {
  const item = getItemDefinition(itemId);
  if (!item) throw new Error(`Unknown item id: ${itemId}`);
  if (!item.spriteId) throw new Error(`Item "${itemId}" is missing spriteId.`);
  return item;
}
