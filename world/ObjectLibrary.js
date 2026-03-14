const OBJECT_CATEGORY = {
  DECORATIVE: 'decorative',
  INTERACTABLE: 'interactable',
  DESTRUCTIBLE: 'destructible',
  SOLID_TERRAIN: 'solid-terrain',
};

export const objectLibrary = {
  flower_patch: {
    id: 'flower_patch', name: 'Flower Patch', category: OBJECT_CATEGORY.DECORATIVE,
    footprint: [[0, 0]], tilePalette: ['"'], interactionType: 'none', collision: false,
    health: null, destructible: false, lootTable: [],
  },
  small_stones: {
    id: 'small_stones', name: 'Small Stones', category: OBJECT_CATEGORY.DECORATIVE,
    footprint: [[0, 0]], tilePalette: ['·'], interactionType: 'none', collision: false,
    health: null, destructible: false, lootTable: [],
  },
  shrine: {
    id: 'shrine', name: 'Shrine', category: OBJECT_CATEGORY.INTERACTABLE,
    footprint: [[0, 0]], tilePalette: ['⊙'], interactionType: 'activate', collision: true,
    health: null, destructible: false, lootTable: [],
  },
  chest: {
    id: 'chest', name: 'Chest', category: OBJECT_CATEGORY.INTERACTABLE,
    footprint: [[0, 0]], tilePalette: ['▣'], interactionType: 'open', collision: true,
    health: null, destructible: false, lootTable: [{ type: 'gold', min: 2, max: 10 }],
  },
  barrel: {
    id: 'barrel', name: 'Barrel', category: OBJECT_CATEGORY.DESTRUCTIBLE,
    footprint: [[0, 0]], tilePalette: ['◍'], interactionType: 'none', collision: true,
    health: 2, destructible: true, lootTable: [{ type: 'gold', min: 1, max: 4 }],
  },
  crate: {
    id: 'crate', name: 'Crate', category: OBJECT_CATEGORY.DESTRUCTIBLE,
    footprint: [[0, 0]], tilePalette: ['▧'], interactionType: 'none', collision: true,
    health: 3, destructible: true, lootTable: [{ type: 'gold', min: 1, max: 5 }],
  },
  forest_grove: {
    id: 'forest_grove', name: 'Forest Grove', category: OBJECT_CATEGORY.DESTRUCTIBLE,
    footprint: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]], tilePalette: ['♣', '♠', '¶'],
    interactionType: 'none', collision: true, health: 10, destructible: true,
    lootTable: [{ type: 'minor-item', min: 1, max: 2 }],
  },
  rock_formation: {
    id: 'rock_formation', name: 'Rock Formation', category: OBJECT_CATEGORY.SOLID_TERRAIN,
    footprint: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]], tilePalette: ['▲', '∆'],
    interactionType: 'none', collision: true, health: null, destructible: false, lootTable: [],
  },
  ruins: {
    id: 'ruins', name: 'Ruins', category: OBJECT_CATEGORY.SOLID_TERRAIN,
    footprint: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]], tilePalette: ['▓', '▒', '║'],
    interactionType: 'none', collision: true, health: null, destructible: false, lootTable: [],
  },
  small_pond: {
    id: 'small_pond', name: 'Small Pond', category: OBJECT_CATEGORY.SOLID_TERRAIN,
    footprint: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]], tilePalette: ['~', '≈'],
    interactionType: 'none', collision: true, health: null, destructible: false, lootTable: [],
  },
};

function maxFootprintDistance(footprint) {
  if (!Array.isArray(footprint) || footprint.length === 0) return 0;
  return footprint.reduce((max, [x, y]) => Math.max(max, Math.hypot(x, y)), 0);
}

export function getObjectDefinition(id) {
  return objectLibrary[id] ?? null;
}

export function spawnObject(type, position, overrides = {}) {
  const definition = getObjectDefinition(type);
  if (!definition) return null;
  const footprint = overrides.footprint ?? definition.footprint ?? [[0, 0]];
  const radius = maxFootprintDistance(footprint) + 0.9;
  return {
    id: overrides.id ?? `${type}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    name: definition.name,
    category: definition.category,
    x: position.x,
    y: position.y,
    position: { x: position.x, y: position.y },
    footprint,
    tilePalette: definition.tilePalette,
    interactionType: definition.interactionType,
    collision: Boolean(definition.collision),
    walkable: !definition.collision,
    interactable: definition.category === OBJECT_CATEGORY.INTERACTABLE,
    attackable: definition.category === OBJECT_CATEGORY.DESTRUCTIBLE,
    destructible: Boolean(definition.destructible),
    health: Number.isFinite(definition.health) ? definition.health : null,
    maxHealth: Number.isFinite(definition.health) ? definition.health : null,
    lootTable: definition.lootTable ?? [],
    state: {},
    destroyed: false,
    radius,
    ...overrides,
  };
}

export { OBJECT_CATEGORY };
