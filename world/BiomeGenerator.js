import { generateBiomeGraph } from './BiomeGraphGenerator.js';
import { generateRoomInstance } from './RoomInstanceGenerator.js';
import { resolveBiomeConfig } from './BiomeConfig.js';

function randomSeed() {
  return Math.floor(Math.random() * 0x7fffffff);
}

function resolveBiomeType(biomeId) {
  const id = `${biomeId ?? ''}`.toLowerCase();
  if (id.includes('mountain')) return 'mountain';
  if (id.includes('river') || id.includes('water')) return 'river';
  if (id.includes('cave') || id.includes('dungeon')) return 'cave';
  return 'forest';
}

export class BiomeGenerator {
  constructor({ roomWidth = 240, roomHeight = 160, runtimeConfig = null } = {}) {
    this.roomWidth = roomWidth;
    this.roomHeight = roomHeight;
    this.runtimeConfig = runtimeConfig;
    this.biomes = new Map();
    this.currentBiome = null;
    this.roomCache = new Map();
  }

  roomCacheKey(roomId, biomeId = this.currentBiome?.biomeId ?? null) {
    if (!biomeId || !roomId) return null;
    return `${biomeId}::${roomId}`;
  }

  logRoomCache(event, { roomId = null, biomeId = this.currentBiome?.biomeId ?? null, caller = 'unknown', reason = null, hit = null } = {}) {
    const timestamp = new Date().toISOString();
    console.info('[BiomeGenerator][RoomCache]', {
      event,
      roomId,
      biomeId,
      timestamp,
      caller,
      reason,
      hit,
      size: this.roomCache.size,
    });
  }

  getCachedRoom(roomId, { biomeId = this.currentBiome?.biomeId ?? null, caller = 'unknown' } = {}) {
    const cacheKey = this.roomCacheKey(roomId, biomeId);
    if (!cacheKey) {
      this.logRoomCache('get', { roomId, biomeId, caller, reason: 'invalid_cache_key', hit: false });
      return null;
    }
    const room = this.roomCache.get(cacheKey) ?? null;
    this.logRoomCache('get', { roomId, biomeId, caller, hit: Boolean(room) });
    return room;
  }

  cacheRoom(roomId, room, { biomeId = this.currentBiome?.biomeId ?? null, caller = 'unknown' } = {}) {
    const cacheKey = this.roomCacheKey(roomId, biomeId);
    if (!cacheKey || !room) {
      this.logRoomCache('set', { roomId, biomeId, caller, reason: 'invalid_cache_set' });
      return;
    }
    this.roomCache.set(cacheKey, room);
    this.logRoomCache('set', { roomId, biomeId, caller });
  }

  clearRoomCache({ caller = 'unknown', reason = 'unspecified', biomeId = this.currentBiome?.biomeId ?? null } = {}) {
    this.logRoomCache('clear', { roomId: '*', biomeId, caller, reason });
    this.roomCache.clear();
  }

  hasCachedRoom(roomId, { biomeId = this.currentBiome?.biomeId ?? null } = {}) {
    const cacheKey = this.roomCacheKey(roomId, biomeId);
    return cacheKey ? this.roomCache.has(cacheKey) : false;
  }

  enterBiome(biomeId, seed = randomSeed(), _options = {}) {
    const alreadyLoaded = this.biomes.has(biomeId);
    console.info('[BiomeGenerator] enterBiome', {
      biomeId,
      seed,
      timestamp: new Date().toISOString(),
      alreadyLoaded,
    });

    if (!this.biomes.has(biomeId)) {
      const biomeType = resolveBiomeType(biomeId);
      const biomeConfig = resolveBiomeConfig(biomeType);
      const graph = generateBiomeGraph({
        seed,
        roomWidth: this.roomWidth,
        roomHeight: this.roomHeight,
        biomeConfig,
      });

      const biome = {
        biomeId,
        biomeType,
        biomeConfig,
        seed,
        rooms: graph.rooms,
        roomGraph: graph.roomGraph,
        startRoomId: graph.startRoomId,
      };

      for (const roomNode of biome.rooms.values()) {
        roomNode.biomeType = biome.biomeType;
        roomNode.biomeConfig = biome.biomeConfig;
      }

      this.biomes.set(biomeId, biome);
    }

    this.currentBiome = this.biomes.get(biomeId);
    this.logStartRoomDebug(this.currentBiome);
    console.info('[BiomeGenerator] enterBiome cache-clear check', {
      biomeId,
      seed,
      didClear: false,
      reason: 'normal_biome_entry_must_preserve_room_cache',
    });

    return {
      biome: this.currentBiome,
      startRoom: null,
    };
  }

  regenerateBiome(biomeId, seed = randomSeed(), options = {}) {
    this.biomes.delete(biomeId);
    this.clearRoomCache({ caller: 'regenerateBiome', reason: 'explicit_reset_event', biomeId });
    return this.enterBiome(biomeId, seed, options);
  }


  logStartRoomDebug(biome) {
    const startRoomNode = biome?.rooms?.get(biome.startRoomId);
    if (!startRoomNode) {
      console.debug('[BiomeGenerator] start room missing', { startRoomId: biome?.startRoomId ?? null });
      return;
    }

    console.debug('[BiomeGenerator] start room debug', {
      startRoomId: biome.startRoomId,
      connections: startRoomNode.connections.map((connection) => ({
        exitId: connection.exitId,
        direction: connection.direction,
        targetRoomId: connection.targetRoomId,
      })),
      entrances: Object.keys(startRoomNode.entrances),
      startRoomConnections: startRoomNode.connections.map((connection) => ({ ...connection })),
    });
  }

  getRoomNode(roomId) {
    return this.currentBiome?.rooms.get(roomId) ?? null;
  }

  loadRoom(roomId, options = {}) {
    if (!options.fromMapLoader) {
      console.warn('[MapLoader] Illegal direct room generation detected', { caller: 'BiomeGenerator.loadRoom', roomId });
      return null;
    }
    const cachedRoom = this.getCachedRoom(roomId, { caller: 'loadRoom' });
    if (cachedRoom) return cachedRoom;

    const roomNode = this.getRoomNode(roomId);
    if (!roomNode) return null;

    const room = generateRoomInstance({
      roomNode,
      rooms: this.currentBiome?.rooms,
      roomGraph: this.currentBiome?.roomGraph,
      roomWidth: this.roomWidth,
      roomHeight: this.roomHeight,
      biomeConfig: this.currentBiome?.biomeConfig,
      runtimeConfig: this.runtimeConfig,
    });

    this.cacheRoom(roomId, room, { caller: 'loadRoom' });
    return room;
  }
}
