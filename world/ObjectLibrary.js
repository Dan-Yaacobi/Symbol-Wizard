import { createDefinition as createSpawnDefinition, SPAWN_CATEGORY } from '../data/DefinitionUtils.js';

const OBJECT_CATEGORY = {
  ENVIRONMENT: SPAWN_CATEGORY.ENVIRONMENT,
  DESTRUCTIBLE: SPAWN_CATEGORY.LOOT,
  INTERACTABLE: SPAWN_CATEGORY.INTERACTABLE,
  LANDMARK: 'landmark',
  PROP: SPAWN_CATEGORY.PROP,
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

function normalizeColor(color, fallback) {
  const clamp = (value) => Math.max(0, Math.min(255, Number(value) || 0));
  const toHex = (r, g, b) => `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;

  if (Array.isArray(color) && color.length >= 3) {
    const [r, g, b] = color;
    return toHex(r, g, b);
  }
  if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  if (typeof color === 'string' && color.startsWith('rgb')) {
    const values = color.match(/\d+/g)?.slice(0, 3);
    if (values?.length === 3) return toHex(values[0], values[1], values[2]);
  }
  return typeof color === 'string' ? color : fallback;
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
      if (!char || char === ' ') return null;
      return {
        x,
        y,
        char,
        fg: normalizeColor(tile.fg, '#d8d2c4'),
        bg: normalizeColor(tile.bg, 'rgba(0, 0, 0, 0)'),
      };
    })
    .filter(Boolean);
}

function normalizeBreakFrames(breakFrames) {
  if (!Array.isArray(breakFrames)) return null;
  return breakFrames.map((frame) => normalizeTiles(frame));
}

function extractTilesFromSpriteAsset(asset) {
  const idleFrame = asset?.animations?.idle?.[0];
  const rows = Array.isArray(idleFrame?.cells) ? idleFrame.cells : [];
  if (rows.length === 0) return [];

  const anchorX = Number.isInteger(asset?.anchor?.x) ? asset.anchor.x : Math.floor((rows[0]?.length ?? 1) / 2);
  const anchorY = Number.isInteger(asset?.anchor?.y) ? asset.anchor.y : Math.floor(rows.length / 2);

  const tiles = [];
  for (let y = 0; y < rows.length; y += 1) {
    const row = Array.isArray(rows[y]) ? rows[y] : [];
    for (let x = 0; x < row.length; x += 1) {
      const cell = row[x];
      if (!cell || typeof cell.ch !== 'string' || cell.ch.length === 0 || cell.ch === ' ') continue;
      tiles.push({
        x: x - anchorX,
        y: y - anchorY,
        char: cell.ch[0],
        fg: normalizeColor(cell.fg, '#d8d2c4'),
        bg: normalizeColor(cell.bg, 'rgba(0, 0, 0, 0)'),
      });
    }
  }
  return tiles;
}

function inferCategoryFromFilePath(fileName, fallback = OBJECT_CATEGORY.ENVIRONMENT) {
  if (typeof fileName !== 'string') return fallback;
  if (fileName.includes('/loot/')) return OBJECT_CATEGORY.DESTRUCTIBLE;
  if (fileName.includes('/environment/')) return OBJECT_CATEGORY.ENVIRONMENT;
  return fallback;
}

function createDefinition(definition) {
  const explicitTiles = normalizeTiles(definition.tiles);
  const footprint = normalizeFootprint(definition.footprint ?? explicitTiles.map((tile) => ({ x: tile.x, y: tile.y })));
  const variants = Array.isArray(definition.variants) ? definition.variants : [];

  const placementCategory = definition.category === OBJECT_CATEGORY.LANDMARK ? OBJECT_CATEGORY.LANDMARK : definition.category;

  return createSpawnDefinition({
    hp: null,
    drops: [],
    biomeTags: ['forest'],
    blocksMovement: false,
    destructible: false,
    interactable: false,
    rotations: false,
    clusterMin: undefined,
    clusterMax: undefined,
    clusterRadius: undefined,
    rarity: 'common',
    spawnWeight: 1,
    minClusterSize: 1,
    maxClusterSize: 1,
    allowOverlap: false,
    biomeRarity: 'common',
    clearanceRadius: 0,
    source: 'code',
    ...definition,
    category: definition.category === OBJECT_CATEGORY.LANDMARK ? SPAWN_CATEGORY.ENVIRONMENT : definition.category,
    placementCategory,
    centerOffset: definition.centerOffset ?? { x: 0, y: 0 },
    footprint,
    variants,
    tiles: explicitTiles,
  });
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

export const objectLibrary = {};

function definitionFromPrefab(prefab, source = 'code') {
  if (!prefab || typeof prefab !== 'object') return null;

  const id = typeof prefab.id === 'string' && prefab.id.length > 0 ? prefab.id : null;
  if (!id) return null;

  const tags = Array.isArray(prefab.tags) && prefab.tags.length > 0
    ? prefab.tags
    : (Array.isArray(prefab?.meta?.biomes) && prefab.meta.biomes.length > 0 ? prefab.meta.biomes : ['forest']);

  const visualTiles = normalizeTiles(prefab.visual ?? []);
  const spriteTiles = visualTiles.length > 0 ? visualTiles : extractTilesFromSpriteAsset(prefab);

  const collisionFootprint = Array.isArray(prefab.collision)
    ? prefab.collision
      .map((cell) => {
        const x = Number(cell?.x);
        const y = Number(cell?.y);
        if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
        return { x, y };
      })
      .filter(Boolean)
    : spriteTiles.map((tile) => ({ x: tile.x, y: tile.y }));

  const category = prefab.category
    ?? inferCategoryFromFilePath(prefab.__fileName, Array.isArray(prefab.interaction) && prefab.interaction.length > 0 ? OBJECT_CATEGORY.INTERACTABLE : OBJECT_CATEGORY.ENVIRONMENT);

  const defaultCollision = category !== OBJECT_CATEGORY.PROP;

  return createDefinition({
    id,
    category,
    biomeTags: tags,
    blocksMovement: prefab.blocksMovement ?? defaultCollision,
    interactable: Boolean(prefab.interactable) || (Array.isArray(prefab.interaction) && prefab.interaction.length > 0),
    footprint: collisionFootprint,
    tiles: spriteTiles,
    spawnWeight: Number(prefab.spawnWeight ?? prefab?.meta?.spawnWeight) || 1,
    minClusterSize: Number(prefab.clusterMin) || 1,
    maxClusterSize: Number(prefab.clusterMax) || 1,
    clusterRadius: Number(prefab.clusterRadius) || 1,
    biomeRarity: typeof prefab.rarity === 'string' ? prefab.rarity : 'common',
    destructible: Boolean(prefab.destructible) || category === OBJECT_CATEGORY.DESTRUCTIBLE,
    hp: Number(prefab.hp) || null,
    material: typeof prefab.material === 'string' ? prefab.material : 'wood',
    drops: Array.isArray(prefab.dropTable)
      ? prefab.dropTable
      : (typeof prefab.dropTable === 'string' && prefab.dropTable !== 'none'
        ? [{ type: prefab.dropTable, min: 1, max: 1 }]
        : []),
    breakFrames: normalizeBreakFrames(prefab.breakFrames),
    source,
    assetId: prefab.assetId ?? id,
  });
}

export function registerPrefabObject(prefab, options = {}) {
  const definition = definitionFromPrefab(prefab, options.source ?? 'code');
  if (!definition?.id) return null;
  objectLibrary[definition.id] = definition;
  return definition;
}

export function clearObjectLibrary() {
  Object.keys(objectLibrary).forEach((id) => delete objectLibrary[id]);
}

export function listLoadedObjects() {
  return Object.values(objectLibrary).map((definition) => ({
    id: definition.id,
    source: definition.source ?? 'code',
  }));
}

export async function loadObjectsFromFolder(basePath = './assets/objects', options = {}) {
  const { debugLog = false, clearExisting = true } = options;
  if (clearExisting) clearObjectLibrary();

  try {
    const registryResponse = await fetch(`${basePath}/registry.json`, { cache: 'no-cache' });
    if (!registryResponse.ok) return;

    const registry = await registryResponse.json();
    const objectFiles = Array.isArray(registry.objects) ? registry.objects : [];

    await Promise.all(objectFiles.map(async (entry) => {
      const fileName = typeof entry === 'string' ? entry : entry?.file;
      if (!fileName) return;

      const response = await fetch(`${basePath}/${fileName}`, { cache: 'no-cache' });
      if (!response.ok) return;
      const prefab = await response.json();
      prefab.__fileName = fileName;
      registerPrefabObject(prefab, { source: 'asset' });
    }));

    if (debugLog) {
      const summary = listLoadedObjects();
      console.info('[ObjectLibrary] Loaded objects:', summary);
    }
  } catch (error) {
    console.warn('[ObjectLibrary] Failed to auto-load object prefabs.', error);
  }
}

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

  const hasRotationOverride = Number.isInteger(overrides.rotation);
  const quarterTurns = hasRotationOverride
    ? ((overrides.rotation % 4) + 4) % 4
    : (definition.rotations ? Math.floor(rng() * 4) : 0);
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
    source: definition.source ?? 'code',
    assetId: definition.assetId,
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
    material: definition.material ?? 'wood',
    breakFrames: Array.isArray(definition.breakFrames) ? definition.breakFrames : null,
    antSpawner: definition.antSpawner ? { ...definition.antSpawner } : null,
    collisionGroup: overrides.collisionGroup ?? definition.collisionGroup ?? type,
    clearRadius: Math.max(0, Number(definition.clearRadius ?? definition.antSpawner?.clearRadius ?? definition.clearanceRadius) || 0),
    clearanceRadius: Math.max(0, Number(definition.clearanceRadius) || 0),
    state: { ...(overrides.state ?? {}) },
    destroyed: false,
    radius,
  };
}

export { OBJECT_CATEGORY };
