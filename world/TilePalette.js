import { palette } from '../entities/SpriteLibrary.js';

export const tiles = {
  grass: { char: ' ', fg: '#255233', bg: '#123522', walkable: true },
  grassDark: { char: ' ', fg: '#1f472c', bg: '#0f2e1d', walkable: true },
  dirt: { char: '.', fg: '#d8b786', bg: '#5c4029', walkable: true },
  dirtEdge: { char: ',', fg: '#c29b69', bg: '#4f3522', walkable: true },
  pathPebble: { char: '.', fg: '#e2c99e', bg: '#63452d', walkable: true },
  water: { char: '~', fg: '#65b8ff', bg: '#17304f', walkable: false },
  fence: { char: '|', fg: '#cfa77a', bg: '#173823', walkable: false },
  wall: { char: '#', fg: palette.wallFg, bg: palette.wallBg, walkable: false },
  floor: { char: '.', fg: palette.floorFg, bg: palette.floorBg, walkable: true },
  wood: { char: '+', fg: '#9d7444', bg: palette.floorBg, walkable: false },
};
