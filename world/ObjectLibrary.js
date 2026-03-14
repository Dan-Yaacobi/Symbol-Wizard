const OBJECT_CATEGORY = {
  ENVIRONMENT: 'environment',
  DESTRUCTIBLE: 'destructible',
  INTERACTABLE: 'interactable',
  LANDMARK: 'landmark',
};

function normalizeFootprint(footprint) {
  if (!Array.isArray(footprint) || footprint.length === 0) return [{ x: 0, y: 0 }];
  return footprint
    .map((cell) => {
      if (Array.isArray(cell) && cell.length === 2) return { x: cell[0], y: cell[1] };
      if (cell && Number.isInteger(cell.x) && Number.isInteger(cell.y)) return { x: cell.x, y: cell.y };
      return null;
    })
    .filter(Boolean);
}

function visual(char, fg, bg = null) {
  return { char, fg, bg };
}

function createDefinition(definition) {
  return {
    hp: null,
    drops: [],
    biomeTags: ['forest'],
    blocksMovement: false,
    destructible: false,
    interactable: false,
    footprint: [{ x: 0, y: 0 }],
    variants: [],
    ...definition,
    footprint: normalizeFootprint(definition.footprint),
  };
}

export const objectLibrary = {
  pine_tree_small: createDefinition({
    id: 'pine_tree_small',
    category: OBJECT_CATEGORY.ENVIRONMENT,
    biomeTags: ['forest', 'taiga'],
    footprint: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
    blocksMovement: true,
    variants: [visual('♠', '#2f7d32'), visual('♠', '#3b8f3d'), visual('♠', '#245c28')],
  }),
  pine_tree_large: createDefinition({
    id: 'pine_tree_large',
    category: OBJECT_CATEGORY.ENVIRONMENT,
    biomeTags: ['forest', 'taiga'],
    footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    blocksMovement: true,
    variants: [visual('♣', '#2f7d32'), visual('♣', '#3b8f3d'), visual('♣', '#245c28')],
  }),
  oak_tree: createDefinition({
    id: 'oak_tree',
    category: OBJECT_CATEGORY.ENVIRONMENT,
    biomeTags: ['forest', 'plains'],
    footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    blocksMovement: true,
    variants: [visual('♣', '#447f3a'), visual('♧', '#3c7334'), visual('♣', '#32662d')],
  }),
  dead_tree: createDefinition({
    id: 'dead_tree',
    category: OBJECT_CATEGORY.ENVIRONMENT,
    biomeTags: ['forest', 'wasteland'],
    footprint: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
    blocksMovement: true,
    variants: [visual('†', '#8b7b66'), visual('♰', '#7c6d58'), visual('†', '#9a8a74')],
  }),
  fallen_log: createDefinition({
    id: 'fallen_log',
    category: OBJECT_CATEGORY.ENVIRONMENT,
    biomeTags: ['forest'],
    footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
    blocksMovement: true,
    variants: [visual('═', '#8d6a43'), visual('━', '#7f5e3b'), visual('═', '#9d774c')],
  }),
  mossy_rock: createDefinition({
    id: 'mossy_rock',
    category: OBJECT_CATEGORY.ENVIRONMENT,
    biomeTags: ['forest', 'hills'],
    footprint: [{ x: 0, y: 0 }],
    blocksMovement: true,
    variants: [visual('▲', '#8b9499'), visual('△', '#7f888d'), visual('◬', '#97a2a8')],
  }),
  rock_cluster: createDefinition({
    id: 'rock_cluster',
    category: OBJECT_CATEGORY.ENVIRONMENT,
    biomeTags: ['forest', 'hills'],
    footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    blocksMovement: true,
    variants: [visual('◭', '#8b939b'), visual('▲', '#9ba3ab'), visual('△', '#7d868f')],
  }),
  berry_bush: createDefinition({
    id: 'berry_bush',
    category: OBJECT_CATEGORY.ENVIRONMENT,
    biomeTags: ['forest', 'plains'],
    footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    blocksMovement: false,
    variants: [visual('❀', '#5ea45a'), visual('✿', '#6cb968'), visual('❁', '#4c8f48')],
  }),
  thorn_bush: createDefinition({
    id: 'thorn_bush',
    category: OBJECT_CATEGORY.ENVIRONMENT,
    biomeTags: ['forest', 'wasteland'],
    footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    blocksMovement: true,
    variants: [visual('✹', '#4f7f39'), visual('✷', '#3f6d31'), visual('✸', '#5b8e42')],
  }),
  mushroom_cluster: createDefinition({
    id: 'mushroom_cluster',
    category: OBJECT_CATEGORY.ENVIRONMENT,
    biomeTags: ['forest', 'swamp'],
    footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    blocksMovement: false,
    variants: [visual('♨', '#c8b08a'), visual('☸', '#d2bf9d'), visual('◉', '#b49f7c')],
  }),
  tall_grass_patch: createDefinition({
    id: 'tall_grass_patch',
    category: OBJECT_CATEGORY.ENVIRONMENT,
    biomeTags: ['forest', 'plains'],
    footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    blocksMovement: false,
    variants: [visual('"', '#5f9e4d'), visual('"', '#6cae58'), visual('"', '#4f8f42')],
  }),
  flower_patch_red: createDefinition({
    id: 'flower_patch_red',
    category: OBJECT_CATEGORY.ENVIRONMENT,
    biomeTags: ['forest', 'plains'],
    footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    blocksMovement: false,
    variants: [visual('*', '#cf5f6d'), visual('✶', '#dc6a78'), visual('✷', '#b64f5c')],
  }),
  flower_patch_yellow: createDefinition({
    id: 'flower_patch_yellow',
    category: OBJECT_CATEGORY.ENVIRONMENT,
    biomeTags: ['forest', 'plains'],
    footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    blocksMovement: false,
    variants: [visual('*', '#d5be59'), visual('✶', '#e2cc6a'), visual('✷', '#bfa748')],
  }),

  barrel: createDefinition({
    id: 'barrel', category: OBJECT_CATEGORY.DESTRUCTIBLE, biomeTags: ['forest', 'roadside'],
    footprint: [{ x: 0, y: 0 }], blocksMovement: true, destructible: true, hp: 3,
    drops: [{ type: 'gold', min: 1, max: 5 }],
    variants: [visual('◍', '#b98b56'), visual('◉', '#c49661'), visual('◎', '#ad7d48')],
  }),
  crate: createDefinition({
    id: 'crate', category: OBJECT_CATEGORY.DESTRUCTIBLE, biomeTags: ['forest', 'roadside'],
    footprint: [{ x: 0, y: 0 }], blocksMovement: true, destructible: true, hp: 4,
    drops: [{ type: 'gold', min: 2, max: 6 }],
    variants: [visual('▧', '#c59663'), visual('▣', '#b8864f'), visual('▤', '#d1a06c')],
  }),
  vase: createDefinition({
    id: 'vase', category: OBJECT_CATEGORY.DESTRUCTIBLE, biomeTags: ['forest', 'ruins'],
    footprint: [{ x: 0, y: 0 }], blocksMovement: true, destructible: true, hp: 2,
    drops: [{ type: 'mana', min: 1, max: 2 }],
    variants: [visual('◠', '#bca4d8'), visual('◡', '#c7b2e2'), visual('◜', '#a58cc4')],
  }),
  wooden_box: createDefinition({
    id: 'wooden_box', category: OBJECT_CATEGORY.DESTRUCTIBLE, biomeTags: ['forest', 'camp'],
    footprint: [{ x: 0, y: 0 }], blocksMovement: true, destructible: true, hp: 3,
    drops: [{ type: 'gold', min: 1, max: 4 }],
    variants: [visual('▥', '#a97a45'), visual('▦', '#966b3d'), visual('▩', '#b58654')],
  }),
  supply_bag: createDefinition({
    id: 'supply_bag', category: OBJECT_CATEGORY.DESTRUCTIBLE, biomeTags: ['forest', 'camp'],
    footprint: [{ x: 0, y: 0 }], blocksMovement: false, destructible: true, hp: 2,
    drops: [{ type: 'potion', min: 1, max: 1 }],
    variants: [visual('◒', '#8c6d4a'), visual('◓', '#9e7e58'), visual('◐', '#7a5d3e')],
  }),

  campfire: createDefinition({
    id: 'campfire', category: OBJECT_CATEGORY.INTERACTABLE, biomeTags: ['forest', 'camp'],
    footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }], blocksMovement: false, interactable: true,
    variants: [visual('♨', '#e0863f'), visual('☼', '#f09a4b'), visual('✶', '#d87332')],
  }),
  shrine: createDefinition({
    id: 'shrine', category: OBJECT_CATEGORY.INTERACTABLE, biomeTags: ['forest', 'ruins'],
    footprint: [{ x: 0, y: 0 }, { x: 0, y: 1 }], blocksMovement: true, interactable: true,
    variants: [visual('⊙', '#d7d0bf'), visual('◌', '#c7c1b1'), visual('◉', '#beb6a5')],
  }),
  signpost: createDefinition({
    id: 'signpost', category: OBJECT_CATEGORY.INTERACTABLE, biomeTags: ['forest', 'roadside'],
    footprint: [{ x: 0, y: 0 }], blocksMovement: true, interactable: true,
    variants: [visual('†', '#b1864d'), visual('‡', '#9f7946'), visual('┼', '#c09358')],
  }),
  well: createDefinition({
    id: 'well', category: OBJECT_CATEGORY.INTERACTABLE, biomeTags: ['forest', 'village'],
    footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    blocksMovement: true, interactable: true,
    variants: [visual('◍', '#8ea3ba'), visual('◌', '#7d93ab'), visual('◎', '#9eb2c7')],
  }),

  ancient_tree: createDefinition({
    id: 'ancient_tree', category: OBJECT_CATEGORY.LANDMARK, biomeTags: ['forest'],
    footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
    blocksMovement: true,
    variants: [visual('♣', '#355f2a'), visual('♧', '#2c5424'), visual('♣', '#3f6c31')],
  }),
  ruined_statue: createDefinition({
    id: 'ruined_statue', category: OBJECT_CATEGORY.LANDMARK, biomeTags: ['forest', 'ruins'],
    footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    blocksMovement: true,
    variants: [visual('☗', '#a8a7a1'), visual('♜', '#989792'), visual('♖', '#b6b5af')],
  }),
  stone_circle: createDefinition({
    id: 'stone_circle', category: OBJECT_CATEGORY.LANDMARK, biomeTags: ['forest', 'hills'],
    footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 2, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
    blocksMovement: true,
    variants: [visual('◍', '#8b919a'), visual('◌', '#7c838d'), visual('◎', '#9ba1ab')],
  }),
  abandoned_cart: createDefinition({
    id: 'abandoned_cart', category: OBJECT_CATEGORY.LANDMARK, biomeTags: ['forest', 'roadside'],
    footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
    blocksMovement: true,
    variants: [visual('▤', '#8a6239'), visual('▥', '#9a7146'), visual('▦', '#7b5632')],
  }),
};

