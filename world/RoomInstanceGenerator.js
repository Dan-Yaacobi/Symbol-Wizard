import { tiles } from './TilePalette.js';

const biomeWallTypes = {
  forest: ['denseTree', 'denseTreeSpire', 'denseTreeBloom'],
  mountain: ['rockCliff'],
  river: ['deepWater'],
  cave: ['stoneWall'],
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

function tileFrom(baseTile, overrides = {}) {
  return {
    ...baseTile,
    ...overrides,
  };
}

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function chooseBiomeWallTiles(roomNode) {
  const biomeType = roomNode.biomeType ?? 'forest';
  const tileKeys = biomeWallTypes[biomeType] ?? biomeWallTypes.forest;
  const resolvedTiles = tileKeys
    .map((tileKey) => tiles[tileKey])
    .filter(Boolean);

  return resolvedTiles.length > 0 ? resolvedTiles : [tiles.wall];
}

function pickBoundaryTileVariant(boundaryTiles, x, y, rng) {
  if (boundaryTiles.length === 1) return boundaryTiles[0];

  const band = (Math.floor(x / 2) + Math.floor(y / 2)) % boundaryTiles.length;
  const jitter = rng() < 0.18 ? 1 : 0;
  return boundaryTiles[(band + jitter) % boundaryTiles.length];
}

function tileMapWithBiomeBoundary(width, height, boundaryTiles, rng) {
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
    const tile = pickBoundaryTileVariant(boundaryTiles, x, y, rng);
    return cloneTile(tile);
  }));
}

function centroidFromPolygon(polygon) {
  if (!polygon?.length) return { x: 0, y: 0 };

  let sumX = 0;
  let sumY = 0;
  for (const vertex of polygon) {
    sumX += vertex.x;
    sumY += vertex.y;
  }

  return {
    x: Math.round(sumX / polygon.length),
    y: Math.round(sumY / polygon.length),
  };
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
      tileMap[y][x] = tileFrom(tiles.grass, { type: 'clearing' });
      if (rng() < 0.07) tileMap[y][x].char = ',';
    }
  }
}

function paintBaseTerrain(tileMap, rng) {
  const width = tileMap[0].length;
  const height = tileMap.length;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const soilBand = ((Math.floor(x / 7) + Math.floor(y / 6)) % 9) / 9;
      const noise = rng();

      if (soilBand + noise * 0.6 > 0.9) {
        tileMap[y][x] = tileFrom(tiles.dirt, { type: 'ground' });
      } else if (noise < 0.18) {
        tileMap[y][x] = tileFrom(tiles.grassDark, { type: 'ground' });
      } else {
        tileMap[y][x] = tileFrom(tiles.grass, { type: 'ground' });
      }
    }
  }
}

function carveFloor(tileMap, x, y, tile = tiles.floor, metadata = null) {
  const row = tileMap[y];
  if (!row || !row[x]) return false;
  row[x] = tileFrom(tile, metadata ?? {});
  return true;
}

function carveFloorCircle(tileMap, x, y, radius = 2, tile = tiles.floor, metadata = null, marker = null) {
  for (let oy = -radius; oy <= radius; oy += 1) {
    for (let ox = -radius; ox <= radius; ox += 1) {
      if (ox * ox + oy * oy > radius * radius) continue;
      const targetX = x + ox;
      const targetY = y + oy;
      if (carveFloor(tileMap, targetX, targetY, tile, metadata) && marker) {
        marker.add(`${targetX},${targetY}`);
      }
    }
  }
}

function carveRoadToAnchor(tileMap, start, anchor, rng, {
  minRadius = 2,
  maxRadius = 3,
  exitRadius = 4,
  roadMask = null,
} = {}) {
  const position = { x: start.x, y: start.y };
  const totalDistance = Math.max(1, Math.hypot(anchor.x - start.x, anchor.y - start.y));
  const maxSteps = Math.ceil(totalDistance * 1.75);
  const initialRadius = randomInt(rng, minRadius, maxRadius);

  carveFloorCircle(tileMap, Math.round(position.x), Math.round(position.y), initialRadius, tiles.pathPebble, { type: 'road' }, roadMask);

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
    carveFloorCircle(tileMap, Math.round(position.x), Math.round(position.y), radius, tiles.pathPebble, { type: 'road' }, roadMask);
  }

  carveFloorCircle(tileMap, anchor.x, anchor.y, exitRadius, tiles.pathPebble, { type: 'road' }, roadMask);
}

