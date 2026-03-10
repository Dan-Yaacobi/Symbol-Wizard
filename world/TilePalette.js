import { palette } from '../entities/SpriteLibrary.js';

export const tiles = {
  wall: { char: '#', fg: palette.wallFg, bg: palette.wallBg, walkable: false },
  floor: { char: '.', fg: palette.floorFg, bg: palette.floorBg, walkable: true },
  wood: { char: '+', fg: '#9d7444', bg: palette.floorBg, walkable: false },
};
