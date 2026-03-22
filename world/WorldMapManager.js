import { TownGenerator } from './TownGenerator.js';
import { tiles } from './TilePalette.js';
import { buildCollidableMask, carvePath, floodFillWalkable, nearestReachablePoint } from './PathConnectivity.js';
import { connectRegions, deriveForestSeedFromTown, normalizeExit } from './RegionGenerationSystem.js';

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

function carveForestEntry(room, entryId, direction, roadWidth = 3) {
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
  const halfWidth = Math.max(1, Math.floor(roadWidth / 2));
  const triggerTiles = [];

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

  for (let oy = -3; oy <= 3; oy += 1) {
    for (let ox = -3; ox <= 3; ox += 1) {
      const tx = landing.x + ox;
      const ty = landing.y + oy;
      if (!room.tiles[ty]?.[tx]) continue;
      if ((ox * ox) + (oy * oy) > 10) continue;
      room.tiles[ty][tx] = cloneTile(Math.abs(ox) === 3 || Math.abs(oy) === 3 ? tiles.dirtEdge : tiles.dirt);
    }
  }

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


function ensureForestEntranceReachable(room, exits, entryId, roadWidth = 3) {
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
      width: Math.max(3, roadWidth),
      jitterBias: 0.24,
      carvedMask: roadMask,
      removableObjects: room.objects ?? [],
    });
    reachable = floodFillWalkable(room.tiles, spawn, buildCollidableMask(room.objects ?? []));
  }

  if (!reachable.has(exitKey)) {
    console.warn('[WorldMapManager] Forest town exit connectivity repair', { entryId, exitId: exit?.id ?? null });
    carvePath(room.tiles, spawn, exitPoint, {
      width: Math.max(3, roadWidth),
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

function normalizeForestRoom(room, { biomeId, biomeSeed, returnLink = null } = {}) {
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
    const entry = carveForestEntry(room, 'forest_entry_from_town', returnLink.townExitSide ?? 'top', returnLink.roadWidth ?? 3);
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
        width: Math.max(2, returnLink.roadWidth ?? 3),
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

  const reachability = ensureForestEntranceReachable(room, exits, 'forest_entry_from_town', returnLink?.roadWidth ?? 3);

  return {
    ...room,
    id: `${biomeId}:${room.id}`,
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
  }

  buildMapId(type, seed, suffix = '') {
    return `${type}-${seed}${suffix ? `-${suffix}` : ''}`;
  }

  enterStartingWorld(seed) {
    return this.loadMap({ type: 'town', seed });
  }

  regenerate(seed) {
    this.mapCache.clear();
    return this.enterStartingWorld(seed);
  }

  loadMap(request = {}) {
    const type = request.type ?? 'forest';
    if (type === 'town') return this.loadTown(request.seed);
    if (type === 'house_interior') return this.loadHouseInterior(request.seed, request.context ?? {});
    return this.loadForest(request.seed, request);
  }

  loadTown(seed) {
    const mapId = this.buildMapId('town', seed);
    if (this.mapCache.has(mapId)) return this.mapCache.get(mapId);
    const town = this.townGenerator.generateTown(seed, { townType: 'forestTown' });
    this.installTownHouseInteractions(town);
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
    const biomeId = this.buildMapId('forest-biome', seed);
    const roomId = options.roomId ?? null;
    this.biomeGenerator.enterBiome(biomeId, seed);
    const room = roomId ? this.biomeGenerator.loadRoom(roomId) : this.biomeGenerator.loadRoom(this.biomeGenerator.currentBiome?.startRoomId);
    const normalized = normalizeForestRoom(room, {
      biomeId,
      biomeSeed: seed,
      returnLink: options.returnLink ?? null,
    });
    if (normalized && options.returnLink?.targetSeed) {
      const town = this.loadTown(options.returnLink.targetSeed);
      connectRegions({ fromRegion: town, toRegion: normalized, options: { debug: this.runtimeConfig?.get?.('generation.debug') ?? false, fromExit: town.exits?.[0], toExit: normalized.exits?.find((exit) => exit.targetMapType === 'town') ?? normalized.exits?.[0] } });
      this.mapCache.set(town.id, town);
    }
    if (normalized) this.mapCache.set(normalized.id, normalized);
    return normalized;
  }

  resolveMapByExit(currentMap, exit) {
    if (exit?.targetMapType === 'town') {
      const town = this.loadTown(exit.targetSeed);
      if (exit.targetEntryId && exit.meta?.returnPosition) {
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

    if (exit?.targetMapType === 'forest') {
      return this.loadForest(exit.targetSeed, {
        returnLink: {
          targetSeed: currentMap.seed,
          targetEntryId: 'town_exit_main',
          townExitSide: exit.meta?.exitSide ?? currentMap.metadata?.townExitSide ?? 'top',
          roadWidth: exit.width ?? exit.meta?.roadWidth ?? 3,
        },
      });
    }

    if (exit?.targetRoomId) {
      return this.loadForest(currentMap.seed, {
        roomId: exit.targetRoomId,
        returnLink: currentMap.type === 'town' ? { targetSeed: currentMap.seed, targetEntryId: exit.targetEntryId } : null,
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
}
installTownHouseInteractions(town) {
  if (!town || !Array.isArray(town.objects)) return;

  town.exits = town.exits ?? [];

  const houseObjects = town.objects.filter(
    (obj) =>
      obj?.type === 'house' ||
      obj?.tags?.includes?.('house') ||
      obj?.category === 'building'
  );

  let houseIndex = 0;

  for (const house of houseObjects) {
    // Try to find door position
    const door = house.door ?? house.entrance ?? null;

    if (!door) continue;

    const doorX = Math.round(house.x + (door.x ?? 0));
    const doorY = Math.round(house.y + (door.y ?? 0));

    const exitId = `house_exit_${houseIndex}`;

    const exit = {
      id: exitId,
      category: 'interactable',
      isInteractable: true,
      interactionType: 'exit',
      interactionMode: 'button', // important: not touch
      interactionPriority: 90,

      position: { x: doorX, y: doorY },

      targetMapType: 'house_interior',
      targetSeed: `${town.seed}-${houseIndex}`,

      interactionData: {
        targetMap: 'house_interior',
        targetId: null,
        targetEntryId: 'house_entry',
        meta: {
          parentTownSeed: town.seed,
          returnEntryId: exitId,
          returnPosition: { x: doorX, y: doorY },
          houseIndex,
        },
      },
    };

    town.exits.push(exit);

    houseIndex++;
  }
}
