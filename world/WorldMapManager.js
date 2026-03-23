import { TownGenerator } from './TownGenerator.js';
import { tiles } from './TilePalette.js';
import { buildCollidableMask, carveBoundaryCrossing, carveEntranceSafetyZone, carvePath, floodFillWalkable, nearestReachablePoint } from './PathConnectivity.js';
import { connectRegions, deriveForestSeedFromTown, normalizeExit } from './RegionGenerationSystem.js';
import { ENTRANCE_CLEAR_ZONE_RADIUS, MIN_ROAD_WIDTH } from './GenerationConstants.js';

function cloneTile(tile) {
  return { ...tile };
}

function buildCollisionMap(grid, objects = []) {
  const map = Array.from({ length: grid.length }, (_, y) => Array.from({ length: grid[0].length }, (_, x) => !grid[y][x].walkable));
  for (const object of objects) {
    if (!object?.collision) continue;
    const footprint = object.footprint ?? object.logicalShape?.tiles ?? [[0, 0]];
    for (const cell of footprint) {
      const dx = Array.isArray(cell) ? cell[0] : cell.x;
      const dy = Array.isArray(cell) ? cell[1] : cell.y;
      const x = Math.round(object.x + dx);
      const y = Math.round(object.y + dy);
      if (map[y]?.[x] == null) continue;
      map[y][x] = true;
    }
  }
  return map;
}

function oppositeDirection(direction) {
  if (direction === 'north') return 'south';
  if (direction === 'south') return 'north';
  if (direction === 'west') return 'east';
  return 'west';
}

function carveForestEntry(room, entryId, direction, roadWidth = MIN_ROAD_WIDTH) {
  if (!room?.tiles?.length || !room.tiles[0]?.length) return null;

  const width = room.tiles[0].length;
  const height = room.tiles.length;
  const existingEntrance = room.entrances?.[entryId];
  const fallbackDirection = oppositeDirection(direction);
  const targetDirection = existingEntrance?.direction ?? fallbackDirection;

  let anchor = existingEntrance
    ? { x: Math.round(existingEntrance.x), y: Math.round(existingEntrance.y), direction: targetDirection }
    : null;

  if (!anchor) {
    if (targetDirection === 'north') anchor = { x: Math.floor(width / 2), y: 2, direction: targetDirection };
    else if (targetDirection === 'south') anchor = { x: Math.floor(width / 2), y: height - 3, direction: targetDirection };
    else if (targetDirection === 'west') anchor = { x: 2, y: Math.floor(height / 2), direction: targetDirection };
    else anchor = { x: width - 3, y: Math.floor(height / 2), direction: targetDirection };
  }

  const landingX = Math.max(1, Math.min(width - 2, existingEntrance?.landingX ?? (targetDirection === 'west' ? 4 : targetDirection === 'east' ? width - 5 : anchor.x)));
  const landingY = Math.max(1, Math.min(height - 2, existingEntrance?.landingY ?? (targetDirection === 'north' ? 4 : targetDirection === 'south' ? height - 5 : anchor.y)));
  const landing = { x: landingX, y: landingY };
  const perpendicular = targetDirection === 'north' || targetDirection === 'south' ? { x: 1, y: 0 } : { x: 0, y: 1 };
  const effectiveRoadWidth = Math.max(MIN_ROAD_WIDTH, roadWidth);
  const halfWidth = Math.ceil(effectiveRoadWidth / 2);
  const triggerTiles = [];

  carveBoundaryCrossing(room.tiles, anchor, targetDirection, { width: effectiveRoadWidth, removableObjects: room.objects ?? [] });

  for (let step = 0; step <= 5; step += 1) {
    const cx = Math.round(anchor.x + ((landing.x - anchor.x) * (step / 5)));
    const cy = Math.round(anchor.y + ((landing.y - anchor.y) * (step / 5)));
    for (let offset = -halfWidth; offset <= halfWidth; offset += 1) {
      const tx = cx + (perpendicular.x * offset);
      const ty = cy + (perpendicular.y * offset);
      if (!room.tiles[ty]?.[tx]) continue;
      room.tiles[ty][tx] = cloneTile(offset === -halfWidth || offset === halfWidth ? tiles.dirtEdge : tiles.dirt);
      triggerTiles.push({ x: tx, y: ty });
    }
  }

  carveEntranceSafetyZone(room.tiles, landing, { radius: ENTRANCE_CLEAR_ZONE_RADIUS, removableObjects: room.objects ?? [] });

  room.entrances = room.entrances ?? {};
  room.entrances[entryId] = {
    id: entryId,
    x: anchor.x,
    y: anchor.y,
    direction: targetDirection,
    spawn: { ...landing },
    landingX: landing.x,
    landingY: landing.y,
  };

  return {
    anchor,
    landing,
    triggerTiles,
  };
}


