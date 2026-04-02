import { TownGenerator } from './TownGenerator.js';
import { buildCollidableMask, carveBoundaryCrossing, carveEntranceSafetyZone, carvePath, floodFillWalkable, nearestReachablePoint } from './PathConnectivity.js';
import { deriveForestSeedFromTown, normalizeExit } from './RegionGenerationSystem.js';
import { ENTRANCE_CLEAR_ZONE_RADIUS, MIN_ROAD_WIDTH } from './GenerationConstants.js';
import { buildRoomTransitionCache } from './TransitionCache.js';

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

function normalizeSideToDirection(sideOrDirection) {
  if (sideOrDirection === 'top') return 'north';
  if (sideOrDirection === 'bottom') return 'south';
  if (sideOrDirection === 'left') return 'west';
  if (sideOrDirection === 'right') return 'east';
  if (sideOrDirection === 'north' || sideOrDirection === 'south' || sideOrDirection === 'west' || sideOrDirection === 'east') return sideOrDirection;
  return 'north';
}

function clampToInterior(value, max) {
  return Math.max(1, Math.min(max - 2, Math.round(value)));
}

function buildForestEntryAnchor(room, returnLink = null) {
  if (!room?.tiles?.length || !room.tiles[0]?.length) return null;

  const width = room.tiles[0].length;
  const height = room.tiles.length;
  const existingEntrance = room.entrances?.forest_entry_from_town ?? null;
  const entryDirection = normalizeSideToDirection(returnLink?.townExitSide ?? existingEntrance?.direction ?? 'north');
  const requestedAnchor = returnLink?.townExitPosition ?? returnLink?.position ?? null;
  const defaultAnchor = existingEntrance
    ? { x: existingEntrance.x, y: existingEntrance.y }
    : requestedAnchor
      ? { x: requestedAnchor.x, y: requestedAnchor.y }
    : entryDirection === 'north'
      ? { x: Math.floor(width / 2), y: 2 }
      : entryDirection === 'south'
        ? { x: Math.floor(width / 2), y: height - 3 }
        : entryDirection === 'west'
          ? { x: 2, y: Math.floor(height / 2) }
          : { x: width - 3, y: Math.floor(height / 2) };

  const anchor = {
    x: clampToInterior(existingEntrance?.x ?? requestedAnchor?.x ?? defaultAnchor.x, width),
    y: clampToInterior(existingEntrance?.y ?? requestedAnchor?.y ?? defaultAnchor.y, height),
    direction: entryDirection,
  };

  const landing = {
    x: clampToInterior(existingEntrance?.landingX ?? existingEntrance?.spawn?.x ?? (entryDirection === 'west' ? 4 : entryDirection === 'east' ? width - 5 : anchor.x), width),
    y: clampToInterior(existingEntrance?.landingY ?? existingEntrance?.spawn?.y ?? (entryDirection === 'north' ? 4 : entryDirection === 'south' ? height - 5 : anchor.y), height),
  };

  return {
    id: 'forest_entry_from_town',
    x: anchor.x,
    y: anchor.y,
    direction: anchor.direction,
    corridorWidth: Math.max(MIN_ROAD_WIDTH, returnLink?.roadWidth ?? existingEntrance?.corridorWidth ?? MIN_ROAD_WIDTH),
    spawn: { ...landing },
    landingX: landing.x,
    landingY: landing.y,
    landing,
  };
}