function maxFootprintDistance(footprint) {
  if (!Array.isArray(footprint) || footprint.length === 0) return 0;
  return footprint.reduce((max, cell) => Math.max(max, Math.hypot(cell.x, cell.y)), 0);
}

function interactionTypeFor(definition) {
  if (!definition.interactable) return 'none';
  if (definition.id === 'campfire') return 'rest';
  if (definition.id === 'shrine') return 'activate';
  if (definition.id === 'signpost') return 'message';
  if (definition.id === 'well') return 'heal';
  return 'activate';
}

export function getObjectDefinition(id) {
  return objectLibrary[id] ?? null;
}

export function spawnObject(type, position, overrides = {}, rng = Math.random) {
  const definition = getObjectDefinition(type);
  if (!definition) return null;

  const footprintInput = overrides.footprint ?? definition.footprint;
  const footprint = normalizeFootprint(footprintInput);
  const radius = maxFootprintDistance(footprint) + 0.9;
  const variants = definition.variants ?? [];
  const selectedVariant = variants.length > 0 ? variants[Math.floor(rng() * variants.length)] : null;

  return {
    id: overrides.id ?? `${type}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    name: definition.id,
    category: definition.category,
    biomeTags: [...definition.biomeTags],
    x: position.x,
    y: position.y,
    position: { x: position.x, y: position.y },
    footprint: footprint.map((cell) => [cell.x, cell.y]),
    variants,
    variant: selectedVariant,
    tileVariants: variants,
    interactionType: overrides.interactionType ?? interactionTypeFor(definition),
    collision: Boolean(definition.blocksMovement),
    walkable: !definition.blocksMovement,
    interactable: Boolean(definition.interactable),
    attackable: Boolean(definition.destructible),
    destructible: Boolean(definition.destructible),
    health: Number.isFinite(definition.hp) ? definition.hp : null,
    maxHealth: Number.isFinite(definition.hp) ? definition.hp : null,
    lootTable: definition.drops ?? [],
    state: { ...(overrides.state ?? {}) },
    destroyed: false,
    radius,
  };
}


export { OBJECT_CATEGORY };