function ensureForestEntranceReachable(room, exits, entryId, roadWidth = MIN_ROAD_WIDTH) {
  const entrance = room?.entrances?.[entryId];
  if (!room?.tiles?.length || !entrance) {
    return { entranceReachable: false, exitReachable: false };
  }

  const spawn = entrance.spawn ?? { x: entrance.landingX ?? entrance.x, y: entrance.landingY ?? entrance.y };
  const exit = Array.isArray(exits) ? exits.find((candidate) => candidate.targetMapType === 'town') : null;
  const roadMask = new Set();
  const objectMask = buildCollidableMask(room.objects ?? []);
  let reachable = floodFillWalkable(room.tiles, spawn, objectMask);
  const entranceKey = `${entrance.landingX},${entrance.landingY}`;
  const exitPoint = exit?.position ?? { x: entrance.landingX, y: entrance.landingY };
  const exitKey = `${exitPoint.x},${exitPoint.y}`;

  const connectPoint = !reachable.has(entranceKey)
    ? nearestReachablePoint(reachable, { x: entrance.landingX, y: entrance.landingY }) ?? spawn
    : null;

  if (connectPoint && (connectPoint.x !== entrance.landingX || connectPoint.y !== entrance.landingY)) {
    console.warn('[WorldMapManager] Forest entrance connectivity repair', { entryId, connectPoint });
    carvePath(room.tiles, { x: entrance.landingX, y: entrance.landingY }, connectPoint, {
      width: Math.max(MIN_ROAD_WIDTH, roadWidth),
      jitterBias: 0.24,
      carvedMask: roadMask,
      removableObjects: room.objects ?? [],
    });
    reachable = floodFillWalkable(room.tiles, spawn, buildCollidableMask(room.objects ?? []));
  }

  if (!reachable.has(exitKey)) {
    console.warn('[WorldMapManager] Forest town exit connectivity repair', { entryId, exitId: exit?.id ?? null });
    carvePath(room.tiles, spawn, exitPoint, {
      width: Math.max(MIN_ROAD_WIDTH, roadWidth),
      jitterBias: 0.3,
      carvedMask: roadMask,
      removableObjects: room.objects ?? [],
    });
    reachable = floodFillWalkable(room.tiles, spawn, buildCollidableMask(room.objects ?? []));
    if (exit) exit.position = { ...exitPoint };
  }

  room.collisionMap = buildCollisionMap(room.tiles, room.objects ?? []);
  room.metadata = {
    ...(room.metadata ?? {}),
    reachability: {
      entranceReachable: reachable.has(entranceKey),
      exitReachable: reachable.has(exitKey),
    },
  };

  return room.metadata.reachability;
}

function cloneExit(exit) {
  const normalized = normalizeExit(exit);
  return {
    ...normalized,
    category: exit?.category ?? 'interactable',
    isInteractable: exit?.isInteractable ?? true,
    interactionType: exit?.interactionType ?? 'exit',
    interactionMode: exit?.interactionMode ?? 'touch',
    interactionPriority: exit?.interactionPriority ?? 100,
    interactionData: exit?.interactionData ?? {
      targetMap: exit?.targetMap ?? exit?.targetMapType ?? null,
      targetBiome: exit?.targetBiome ?? exit?.targetRoomId ?? null,
      targetExitId: exit?.targetExitId ?? null,
      targetEntryId: exit?.targetEntryId ?? exit?.targetEntranceId ?? null,
      targetSeed: exit?.targetSeed ?? null,
      meta: exit?.meta ?? null,
    },
    targetMap: exit?.targetMap ?? exit?.targetMapType ?? null,
    targetBiome: exit?.targetBiome ?? exit?.targetRoomId ?? null,
    position: exit?.position ? { ...exit.position } : null,
  };
}

