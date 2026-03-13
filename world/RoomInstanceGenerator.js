import { tiles } from './TilePalette.js';

const biomeWallTypes = {
  forest: 'denseTree',
  mountain: 'rockCliff',
  river: 'deepWater',
  cave: 'stoneWall',
};

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

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function chooseBiomeWallTile(roomNode) {
  const biomeType = roomNode.biomeType ?? 'forest';
  const tileKey = biomeWallTypes[biomeType] ?? biomeWallTypes.forest;
  return tiles[tileKey] ?? tiles.wall;
}

function tileMapWithBiomeBoundary(width, height, wallTile) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => cloneTile(wallTile)));
}

function generatePolygonVertices(width, height, rng) {
  const center = {
    x: Math.floor(width / 2),
    y: Math.floor(height / 2),
  };

  const vertexCount = randomInt(rng, 10, 16);
  const minRadiusX = width * 0.28;
  const maxRadiusX = width * 0.44;
  const minRadiusY = height * 0.28;
  const maxRadiusY = height * 0.44;
  const baseAngle = rng() * Math.PI * 2;

  const vertices = [];
  for (let i = 0; i < vertexCount; i += 1) {
    const t = i / vertexCount;
    const angleJitter = (rng() - 0.5) * (Math.PI / vertexCount);
    const angle = baseAngle + t * Math.PI * 2 + angleJitter;

    const radiusX = minRadiusX + (maxRadiusX - minRadiusX) * (0.2 + rng() * 0.8);
    const radiusY = minRadiusY + (maxRadiusY - minRadiusY) * (0.2 + rng() * 0.8);

    const x = Math.round(center.x + Math.cos(angle) * radiusX);
    const y = Math.round(center.y + Math.sin(angle) * radiusY);

    vertices.push({
      x: Math.max(2, Math.min(width - 3, x)),
      y: Math.max(2, Math.min(height - 3, y)),
    });
  }

  return vertices;
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function paintPolygonFloor(tileMap, polygon, rng) {
  for (let y = 0; y < tileMap.length; y += 1) {
    for (let x = 0; x < tileMap[0].length; x += 1) {
      if (!pointInPolygon(x + 0.5, y + 0.5, polygon)) continue;
      tileMap[y][x] = cloneTile(tiles.floor);
      if (rng() < 0.07) tileMap[y][x].char = ',';
    }
  }
}

function carveFloor(tileMap, x, y) {
  const row = tileMap[y];
  if (!row || !row[x]) return false;
  row[x] = cloneTile(tiles.floor);
  return true;
}

function carveFloorCircle(tileMap, x, y, radius = 2) {
  for (let oy = -radius; oy <= radius; oy += 1) {
    for (let ox = -radius; ox <= radius; ox += 1) {
      if (ox * ox + oy * oy > radius * radius) continue;
      carveFloor(tileMap, x + ox, y + oy);
    }
  }
}

function carveRoadToAnchor(tileMap, start, anchor, rng, {
  minRadius = 2,
  maxRadius = 3,
  exitRadius = 4,
} = {}) {
  const position = { x: start.x, y: start.y };
  const totalDistance = Math.max(1, Math.hypot(anchor.x - start.x, anchor.y - start.y));
  const maxSteps = Math.ceil(totalDistance * 1.75);
  const initialRadius = randomInt(rng, minRadius, maxRadius);

  carveFloorCircle(tileMap, Math.round(position.x), Math.round(position.y), initialRadius);

  for (let step = 0; step < maxSteps; step += 1) {
    const dx = anchor.x - position.x;
    const dy = anchor.y - position.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1.2) break;

    const towardX = dx / distance;
    const towardY = dy / distance;
    const lateralScale = Math.min(0.35, distance / 60);
    const lateralJitter = (rng() - 0.5) * lateralScale;

    let stepX = towardX - towardY * lateralJitter;
    let stepY = towardY + towardX * lateralJitter;
    const stepMagnitude = Math.hypot(stepX, stepY) || 1;
    const stepLength = 0.9 + rng() * 0.7;

    stepX = (stepX / stepMagnitude) * stepLength;
    stepY = (stepY / stepMagnitude) * stepLength;

    position.x += stepX;
    position.y += stepY;

    const progress = 1 - Math.min(1, distance / totalDistance);
    const widening = progress > 0.78 ? 1 : 0;
    const radius = Math.min(exitRadius, randomInt(rng, minRadius, maxRadius) + widening);
    carveFloorCircle(tileMap, Math.round(position.x), Math.round(position.y), radius);
  }

  carveFloorCircle(tileMap, anchor.x, anchor.y, exitRadius);
}

function carveExitOpening(tileMap, anchor) {
  const horizontalOpening = anchor.direction === 'north' || anchor.direction === 'south';

  carveFloorCircle(tileMap, anchor.x, anchor.y, 3);

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

function buildExitZone(anchor, roomWidth, roomHeight, radius = 2) {
  const tiles = [];

  for (let y = anchor.y - radius; y <= anchor.y + radius; y += 1) {
    for (let x = anchor.x - radius; x <= anchor.x + radius; x += 1) {
      if (x < 0 || y < 0 || x >= roomWidth || y >= roomHeight) continue;
      tiles.push({ x, y });
    }
  }

  return tiles;
}

export function generateRoomInstance({
  roomNode,
  roomWidth = 240,
  roomHeight = 160,
} = {}) {
  const rng = createRng(roomNode.seed >>> 0);
  const boundaryTile = chooseBiomeWallTile(roomNode);
  const tilesGrid = tileMapWithBiomeBoundary(roomWidth, roomHeight, boundaryTile);
  const center = {
    x: Math.floor(roomWidth / 2),
    y: Math.floor(roomHeight / 2),
  };

  const polygon = generatePolygonVertices(roomWidth, roomHeight, rng);
  paintPolygonFloor(tilesGrid, polygon, rng);

  carveFloor(tilesGrid, center.x, center.y);
  const exitZones = [];

  for (const exit of Object.values(roomNode.exits)) {
    carveRoadToAnchor(tilesGrid, center, exit, rng);
    carveExitOpening(tilesGrid, exit);
  }

  for (const entrance of Object.values(roomNode.entrances)) {
    carveRoadToAnchor(tilesGrid, center, entrance, rng);
    carveExitOpening(tilesGrid, entrance);
  }

  for (const [entranceId, entrance] of Object.entries(roomNode.entrances)) {
    markAnchorTile(tilesGrid, entrance, 'entrance', entranceId);
  }

  for (const [exitId, exit] of Object.entries(roomNode.exits)) {
    markAnchorTile(tilesGrid, exit, 'exit', exitId);
    exitZones.push({
      exitId,
      direction: exit.direction,
      tiles: buildExitZone(exit, roomWidth, roomHeight),
    });
  }

  return {
    id: roomNode.id,
    tiles: tilesGrid,
    entities: [],
    entrances: structuredClone(roomNode.entrances),
    exits: structuredClone(roomNode.exits),
    exitZones,
    state: {
      visited: roomNode.state?.visited ?? false,
    },
  };
}