function carveForestEntry(room, entryId, direction, roadWidth = MIN_ROAD_WIDTH) {
  if (!room?.tiles?.length || !room.tiles[0]?.length) return null;

  const width = room.tiles[0].length;
  const height = room.tiles.length;
  const existingEntrance = room.entrances?.[entryId];
  const fallbackDirection = oppositeDirection(normalizeSideToDirection(direction));
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
  for (let offset = -halfWidth; offset <= halfWidth; offset += 1) {
    const tx = anchor.x + (perpendicular.x * offset);
    const ty = anchor.y + (perpendicular.y * offset);
    if (!room.tiles[ty]?.[tx]) continue;
    triggerTiles.push({ x: tx, y: ty });
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
  const minimumReachableArea = Math.max(48, Math.round((room.tiles.length * room.tiles[0].length) * 0.02));

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

  if (reachable.size < minimumReachableArea) {
    const pathTargets = [];
    for (const candidate of exits ?? []) {
      if (candidate?.position) pathTargets.push(candidate.position);
      else if (Number.isFinite(candidate?.x) && Number.isFinite(candidate?.y)) pathTargets.push({ x: candidate.x, y: candidate.y });
    }
    pathTargets.push(
      { x: Math.floor((room.tiles[0]?.length ?? 1) / 2), y: Math.floor((room.tiles.length ?? 1) / 2) },
      { x: Math.floor((room.tiles[0]?.length ?? 1) * 0.25), y: Math.floor((room.tiles.length ?? 1) * 0.25) },
      { x: Math.floor((room.tiles[0]?.length ?? 1) * 0.75), y: Math.floor((room.tiles.length ?? 1) * 0.25) },
      { x: Math.floor((room.tiles[0]?.length ?? 1) * 0.25), y: Math.floor((room.tiles.length ?? 1) * 0.75) },
      { x: Math.floor((room.tiles[0]?.length ?? 1) * 0.75), y: Math.floor((room.tiles.length ?? 1) * 0.75) },
    );

    const candidateTargets = pathTargets.filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y));
    const usedTargets = [];
    for (const candidate of candidateTargets) {
      const candidateKey = `${candidate.x},${candidate.y}`;
      if (reachable.has(candidateKey)) continue;
      usedTargets.push({ x: candidate.x, y: candidate.y });
      carvePath(room.tiles, spawn, candidate, {
        width: Math.max(MIN_ROAD_WIDTH, roadWidth),
        jitterBias: 0.2,
        carvedMask: roadMask,
        removableObjects: room.objects ?? [],
      });
      carveEntranceSafetyZone(room.tiles, spawn, {
        radius: ENTRANCE_CLEAR_ZONE_RADIUS + 2,
        carvedMask: roadMask,
        removableObjects: room.objects ?? [],
      });
      reachable = floodFillWalkable(room.tiles, spawn, buildCollidableMask(room.objects ?? []));
      if (reachable.size >= minimumReachableArea) break;
    }
    console.warn('[WorldMapManager] Forest open-area connectivity repair', {
      entryId,
      reachableTiles: reachable.size,
      minimumReachableArea,
      repairedTargets: usedTargets,
    });
  }

  room.collisionMap = buildCollisionMap(room.tiles, room.objects ?? []);
  room.metadata = {
    ...(room.metadata ?? {}),
    reachability: {
      entranceReachable: reachable.has(entranceKey),
      exitReachable: reachable.has(exitKey),
      reachableTiles: reachable.size,
      minimumReachableArea,
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
    const entryAnchor = buildForestEntryAnchor(room, returnLink);
    if (entryAnchor) {
      room.entrances = room.entrances ?? {};
      room.entrances.forest_entry_from_town = {
        ...entryAnchor,
        spawn: { ...entryAnchor.landing },
      };
    }
    const entry = carveForestEntry(room, 'forest_entry_from_town', returnLink.townExitSide ?? 'top', Math.max(MIN_ROAD_WIDTH, returnLink.roadWidth ?? MIN_ROAD_WIDTH));
    const returnExitId = 'forest_exit_to_town';
    const existing = exits.find((exit) => exit.id === returnExitId);
    const landing = room?.entrances?.forest_entry_from_town?.spawn
      ?? entry?.landing
      ?? { x: Math.floor(room.tiles[0].length / 2), y: Math.floor(room.tiles.length / 2) };
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

  const normalizedRoom = {
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

  const hasStructuralForestChanges = Boolean(returnLink);
  if (!hasStructuralForestChanges && room?.__transitionCache?.spawnByEntrance instanceof Map) {
    normalizedRoom.__transitionCache = room.__transitionCache;
  } else {
    buildRoomTransitionCache(normalizedRoom, { primaryEntranceId: 'forest_entry_from_town' });
  }

  const forestTownEntrance = normalizedRoom.entrances?.forest_entry_from_town ?? null;
  if (forestTownEntrance && normalizedRoom.__transitionCache?.connectivityByEntrance instanceof Map) {
    const requested = {
      x: Math.round(forestTownEntrance.spawn?.x ?? forestTownEntrance.landingX ?? forestTownEntrance.x ?? 0),
      y: Math.round(forestTownEntrance.spawn?.y ?? forestTownEntrance.landingY ?? forestTownEntrance.y ?? 0),
    };
    const spawnKey = forestTownEntrance.id ? `entrance:${forestTownEntrance.id}` : `preferred:${requested.x},${requested.y}`;
    const diagnostics = normalizedRoom.__transitionCache.connectivityByEntrance.get(spawnKey) ?? null;
    if (!diagnostics?.connected) {
      console.error('[WorldMapManager] Forest town-linked entrance failed connectivity validation during generation', {
        roomId: normalizedRoom.id,
        entranceId: forestTownEntrance.id ?? 'forest_entry_from_town',
        requestedSpawn: diagnostics?.requested ?? requested,
        correctedSpawn: diagnostics?.corrected ?? null,
        repaired: true,
      });
      ensureForestEntranceReachable(normalizedRoom, normalizedRoom.exits, 'forest_entry_from_town', Math.max(MIN_ROAD_WIDTH, returnLink?.roadWidth ?? MIN_ROAD_WIDTH));
      buildRoomTransitionCache(normalizedRoom, { primaryEntranceId: 'forest_entry_from_town' });
    }
  }

  return normalizedRoom;
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

  loadMap(request = {}, options = {}) {
    if (!options.fromMapLoader) console.warn('[MapLoader] Illegal direct room generation detected', { caller: 'WorldMapManager.loadMap', request });
    const type = request.type ?? 'forest';
    if (type === 'town') return this.loadTown(request.seed, options);
    if (type === 'house_interior') return this.loadHouseInterior(request.seed, request.context ?? {}, options);
    return this.loadForest(request.seed, request, options);
  }

  loadTown(seed, options = {}) {
    if (!options.fromMapLoader) console.warn('[MapLoader] Illegal direct room generation detected', { caller: 'WorldMapManager.loadTown', seed });
    const mapId = this.buildTownMapId(seed);
    if (this.mapCache.has(mapId)) return this.mapCache.get(mapId);

    const town = this.townGenerator.generateTown(seed, { townType: 'forestTown' });
    town.seed = seed;
    this.installTownHouseInteractions(town);

    const forestExit = town.exits?.find((candidate) => candidate.targetMapType === 'forest');
    if (forestExit?.targetSeed) {
      const biomeId = this.buildForestBiomeId(forestExit.targetSeed);
      const { biome } = this.biomeGenerator.enterBiome(biomeId, forestExit.targetSeed, { fromMapLoader: true });
      const targetRoomId = forestExit.targetRoomId ?? biome?.startRoomId ?? null;
      if (targetRoomId) {
        forestExit.targetId = targetRoomId;
        forestExit.targetRoomId = targetRoomId;
        forestExit.targetEntryId = forestExit.targetEntryId ?? 'forest_entry_from_town';
        forestExit.targetEntranceId = forestExit.targetEntranceId ?? forestExit.targetEntryId;
        if (forestExit.interactionData) {
          forestExit.interactionData.targetId = targetRoomId;
          forestExit.interactionData.targetBiome = targetRoomId;
          forestExit.interactionData.targetRoomId = targetRoomId;
          forestExit.interactionData.targetEntryId = forestExit.targetEntryId;
          forestExit.interactionData.targetSeed = forestExit.targetSeed;
        }
      }
    }

    this.mapCache.set(mapId, town);
    return town;
  }


  loadHouseInterior(seed, context = {}, options = {}) {
    if (!options.fromMapLoader) console.warn('[MapLoader] Illegal direct room generation detected', { caller: 'WorldMapManager.loadHouseInterior', seed });
    const mapId = this.buildMapId('house', seed);
    if (this.mapCache.has(mapId)) return this.mapCache.get(mapId);
    const map = this.townGenerator.generateHouseInterior(seed, context);
    this.mapCache.set(mapId, map);
    return map;
  }

  loadForest(seed, options = {}, loaderOptions = {}) {
    if (!loaderOptions.fromMapLoader) console.warn('[MapLoader] Illegal direct room generation detected', { caller: 'WorldMapManager.loadForest', seed, roomId: options.roomId ?? null });
    const biomeId = this.buildForestBiomeId(seed);
    const biome = this.biomeGenerator.biomes.has(biomeId)
      ? this.biomeGenerator.biomes.get(biomeId)
      : this.biomeGenerator.enterBiome(biomeId, seed, { fromMapLoader: true }).biome;
    this.biomeGenerator.currentBiome = biome;
    const requestedRoomId = options.roomId ?? null;
    const canonicalPrefix = `forest-${seed}-`;
    const roomNodeId = requestedRoomId?.startsWith(canonicalPrefix)
      ? requestedRoomId.slice(canonicalPrefix.length)
      : (requestedRoomId ?? biome?.startRoomId ?? null);
    const mapId = roomNodeId ? this.buildForestMapId(seed, roomNodeId) : biomeId;

    if (options.returnLink && roomNodeId === biome?.startRoomId) {
      this.forestReturnLinks.set(biomeId, { ...options.returnLink });
    }

    if (this.mapCache.has(mapId)) {
      return this.mapCache.get(mapId);
    }

    const rememberedReturnLink = this.forestReturnLinks.get(biomeId) ?? null;
    const returnLink = roomNodeId === biome?.startRoomId ? (options.returnLink ?? rememberedReturnLink) : null;
    const roomNode = roomNodeId ? this.biomeGenerator.getRoomNode(roomNodeId) : null;
    if (roomNode && returnLink) {
      const plannedEntryAnchor = buildForestEntryAnchor({
        tiles: Array.from({ length: this.biomeGenerator.roomHeight }, () => Array.from({ length: this.biomeGenerator.roomWidth }, () => ({}))),
        entrances: roomNode.entrances,
      }, returnLink);
      roomNode.entrances = {
        ...(roomNode.entrances ?? {}),
        forest_entry_from_town: {
          ...(roomNode.entrances?.forest_entry_from_town ?? {}),
          id: 'forest_entry_from_town',
          x: plannedEntryAnchor?.x,
          y: plannedEntryAnchor?.y,
          direction: plannedEntryAnchor?.direction,
          corridorWidth: plannedEntryAnchor?.corridorWidth ?? Math.max(MIN_ROAD_WIDTH, returnLink.roadWidth ?? MIN_ROAD_WIDTH),
          landingX: plannedEntryAnchor?.landingX,
          landingY: plannedEntryAnchor?.landingY,
          spawn: plannedEntryAnchor?.spawn ? { ...plannedEntryAnchor.spawn } : undefined,
        },
      };
      console.info('[WorldMapManager] Preserving biome room cache during loadForest', {
        biomeId,
        roomId: roomNodeId,
        reason: 'normal_transition_must_not_invalidate_room_cache',
      });
    }
    const baseRoom = roomNodeId ? this.biomeGenerator.loadRoom(roomNodeId, { fromMapLoader: true }) : null;
    const room = baseRoom ? JSON.parse(JSON.stringify(baseRoom)) : null;
    const normalized = normalizeForestRoom(room, {
      biomeId,
      biomeSeed: seed,
      mapId,
      returnLink,
    });

    if (normalized && returnLink?.targetSeed) {
      const town = this.loadTown(returnLink.targetSeed, { fromMapLoader: true });
      const entryId = returnLink.targetEntryId ?? 'town_exit_main';
      const townExit = town.exits?.find((candidate) => candidate.id === entryId)
        ?? town.exits?.find((candidate) => candidate.targetMapType === 'forest');

      if (townExit?.position) {
        const landing = town.entrances?.[entryId]?.spawn
          ?? town.entrances?.[entryId]
          ?? townExit.meta?.returnPosition
          ?? townExit.position;
        town.entrances = {
          ...(town.entrances ?? {}),
          [entryId]: {
            ...(town.entrances?.[entryId] ?? {}),
            id: entryId,
            x: townExit.position.x,
            y: townExit.position.y,
            spawn: landing?.x != null && landing?.y != null ? { x: landing.x, y: landing.y } : undefined,
            landingX: landing?.x ?? townExit.position.x,
            landingY: landing?.y ?? townExit.position.y,
            direction: oppositeDirection(townExit.direction ?? 'north'),
          },
        };
        this.mapCache.set(town.id, town);
      }
    }

    if (normalized) this.mapCache.set(normalized.id, normalized);
    return normalized;
  }

  buildRequestFromRoomId(roomId) {
    if (!roomId) return null;
    if (roomId.startsWith('town-')) return { type: 'town', mapType: 'town', biomeId: 'town', seed: roomId.slice(5), roomId };
    if (roomId.startsWith('house-')) return { type: 'house_interior', mapType: 'house_interior', biomeId: 'house_interior', seed: roomId.slice(6), roomId };
    if (roomId.startsWith('forest-')) {
      const parts = roomId.split('-');
      if (parts.length >= 3) {
        const mapType = 'forest';
        const biomeId = mapType;
        return {
          type: mapType,
          mapType,
          biomeId,
          seed: parts[1],
          roomId,
        };
      }
    }
    return null;
  }

  buildRequestFromExit(currentMap, exit) {
    if (!exit) return null;
    if (exit.targetMapType === 'town') {
      return {
        type: 'town',
        mapType: 'town',
        biomeId: 'town',
        seed: exit.targetSeed,
        roomId: this.buildTownMapId(exit.targetSeed),
      };
    }
    if (exit.targetMapType === 'house_interior') {
      return {
        type: 'house_interior',
        mapType: 'house_interior',
        biomeId: 'house_interior',
        seed: exit.targetSeed,
        roomId: this.buildMapId('house', exit.targetSeed),
        context: {
          parentTownSeed: exit.meta?.parentTownSeed,
          returnEntryId: exit.meta?.returnEntryId,
          returnPosition: exit.meta?.returnPosition,
          houseId: exit.meta?.houseId,
          houseIndex: exit.meta?.houseIndex,
        },
      };
    }
    if (exit.targetMapType === 'forest' || exit.targetRoomId) {
      const forestSeed = exit.targetSeed ?? currentMap?.seed;
      const biomeMapId = this.buildForestBiomeId(forestSeed);
      const biome = this.biomeGenerator.biomes.has(biomeMapId)
        ? this.biomeGenerator.biomes.get(biomeMapId)
        : this.biomeGenerator.enterBiome(biomeMapId, forestSeed, { fromMapLoader: true }).biome;
      const roomNodeId = exit.targetRoomId ?? biome?.startRoomId ?? null;
      if (!roomNodeId) return null;
      const mapType = 'forest';
      const biomeId = mapType;
      const canonicalRoomId = `${biomeId}-${forestSeed}-${roomNodeId}`;
      const returnLink = currentMap?.type === 'town'
        ? {
          targetSeed: currentMap.seed,
          targetEntryId: exit.id,
          townExitSide: exit.meta?.exitSide ?? currentMap.metadata?.townExitSide ?? 'top',
          townExitPosition: exit.position ?? exit.meta?.townExitPosition ?? currentMap.metadata?.townExitPosition ?? null,
          roadWidth: exit.width ?? exit.meta?.roadWidth ?? 3,
        }
        : null;
      return {
        type: mapType,
        mapType,
        biomeId,
        seed: forestSeed,
        roomId: canonicalRoomId,
        returnLink,
      };
    }
    return null;
  }

  resolveMapByExit(currentMap, exit, options = {}) {
    if (!options.fromMapLoader) console.warn('[MapLoader] Illegal direct room generation detected', { caller: 'WorldMapManager.resolveMapByExit', exitId: exit?.id ?? null });
    if (exit?.targetMapType === 'town') {
      const townMapId = this.buildTownMapId(exit.targetSeed);
      const town = this.mapCache.get(townMapId) ?? this.loadTown(exit.targetSeed, { fromMapLoader: true });
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
      }, { fromMapLoader: true });
    }

    if (exit?.targetRoomId) {
      const forestSeed = exit.targetSeed ?? currentMap.seed;
      const forestMapId = this.buildForestMapId(forestSeed, exit.targetRoomId);
      const returnLink = currentMap.type === 'town'
        ? {
          targetSeed: currentMap.seed,
          targetEntryId: exit.id,
          townExitSide: exit.meta?.exitSide ?? currentMap.metadata?.townExitSide ?? 'top',
          townExitPosition: exit.position ?? exit.meta?.townExitPosition ?? currentMap.metadata?.townExitPosition ?? null,
          roadWidth: exit.width ?? exit.meta?.roadWidth ?? 3,
        }
        : null;
      const cachedMap = this.mapCache.get(forestMapId) ?? null;
      if (cachedMap) return cachedMap;
      return this.loadForest(forestSeed, {
        roomId: exit.targetRoomId,
        returnLink,
      }, { fromMapLoader: true });
    }

    if (exit?.targetMapType === 'forest') {
      const targetRoomId = exit.targetRoomId ?? null;
      const forestMapId = targetRoomId ? this.buildForestMapId(exit.targetSeed, targetRoomId) : null;
      const cachedMap = forestMapId ? this.mapCache.get(forestMapId) : null;
      if (cachedMap) return cachedMap;
      return this.loadForest(exit.targetSeed, {
        roomId: targetRoomId,
        returnLink: {
          targetSeed: currentMap.seed,
          targetEntryId: exit.id,
          townExitSide: exit.meta?.exitSide ?? currentMap.metadata?.townExitSide ?? 'top',
          roadWidth: exit.width ?? exit.meta?.roadWidth ?? 3,
        },
      }, { fromMapLoader: true });
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
