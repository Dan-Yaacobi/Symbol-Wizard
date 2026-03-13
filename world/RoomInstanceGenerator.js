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
      if (rng() < 0.07) grid[y][x].char = ',';
    }
  }

  return grid;
}

function carveFloor(tileMap, x, y) {
  const row = tileMap[y];
  if (!row || !row[x]) return false;
  row[x] = cloneTile(tiles.floor);
  return true;
}

function carvePathToAnchor(tileMap, start, anchor) {
  let x = start.x;
  let y = start.y;

  while (x !== anchor.x) {
    x += x < anchor.x ? 1 : -1;
    carveFloor(tileMap, x, y);
  }

  while (y !== anchor.y) {
    y += y < anchor.y ? 1 : -1;
    carveFloor(tileMap, x, y);
  }
}

function carveExitOpening(tileMap, anchor) {
  const horizontalOpening = anchor.direction === 'north' || anchor.direction === 'south';

  for (let offset = -1; offset <= 1; offset += 1) {
    const x = horizontalOpening ? anchor.x + offset : anchor.x;
    const y = horizontalOpening ? anchor.y : anchor.y + offset;
    carveFloor(tileMap, x, y);

    if (horizontalOpening) {
      carveFloor(tileMap, x, anchor.y - 1);
      carveFloor(tileMap, x, anchor.y + 1);
    } else {
      carveFloor(tileMap, anchor.x - 1, y);
      carveFloor(tileMap, anchor.x + 1, y);
    }
  }
}

function carveAnchorTile(tileMap, anchor) {
  return carveFloor(tileMap, anchor.x, anchor.y);
}

function markAnchorTile(tileMap, anchor, tileType, id) {
  if (!carveAnchorTile(tileMap, anchor)) return;

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
  roomWidth = 120,
  roomHeight = 80,
} = {}) {
  const rng = createRng(roomNode.seed >>> 0);
  const tilesGrid = baseRoomTiles(roomWidth, roomHeight, rng);
  const center = {
    x: Math.floor(roomWidth / 2),
    y: Math.floor(roomHeight / 2),
  };

  for (const exit of Object.values(roomNode.exits)) {
    carvePathToAnchor(tilesGrid, center, exit);
    carveExitOpening(tilesGrid, exit);
  }

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
