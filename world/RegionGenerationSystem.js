import { tiles, tileFrom } from './TilePalette.js';
import { createSeededRng, hashSeed, pickOne } from './SeededRandom.js';
import { buildCollidableMask, carvePath, floodFillWalkable, nearestReachablePoint } from './PathConnectivity.js';

function cloneTile(tile) {
  return { ...tile };
}

function makeGrid(width, height, tile) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => cloneTile(tile)));
}

function directionToDelta(direction) {
  if (direction === 'north') return { x: 0, y: -1 };
  if (direction === 'south') return { x: 0, y: 1 };
  if (direction === 'west') return { x: -1, y: 0 };
  return { x: 1, y: 0 };
}

function oppositeDirection(direction) {
  if (direction === 'north') return 'south';
  if (direction === 'south') return 'north';
  if (direction === 'west') return 'east';
  return 'west';
}

function makeLogger(debug, prefix) {
  if (!debug) return () => {};
  return (message, details = {}) => console.info(prefix, message, details);
}

export const biomeDefinitions = {
  forest: {
    terrainStyle: 'forest',
    groundTile: () => (Math.random() < 0.2 ? tiles.grassDark : tiles.grass),
    boundaryTile: () => pickOne(Math.random, [tiles.denseTree, tiles.denseTreeBloom, tiles.denseTreeSpire, tiles.rockCliff]) ?? tiles.denseTree,
    allowedObjectCategories: ['trees', 'rocks', 'props'],
    density: 0.6,
    decorationRules: { edgeDensity: 0.9 },
  },
  desert: {
    terrainStyle: 'desert',
    groundTile: () => tileFrom(tiles.dirt, { fg: '#d6bf7f', bg: '#675537', type: 'sand', walkable: true }),
    boundaryTile: () => tileFrom(tiles.rockCliff, { fg: '#b68e58', bg: '#5f4627', type: 'dune-wall', walkable: false }),
    allowedObjectCategories: ['rocks', 'props'],
    density: 0.35,
    decorationRules: { edgeDensity: 0.72 },
  },
  swamp: {
    terrainStyle: 'swamp',
    groundTile: () => tileFrom(tiles.grassDark, { fg: '#6c8c64', bg: '#243526', type: 'swamp-ground', walkable: true }),
    boundaryTile: () => tileFrom(tiles.rockCliff, { fg: '#355244', bg: '#1d2b24', type: 'swamp-thicket', walkable: false }),
    allowedObjectCategories: ['trees', 'props'],
    density: 0.5,
    decorationRules: { edgeDensity: 0.84 },
  },
};

export const townDefinitions = {
  forestTown: {
    biomeType: 'forest',
    layout: 'plaza',
    assets: ['wood', 'stone'],
    npcRules: { roles: ['villager', 'merchant', 'guard'] },
    objectRules: { decorationDensity: 0.55 },
  },
  desertTown: {
    biomeType: 'desert',
    layout: 'courtyard',
    assets: ['sandstone', 'cloth'],
    npcRules: { roles: ['merchant', 'guard', 'traveler'] },
    objectRules: { decorationDensity: 0.35 },
  },
};

export function createRegionResult({ id, regionType, tiles: tileGrid, objects = [], entities = [], exits = [], metadata = {}, entrances = {}, exitCorridors = [], npcs = [], collisionMap = null, state = null }) {
  return {
    id,
    type: regionType,
    tiles: tileGrid,
    objects,
    entities,
    exits,
    entrances,
    exitCorridors,
    npcs,
    collisionMap,
    state: state ?? { visited: false },
    metadata,
  };
}

export function normalizeExit(exit, { targetType = null, targetId = null, entryId = null } = {}) {
  const direction = exit.direction ?? 'north';
  const normalizedTargetType = targetType ?? exit.targetType ?? exit.targetMapType ?? (exit.targetRoomId ? 'biome' : 'town');
  const resolvedTargetId = targetId ?? exit.targetId ?? exit.targetSeed ?? exit.targetRoomId ?? null;
  const resolvedEntryId = entryId ?? exit.entryId ?? exit.targetEntryId ?? exit.targetEntranceId ?? null;
  return {
    ...exit,
    category: exit.category ?? 'interactable',
    isInteractable: exit.isInteractable ?? true,
    interactable: exit.interactable ?? true,
    interactionType: 'exit',
    x: exit.x ?? exit.position?.x ?? exit.roadAnchor?.x ?? exit.spawn?.x ?? 0,
    y: exit.y ?? exit.position?.y ?? exit.roadAnchor?.y ?? exit.spawn?.y ?? 0,
    position: exit.position ?? { x: exit.x ?? 0, y: exit.y ?? 0 },
    direction,
    targetType: normalizedTargetType,
    targetId: resolvedTargetId,
    targetMapType: exit.targetMapType ?? (normalizedTargetType === 'biome' ? 'forest' : normalizedTargetType),
    targetSeed: exit.targetSeed ?? (typeof resolvedTargetId === 'number' ? resolvedTargetId : null),
    targetRoomId: exit.targetRoomId ?? (normalizedTargetType === 'biome' && typeof resolvedTargetId === 'string' ? resolvedTargetId : null),
    targetEntryId: exit.targetEntryId ?? resolvedEntryId,
    targetEntranceId: exit.targetEntranceId ?? resolvedEntryId,
    interactionData: {
      targetType: normalizedTargetType === 'forest' ? 'biome' : normalizedTargetType,
      targetId: resolvedTargetId,
      entryId: resolvedEntryId,
    },
  };
}

