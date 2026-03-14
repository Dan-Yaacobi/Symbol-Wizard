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
  denseTree: { char: '♣', fg: '#3f8f4d', bg: '#0a1a10', walkable: false },
  denseTreeSpire: { char: '♠', fg: '#2d7a3e', bg: '#08160d', walkable: false },
  denseTreeBloom: { char: '♧', fg: '#4a9c58', bg: '#0c1f13', walkable: false },
  denseTreeCanopy: { char: '♤', fg: '#2f6f3b', bg: '#061008', walkable: false },
  denseTreeShadow: { char: '♠', fg: '#245f33', bg: '#050d07', walkable: false },
  rockCliff: { char: '▲', fg: '#8b8f96', bg: '#2a2f37', walkable: false },
  deepWater: { char: '≈', fg: '#4ea4ff', bg: '#0e2741', walkable: false },
  stoneWall: { char: '▓', fg: '#969696', bg: '#2f2f2f', walkable: false },
  floor: { char: '.', fg: palette.floorFg, bg: palette.floorBg, walkable: true },
  wood: { char: '+', fg: '#9d7444', bg: palette.floorBg, walkable: false },
};
