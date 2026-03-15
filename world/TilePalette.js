import { palette } from '../entities/SpriteLibrary.js';
import { visualTheme } from '../data/VisualTheme.js';

const c = visualTheme.colors;

export const tiles = {
  grass: { char: ' ', fg: c.grassFg, bg: c.grassBg, walkable: true },
  grassDark: { char: ' ', fg: '#356949', bg: '#0f1f17', walkable: true },
  dirt: { char: '.', fg: c.dirtFg, bg: c.dirtBg, walkable: true },
  dirtEdge: { char: ',', fg: '#af8d69', bg: '#433126', walkable: true },
  pathPebble: { char: '.', fg: '#d5bc98', bg: c.dirtBg, walkable: true },
  water: { char: '~', fg: c.waterFg, bg: c.waterBg, walkable: false },
  fence: { char: '|', fg: c.woodFg, bg: c.grassBg, walkable: false },
  wall: { char: '#', fg: palette.wallFg, bg: palette.wallBg, walkable: false },
  denseTree: { char: '♣', fg: c.treeFg, bg: '#0a1710', walkable: false },
  denseTreeSpire: { char: '♠', fg: c.treeDarkFg, bg: '#09130d', walkable: false },
  denseTreeBloom: { char: '♣', fg: '#70b573', bg: '#0f1a13', walkable: false },
  denseTreeCanopy: { char: '♠', fg: '#427b4a', bg: '#09130d', walkable: false },
  denseTreeShadow: { char: '♠', fg: '#345f3a', bg: '#060d09', walkable: false },
  rockCliff: { char: '▲', fg: '#8b96a3', bg: '#2b3240', walkable: false },
  deepWater: { char: '≈', fg: '#79bdf2', bg: '#10263b', walkable: false },
  stoneWall: { char: '▓', fg: '#8f96a3', bg: '#333b49', walkable: false },
  floor: { char: '.', fg: palette.floorFg, bg: palette.floorBg, walkable: true },
  wood: { char: '+', fg: c.woodFg, bg: palette.floorBg, walkable: false },
};

export function tileFrom(base, overrides = {}) {
  return { ...base, ...overrides };
}
