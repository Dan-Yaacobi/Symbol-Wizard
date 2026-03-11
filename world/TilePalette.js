import { palette } from '../entities/SpriteLibrary.js';

export const tiles = {
  grass: { char: '"', fg: '#4eca5d', bg: '#173823', walkable: true },
  grassDark: { char: ',', fg: '#3fbd55', bg: '#16311f', walkable: true },
  dirt: { char: '.', fg: '#c79a5d', bg: '#4a2f1e', walkable: true },
  dirtEdge: { char: ',', fg: '#af8450', bg: '#3f2819', walkable: true },
  pathPebble: { char: ':', fg: '#b18758', bg: '#4a2f1e', walkable: true },
  water: { char: '~', fg: '#65b8ff', bg: '#17304f', walkable: false },
  fence: { char: '|', fg: '#cfa77a', bg: '#173823', walkable: false },
  wall: { char: '#', fg: palette.wallFg, bg: palette.wallBg, walkable: false },
  floor: { char: '.', fg: palette.floorFg, bg: palette.floorBg, walkable: true },
  wood: { char: '+', fg: '#9d7444', bg: palette.floorBg, walkable: false },
};
