import { ITEM_CATALOG } from './itemCatalog.js';

const ITEM_TYPES = Object.freeze({
  RESOURCE: 'resource',
  RARE: 'rare',
  BOSS: 'boss',
  CURRENCY: 'currency',
});

const DEFAULT_ITEM_TYPE = ITEM_TYPES.RESOURCE;
const DEFAULT_SAFE_MAX_STACK = 999;

const DROP_VISUALS_BY_TYPE = Object.freeze({
  [ITEM_TYPES.RESOURCE]: Object.freeze({ spriteId: 'drop-resource', dropTint: '#f5f1de' }),
  [ITEM_TYPES.RARE]: Object.freeze({ spriteId: 'drop-rare', dropTint: '#ffe07d' }),
  [ITEM_TYPES.BOSS]: Object.freeze({ spriteId: 'drop-boss', dropTint: '#ffba6a' }),
  [ITEM_TYPES.CURRENCY]: Object.freeze({ spriteId: 'drop-currency', dropTint: '#b2f6ff' }),
});

const DEFAULT_DROP_ANIMATION = Object.freeze({
  bobAmplitude: 0.35,
  bobSpeed: 3.6,
});

function getDefaultDropVisual(type = DEFAULT_ITEM_TYPE) {
  return DROP_VISUALS_BY_TYPE[type] ?? DROP_VISUALS_BY_TYPE[DEFAULT_ITEM_TYPE];
}

function withDropVisualDefaults(item) {
  const visual = getDefaultDropVisual(item?.type);
  return {
    ...item,
    spriteId: item?.spriteId ?? visual.spriteId,
    dropTint: item?.dropTint ?? visual.dropTint,
    dropAnimation: {
      ...DEFAULT_DROP_ANIMATION,
      ...(item?.dropAnimation ?? {}),
    },
  };
}

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
  { id: 'chitin_fragment', name: 'Chitin Fragment', type: ITEM_TYPES.RESOURCE, tier: 1, stackable: true, maxStack: 99, icon: '⌬' },
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
  return item;
}
