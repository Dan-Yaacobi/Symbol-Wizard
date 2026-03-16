import { generateWorldGraph } from './WorldGraphGenerator.js';

export function generateBiomeGraph({ seed, roomWidth, roomHeight, biomeConfig } = {}) {
  return generateWorldGraph({
    seed,
    roomWidth,
    roomHeight,
    biomeConfig,
  });
}