function normalizeForestRoom(room, { biomeId, biomeSeed, mapId, returnLink = null } = {}) {
  if (!room) return null;
  const originalExits = Array.isArray(room.exits)
    ? room.exits
    : Object.entries(room.exits ?? {}).map(([id, exit]) => ({
      id,
      position: exit?.roadAnchor ?? exit?.landing ?? exit?.spawn ?? exit?.edgeStart ?? { x: 0, y: 0 },
      targetRoomId: exit?.targetRoomId,
      targetEntranceId: exit?.targetEntranceId,
      width: Math.max(2, Math.abs((exit?.edgeEnd?.x ?? 0) - (exit?.edgeStart?.x ?? 0)) + Math.abs((exit?.edgeEnd?.y ?? 0) - (exit?.edgeStart?.y ?? 0)) + 1),
    }));

  const exits = [...originalExits];
  const exitCorridors = Array.isArray(room.exitCorridors) ? [...room.exitCorridors] : [];

  if (returnLink) {
    const entry = carveForestEntry(room, 'forest_entry_from_town', returnLink.townExitSide ?? 'top', Math.max(MIN_ROAD_WIDTH, returnLink.roadWidth ?? MIN_ROAD_WIDTH));
    const returnExitId = 'forest_exit_to_town';
    const existing = exits.find((exit) => exit.id === returnExitId);
    const landing = entry?.landing ?? room?.entrances?.['forest_entry_from_town']?.spawn ?? { x: Math.floor(room.tiles[0].length / 2), y: Math.floor(room.tiles.length / 2) };
    if (!existing) {
      exits.push({
        id: returnExitId,
        category: 'interactable',
        isInteractable: true,
        interactionType: 'exit',
        interactionMode: 'touch',
        interactionPriority: 100,
        interactionData: {
          targetMap: 'town',
          targetBiome: null,
          targetEntryId: returnLink.targetEntryId ?? 'town_exit_main',
          targetSeed: returnLink.targetSeed,
        },
        position: { x: landing.x, y: landing.y },
        targetMapType: 'town',
        targetMap: 'town',
        targetSeed: returnLink.targetSeed,
        targetEntryId: returnLink.targetEntryId ?? 'town_exit_main',
        width: Math.max(MIN_ROAD_WIDTH, returnLink.roadWidth ?? MIN_ROAD_WIDTH),
        meta: {
          originForestSeed: biomeSeed,
        },
      });
    }
    exitCorridors.push({
      exitId: returnExitId,
      triggerTiles: entry?.triggerTiles?.length ? entry.triggerTiles : [{ x: landing.x, y: landing.y }],
    });
    console.log('Forest → Town', biomeSeed, '→', returnLink.targetSeed);
  }

  const reachability = ensureForestEntranceReachable(room, exits, 'forest_entry_from_town', Math.max(MIN_ROAD_WIDTH, returnLink?.roadWidth ?? MIN_ROAD_WIDTH));

  return {
    ...room,
    id: mapId ?? `forest-${biomeSeed}-${room.id}`,
    sourceRoomId: room.id,
    type: 'forest',
    seed: biomeSeed,
    exits: exits.map(cloneExit),
    exitCorridors,
    npcs: room.npcs ?? [],
    metadata: {
      ...(room.metadata ?? {}),
      biomeId,
      biomeSeed,
      reachability,
    },
  };
}

export class WorldMapManager {
  constructor({ biomeGenerator, roomWidth = 240, roomHeight = 160, runtimeConfig = null } = {}) {
    this.biomeGenerator = biomeGenerator;
    this.townGenerator = new TownGenerator({ width: roomWidth, height: roomHeight, runtimeConfig });
    this.runtimeConfig = runtimeConfig;
    this.mapCache = new Map();
    this.forestReturnLinks = new Map();
  }

  buildMapId(type, seed, suffix = '') {
    return `${type}-${seed}${suffix ? `-${suffix}` : ''}`;
  }

  buildTownMapId(seed) {
    return `town-${seed}`;
  }

  buildForestBiomeId(seed) {
    return `forest-biome-${seed}`;
  }

  buildForestMapId(seed, roomId) {
    return `forest-${seed}-${roomId}`;
  }

  enterStartingWorld(seed) {
    return this.loadMap({ type: 'town', seed });
  }

  regenerate(seed) {
    this.mapCache.clear();
    this.forestReturnLinks.clear();
    return this.enterStartingWorld(seed);
  }

  loadMap(request = {}) {
    const type = request.type ?? 'forest';
    if (type === 'town') return this.loadTown(request.seed);
    if (type === 'house_interior') return this.loadHouseInterior(request.seed, request.context ?? {});
    return this.loadForest(request.seed, request);
  }

