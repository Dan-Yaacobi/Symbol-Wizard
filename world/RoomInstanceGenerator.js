import { RoomGenerator } from './RoomGenerator.js';

export function generateRoomInstance({
  roomNode,
  roomWidth = 240,
  roomHeight = 160,
} = {}) {
  const generator = new RoomGenerator({ roomWidth, roomHeight });
  return generator.generate(roomNode);
}
