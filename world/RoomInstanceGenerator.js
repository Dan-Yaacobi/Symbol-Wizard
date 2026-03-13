import { tiles } from './TilePalette.js';

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cloneTile(tile) {
  return { ...tile };
}

function baseRoomTiles(width, height, rng) {
  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => cloneTile(tiles.floor)));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (edge) {
        grid[y][x] = cloneTile(tiles.wall);
        continue;
      }

      if (rng() < 0.07) grid[y][x].char = ',';
    }
  }

  return grid;
}

function markAnchorTile(tileMap, anchor, tileType, id) {
  const tile = {
    ...tiles.floor,
    char: tileType === 'exit' ? '>' : '<',
    fg: tileType === 'exit' ? '#f2d67f' : '#8edcf4',
    bg: '#1f2430',
    walkable: true,
    type: tileType,
    id,
    direction: anchor.direction,
  };
  tileMap[anchor.y][anchor.x] = tile;
}

export function generateRoomInstance({
  roomNode,
  roomWidth = 64,
  roomHeight = 40,
} = {}) {
  const rng = createRng(roomNode.seed >>> 0);
  const tilesGrid = baseRoomTiles(roomWidth, roomHeight, rng);

  for (const [entranceId, entrance] of Object.entries(roomNode.entrances)) {
    markAnchorTile(tilesGrid, entrance, 'entrance', entranceId);
  }

  for (const [exitId, exit] of Object.entries(roomNode.exits)) {
    markAnchorTile(tilesGrid, exit, 'exit', exitId);
  }

  return {
    id: roomNode.id,
    tiles: tilesGrid,
    entities: [],
    entrances: structuredClone(roomNode.entrances),
    exits: structuredClone(roomNode.exits),
    state: {
      visited: roomNode.state?.visited ?? false,
    },
  };
}