  loadTown(seed) {
    const mapId = this.buildTownMapId(seed);
    if (this.mapCache.has(mapId)) return this.mapCache.get(mapId);

    const town = this.townGenerator.generateTown(seed, { townType: 'forestTown' });
    town.seed = seed;
    this.installTownHouseInteractions(town);

    const forestExit = town.exits?.find((candidate) => candidate.targetMapType === 'forest');
    if (forestExit) {
      const biomeId = this.buildForestBiomeId(forestExit.targetSeed);
      const { biome } = this.biomeGenerator.enterBiome(biomeId, forestExit.targetSeed);
      forestExit.targetRoomId = forestExit.targetRoomId ?? biome?.startRoomId ?? null;
      forestExit.targetEntryId = forestExit.targetEntryId ?? 'forest_entry_from_town';
      forestExit.targetEntranceId = forestExit.targetEntranceId ?? forestExit.targetEntryId;
      if (forestExit.interactionData) {
        forestExit.interactionData.targetBiome = forestExit.targetRoomId;
        forestExit.interactionData.targetEntryId = forestExit.targetEntryId;
      }
    }

    this.mapCache.set(mapId, town);
    return town;
  }


  loadHouseInterior(seed, context = {}) {
    const mapId = this.buildMapId('house', seed);
    if (this.mapCache.has(mapId)) return this.mapCache.get(mapId);
    const map = this.townGenerator.generateHouseInterior(seed, context);
    this.mapCache.set(mapId, map);
    return map;
  }

  loadForest(seed, options = {}) {
    const biomeId = this.buildForestBiomeId(seed);
    const { biome } = this.biomeGenerator.enterBiome(biomeId, seed);
    const roomId = options.roomId ?? biome?.startRoomId ?? null;
    const mapId = roomId ? this.buildForestMapId(seed, roomId) : biomeId;

    if (options.returnLink && roomId === biome?.startRoomId) {
      this.forestReturnLinks.set(biomeId, { ...options.returnLink });
    }

    if (this.mapCache.has(mapId)) {
      return this.mapCache.get(mapId);
    }

    const rememberedReturnLink = this.forestReturnLinks.get(biomeId) ?? null;
    const returnLink = roomId === biome?.startRoomId ? (options.returnLink ?? rememberedReturnLink) : null;
    const room = roomId ? this.biomeGenerator.loadRoom(roomId) : null;
    const normalized = normalizeForestRoom(room, {
      biomeId,
      biomeSeed: seed,
      mapId,
      returnLink,
    });

    if (normalized && returnLink?.targetSeed) {
      const town = this.loadTown(returnLink.targetSeed);
      const townExit = town.exits?.find((candidate) => candidate.id === (returnLink.targetEntryId ?? 'town_exit_main'))
        ?? town.exits?.find((candidate) => candidate.targetMapType === 'forest');
      const forestReturnExit = normalized.exits?.find((candidate) => candidate.targetMapType === 'town')
        ?? normalized.exits?.[0];

      if (townExit && forestReturnExit) {
        townExit.targetSeed = seed;
        townExit.targetRoomId = roomId;
        townExit.targetEntryId = 'forest_entry_from_town';
        townExit.targetEntranceId = 'forest_entry_from_town';
        if (townExit.interactionData) {
          townExit.interactionData.targetBiome = roomId;
          townExit.interactionData.targetEntryId = 'forest_entry_from_town';
          townExit.interactionData.targetSeed = seed;
        }

        forestReturnExit.targetSeed = returnLink.targetSeed;
        forestReturnExit.targetEntryId = returnLink.targetEntryId ?? townExit.id;
        forestReturnExit.targetEntranceId = forestReturnExit.targetEntryId;
        if (forestReturnExit.interactionData) {
          forestReturnExit.interactionData.targetSeed = returnLink.targetSeed;
          forestReturnExit.interactionData.targetEntryId = forestReturnExit.targetEntryId;
        }

        connectRegions({
          fromRegion: town,
          toRegion: normalized,
          options: {
            debug: this.runtimeConfig?.get?.('generation.debug') ?? false,
            fromExit: townExit,
            toExit: forestReturnExit,
          },
        });
        this.mapCache.set(town.id, town);
      }
    }

    if (normalized) this.mapCache.set(normalized.id, normalized);
    return normalized;
  }

