import { RoomGenerator } from './RoomGenerator.js';

export function generateRoomInstance({
  roomNode,
  rooms,
  roomGraph,
  roomWidth = 240,
  roomHeight = 160,
  biomeConfig = null,
  runtimeConfig = null,
} = {}) {
  const generator = new RoomGenerator({ roomWidth, roomHeight, biomeConfig, runtimeConfig });
  return generator.generate(roomNode, { rooms, roomGraph });
}
