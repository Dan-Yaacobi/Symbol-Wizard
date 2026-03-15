const DEFAULT_PREFAB_METADATA = {
  spawnWeight: 10,
  clusterMin: 1,
  clusterMax: 3,
  clusterRadius: 2,
  rarity: 'common',
  destructible: true,
  hp: 10,
  material: 'wood',
  dropTable: 'none',
  tags: [],
};

const DAMAGE_CHAR_MAP = {
  '#': '%',
  '|': '/',
  '/': '-',
  '\\': '-',
  O: 'o',
};

const FINAL_DEBRIS = ['.', ',', "'", '`'];

function normalizeColor(color, fallback = [255, 255, 255]) {
  if (Array.isArray(color) && color.length >= 3) {
    return [
      Math.max(0, Math.min(255, Number(color[0]) || 0)),
      Math.max(0, Math.min(255, Number(color[1]) || 0)),
      Math.max(0, Math.min(255, Number(color[2]) || 0)),
    ];
  }

  if (typeof color === 'string' && color.startsWith('rgb')) {
    const values = color.match(/\d+/g)?.slice(0, 3).map((value) => Number(value) || 0);
    if (values && values.length === 3) return values;
  }

  return [...fallback];
}

function isEmptyCell(cell) {
  return !cell || !cell.char || cell.char === ' ' || cell.char === '\0';
}

async function inflateGzip(buffer) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('DecompressionStream is not supported in this browser.');
  }

  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  const decompressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(decompressed);
}

export async function parseXPFromArrayBuffer(buffer) {
  const inflated = await inflateGzip(buffer);
  const view = new DataView(inflated.buffer, inflated.byteOffset, inflated.byteLength);

  let offset = 0;
  const version = view.getInt32(offset, true);
  offset += 4;

  const layerCount = view.getInt32(offset, true);
  offset += 4;

  const layers = [];

  for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
    const width = view.getInt32(offset, true);
    offset += 4;
    const height = view.getInt32(offset, true);
    offset += 4;

    const cells = [];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const codepoint = view.getUint32(offset, true);
        offset += 4;

        const fg = [inflated[offset], inflated[offset + 1], inflated[offset + 2]];
        offset += 3;
        const bg = [inflated[offset], inflated[offset + 1], inflated[offset + 2]];
        offset += 3;

        const char = codepoint === 0 ? ' ' : String.fromCodePoint(codepoint);
        cells.push({ x, y, char, fg, bg });
      }
    }

    layers.push({ width, height, cells });
  }

  return { version, layers };
}

export function getVisualBounds(visualLayer) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const cell of visualLayer?.cells ?? []) {
    if (isEmptyCell(cell)) continue;
    minX = Math.min(minX, cell.x);
    minY = Math.min(minY, cell.y);
    maxX = Math.max(maxX, cell.x);
    maxY = Math.max(maxY, cell.y);
  }

  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

function normalizeCells(cells, bounds) {
  return cells.map((cell) => ({ ...cell, x: cell.x - bounds.minX, y: cell.y - bounds.minY }));
}

function extractVisualLayer(layer, bounds) {
  const cropped = (layer?.cells ?? [])
    .filter((cell) => !isEmptyCell(cell) && cell.x >= bounds.minX && cell.x <= bounds.maxX && cell.y >= bounds.minY && cell.y <= bounds.maxY)
    .map((cell) => ({
      x: cell.x,
      y: cell.y,
      char: cell.char,
      fg: normalizeColor(cell.fg),
      bg: normalizeColor(cell.bg, [0, 0, 0]),
    }));

  return normalizeCells(cropped, bounds);
}

function extractMaskLayer(layer, bounds) {
  const cropped = (layer?.cells ?? [])
    .filter((cell) => !isEmptyCell(cell) && cell.x >= bounds.minX && cell.x <= bounds.maxX && cell.y >= bounds.minY && cell.y <= bounds.maxY)
    .map((cell) => ({ x: cell.x, y: cell.y }));

  return normalizeCells(cropped, bounds);
}

export function buildPrefabFromXP(parsedXp, metadata = {}, options = {}) {
  const visualLayer = parsedXp.layers[0] ?? { cells: [] };
  const collisionLayer = parsedXp.layers[1] ?? { cells: [] };
  const interactionLayer = parsedXp.layers[2] ?? { cells: [] };

  const bounds = options.autoCrop === false
    ? {
      minX: 0,
      minY: 0,
      maxX: Math.max(0, (visualLayer.width ?? 1) - 1),
      maxY: Math.max(0, (visualLayer.height ?? 1) - 1),
    }
    : getVisualBounds(visualLayer);

  return {
    id: metadata.id ?? '',
    tags: Array.isArray(metadata.tags) ? metadata.tags : [],
    spawnWeight: Number(metadata.spawnWeight) || DEFAULT_PREFAB_METADATA.spawnWeight,
    clusterMin: Number(metadata.clusterMin) || DEFAULT_PREFAB_METADATA.clusterMin,
    clusterMax: Number(metadata.clusterMax) || DEFAULT_PREFAB_METADATA.clusterMax,
    clusterRadius: Number(metadata.clusterRadius) || DEFAULT_PREFAB_METADATA.clusterRadius,
    rarity: metadata.rarity ?? DEFAULT_PREFAB_METADATA.rarity,
    destructible: metadata.destructible ?? DEFAULT_PREFAB_METADATA.destructible,
    hp: Number(metadata.hp) || DEFAULT_PREFAB_METADATA.hp,
    material: metadata.material ?? DEFAULT_PREFAB_METADATA.material,
    dropTable: metadata.dropTable ?? DEFAULT_PREFAB_METADATA.dropTable,
    visual: extractVisualLayer(visualLayer, bounds),
    collision: extractMaskLayer(collisionLayer, bounds),
    interaction: extractMaskLayer(interactionLayer, bounds),
    source: metadata.source ?? null,
  };
}

function isStructuralChar(char) {
  return ['#', '|', '/', '\\', '*', 'O'].includes(char);
}

function jitter(value, amount = 1) {
  return value + Math.round((Math.random() * 2 - 1) * amount);
}

export function generateDestructionFrames(visualTiles = [], frameCount = 4) {
  if (!Array.isArray(visualTiles) || visualTiles.length === 0) return [];

  const base = visualTiles.map((tile) => ({ ...tile }));
  const frames = [];

  for (let frame = 0; frame < frameCount; frame += 1) {
    const normalized = frameCount > 1 ? frame / (frameCount - 1) : 1;
    const isFinal = frame === frameCount - 1;
    const scatterAmount = normalized * 1.2;

    const frameTiles = base.map((tile) => {
      let char = tile.char;
      if (isFinal) {
        char = FINAL_DEBRIS[Math.floor(Math.random() * FINAL_DEBRIS.length)];
      } else if (isStructuralChar(char) && Math.random() < 0.2 + normalized * 0.65) {
        char = DAMAGE_CHAR_MAP[char] ?? char;
      }

      return {
        ...tile,
        char,
        x: jitter(tile.x, scatterAmount),
        y: jitter(tile.y, scatterAmount),
      };
    });

    frames.push(frameTiles);
  }

  return frames;
}

export { DEFAULT_PREFAB_METADATA };