  resolveMapByExit(currentMap, exit) {
    if (exit?.targetMapType === 'town') {
      const townMapId = this.buildTownMapId(exit.targetSeed);
      const town = this.mapCache.get(townMapId) ?? this.loadTown(exit.targetSeed);
      if (exit.targetEntryId && exit.meta?.returnPosition && !town.entrances?.[exit.targetEntryId]) {
        town.entrances[exit.targetEntryId] = {
          id: exit.targetEntryId,
          x: exit.meta.returnPosition.x,
          y: exit.meta.returnPosition.y,
          spawn: { ...exit.meta.returnPosition },
          landingX: exit.meta.returnPosition.x,
          landingY: exit.meta.returnPosition.y,
        };
      }
      return town;
    }

    if (exit?.targetMapType === 'house_interior') {
      return this.loadHouseInterior(exit.targetSeed, {
        parentTownSeed: exit.meta?.parentTownSeed,
        returnEntryId: exit.meta?.returnEntryId,
        returnPosition: exit.meta?.returnPosition,
        houseId: exit.meta?.houseId,
        houseIndex: exit.meta?.houseIndex,
      });
    }

    if (exit?.targetRoomId) {
      const forestSeed = exit.targetSeed ?? currentMap.seed;
      const forestMapId = this.buildForestMapId(forestSeed, exit.targetRoomId);
      const returnLink = currentMap.type === 'town'
        ? {
          targetSeed: currentMap.seed,
          targetEntryId: exit.id,
          townExitSide: exit.meta?.exitSide ?? currentMap.metadata?.townExitSide ?? 'top',
          roadWidth: exit.width ?? exit.meta?.roadWidth ?? 3,
        }
        : null;
      return this.mapCache.get(forestMapId) ?? this.loadForest(forestSeed, {
        roomId: exit.targetRoomId,
        returnLink,
      });
    }

    if (exit?.targetMapType === 'forest') {
      const targetRoomId = exit.targetRoomId ?? null;
      const forestMapId = targetRoomId ? this.buildForestMapId(exit.targetSeed, targetRoomId) : null;
      return (forestMapId ? this.mapCache.get(forestMapId) : null) ?? this.loadForest(exit.targetSeed, {
        roomId: targetRoomId,
        returnLink: {
          targetSeed: currentMap.seed,
          targetEntryId: exit.id,
          townExitSide: exit.meta?.exitSide ?? currentMap.metadata?.townExitSide ?? 'top',
          roadWidth: exit.width ?? exit.meta?.roadWidth ?? 3,
        },
      });
    }

    return null;
  }

  getEntrance(map, entryId) {
    if (!map) return null;
    return map.entrances?.[entryId] ?? null;
  }

  deriveForestSeedFromTown(townSeed) {
    return deriveForestSeedFromTown(townSeed);
  }
  
  installTownHouseInteractions(town) {
    if (!town || !Array.isArray(town.objects)) return;

    town.exits = town.exits ?? [];

    const houseObjects = town.objects.filter((obj) => obj?.type === 'house' || obj?.tags?.includes?.('house'));

    let houseIndex = 0;

    for (const house of houseObjects) {
      const door = house?.door ?? house?.entrance ?? null;
      if (!door) {
        houseIndex += 1;
        continue;
      }

      const doorX = Math.round(door.x ?? house.x ?? 0);
      const doorY = Math.round(door.y ?? house.y ?? 0);
      const exitId = house.id ? `return-${house.id}` : `house_exit_${houseIndex}`;
      const targetSeed = house.interiorSeed ?? `${town.seed}-${houseIndex}`;
      const returnPosition = { x: doorX, y: doorY + 2 };
      const existingExit = town.exits.find((exit) => exit?.id === exitId);

      const exit = {
        id: exitId,
        category: 'interactable',
        isInteractable: true,
        interactionType: 'exit',
        interactionMode: 'button',
        interactionPriority: 90,
        position: { x: doorX, y: doorY },
        targetMapType: 'house_interior',
        targetSeed,
        targetEntryId: 'house_entry',
        meta: {
          parentTownSeed: town.seed,
          returnEntryId: exitId,
          returnPosition,
          houseIndex,
          houseId: house.id ?? null,
        },
        interactionData: {
          targetMap: 'house_interior',
          targetEntryId: 'house_entry',
          meta: {
            parentTownSeed: town.seed,
            returnEntryId: exitId,
            returnPosition,
            houseIndex,
            houseId: house.id ?? null,
          },
        },
      };

      if (existingExit) Object.assign(existingExit, exit);
      else town.exits.push(exit);

      houseIndex += 1;
    }
  }
}

