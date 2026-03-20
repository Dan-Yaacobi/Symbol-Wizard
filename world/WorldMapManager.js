import { TownGenerator } from './TownGenerator.js';
import { hashSeed } from './SeededRandom.js';

function cloneExit(exit) {
  return {
    ...exit,
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
    const returnExitId = 'forest-town-return';
    const existing = exits.find((exit) => exit.id === returnExitId);
    if (!existing) {
      const spawn = room?.entrances?.['initial-spawn']?.spawn ?? { x: Math.floor(room.tiles[0].length / 2), y: Math.floor(room.tiles.length / 2) };
      exits.push({
        id: returnExitId,
        position: { x: spawn.x, y: Math.max(1, spawn.y - 2) },
        targetMapType: 'town',
        targetSeed: returnLink.targetSeed,
        targetEntryId: returnLink.targetEntryId,
        width: 2,
      });
      exitCorridors.push({
        exitId: returnExitId,
        triggerTiles: [
          { x: spawn.x, y: Math.max(1, spawn.y - 2) },
          { x: spawn.x - 1, y: Math.max(1, spawn.y - 2) },
          { x: spawn.x + 1, y: Math.max(1, spawn.y - 2) },
        ],
      });
    }
  }

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
    const town = this.townGenerator.generateTown(seed);
    this.installTownHouseInteractions(town);
    this.mapCache.set(mapId, town);
    return town;
  }

  installTownHouseInteractions(town) {
    for (const object of town.objects ?? []) {
      if (!object.enterable || !object.mapRef) continue;
      object.interact = ({ transitionSystem } = {}) => {
        const targetSeed = object.mapRef.targetSeed;
        console.log('Entering house', object.id, targetSeed);
        transitionSystem?.requestTransition({
          id: `${object.id}-enter`,
          position: { ...object.door },
          targetMapType: 'house_interior',
          targetSeed,
          targetEntryId: 'house-door',
          meta: {
            houseId: object.id,
            parentTownSeed: town.seed,
            houseIndex: Number.parseInt(String(object.id).split('-').pop(), 10) || 0,
            returnPosition: { x: object.door.x, y: object.door.y + 2 },
            returnMapId: town.id,
            returnEntryId: `return-${object.id}`,
          },
        });
      };
    }
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
          targetEntryId: exit.targetEntryId ?? 'initial-spawn',
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

  deriveForestSeedFromTown(townSeed, exitIndex = 0) {
    return hashSeed(townSeed, 'forest-exit', exitIndex);
  }
}
