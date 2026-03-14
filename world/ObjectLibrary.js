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

function normalizeTiles(tiles) {
  if (!Array.isArray(tiles)) return [];
  return tiles
    .map((tile) => {
      if (!tile) return null;
      const x = Number(tile.x);
      const y = Number(tile.y);
      if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
      const char = typeof tile.char === 'string' && tile.char.length > 0 ? tile.char[0] : null;
      if (!char) return null;
      return {
        x,
        y,
        char,
        fg: tile.fg ?? '#d8d2c4',
        bg: tile.bg ?? null,
      };
    })
    .filter(Boolean);
}

function visual(char, fg, bg = null) {
  return { char, fg, bg };
}

export function parseBlueprint(blueprint, glyphPalette = {}) {
  if (!Array.isArray(blueprint) || blueprint.length === 0) {
    return {
      footprint: [{ x: 0, y: 0 }],
      tileVariants: [{ x: 0, y: 0, char: '•', fg: '#d8d2c4', bg: null }],
      centerOffset: { x: 0, y: 0 },
    };
  }

  const rows = blueprint.map((row) => (typeof row === 'string' ? row : String(row ?? '')));
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const centerOffset = { x: Math.floor(width / 2), y: Math.floor(rows.length / 2) };
  const footprint = [];
  const tileVariants = [];

  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y].padEnd(width, ' ');
    for (let x = 0; x < width; x += 1) {
      const char = row[x];
      if (char === ' ') continue;
      const rx = x - centerOffset.x;
      const ry = y - centerOffset.y;
      const paletteEntry = glyphPalette[char] ?? {};
      footprint.push({ x: rx, y: ry });
      tileVariants.push({
        x: rx,
        y: ry,
        char,
        fg: paletteEntry.fg ?? '#d8d2c4',
        bg: paletteEntry.bg ?? null,
      });
    }
  }

  return {
    footprint: footprint.length > 0 ? footprint : [{ x: 0, y: 0 }],
    tileVariants: tileVariants.length > 0 ? tileVariants : [{ x: 0, y: 0, char: '•', fg: '#d8d2c4', bg: null }],
    centerOffset,
  };
}

function createDefinition(definition) {
  const parsed = definition.blueprint
    ? parseBlueprint(definition.blueprint, definition.glyphPalette)
    : null;

  const footprint = parsed
    ? parsed.footprint
    : normalizeFootprint(definition.footprint);

  const blueprintTiles = parsed
    ? parsed.tileVariants
    : [];

  const explicitTiles = normalizeTiles(definition.tiles);
  const variants = Array.isArray(definition.variants) ? definition.variants : [];

  return {
    hp: null,
    drops: [],
    biomeTags: ['forest'],
    blocksMovement: false,
    destructible: false,
    interactable: false,
    rotations: false,
    footprint: [{ x: 0, y: 0 }],
    variants: [],
    tiles: [],
    spawnWeight: 1,
    minClusterSize: 1,
    maxClusterSize: 1,
    allowOverlap: false,
    biomeRarity: 'common',
    ...definition,
    centerOffset: parsed?.centerOffset ?? { x: 0, y: 0 },
    footprint,
    variants,
    tiles: explicitTiles.length > 0 ? explicitTiles : blueprintTiles,
  };
}

function rotatePoint(x, y, quarterTurns) {
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (turns === 1) return { x: -y, y: x };
  if (turns === 2) return { x: -x, y: -y };
  if (turns === 3) return { x: y, y: -x };
  return { x, y };
}

function rotateFootprint(footprint, quarterTurns) {
  return footprint.map((cell) => rotatePoint(cell.x, cell.y, quarterTurns));
}

function rotateTiles(tiles, quarterTurns) {
  return tiles.map((tile) => {
    const rotated = rotatePoint(tile.x, tile.y, quarterTurns);
    return { ...tile, x: rotated.x, y: rotated.y };
  });
}

