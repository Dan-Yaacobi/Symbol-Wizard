import { tiles } from './TilePalette.js';

export function generateDungeon(width, height) {
  const map = Array.from({ length: height }, () => Array.from({ length: width }, () => ({ ...tiles.wall })));

  const room = { x: 6, y: 6, w: width - 12, h: height - 12 };
  for (let y = room.y; y < room.y + room.h; y += 1) {
    for (let x = room.x; x < room.x + room.w; x += 1) map[y][x] = { ...tiles.floor };
  }

  for (let i = 0; i < 1400; i += 1) {
    const x = 10 + Math.floor(Math.random() * (width - 20));
    const y = 10 + Math.floor(Math.random() * (height - 20));
    if (Math.random() < 0.08) map[y][x] = { ...tiles.wood };
  }

  return map;
}
