import { generateRoomGraph } from './RoomGraphGenerator.js';
import { generateRoomInstance } from './RoomInstanceGenerator.js';

function randomSeed() {
  return Math.floor(Math.random() * 0x7fffffff);
}

export class BiomeGenerator {
  constructor({ roomWidth = 64, roomHeight = 40 } = {}) {
    this.roomWidth = roomWidth;
    this.roomHeight = roomHeight;
    this.biomes = new Map();
    this.currentBiome = null;
    this.roomCache = new Map();
  }

  enterBiome(biomeId, seed = randomSeed()) {
    if (!this.biomes.has(biomeId)) {
      const graph = generateRoomGraph({
        seed,
        roomWidth: this.roomWidth,
        roomHeight: this.roomHeight,
      });

      const biome = {
        biomeId,
        seed,
        rooms: graph.rooms,
        startRoomId: graph.startRoomId,
      };

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
      startRoomExits: Object.entries(startRoomNode.exits).map(([exitId, anchor]) => ({ exitId, ...anchor })),
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
    });

    this.roomCache.set(roomId, room);
    return room;
  }
}
