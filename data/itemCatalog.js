export const ITEM_CATALOG = Object.freeze({
  essence: Object.freeze({ id: 'essence', name: 'Essence' }),
  stone: Object.freeze({ id: 'stone', name: 'Stone' }),
  frost_core: Object.freeze({ id: 'frost_core', name: 'Frost Core' }),
  fire_core: Object.freeze({ id: 'fire_core', name: 'Fire Core' }),
  ember_dust: Object.freeze({ id: 'ember_dust', name: 'Ember Dust' }),
  lightning_core: Object.freeze({ id: 'lightning_core', name: 'Lightning Core' }),
  storm_shard: Object.freeze({ id: 'storm_shard', name: 'Storm Shard' }),
  poison_gland: Object.freeze({ id: 'poison_gland', name: 'Poison Gland' }),
  moss: Object.freeze({ id: 'moss', name: 'Moss' }),
  arcane_shard: Object.freeze({ id: 'arcane_shard', name: 'Arcane Shard' }),
  crystal_dust: Object.freeze({ id: 'crystal_dust', name: 'Crystal Dust' }),
});

export function getItemName(itemId) {
  return ITEM_CATALOG[itemId]?.name ?? String(itemId)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