export const objectLibrary = {
  pine_tree_large: createDefinition({
    id: 'pine_tree_large', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest', 'taiga'], blocksMovement: true,
    rotations: true, spawnWeight: 1.35, minClusterSize: 1, maxClusterSize: 3, biomeRarity: 'common',
    blueprint: ['  ▲  ', ' ▲▲▲ ', '▲♠♠▲', '  ║  ', '  ║  '],
    glyphPalette: { '▲': { fg: '#2f7d32' }, '♠': { fg: '#256429' }, '║': { fg: '#6f5230' } },
  }),
  fallen_tree: createDefinition({
    id: 'fallen_tree', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest'], blocksMovement: true,
    rotations: true, spawnWeight: 0.85, minClusterSize: 1, maxClusterSize: 2, biomeRarity: 'common',
    blueprint: ['        ', '═══════✶', '▒▒▒▒▒▒▒ ', '        '],
    glyphPalette: { '═': { fg: '#7f5e3b' }, '▒': { fg: '#5f472d' }, '✶': { fg: '#9a7b4c' } },
  }),
  ancient_tree: createDefinition({
    id: 'ancient_tree', category: OBJECT_CATEGORY.LANDMARK, biomeTags: ['forest'], blocksMovement: true,
    spawnWeight: 0.25, minClusterSize: 1, maxClusterSize: 1, biomeRarity: 'rare',
    blueprint: ['   ♣♣♣   ', ' ♣♣♣♣♣♣♣ ', '♣♣♣♧♣♧♣♣♣', ' ♣♣♣♣♣♣♣ ', '   ║▓║   ', '   ║▓║   ', '  ▓▓▓▓▓  '],
    glyphPalette: { '♣': { fg: '#305f2a' }, '♧': { fg: '#3d6f35' }, '║': { fg: '#6b4f2a' }, '▓': { fg: '#5a3f25' } },
  }),
  tree_cluster: createDefinition({
    id: 'tree_cluster', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest'], blocksMovement: true,
    rotations: true, spawnWeight: 1.2, minClusterSize: 1, maxClusterSize: 4, biomeRarity: 'common',
    blueprint: [' ♠ ♣ ', '♣♣♠♣♣', ' ♣║♠ ', '  ║  ', ' ♧ ║ '],
    glyphPalette: { '♠': { fg: '#2d7f33' }, '♣': { fg: '#3b8f3d' }, '♧': { fg: '#2a6f31' }, '║': { fg: '#6b4f2a' } },
  }),
  stump: createDefinition({
    id: 'stump', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest'], blocksMovement: true,
    rotations: true, spawnWeight: 0.9, minClusterSize: 1, maxClusterSize: 3,
    blueprint: [' ▒▒ ', '▒◎▒▒', ' ▒▒ '],
    glyphPalette: { '▒': { fg: '#6f4e2f' }, '◎': { fg: '#a07b50' } },
  }),
  root_cluster: createDefinition({
    id: 'root_cluster', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest'], blocksMovement: false,
    rotations: true, spawnWeight: 0.95, minClusterSize: 2, maxClusterSize: 5,
    blueprint: ['  ║  ', '═╬═╬═', '  ╬  ', '═╬═  '],
    glyphPalette: { '║': { fg: '#6a4a2c' }, '═': { fg: '#6a4a2c' }, '╬': { fg: '#7a5734' } },
  }),
  cedar_grove: createDefinition({
    id: 'cedar_grove', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest', 'taiga'], blocksMovement: true,
    rotations: true, spawnWeight: 0.8, minClusterSize: 1, maxClusterSize: 2, biomeRarity: 'uncommon',
    blueprint: [' ▲ ▲ ', '▲♠▲♠▲', ' ║ ║ ', ' ▲▲▲ ', '  ║  '],
    glyphPalette: { '▲': { fg: '#3e7f42' }, '♠': { fg: '#2f6b33' }, '║': { fg: '#664b2d' } },
  }),
  bent_pine: createDefinition({
    id: 'bent_pine', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest', 'taiga'], blocksMovement: true,
    rotations: true, spawnWeight: 0.75, minClusterSize: 1, maxClusterSize: 2,
    blueprint: ['   ▲▲ ', '  ▲♠▲', ' ▲▲▲ ', '  ║  ', ' ║   '],
    glyphPalette: { '▲': { fg: '#2f7d32' }, '♠': { fg: '#245c28' }, '║': { fg: '#6d502f' } },
  }),
  hollow_trunk: createDefinition({
    id: 'hollow_trunk', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest'], blocksMovement: true,
    rotations: true, spawnWeight: 0.55, minClusterSize: 1, maxClusterSize: 2, biomeRarity: 'uncommon',
    blueprint: [' ▓▓▓ ', '▓○▒▓', '▓▒▒▓', ' ▓▓▓ '],
    glyphPalette: { '▓': { fg: '#65492b' }, '▒': { fg: '#5a3f25' }, '○': { fg: '#2d2014' } },
  }),
  sapling_ring: createDefinition({
    id: 'sapling_ring', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest', 'plains'], blocksMovement: false,
    spawnWeight: 0.65, minClusterSize: 1, maxClusterSize: 3, biomeRarity: 'uncommon',
    blueprint: [' ♠♠♠ ', '♠   ♠', '♠   ♠', ' ♠♠♠ '],
    glyphPalette: { '♠': { fg: '#4b9950' } },
  }),

  mushroom_ring: createDefinition({
    id: 'mushroom_ring', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest', 'swamp'], blocksMovement: false,
    spawnWeight: 0.95, minClusterSize: 1, maxClusterSize: 4,
    blueprint: [' ◎◎◎ ', '◎   ◎', '◎ ✸ ◎', '◎   ◎', ' ◎◎◎ '],
    glyphPalette: { '◎': { fg: '#c8b08a' }, '✸': { fg: '#8e6f49' } },
  }),
  berry_patch: createDefinition({
    id: 'berry_patch', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest', 'plains'], blocksMovement: false,
    rotations: true, spawnWeight: 1.1, minClusterSize: 2, maxClusterSize: 6,
    blueprint: [' ✶✶  ', '✶♣✶✶ ', ' ✶✶♣ ', '  ✶✶ '],
    glyphPalette: { '✶': { fg: '#b24767' }, '♣': { fg: '#4e8c46' } },
  }),
  grass_field: createDefinition({
    id: 'grass_field', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest', 'plains'], blocksMovement: false,
    spawnWeight: 1.3, minClusterSize: 3, maxClusterSize: 7,
    blueprint: ['▴▴▴▴▴', '▴△▴△▴', '▴▴▴▴▴', '△▴△▴△', '▴▴▴▴▴'],
    glyphPalette: { '▴': { fg: '#5f9e4d' }, '△': { fg: '#73b85e' } },
  }),
  flower_field: createDefinition({
    id: 'flower_field', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest', 'plains'], blocksMovement: false,
    spawnWeight: 1.15, minClusterSize: 2, maxClusterSize: 6,
    blueprint: ['✶✦✶✦✶', '✦♣✦♣✦', '✶✦✸✦✶', '✦♣✦♣✦', '✶✦✶✦✶'],
    glyphPalette: { '✶': { fg: '#d58cc2' }, '✦': { fg: '#e7d374' }, '✸': { fg: '#cf5f6d' }, '♣': { fg: '#4d8b46' } },
  }),
  mossy_boulder: createDefinition({
    id: 'mossy_boulder', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest', 'hills'], blocksMovement: true,
    rotations: true, spawnWeight: 0.9, minClusterSize: 1, maxClusterSize: 3,
    blueprint: [' ▓█▓ ', '▓███▓', '▓█♣█▓', ' ▓█▓ '],
    glyphPalette: { '▓': { fg: '#7d868f' }, '█': { fg: '#6c747d' }, '♣': { fg: '#497a45' } },
  }),
  rock_formation: createDefinition({
    id: 'rock_formation', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest', 'hills'], blocksMovement: true,
    rotations: true, spawnWeight: 0.82, minClusterSize: 1, maxClusterSize: 2,
    blueprint: ['  ▲  ', ' ▲█▲ ', '▲███▲', '  ▲  '],
    glyphPalette: { '▲': { fg: '#8e969e' }, '█': { fg: '#7b838b' } },
  }),
  fern_patch: createDefinition({
    id: 'fern_patch', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest', 'swamp'], blocksMovement: false,
    rotations: true, spawnWeight: 1.0, minClusterSize: 2, maxClusterSize: 5,
    blueprint: [' ♧♣  ', '♣♧♣♧ ', ' ♧♣♧ '],
    glyphPalette: { '♧': { fg: '#4a914b' }, '♣': { fg: '#3b7f3f' } },
  }),
  reed_bed: createDefinition({
    id: 'reed_bed', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['swamp', 'river'], blocksMovement: false,
    spawnWeight: 0.7, minClusterSize: 2, maxClusterSize: 5, biomeRarity: 'uncommon',
    blueprint: ['║║║║║', '║▴║▴║', '║║║║║'],
    glyphPalette: { '║': { fg: '#7f9854' }, '▴': { fg: '#95ad63' } },
  }),
  crystal_lichen: createDefinition({
    id: 'crystal_lichen', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest', 'hills'], blocksMovement: false,
    spawnWeight: 0.4, minClusterSize: 1, maxClusterSize: 3, biomeRarity: 'rare',
    blueprint: [' ✦✦ ', '✦♣✸✦', ' ✦✦ '],
    glyphPalette: { '✦': { fg: '#9fd3de' }, '✸': { fg: '#bcd7ef' }, '♣': { fg: '#5d9461' } },
  }),
  wildflower_arc: createDefinition({
    id: 'wildflower_arc', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest', 'plains'], blocksMovement: false,
    rotations: true, spawnWeight: 0.75, minClusterSize: 1, maxClusterSize: 4,
    blueprint: ['✶✦✶✦ ', ' ♣✶✦✶', '  ♣✶✦'],
    glyphPalette: { '✶': { fg: '#d27ab3' }, '✦': { fg: '#f3dd6e' }, '♣': { fg: '#4a8a45' } },
  }),

  broken_statue: createDefinition({
    id: 'broken_statue', category: OBJECT_CATEGORY.LANDMARK, biomeTags: ['forest', 'ruins'], blocksMovement: true,
    rotations: true, spawnWeight: 0.35, minClusterSize: 1, maxClusterSize: 2, biomeRarity: 'rare',
    blueprint: ['  †  ', ' ▓█▓ ', '  █  ', ' ▒▓▒ '],
    glyphPalette: { '†': { fg: '#b9b4a8' }, '▓': { fg: '#9a978e' }, '█': { fg: '#87847d' }, '▒': { fg: '#7b7872' } },
  }),
  altar_ruins: createDefinition({
    id: 'altar_ruins', category: OBJECT_CATEGORY.LANDMARK, biomeTags: ['forest', 'ruins'], blocksMovement: true,
    spawnWeight: 0.3, minClusterSize: 1, maxClusterSize: 1, biomeRarity: 'rare',
    blueprint: [' ▓▓▓ ', '▓═○═▓', '▓═◉═▓', '▓═○═▓', ' ▓▓▓ '],
    glyphPalette: { '▓': { fg: '#8f8a80' }, '═': { fg: '#7d786f' }, '○': { fg: '#b9b39f' }, '◉': { fg: '#d6cfb8' } },
  }),
  collapsed_wall: createDefinition({
    id: 'collapsed_wall', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest', 'ruins'], blocksMovement: true,
    rotations: true, spawnWeight: 0.7, minClusterSize: 1, maxClusterSize: 3,
    blueprint: ['█▓█▓█▓', ' ▒ ▒  ', '▓█▓█▓ '],
    glyphPalette: { '█': { fg: '#8c8880' }, '▓': { fg: '#7e7a72' }, '▒': { fg: '#6f6b64' } },
  }),
  ruined_arch: createDefinition({
    id: 'ruined_arch', category: OBJECT_CATEGORY.LANDMARK, biomeTags: ['forest', 'ruins'], blocksMovement: true,
    rotations: true, spawnWeight: 0.42, minClusterSize: 1, maxClusterSize: 2,
    blueprint: ['█   █', '█   █', '█═══█', '█   █'],
    glyphPalette: { '█': { fg: '#8f8b84' }, '═': { fg: '#78746d' } },
  }),
  stone_pillar: createDefinition({
    id: 'stone_pillar', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest', 'ruins'], blocksMovement: true,
    spawnWeight: 0.65, minClusterSize: 1, maxClusterSize: 4,
    blueprint: [' ▓ ', ' █ ', ' █ ', ' ▓ '],
    glyphPalette: { '▓': { fg: '#9b968e' }, '█': { fg: '#848078' } },
  }),
  grave: createDefinition({
    id: 'grave', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest', 'ruins'], blocksMovement: true,
    spawnWeight: 0.45, minClusterSize: 1, maxClusterSize: 4,
    blueprint: [' † ', '▓▓▓', '▒▒▒'],
    glyphPalette: { '†': { fg: '#b7b19e' }, '▓': { fg: '#8d897f' }, '▒': { fg: '#726d64' } },
  }),
  cracked_obelisk: createDefinition({
    id: 'cracked_obelisk', category: OBJECT_CATEGORY.LANDMARK, biomeTags: ['forest', 'ruins'], blocksMovement: true,
    rotations: true, spawnWeight: 0.25, minClusterSize: 1, maxClusterSize: 1, biomeRarity: 'rare',
    blueprint: ['  Δ  ', ' ▓█▓ ', '  █  ', '  █  ', ' ▒▒▒ '],
    glyphPalette: { 'Δ': { fg: '#d2cebb' }, '▓': { fg: '#928d83' }, '█': { fg: '#7d786f' }, '▒': { fg: '#6c675f' } },
  }),
  shattered_gate: createDefinition({
    id: 'shattered_gate', category: OBJECT_CATEGORY.LANDMARK, biomeTags: ['forest', 'ruins'], blocksMovement: true,
    rotations: true, spawnWeight: 0.22, minClusterSize: 1, maxClusterSize: 1, biomeRarity: 'rare',
    blueprint: ['█ ═ ═ █', '█     █', '█ ▒ ▒ █', '█     █'],
    glyphPalette: { '█': { fg: '#8e8a83' }, '═': { fg: '#746f68' }, '▒': { fg: '#605b54' } },
  }),

  campfire_site: createDefinition({
    id: 'campfire_site', category: OBJECT_CATEGORY.INTERACTABLE, biomeTags: ['forest', 'camp'], interactable: true,
    blocksMovement: false, rotations: true, spawnWeight: 0.85, minClusterSize: 1, maxClusterSize: 3,
    blueprint: [' ▒▒▒ ', '▒✶✸▒', '▒╬╬▒', ' ▒▒▒ '],
    glyphPalette: { '▒': { fg: '#6a5034' }, '✶': { fg: '#f09a4b' }, '✸': { fg: '#d87332' }, '╬': { fg: '#7f5d3c' } },
  }),
  abandoned_cart: createDefinition({
    id: 'abandoned_cart', category: OBJECT_CATEGORY.LANDMARK, biomeTags: ['forest', 'roadside', 'camp'], blocksMovement: true,
    rotations: true, spawnWeight: 0.36, minClusterSize: 1, maxClusterSize: 2,
    blueprint: ['○═▒▒═○', '█▒▒▒▒█', ' ○   ○ '],
    glyphPalette: { '○': { fg: '#8a8f97' }, '═': { fg: '#7f5d3c' }, '▒': { fg: '#926b42' }, '█': { fg: '#6f4f32' } },
  }),
  hunter_camp: createDefinition({
    id: 'hunter_camp', category: OBJECT_CATEGORY.INTERACTABLE, biomeTags: ['forest', 'camp'], interactable: true,
    blocksMovement: true, rotations: true, spawnWeight: 0.52, minClusterSize: 1, maxClusterSize: 2,
    blueprint: ['▲▲▲  ', '▲▒▲ ║', '▲▲▲ ║', ' ○○  '],
    glyphPalette: { '▲': { fg: '#8b6a43' }, '▒': { fg: '#6f5230' }, '║': { fg: '#5d452a' }, '○': { fg: '#8f9399' } },
  }),
  tent: createDefinition({
    id: 'tent', category: OBJECT_CATEGORY.INTERACTABLE, biomeTags: ['forest', 'camp'], interactable: true,
    blocksMovement: true, rotations: true, spawnWeight: 0.8, minClusterSize: 1, maxClusterSize: 3,
    blueprint: ['  ▲  ', ' ▲▒▲ ', '▲▒▒▒▲', ' ║ ║ '],
    glyphPalette: { '▲': { fg: '#a67b49' }, '▒': { fg: '#805c36' }, '║': { fg: '#6b4d2e' } },
  }),
  supply_pile: createDefinition({
    id: 'supply_pile', category: OBJECT_CATEGORY.DESTRUCTIBLE, biomeTags: ['forest', 'camp'], destructible: true,
    hp: 5, drops: [{ type: 'gold', min: 2, max: 8 }], blocksMovement: true,
    spawnWeight: 0.58, minClusterSize: 1, maxClusterSize: 4,
    blueprint: ['▦▥▦', '▩▒▩', '▦▥▦'],
    glyphPalette: { '▦': { fg: '#a67946' }, '▥': { fg: '#8f643c' }, '▩': { fg: '#7b5534' }, '▒': { fg: '#6c4b2d' } },
  }),
  broken_wagon: createDefinition({
    id: 'broken_wagon', category: OBJECT_CATEGORY.ENVIRONMENT, biomeTags: ['forest', 'roadside', 'camp'], blocksMovement: true,
    rotations: true, spawnWeight: 0.42, minClusterSize: 1, maxClusterSize: 2,
    blueprint: ['○═█═○', ' ▒▒▒ ', '○   ○'],
    glyphPalette: { '○': { fg: '#8d9299' }, '═': { fg: '#7c5a3a' }, '█': { fg: '#6f4d2f' }, '▒': { fg: '#8a633f' } },
  }),
  cook_station: createDefinition({
    id: 'cook_station', category: OBJECT_CATEGORY.INTERACTABLE, biomeTags: ['forest', 'camp'], interactable: true,
    blocksMovement: true, rotations: true, spawnWeight: 0.44, minClusterSize: 1, maxClusterSize: 2,
    blueprint: [' ═╬═ ', '▒✶▒▒', ' ▓▓ '],
    glyphPalette: { '═': { fg: '#7f5e3b' }, '╬': { fg: '#6f5234' }, '▒': { fg: '#7a5a38' }, '✶': { fg: '#e8873f' }, '▓': { fg: '#8b857b' } },
  }),
  watch_post: createDefinition({
    id: 'watch_post', category: OBJECT_CATEGORY.INTERACTABLE, biomeTags: ['forest', 'camp'], interactable: true,
    blocksMovement: true, spawnWeight: 0.32, minClusterSize: 1, maxClusterSize: 2, biomeRarity: 'uncommon',
    blueprint: [' ▓▓▓ ', ' ▓○▓ ', '  ║  ', ' ▒▒▒ '],
    glyphPalette: { '▓': { fg: '#8a6440' }, '○': { fg: '#afc4d9' }, '║': { fg: '#6d4f31' }, '▒': { fg: '#5e452c' } },
  }),

  giant_tree: createDefinition({
    id: 'giant_tree', category: OBJECT_CATEGORY.LANDMARK, biomeTags: ['forest'], blocksMovement: true,
    spawnWeight: 0.18, minClusterSize: 1, maxClusterSize: 1, biomeRarity: 'rare',
    blueprint: ['    ♣♣♣    ', '  ♣♣♣♣♣♣♣  ', ' ♣♣♧♣♣♧♣♣♣ ', '♣♣♣♣♣♣♣♣♣♣♣', '  ♣♣♣♣♣♣♣  ', '    ║▓║    ', '   ▓▓▓▓▓   ', '   ▓▓▓▓▓   '],
    glyphPalette: { '♣': { fg: '#2f6129' }, '♧': { fg: '#42763a' }, '║': { fg: '#6b4f2a' }, '▓': { fg: '#594026' } },
  }),
  stone_circle: createDefinition({
    id: 'stone_circle', category: OBJECT_CATEGORY.LANDMARK, biomeTags: ['forest', 'hills'], blocksMovement: true,
    spawnWeight: 0.3, minClusterSize: 1, maxClusterSize: 1, biomeRarity: 'rare',
    blueprint: ['  ○○○  ', ' ○   ○ ', '○  ✦  ○', '○ ✦◎✦ ○', '○  ✦  ○', ' ○   ○ ', '  ○○○  '],
    glyphPalette: { '○': { fg: '#8d939b' }, '✦': { fg: '#b9c3d0' }, '◎': { fg: '#d9d2bc' } },
  }),
  forest_shrine: createDefinition({
    id: 'forest_shrine', category: OBJECT_CATEGORY.LANDMARK, biomeTags: ['forest', 'ruins'], blocksMovement: true,
    spawnWeight: 0.24, minClusterSize: 1, maxClusterSize: 1, biomeRarity: 'rare',
    blueprint: ['   ▓▓▓   ', '  ▓††▓  ', ' ▓═◉═▓ ', ' ▓═○═▓ ', '   ▒▒▒   '],
    glyphPalette: { '▓': { fg: '#8e8980' }, '†': { fg: '#c8c2ad' }, '═': { fg: '#767169' }, '◉': { fg: '#dfd8bf' }, '○': { fg: '#b8b19b' }, '▒': { fg: '#655f57' } },
  }),
  druid_altar: createDefinition({
    id: 'druid_altar', category: OBJECT_CATEGORY.LANDMARK, biomeTags: ['forest'], blocksMovement: true,
    spawnWeight: 0.2, minClusterSize: 1, maxClusterSize: 1, biomeRarity: 'rare',
    blueprint: ['  ✶   ✶  ', ' ○ ▓▓▓ ○ ', '   ▓◉▓   ', ' ○ ▓▓▓ ○ ', '  ✶   ✶  '],
    glyphPalette: { '✶': { fg: '#94c9d1' }, '○': { fg: '#9ba2ab' }, '▓': { fg: '#7f7a72' }, '◉': { fg: '#d5ceb5' } },
  }),
  ritual_circle: createDefinition({
    id: 'ritual_circle', category: OBJECT_CATEGORY.LANDMARK, biomeTags: ['forest', 'ruins'], blocksMovement: false,
    spawnWeight: 0.26, minClusterSize: 1, maxClusterSize: 1, biomeRarity: 'rare',
    blueprint: ['  ✦✦✦  ', ' ✦   ✦ ', '✦ Δ◉Δ ✦', ' ✦   ✦ ', '  ✦✦✦  '],
    glyphPalette: { '✦': { fg: '#a888d7' }, 'Δ': { fg: '#d2b7f5' }, '◉': { fg: '#ece3cf' } },
  }),
  moon_well: createDefinition({
    id: 'moon_well', category: OBJECT_CATEGORY.LANDMARK, biomeTags: ['forest', 'ruins'], blocksMovement: true,
    spawnWeight: 0.18, minClusterSize: 1, maxClusterSize: 1, biomeRarity: 'rare',
    blueprint: ['  ▓▓▓  ', ' ▓◎◎▓ ', '▓◎◉◎▓', ' ▓◎◎▓ ', '  ▓▓▓  '],
    glyphPalette: { '▓': { fg: '#7f848d' }, '◎': { fg: '#8cb4d4' }, '◉': { fg: '#d4e4f2' } },
    interactable: true,
  }),

  legacy_signpost: createDefinition({
    id: 'legacy_signpost', category: OBJECT_CATEGORY.INTERACTABLE, biomeTags: ['forest', 'roadside'],
    footprint: [{ x: 0, y: 0 }], blocksMovement: true, interactable: true,
    variants: [visual('†', '#b1864d'), visual('‡', '#9f7946'), visual('┼', '#c09358')],
    spawnWeight: 0.1,
  }),
};