export function placeRegionExits({ region, exits, metadataType, metadataValue, seed, debug = false }) {
  const log = makeLogger(debug, '[RegionGeneration:ExitPlacement]');
  const normalizedExits = exits.map((exit) => normalizeExit(exit));
  log('placed exits', { regionId: region.id, exits: normalizedExits.map(({ id, x, y, direction, interactionData }) => ({ id, x, y, direction, interactionData })) });
  region.exits = normalizedExits;
  region.metadata = {
    ...(region.metadata ?? {}),
    [metadataType]: metadataValue,
    seed,
  };
  return region;
}

export function ensureRegionConnectivity(region, { spawn = null, exitIds = null, debug = false, pathWidth = 3 } = {}) {
  const log = makeLogger(debug, '[RegionGeneration:Connectivity]');
  const objectMask = buildCollidableMask(region.objects ?? []);
  const defaultSpawn = spawn
    ?? region.entrances?.['initial-spawn']?.spawn
    ?? region.entrances?.['initial-spawn']
    ?? region.entrances?.[region.exits?.[0]?.targetEntryId ?? '']?.spawn
    ?? { x: Math.floor((region.tiles?.[0]?.length ?? 1) / 2), y: Math.floor((region.tiles?.length ?? 1) / 2) };
  let reachable = floodFillWalkable(region.tiles, defaultSpawn, objectMask);
  const targets = (region.exits ?? []).filter((exit) => !exitIds || exitIds.includes(exit.id));
  const fixes = [];

  for (const exit of targets) {
    const exitKey = `${exit.x},${exit.y}`;
    if (reachable.has(exitKey)) continue;
    const fallback = nearestReachablePoint(reachable, { x: exit.x, y: exit.y }) ?? defaultSpawn;
    carvePath(region.tiles, fallback, { x: exit.x, y: exit.y }, {
      width: pathWidth,
      jitterBias: 0.25,
      removableObjects: region.objects ?? [],
    });
    fixes.push({ exitId: exit.id, from: fallback, to: { x: exit.x, y: exit.y } });
    reachable = floodFillWalkable(region.tiles, defaultSpawn, buildCollidableMask(region.objects ?? []));
  }

  region.metadata = {
    ...(region.metadata ?? {}),
    connectivity: {
      ...(region.metadata?.connectivity ?? {}),
      spawn: defaultSpawn,
      allExitsReachable: targets.every((exit) => reachable.has(`${exit.x},${exit.y}`)),
      fixes,
    },
  };
  if (fixes.length) log('connectivity fixes applied', { regionId: region.id, fixes });
  return region;
}

