const OBJECT_CATEGORY = {
  DECORATIVE: 'decorative',
  INTERACTABLE: 'interactable',
  DESTRUCTIBLE: 'destructible',
  SOLID_TERRAIN: 'solid-terrain',
};

function forestPalette(char, fg, bg, walkable = false) {
  return { char, fg, bg, walkable };
}

export const objectLibrary = {
  oak_tree: {
    id: 'oak_tree', name: 'Oak Tree', category: OBJECT_CATEGORY.SOLID_TERRAIN,
    footprint: [[0, 0]], interactionType: 'none', collision: true,
    health: null, destructible: false, lootTable: [],
    tileVariants: [
      forestPalette('♣', '#3f8f4d', '#09150d', false),
      forestPalette('♧', '#4d9b59', '#0a1a11', false),
      forestPalette('♤', '#2f7f44', '#08120a', false),
    ],
  },
  pine_tree: {
    id: 'pine_tree', name: 'Pine Tree', category: OBJECT_CATEGORY.SOLID_TERRAIN,
    footprint: [[0, 0], [0, 1]], interactionType: 'none', collision: true,
    health: null, destructible: false, lootTable: [],
    tileVariants: [
      forestPalette('♠', '#2f7a3f', '#071109', false),
      forestPalette('♤', '#2a6c38', '#060f08', false),
      forestPalette('♣', '#3a8c48', '#08140a', false),
    ],
  },
  bush: {
    id: 'bush', name: 'Bush', category: OBJECT_CATEGORY.DECORATIVE,
    footprint: [[0, 0]], interactionType: 'none', collision: false,
    health: null, destructible: false, lootTable: [],
    tileVariants: [
      forestPalette('✿', '#67b36d', '#133022', true),
      forestPalette('❀', '#6dbf73', '#163626', true),
      forestPalette('❁', '#55a962', '#112a1d', true),
    ],
  },
  wildflowers: {
    id: 'wildflowers', name: 'Wildflowers', category: OBJECT_CATEGORY.DECORATIVE,
    footprint: [[0, 0]], interactionType: 'none', collision: false,
    health: null, destructible: false, lootTable: [],
    tileVariants: [
      forestPalette('*', '#d98da8', '#1a3b28', true),
      forestPalette('✶', '#e4c072', '#1c402b', true),
      forestPalette('✷', '#8cb7e8', '#173a27', true),
    ],
  },
  stone_cluster: {
    id: 'stone_cluster', name: 'Stone Cluster', category: OBJECT_CATEGORY.SOLID_TERRAIN,
    footprint: [[0, 0], [1, 0]], interactionType: 'none', collision: true,
    health: null, destructible: false, lootTable: [],
    tileVariants: [
      { char: '▲', fg: '#8d949f', bg: '#252c33', walkable: false },
      { char: '∆', fg: '#9aa1aa', bg: '#2a3138', walkable: false },
      { char: '◭', fg: '#7f8893', bg: '#222830', walkable: false },
    ],
  },
  barrel: {
    id: 'barrel', name: 'Barrel', category: OBJECT_CATEGORY.DESTRUCTIBLE,
    footprint: [[0, 0]], interactionType: 'none', collision: true,
    health: 2, destructible: true, lootTable: [{ type: 'gold', min: 1, max: 4 }],
    tileVariants: [
      { char: '◍', fg: '#b98b56', bg: '#3f2d1a', walkable: false },
      { char: '◉', fg: '#c49661', bg: '#47311d', walkable: false },
    ],
  },
  crate: {
    id: 'crate', name: 'Crate', category: OBJECT_CATEGORY.DESTRUCTIBLE,
    footprint: [[0, 0]], interactionType: 'none', collision: true,
    health: 3, destructible: true, lootTable: [{ type: 'gold', min: 1, max: 5 }],
    tileVariants: [
      { char: '▧', fg: '#c59663', bg: '#4a3421', walkable: false },
      { char: '▣', fg: '#b8864f', bg: '#402b19', walkable: false },
    ],
  },
  shrine: {
    id: 'shrine', name: 'Shrine', category: OBJECT_CATEGORY.INTERACTABLE,
    footprint: [[0, 0]], interactionType: 'activate', collision: true,
    health: null, destructible: false, lootTable: [],
    tileVariants: [
      { char: '⊙', fg: '#d7d0bf', bg: '#303030', walkable: false },
      { char: '◌', fg: '#c7c1b1', bg: '#2a2a2a', walkable: false },
    ],
  },
  chest: {
    id: 'chest', name: 'Chest', category: OBJECT_CATEGORY.INTERACTABLE,
    footprint: [[0, 0]], interactionType: 'open', collision: true,
    health: null, destructible: false, lootTable: [{ type: 'gold', min: 2, max: 10 }],
    tileVariants: [
      { char: '▣', fg: '#d8b16f', bg: '#4d3823', walkable: false },
      { char: '▤', fg: '#caa161', bg: '#442f1c', walkable: false },
    ],
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
    tileVariants: definition.tileVariants ?? [],
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
