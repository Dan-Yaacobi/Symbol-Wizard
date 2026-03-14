import { generateRoomGraph } from './RoomGraphGenerator.js';

export function generateBiomeGraph({ seed, roomWidth, roomHeight, biomeConfig } = {}) {
  return generateRoomGraph({
    seed,
    roomWidth,
    roomHeight,
    biomeConfig,
  });
}