function maxFootprintDistance(footprint) {
  if (!Array.isArray(footprint) || footprint.length === 0) return 0;
  return footprint.reduce((max, cell) => Math.max(max, Math.hypot(cell.x, cell.y)), 0);
}

function interactionTypeFor(definition) {
  if (!definition.interactable) return 'none';
  if (definition.id.includes('campfire')) return 'rest';
  if (definition.id.includes('shrine') || definition.id.includes('altar')) return 'activate';
  if (definition.id.includes('signpost')) return 'message';
  if (definition.id.includes('well')) return 'heal';
  return 'activate';
}

export function getObjectDefinition(id) {
  return objectLibrary[id] ?? null;
}

export function spawnObject(type, position, overrides = {}, rng = Math.random) {
  const definition = getObjectDefinition(type);
  if (!definition) return null;

  const quarterTurns = definition.rotations ? Math.floor(rng() * 4) : 0;
  const footprintInput = overrides.footprint ?? definition.footprint;
  const baseFootprint = normalizeFootprint(footprintInput);
  const rotatedFootprint = rotateFootprint(baseFootprint, quarterTurns);

  const tilesInput = overrides.tiles ?? definition.tiles;
  const normalizedTiles = normalizeTiles(tilesInput);

  const variants = definition.variants ?? [];
  const selectedVariant = variants.length > 0 ? variants[Math.floor(rng() * variants.length)] : null;

  const tiles = normalizedTiles.length > 0
    ? rotateTiles(normalizedTiles, quarterTurns)
    : rotatedFootprint.map((cell) => ({
      x: cell.x,
      y: cell.y,
      ...(selectedVariant ?? variants[Math.abs((cell.x * 17) + (cell.y * 11)) % Math.max(1, variants.length)] ?? { char: '•', fg: '#d8d2c4', bg: null }),
    }));

  const radius = maxFootprintDistance(rotatedFootprint) + 0.9;

  return {
    id: overrides.id ?? `${type}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    name: definition.id,
    category: definition.category,
    biomeTags: [...definition.biomeTags],
    x: position.x,
    y: position.y,
    position: { x: position.x, y: position.y },
    footprint: rotatedFootprint.map((cell) => [cell.x, cell.y]),
    variants,
    variant: selectedVariant,
    tileVariants: tiles,
    tiles,
    rotation: quarterTurns,
    centerOffset: definition.centerOffset,
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
