import { RoomGenerator } from './RoomGenerator.js';

export function generateRoomInstance({
  roomNode,
  roomWidth = 240,
  roomHeight = 160,
  biomeConfig = null,
} = {}) {
  const generator = new RoomGenerator({ roomWidth, roomHeight, biomeConfig });
  return generator.generate(roomNode);
}