export function connectRegions({ fromRegion, toRegion, connectionType = 'path', options = {} }) {
  const log = makeLogger(options.debug, '[RegionGeneration:ConnectRegions]');
  const fromExit = normalizeExit(options.fromExit ?? fromRegion.exits?.[0] ?? {});
  const toExit = normalizeExit(options.toExit ?? toRegion.exits?.[0] ?? {
    id: `${toRegion.id}-entry`,
    x: Math.floor((toRegion.tiles?.[0]?.length ?? 1) / 2),
    y: Math.floor((toRegion.tiles?.length ?? 1) / 2),
    direction: oppositeDirection(fromExit.direction),
  });

  fromExit.targetType = toRegion.type === 'town' ? 'town' : 'biome';
  fromExit.targetId = toRegion.id;
  fromExit.targetMapType = toRegion.type === 'town' ? 'town' : 'forest';
  fromExit.targetSeed = toRegion.seed ?? toRegion.metadata?.seed ?? null;
  fromExit.targetEntryId = toExit.id;
  fromExit.targetEntranceId = toExit.id;
  fromExit.interactionData = { targetType: fromExit.targetType, targetId: fromExit.targetId, entryId: toExit.id };

  toExit.targetType = fromRegion.type === 'town' ? 'town' : 'biome';
  toExit.targetId = fromRegion.id;
  toExit.targetMapType = fromRegion.type === 'town' ? 'town' : 'forest';
  toExit.targetSeed = fromRegion.seed ?? fromRegion.metadata?.seed ?? null;
  toExit.targetEntryId = fromExit.id;
  toExit.targetEntranceId = fromExit.id;
  toExit.interactionData = { targetType: toExit.targetType, targetId: toExit.targetId, entryId: fromExit.id };

  const fromDelta = directionToDelta(fromExit.direction);
  const toLanding = { x: Math.max(1, Math.min((toRegion.tiles?.[0]?.length ?? 2) - 2, toExit.x - fromDelta.x * 3)), y: Math.max(1, Math.min((toRegion.tiles?.length ?? 2) - 2, toExit.y - fromDelta.y * 3)) };
  const toDelta = directionToDelta(toExit.direction);
  const fromLanding = { x: Math.max(1, Math.min((fromRegion.tiles?.[0]?.length ?? 2) - 2, fromExit.x - toDelta.x * 3)), y: Math.max(1, Math.min((fromRegion.tiles?.length ?? 2) - 2, fromExit.y - toDelta.y * 3)) };

  fromRegion.entrances = {
    ...(fromRegion.entrances ?? {}),
    [toExit.id]: { id: toExit.id, x: fromExit.x, y: fromExit.y, spawn: fromLanding, landingX: fromLanding.x, landingY: fromLanding.y, direction: oppositeDirection(fromExit.direction) },
  };
  toRegion.entrances = {
    ...(toRegion.entrances ?? {}),
    [fromExit.id]: { id: fromExit.id, x: toExit.x, y: toExit.y, spawn: toLanding, landingX: toLanding.x, landingY: toLanding.y, direction: oppositeDirection(toExit.direction) },
  };

  fromRegion.exits = (fromRegion.exits ?? []).map((exit) => exit.id === fromExit.id ? fromExit : normalizeExit(exit));
  if (!fromRegion.exits.some((exit) => exit.id === fromExit.id)) fromRegion.exits.push(fromExit);
  toRegion.exits = (toRegion.exits ?? []).map((exit) => exit.id === toExit.id ? toExit : normalizeExit(exit));
  if (!toRegion.exits.some((exit) => exit.id === toExit.id)) toRegion.exits.push(toExit);

  ensureRegionConnectivity(fromRegion, { spawn: fromRegion.entrances?.['initial-spawn']?.spawn ?? fromLanding, exitIds: [fromExit.id], debug: options.debug, pathWidth: Math.max(3, options.pathWidth ?? 3) });
  ensureRegionConnectivity(toRegion, { spawn: toLanding, exitIds: [toExit.id], debug: options.debug, pathWidth: Math.max(3, options.pathWidth ?? 3) });

  const result = {
    connectionType,
    linkedExitIds: { fromExitId: fromExit.id, toExitId: toExit.id },
    fromRegion,
    toRegion,
  };
  log('regions connected', { fromRegionId: fromRegion.id, toRegionId: toRegion.id, linkedExitIds: result.linkedExitIds });
  return result;
}

export function generateBiome({ biomeType = 'forest', seed, options = {} }) {
  const definition = biomeDefinitions[biomeType] ?? biomeDefinitions.forest;
  const width = options.width ?? 96;
  const height = options.height ?? 72;
  const debug = options.debug ?? false;
  const log = makeLogger(debug, '[RegionGeneration:Biome]');
  const rng = createSeededRng(seed);
  const grid = makeGrid(width, height, definition.groundTile());

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      grid[y][x] = cloneTile(definition.groundTile());
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (isBorder && rng() < definition.decorationRules.edgeDensity) grid[y][x] = cloneTile(definition.boundaryTile());
    }
  }

  const center = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const exitDirection = pickOne(rng, ['north', 'south', 'east', 'west']) ?? 'north';
  const exit = normalizeExit({
    id: `${biomeType}-exit-main`,
    x: exitDirection === 'west' ? 0 : exitDirection === 'east' ? width - 1 : center.x,
    y: exitDirection === 'north' ? 0 : exitDirection === 'south' ? height - 1 : center.y,
    direction: exitDirection,
    targetType: 'town',
  });
  const spawn = { x: center.x, y: center.y };
  carvePath(grid, spawn, { x: exit.x, y: exit.y }, { rng, width: 3 });

  const region = createRegionResult({
    id: `${biomeType}-${seed}`,
    regionType: 'biome',
    tiles: grid,
    exits: [exit],
    entrances: { 'initial-spawn': { id: 'initial-spawn', x: spawn.x, y: spawn.y, spawn: { ...spawn }, landingX: spawn.x, landingY: spawn.y } },
    metadata: { biomeType, seed, definition },
  });
  ensureRegionConnectivity(region, { spawn, debug, pathWidth: 3 });
  log('generated biome', { biomeType, seed });
  return region;
}

export function generateTown({ townType = 'forestTown', seed, options = {} }) {
  if (options.generator?.generateTown) return options.generator.generateTown(seed, { townType, options });
  const biomeType = townDefinitions[townType]?.biomeType ?? 'forest';
  const region = generateBiome({ biomeType, seed, options: { ...options, width: options.width ?? 96, height: options.height ?? 72 } });
  region.id = `${townType}-${seed}`;
  region.type = 'town';
  region.metadata = { townType, seed, biomeType };
  return region;
}

export function createConnectedRegionPair({ townRegion, biomeRegion, debug = false, pathWidth = 3 }) {
  return connectRegions({
    fromRegion: townRegion,
    toRegion: biomeRegion,
    connectionType: 'paired-transition',
    options: { debug, pathWidth },
  });
}

export function deriveForestSeedFromTown(seed) {
  return hashSeed(seed, 'forest_exit');
}
