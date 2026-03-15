export const visualTheme = {
  colors: {
    abyss: '#070b12',
    night: '#0d1420',
    shadow: '#131d2b',
    panel: '#172334',
    panelElevated: '#1d2d42',
    panelBorder: '#35516f',
    panelBorderBright: '#5f86b2',
    text: '#d6e6ff',
    textMuted: '#90a9c9',
    worldBackground: '#0b1016',
    floorFg: '#516078',
    floorBg: '#0f1724',
    wallFg: '#8f9bb0',
    wallBg: '#283244',
    grassFg: '#3f7f56',
    grassBg: '#12251a',
    dirtFg: '#c4a27c',
    dirtBg: '#4e3a2a',
    waterFg: '#62a7d9',
    waterBg: '#14283b',
    treeFg: '#5b9c5f',
    treeDarkFg: '#3f7447',
    woodFg: '#9e7852',
    playerPrimary: '#e6d6ff',
    playerAccent: '#ffd67a',
    slime: '#8ee2a8',
    skeleton: '#dbe6f6',
    enemyFrozen: '#9edbff',
    projectileArcane: '#9dd8ff',
    gold: '#f2ca61',
    damage: '#ff7f87',
    mana: '#85cfff',
    health: '#ff8f96',
    success: '#84d79a',
    warning: '#e7c27b',
  },
  glyphFallbacks: {
    '♧': '♣',
    '♤': '♠',
    '✦': '*',
    '✶': '*',
    '✸': '*',
    '⚡': '≈',
    '❄': '*',
    '◉': '○',
    '◌': '○',
    '◎': '○',
    '◇': '♦',
    '◆': '♦',
    '△': '▲',
    '▽': '▼',
    '▴': '▲',
    '▶': '►',
    '▷': '►',
    '◀': '◄',
    '◁': '◄',
    '◥': '▲',
    '◤': '▲',
    '◣': '▼',
    '◢': '▼',
    '†': '+',
    '‡': '+',
    'Δ': '▲',
    '⚠': '!',
    '▦': '▒',
    '▥': '▓',
    '▩': '█',
    '×': 'x',
    '—': '-',
  },
};

export const renderLayers = {
  background: 'background',
  entities: 'entities',
  effects: 'effects',
  ui: 'ui',
};

export const glyphDensity = {
  low: new Set([' ', '.', ',', '~', '`', '"', ':', ';', '·']),
  medium: new Set(['|', '/', '\\', '+', '#', '%', '=', '-', '_', '○', '◄', '►', '▲', '▼', '║', '▓', '▒']),
  high: new Set(['@', '&', '$', '*', '!', '█', '♦']),
};

export const visualPalette = {
  background: {
    world: visualTheme.colors.worldBackground,
    panel: visualTheme.colors.panel,
  },
  ground: {
    floorFg: visualTheme.colors.floorFg,
    floorBg: visualTheme.colors.floorBg,
    dirtFg: visualTheme.colors.dirtFg,
    dirtBg: visualTheme.colors.dirtBg,
  },
  foliage: {
    bright: visualTheme.colors.treeFg,
    dark: visualTheme.colors.treeDarkFg,
    grassFg: visualTheme.colors.grassFg,
    grassBg: visualTheme.colors.grassBg,
  },
  stone: {
    wallFg: visualTheme.colors.wallFg,
    wallBg: visualTheme.colors.wallBg,
  },
  player: {
    primary: visualTheme.colors.playerPrimary,
    accent: visualTheme.colors.playerAccent,
    cast: '#f1e6ff',
  },
  enemy: {
    slime: visualTheme.colors.slime,
    skeleton: visualTheme.colors.skeleton,
    frozen: visualTheme.colors.enemyFrozen,
  },
  ui: {
    text: visualTheme.colors.text,
    textMuted: visualTheme.colors.textMuted,
  },
  damage: {
    normal: visualTheme.colors.damage,
    frozen: visualTheme.colors.enemyFrozen,
  },
  gold: {
    coin: visualTheme.colors.gold,
    lootSpark: '#90f0d1',
  },
};

export function toSafeGlyph(char) {
  if (!char || typeof char !== 'string') return ' ';
  return visualTheme.glyphFallbacks[char[0]] ?? char[0];
}

export function toRenderCell({ glyph = ' ', fg = visualTheme.colors.text, bg = visualTheme.colors.worldBackground, layer = renderLayers.entities } = {}) {
  return {
    glyph: toSafeGlyph(glyph),
    fg,
    bg,
    layer,
  };
}