function carveExitOpening(tileMap, anchor) {
  const horizontalOpening = anchor.direction === 'north' || anchor.direction === 'south';

  carveFloorCircle(tileMap, anchor.x, anchor.y, 3, tiles.pathPebble, { type: 'road' });

  for (let offset = -1; offset <= 1; offset += 1) {
    const x = horizontalOpening ? anchor.x + offset : anchor.x;
    const y = horizontalOpening ? anchor.y : anchor.y + offset;
    carveFloor(tileMap, x, y, tiles.pathPebble, { type: 'road' });

    if (horizontalOpening) {
      carveFloor(tileMap, x, anchor.y - 1, tiles.pathPebble, { type: 'road' });
      carveFloor(tileMap, x, anchor.y + 1, tiles.pathPebble, { type: 'road' });
    } else {
      carveFloor(tileMap, anchor.x - 1, y, tiles.pathPebble, { type: 'road' });
      carveFloor(tileMap, anchor.x + 1, y, tiles.pathPebble, { type: 'road' });
    }
  }
}

function paintTerrainRegion(tileMap, rng, {
  regionCount,
  radiusMin,
  radiusMax,
  tile,
  avoidMask,
  noiseThreshold,
  metadata,
  centerBias,
  spreadX,
  spreadY,
}) {
  const width = tileMap[0].length;
  const height = tileMap.length;

  for (let i = 0; i < regionCount; i += 1) {
    const cx = Math.max(3, Math.min(width - 4, Math.round(centerBias.x + (rng() - 0.5) * spreadX)));
    const cy = Math.max(3, Math.min(height - 4, Math.round(centerBias.y + (rng() - 0.5) * spreadY)));

    const radiusX = randomInt(rng, radiusMin, radiusMax);
    const radiusY = randomInt(rng, radiusMin, radiusMax);

    for (let y = cy - radiusY; y <= cy + radiusY; y += 1) {
      if (y < 1 || y >= height - 1) continue;
      for (let x = cx - radiusX; x <= cx + radiusX; x += 1) {
        if (x < 1 || x >= width - 1) continue;
        if (avoidMask.has(`${x},${y}`)) continue;

        const nx = (x - cx) / Math.max(1, radiusX);
        const ny = (y - cy) / Math.max(1, radiusY);
        const ellipse = nx * nx + ny * ny;
        const jitter = (rng() - 0.5) * 0.4;
        if (ellipse + jitter > noiseThreshold) continue;

        tileMap[y][x] = tileFrom(tile, metadata);
      }
    }
  }
}

function scatterTerrainObstacles(tileMap, rng, {
  attempts,
  avoidMask,
  centerBias,
  spreadX,
  spreadY,
}) {
  const width = tileMap[0].length;
  const height = tileMap.length;

  for (let i = 0; i < attempts; i += 1) {
    const x = Math.max(2, Math.min(width - 3, Math.round(centerBias.x + (rng() - 0.5) * spreadX)));
    const y = Math.max(2, Math.min(height - 3, Math.round(centerBias.y + (rng() - 0.5) * spreadY)));
    if (avoidMask.has(`${x},${y}`)) continue;

    const roll = rng();
    if (roll < 0.45) {
      tileMap[y][x] = tileFrom(tiles.wood, { type: 'obstacle' });
    } else if (roll < 0.8) {
      tileMap[y][x] = tileFrom(tiles.fence, { type: 'obstacle' });
    } else {
      tileMap[y][x] = tileFrom(tiles.rockCliff, {
        char: '^',
        fg: '#8f8f8f',
        bg: '#2d3139',
        type: 'obstacle',
      });
    }
  }
}

function applySoftBoundaries(tileMap, boundaryTiles, rng, center) {
  const width = tileMap[0].length;
  const height = tileMap.length;
  const maxRadius = Math.hypot(width * 0.5, height * 0.5);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edgeDistance = Math.min(x, y, width - 1 - x, height - 1 - y);
      const radialDistance = Math.hypot(x - center.x, y - center.y);
      const radialRatio = radialDistance / maxRadius;
      const borderPressure = 1 - Math.min(1, edgeDistance / 14);
      const edgeNoise = rng() * 0.25;

      if (borderPressure + radialRatio * 0.75 + edgeNoise < 1.02) continue;

      const boundaryTile = pickBoundaryTileVariant(boundaryTiles, x, y, rng);
      tileMap[y][x] = tileFrom(boundaryTile, { type: 'boundary' });
    }
  }
}

