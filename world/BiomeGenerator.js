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
  constructor({ roomWidth = 240, roomHeight = 160 } = {}) {
    this.roomWidth = roomWidth;
    this.roomHeight = roomHeight;
    this.biomes = new Map();
    this.currentBiome = null;
    this.roomCache = new Map();
  }

  enterBiome(biomeId, seed = randomSeed()) {
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
    this.roomCache.clear();

    const startRoom = this.loadRoom(this.currentBiome.startRoomId);
    return {
      biome: this.currentBiome,
      startRoom,
    };
  }


  logStartRoomDebug(biome) {
    const startRoomNode = biome?.rooms?.get(biome.startRoomId);
    if (!startRoomNode) {
      console.debug('[BiomeGenerator] start room missing', { startRoomId: biome?.startRoomId ?? null });
      return;
    }

    console.debug('[BiomeGenerator] start room debug', {
      startRoomId: biome.startRoomId,
      exits: Object.keys(startRoomNode.exits),
      entrances: Object.keys(startRoomNode.entrances),
      exitCoordinates: Object.entries(startRoomNode.exits).map(([exitId, anchor]) => ({
        exitId,
        x: anchor.x,
        y: anchor.y,
        direction: anchor.direction,
      })),
      startRoomConnections: startRoomNode.connections.map((connection) => ({ ...connection })),
    });
  }

  getRoomNode(roomId) {
    return this.currentBiome?.rooms.get(roomId) ?? null;
  }

  loadRoom(roomId) {
    if (this.roomCache.has(roomId)) return this.roomCache.get(roomId);

    const roomNode = this.getRoomNode(roomId);
    if (!roomNode) return null;

    const room = generateRoomInstance({
      roomNode,
      roomWidth: this.roomWidth,
      roomHeight: this.roomHeight,
      biomeConfig: this.currentBiome?.biomeConfig,
    });

    this.roomCache.set(roomId, room);
    return room;
  }
}
