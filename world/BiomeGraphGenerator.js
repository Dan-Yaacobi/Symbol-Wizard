import { generateRoomGraph } from './RoomGraphGenerator.js';

export function generateBiomeGraph({ seed, roomWidth, roomHeight } = {}) {
  return generateRoomGraph({
    seed,
    roomWidth,
    roomHeight,
  });
}