function carveRoadClearings(tileMap, roadMask, rng) {
  for (const key of roadMask) {
    if (rng() > 0.045) continue;
    const [xString, yString] = key.split(',');
    const x = Number(xString);
    const y = Number(yString);
    const radius = randomInt(rng, 3, 6);
    carveFloorCircle(tileMap, x, y, radius, tiles.grass, { type: 'clearing' });
  }
}

function createRoadClearanceMask(roadMask, width, height, bufferRadius = 3) {
  const protectedMask = new Set(roadMask);
  for (const key of roadMask) {
    const [xString, yString] = key.split(',');
    const cx = Number(xString);
    const cy = Number(yString);

    for (let oy = -bufferRadius; oy <= bufferRadius; oy += 1) {
      for (let ox = -bufferRadius; ox <= bufferRadius; ox += 1) {
        const x = cx + ox;
        const y = cy + oy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (ox * ox + oy * oy > bufferRadius * bufferRadius) continue;
        protectedMask.add(`${x},${y}`);
      }
    }
  }

  return protectedMask;
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
  const boundaryTiles = chooseBiomeWallTiles(roomNode);
  const tilesGrid = tileMapWithBiomeBoundary(roomWidth, roomHeight, boundaryTiles, rng);
  const center = {
    x: Math.floor(roomWidth / 2),
    y: Math.floor(roomHeight / 2),
  };

  const polygon = generatePolygonVertices(roomWidth, roomHeight, rng);
  const terrainCenter = centroidFromPolygon(polygon);
  paintBaseTerrain(tilesGrid, rng);
  const roadMask = new Set();

  carveFloor(tilesGrid, terrainCenter.x, terrainCenter.y, tiles.pathPebble, { type: 'road' });
  roadMask.add(`${terrainCenter.x},${terrainCenter.y}`);
  const exitZones = [];

  for (const exit of Object.values(roomNode.exits)) {
    carveRoadToAnchor(tilesGrid, terrainCenter, exit, rng, { roadMask });
    carveExitOpening(tilesGrid, exit);
  }

  for (const entrance of Object.values(roomNode.entrances)) {
    carveRoadToAnchor(tilesGrid, terrainCenter, entrance, rng, { roadMask });
    carveExitOpening(tilesGrid, entrance);
  }

  const roadClearanceMask = createRoadClearanceMask(roadMask, roomWidth, roomHeight, 4);
  const broadTerrainSpread = {
    centerBias: terrainCenter,
    spreadX: roomWidth * 0.9,
    spreadY: roomHeight * 0.9,
  };

  paintTerrainRegion(tilesGrid, rng, {
    regionCount: randomInt(rng, 8, 12),
    radiusMin: 5,
    radiusMax: 14,
    tile: tiles.grass,
    avoidMask: roadMask,
    noiseThreshold: 1.1,
    metadata: { type: 'clearing' },
    ...broadTerrainSpread,
  });

  paintTerrainRegion(tilesGrid, rng, {
    regionCount: randomInt(rng, 10, 15),
    radiusMin: 4,
    radiusMax: 11,
    tile: tiles.denseTree,
    avoidMask: roadClearanceMask,
    noiseThreshold: 1.0,
    metadata: { type: 'forest' },
    ...broadTerrainSpread,
  });

  paintTerrainRegion(tilesGrid, rng, {
    regionCount: randomInt(rng, 5, 9),
    radiusMin: 3,
    radiusMax: 8,
    tile: tileFrom(tiles.rockCliff, { char: '∎', fg: '#8c8f96', bg: '#2a2e35' }),
    avoidMask: roadClearanceMask,
    noiseThreshold: 0.95,
    metadata: { type: 'rock-field' },
    ...broadTerrainSpread,
  });

  paintTerrainRegion(tilesGrid, rng, {
    regionCount: randomInt(rng, 3, 5),
    radiusMin: 4,
    radiusMax: 9,
    tile: tiles.water,
    avoidMask: roadClearanceMask,
    noiseThreshold: 1.0,
    metadata: { type: 'water' },
    ...broadTerrainSpread,
  });

  carveRoadClearings(tilesGrid, roadMask, rng);

  scatterTerrainObstacles(tilesGrid, rng, {
    attempts: randomInt(rng, 50, 90),
    avoidMask: roadClearanceMask,
    ...broadTerrainSpread,
  });

  applySoftBoundaries(tilesGrid, boundaryTiles, rng, center);

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
