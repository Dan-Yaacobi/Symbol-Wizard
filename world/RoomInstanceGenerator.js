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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
      const patchBand = ((Math.floor(x / 11) + Math.floor(y / 9)) % 10) / 10;
      const noise = rng();

      if (patchBand + noise * 0.35 > 0.94) {
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
  exitRadius = 3,
  roadMask = null,
} = {}) {
  const position = { x: start.x, y: start.y };
  const totalDistance = Math.max(1, Math.hypot(anchor.x - start.x, anchor.y - start.y));
  const maxSteps = Math.ceil(totalDistance * 1.75);
  const initialRadius = randomInt(rng, minRadius, maxRadius);
  const bendStrength = 0.22 + rng() * 0.24;
  const bendPhase = rng() * Math.PI * 2;
  const bendSign = rng() < 0.5 ? -1 : 1;

  carveFloorCircle(tileMap, Math.round(position.x), Math.round(position.y), initialRadius, tiles.pathPebble, { type: 'road' }, roadMask);

  for (let step = 0; step < maxSteps; step += 1) {
    const dx = anchor.x - position.x;
    const dy = anchor.y - position.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1.2) break;

    const towardX = dx / distance;
    const towardY = dy / distance;
    const progress = 1 - Math.min(1, distance / totalDistance);
    const lateralScale = Math.min(0.28, distance / 80);
    const curveOffset = Math.sin((progress * Math.PI * 1.35) + bendPhase) * bendStrength * bendSign;
    const lateralJitter = ((rng() - 0.5) * lateralScale) + curveOffset;

    let stepX = towardX - towardY * lateralJitter;
    let stepY = towardY + towardX * lateralJitter;
    const stepMagnitude = Math.hypot(stepX, stepY) || 1;
    const stepLength = 0.9 + rng() * 0.7;

    stepX = (stepX / stepMagnitude) * stepLength;
    stepY = (stepY / stepMagnitude) * stepLength;

    position.x += stepX;
    position.y += stepY;

    const widening = progress > 0.78 ? 1 : 0;
    const radius = Math.min(exitRadius, randomInt(rng, minRadius, maxRadius) + widening);
    carveFloorCircle(tileMap, Math.round(position.x), Math.round(position.y), radius, tiles.pathPebble, { type: 'road' }, roadMask);
  }

  carveFloorCircle(tileMap, anchor.x, anchor.y, exitRadius, tiles.pathPebble, { type: 'road' }, roadMask);
}

function buildExitClearing(tileMap, anchor, rng, protectedMask = null, {
  minRadius = 3,
  maxRadius = 4,
} = {}) {
  const radius = randomInt(rng, minRadius, maxRadius);
  carveFloorCircle(tileMap, anchor.x, anchor.y, radius, tiles.pathPebble, { type: 'road' }, protectedMask);
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

function buildPrimaryRoadPath(exits, entrances, center) {
  const anchors = [...Object.values(entrances), ...Object.values(exits)];
  if (!anchors.length) return [center];

  const sortedAnchors = [...anchors].sort((left, right) => {
    const leftAngle = Math.atan2(left.y - center.y, left.x - center.x);
    const rightAngle = Math.atan2(right.y - center.y, right.x - center.x);
    return leftAngle - rightAngle;
  });

  return [sortedAnchors[0], ...sortedAnchors.slice(1), sortedAnchors[0]];
}

function carvePrimaryRoadNetwork(tileMap, roadPath, terrainCenter, rng, roadMask) {
  carveFloorCircle(tileMap, terrainCenter.x, terrainCenter.y, 3, tiles.pathPebble, { type: 'road' }, roadMask);

  for (let i = 0; i < roadPath.length - 1; i += 1) {
    carveRoadToAnchor(tileMap, roadPath[i], roadPath[i + 1], rng, {
      minRadius: 2,
      maxRadius: 3,
      exitRadius: 3,
      roadMask,
    });
  }

  for (const point of roadPath) {
    carveRoadToAnchor(tileMap, point, terrainCenter, rng, {
      minRadius: 2,
      maxRadius: 3,
      exitRadius: 3,
      roadMask,
    });
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

function tileAt(tileMap, x, y) {
  return tileMap[y]?.[x] ?? null;
}

function isInside(tileMap, x, y) {
  return y >= 0 && y < tileMap.length && x >= 0 && x < tileMap[0].length;
}

function isWalkableTile(tileMap, x, y) {
  return Boolean(tileAt(tileMap, x, y)?.walkable);
}

function collectRoadPoints(roadMask) {
  const points = [];
  for (const key of roadMask) {
    const [xString, yString] = key.split(',');
    points.push({ x: Number(xString), y: Number(yString) });
  }
  return points;
}

function buildProtectedZoneMask(points, width, height, radius) {
  const mask = new Set();
  for (const point of points) {
    for (let oy = -radius; oy <= radius; oy += 1) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        if (ox * ox + oy * oy > radius * radius) continue;
        const x = point.x + ox;
        const y = point.y + oy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        mask.add(`${x},${y}`);
      }
    }
  }
  return mask;
}

function canPlaceCells(tileMap, center, cells, blockedMask, { requireWalkable = false } = {}) {
  for (const cell of cells) {
    const x = center.x + cell.x;
    const y = center.y + cell.y;
    if (!isInside(tileMap, x, y)) return false;
    if (blockedMask.has(`${x},${y}`)) return false;
    if (requireWalkable && !isWalkableTile(tileMap, x, y)) return false;
  }
  return true;
}

function markMaskFromCells(mask, center, cells, padding = 0) {
  for (const cell of cells) {
    const cx = center.x + cell.x;
    const cy = center.y + cell.y;
    for (let oy = -padding; oy <= padding; oy += 1) {
      for (let ox = -padding; ox <= padding; ox += 1) {
        mask.add(`${cx + ox},${cy + oy}`);
      }
    }
  }
}

function stampCells(tileMap, center, cells, tileBuilder) {
  for (const cell of cells) {
    const x = center.x + cell.x;
    const y = center.y + cell.y;
    if (!isInside(tileMap, x, y)) continue;
    tileMap[y][x] = tileBuilder(cell, x, y);
  }
}

function ringCells(radius) {
  const cells = [];
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      const dist = Math.hypot(x, y);
      if (dist >= radius - 0.75 && dist <= radius + 0.35) cells.push({ x, y });
    }
  }
  return cells;
}

function diskCells(radius) {
  const cells = [];
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (x * x + y * y <= radius * radius) cells.push({ x, y });
    }
  }
  return cells;
}

function tryPlaceLandmarks(tileMap, rng, roadMask, blockedMask) {
  const roadPoints = collectRoadPoints(roadMask);
  const landmarkCount = randomInt(rng, 1, 3);
  const placements = [];

  const landmarkBuilders = [
    (center) => {
      const clearing = diskCells(5);
      const columnOffsets = [{ x: -2, y: -2 }, { x: 2, y: -2 }, { x: -2, y: 2 }, { x: 2, y: 2 }];
      return {
        center,
        footprint: clearing,
        stamp: () => {
          stampCells(tileMap, center, clearing, () => tileFrom(tiles.grass, { type: 'landmark-clearing' }));
          stampCells(tileMap, center, [{ x: 0, y: 0 }], () => tileFrom(tiles.stoneWall, { char: '☥', fg: '#d4d0c8', type: 'landmark', landmark: 'ruined-shrine', walkable: false }));
          stampCells(tileMap, center, columnOffsets, () => tileFrom(tiles.stoneWall, { char: '║', fg: '#a0a0a0', type: 'landmark', landmark: 'ruined-shrine', walkable: false }));
          stampCells(tileMap, center, ringCells(3).filter(() => rng() < 0.35), () => tileFrom(tiles.rockCliff, { char: '·', fg: '#7f848c', bg: '#1d2229', type: 'landmark-rubble', walkable: true }));
        },
      };
    },
    (center) => {
      const campDisk = diskCells(4);
      const tents = [{ x: -2, y: -1 }, { x: 2, y: -1 }];
      const wagon = [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: -1, y: 2 }];
      return {
        center,
        footprint: campDisk,
        stamp: () => {
          stampCells(tileMap, center, campDisk, () => tileFrom(tiles.dirt, { type: 'landmark-clearing' }));
          stampCells(tileMap, center, tents, () => tileFrom(tiles.wood, { char: '⛺', fg: '#c39b68', type: 'landmark', landmark: 'bandit-camp', walkable: false }));
          stampCells(tileMap, center, wagon, () => tileFrom(tiles.wood, { char: '▤', fg: '#b28757', type: 'landmark', landmark: 'abandoned-wagon', walkable: false }));
          stampCells(tileMap, center, [{ x: 0, y: 0 }], () => tileFrom(tiles.pathPebble, { char: '*', fg: '#ffb26d', type: 'landmark-firepit', walkable: true }));
        },
      };
    },
    (center) => {
      const towerBase = diskCells(3);
      const rubble = ringCells(5).filter(() => rng() < 0.28);
      return {
        center,
        footprint: [...towerBase, ...rubble],
        stamp: () => {
          stampCells(tileMap, center, towerBase, () => tileFrom(tiles.stoneWall, { char: '▓', fg: '#9da3ad', type: 'landmark', landmark: 'broken-tower', walkable: false }));
          stampCells(tileMap, center, [{ x: 0, y: 0 }], () => tileFrom(tiles.stoneWall, { char: 'Ø', fg: '#d9dde3', type: 'landmark-core', walkable: false }));
          stampCells(tileMap, center, rubble, () => tileFrom(tiles.rockCliff, { char: ':', fg: '#7b8088', bg: '#1d2128', type: 'landmark-rubble', walkable: true }));
        },
      };
    },
  ];

  for (let i = 0; i < landmarkCount; i += 1) {
    let placed = false;
    for (let attempt = 0; attempt < 45 && !placed; attempt += 1) {
      const road = roadPoints[randomInt(rng, 0, Math.max(0, roadPoints.length - 1))] ?? { x: Math.floor(tileMap[0].length / 2), y: Math.floor(tileMap.length / 2) };
      const angle = rng() * Math.PI * 2;
      const distance = randomInt(rng, 6, 12);
      const center = {
        x: Math.round(road.x + Math.cos(angle) * distance),
        y: Math.round(road.y + Math.sin(angle) * distance),
      };
      const builder = landmarkBuilders[randomInt(rng, 0, landmarkBuilders.length - 1)](center);
      if (!canPlaceCells(tileMap, center, builder.footprint, blockedMask, { requireWalkable: true })) continue;

      builder.stamp();
      markMaskFromCells(blockedMask, center, builder.footprint, 3);
      placements.push(builder.center);
      placed = true;
    }
  }

  return placements;
}

function placeTerrainObjectClusters(tileMap, rng, blockedMask, roadMask) {
  const roadPoints = collectRoadPoints(roadMask);
  const clusterCount = randomInt(rng, 8, 14);

  for (let i = 0; i < clusterCount; i += 1) {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const road = roadPoints[randomInt(rng, 0, Math.max(0, roadPoints.length - 1))] ?? { x: Math.floor(tileMap[0].length / 2), y: Math.floor(tileMap.length / 2) };
      const angle = rng() * Math.PI * 2;
      const distance = randomInt(rng, 10, 24);
      const center = { x: Math.round(road.x + Math.cos(angle) * distance), y: Math.round(road.y + Math.sin(angle) * distance) };
      const radiusX = randomInt(rng, 2, 4);
      const radiusY = randomInt(rng, 2, 4);
      const footprint = [];
      for (let y = -radiusY; y <= radiusY; y += 1) {
        for (let x = -radiusX; x <= radiusX; x += 1) {
          const shapeNoise = (rng() - 0.5) * 0.35;
          if (((x * x) / (radiusX * radiusX) + (y * y) / (radiusY * radiusY)) + shapeNoise > 1) continue;
          footprint.push({ x, y });
        }
      }

      if (!canPlaceCells(tileMap, center, footprint, blockedMask, { requireWalkable: true })) continue;

      const terrainPick = rng();
      const terrainTile = terrainPick < 0.5
        ? tileFrom(tiles.denseTree, { type: 'terrain-object', walkable: false })
        : terrainPick < 0.8
          ? tileFrom(tiles.rockCliff, { char: '▲', fg: '#8d9199', bg: '#262b33', type: 'terrain-object', walkable: false })
          : tileFrom(tiles.water, { type: 'terrain-object', walkable: false });

      stampCells(tileMap, center, footprint, () => ({ ...terrainTile }));
      markMaskFromCells(blockedMask, center, footprint, 1);
      break;
    }
  }
}

function scatterDecoratives(tileMap, rng, blockedMask) {
  const width = tileMap[0].length;
  const height = tileMap.length;
  const decorativeTiles = [
    () => tileFrom(tiles.grassDark, { char: '"', type: 'decorative', walkable: true }),
    () => tileFrom(tiles.pathPebble, { char: '*', fg: '#d86464', bg: '#3b2f20', type: 'decorative', walkable: true }),
    () => tileFrom(tiles.pathPebble, { char: '*', fg: '#e1cb6a', bg: '#3b2f20', type: 'decorative', walkable: true }),
    () => tileFrom(tiles.pathPebble, { char: '·', fg: '#a4adb8', bg: '#373838', type: 'decorative', walkable: true }),
    () => tileFrom(tiles.dirt, { char: '᛫', fg: '#baa07b', type: 'decorative', walkable: true }),
  ];

  const attempts = Math.floor((width * height) / 85);
  for (let i = 0; i < attempts; i += 1) {
    const x = randomInt(rng, 2, width - 3);
    const y = randomInt(rng, 2, height - 3);
    if (blockedMask.has(`${x},${y}`)) continue;
    const tile = tileAt(tileMap, x, y);
    if (!tile?.walkable || tile.type === 'road') continue;
    tileMap[y][x] = decorativeTiles[randomInt(rng, 0, decorativeTiles.length - 1)]();
  }
}

function applySoftBoundariesWithProtection(tileMap, boundaryTiles, rng, center, protectedMask) {
  const width = tileMap[0].length;
  const height = tileMap.length;
  const maxRadius = Math.hypot(width * 0.5, height * 0.5);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (protectedMask.has(`${x},${y}`)) continue;

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

function hasPathToAnchor(tileMap, start, anchor) {
  if (!isInside(tileMap, start.x, start.y) || !isInside(tileMap, anchor.x, anchor.y)) return false;
  if (!isWalkableTile(tileMap, start.x, start.y) || !isWalkableTile(tileMap, anchor.x, anchor.y)) return false;

  const queue = [{ x: start.x, y: start.y }];
  const visited = new Set([`${start.x},${start.y}`]);
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.x === anchor.x && current.y === anchor.y) return true;

    for (const direction of directions) {
      const nx = current.x + direction.x;
      const ny = current.y + direction.y;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      if (!isInside(tileMap, nx, ny) || !isWalkableTile(tileMap, nx, ny)) continue;

      visited.add(key);
      queue.push({ x: nx, y: ny });
    }
  }

  return false;
}

function ensureAnchorConnectivity(tileMap, rng, start, anchors, protectedMask, roadMask) {
  for (const anchor of anchors) {
    if (hasPathToAnchor(tileMap, start, anchor)) continue;

    carveRoadToAnchor(tileMap, start, anchor, rng, { roadMask, minRadius: 2, maxRadius: 3, exitRadius: 4 });
    buildExitClearing(tileMap, anchor, rng, protectedMask);
    carveExitOpening(tileMap, anchor);
    protectedMask.add(`${anchor.x},${anchor.y}`);
  }
}

function carveRoadClearings(tileMap, roadMask, rng) {
  for (const key of roadMask) {
    const [xString, yString] = key.split(',');
    const x = Number(xString);
    const y = Number(yString);

    if (rng() < 0.32) {
      const wornRadius = randomInt(rng, 1, 2);
      carveFloorCircle(tileMap, x, y, wornRadius, tiles.dirt, { type: 'worn-path' });
    }

    if (rng() > 0.05) continue;
    const clearRadius = randomInt(rng, 4, 7);
    carveFloorCircle(tileMap, x, y, clearRadius, tiles.grass, { type: 'clearing' });
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

function buildEdgePassage(anchor, roomWidth, roomHeight, rng) {
  const direction = anchor.direction;
  const corridorWidth = randomInt(rng, 8, 14);
  const halfWidth = Math.floor(corridorWidth / 2);
  const edgeInset = 4;

  if (direction === 'north' || direction === 'south') {
    const edgeY = direction === 'north' ? 0 : roomHeight - 1;
    const baseX = clamp(anchor.x, edgeInset, roomWidth - 1 - edgeInset);
    const edgeStartX = clamp(baseX - halfWidth, 0, roomWidth - 1);
    const edgeEndX = clamp(baseX + halfWidth, 0, roomWidth - 1);
    const centerX = Math.round((edgeStartX + edgeEndX) / 2);

    return {
      direction,
      x: centerX,
      y: direction === 'north' ? 4 : roomHeight - 5,
      edgeStart: { x: edgeStartX, y: edgeY },
      edgeEnd: { x: edgeEndX, y: edgeY },
      center: { x: centerX, y: edgeY },
      roadAnchor: {
        x: centerX,
        y: direction === 'north' ? 4 : roomHeight - 5,
      },
      spawn: {
        x: centerX,
        y: direction === 'north' ? 4 : roomHeight - 5,
      },
    };
  }

  const edgeX = direction === 'west' ? 0 : roomWidth - 1;
  const baseY = clamp(anchor.y, edgeInset, roomHeight - 1 - edgeInset);
  const edgeStartY = clamp(baseY - halfWidth, 0, roomHeight - 1);
  const edgeEndY = clamp(baseY + halfWidth, 0, roomHeight - 1);
  const centerY = Math.round((edgeStartY + edgeEndY) / 2);

  return {
    direction,
    x: direction === 'west' ? 4 : roomWidth - 5,
    y: centerY,
    edgeStart: { x: edgeX, y: edgeStartY },
    edgeEnd: { x: edgeX, y: edgeEndY },
    center: { x: edgeX, y: centerY },
    roadAnchor: {
      x: direction === 'west' ? 4 : roomWidth - 5,
      y: centerY,
    },
    spawn: {
      x: direction === 'west' ? 4 : roomWidth - 5,
      y: centerY,
    },
  };
}

function carveEdgePassage(tileMap, passage, roadMask, roomWidth, roomHeight) {
  const depth = 7;
  const metadata = { type: 'road' };

  if (passage.direction === 'north' || passage.direction === 'south') {
    const yStep = passage.direction === 'north' ? 1 : -1;
    const originY = passage.direction === 'north' ? 0 : roomHeight - 1;
    for (let depthStep = 0; depthStep < depth; depthStep += 1) {
      const y = originY + yStep * depthStep;
      for (let x = passage.edgeStart.x; x <= passage.edgeEnd.x; x += 1) {
        carveFloor(tileMap, x, y, tiles.pathPebble, metadata);
        roadMask.add(`${x},${y}`);
      }
    }
    return;
  }

  const xStep = passage.direction === 'west' ? 1 : -1;
  const originX = passage.direction === 'west' ? 0 : roomWidth - 1;
  for (let depthStep = 0; depthStep < depth; depthStep += 1) {
    const x = originX + xStep * depthStep;
    for (let y = passage.edgeStart.y; y <= passage.edgeEnd.y; y += 1) {
      carveFloor(tileMap, x, y, tiles.pathPebble, metadata);
      roadMask.add(`${x},${y}`);
    }
  }
}

function buildEdgeZone(exitId, passage) {
  return {
    exitId,
    direction: passage.direction,
    edgeStart: structuredClone(passage.edgeStart),
    edgeEnd: structuredClone(passage.edgeEnd),
  };
}

function anchorDirection(anchor, roomWidth, roomHeight) {
  if (anchor?.direction) return anchor.direction;
  if (!anchor) return 'east';
  if (anchor.y <= 2) return 'north';
  if (anchor.y >= roomHeight - 3) return 'south';
  if (anchor.x <= 2) return 'west';
  if (anchor.x >= roomWidth - 3) return 'east';
  return 'east';
}

function slotAnchorPosition(direction, slotIndex, slotCount, roomWidth, roomHeight) {
  const minAxis = 4;
  const maxX = roomWidth - 5;
  const maxY = roomHeight - 5;
  const axisMax = direction === 'north' || direction === 'south' ? maxX : maxY;
  const clampedMax = Math.max(minAxis, axisMax);
  const span = clampedMax - minAxis;
  const axis = slotCount <= 1
    ? Math.round((minAxis + clampedMax) / 2)
    : Math.round(minAxis + (span * ((slotIndex + 1) / (slotCount + 1))));

  if (direction === 'north') return { x: axis, y: 2, direction };
  if (direction === 'south') return { x: axis, y: roomHeight - 3, direction };
  if (direction === 'west') return { x: 2, y: axis, direction };
  return { x: roomWidth - 3, y: axis, direction };
}

function resolveRoomAnchors(exits, entrances, roomWidth, roomHeight) {
  const descriptors = [];

  for (const [id, anchor] of Object.entries(exits)) {
    descriptors.push({ type: 'exit', id, direction: anchorDirection(anchor, roomWidth, roomHeight) });
  }

  for (const [id, anchor] of Object.entries(entrances)) {
    descriptors.push({ type: 'entrance', id, direction: anchorDirection(anchor, roomWidth, roomHeight) });
  }

  const byDirection = new Map();
  for (const descriptor of descriptors) {
    if (!byDirection.has(descriptor.direction)) byDirection.set(descriptor.direction, []);
    byDirection.get(descriptor.direction).push(descriptor);
  }

  const resolvedExits = {};
  const resolvedEntrances = {};

  for (const entries of byDirection.values()) {
    entries.sort((left, right) => `${left.type}:${left.id}`.localeCompare(`${right.type}:${right.id}`));
    entries.forEach((entry, index) => {
      const resolved = slotAnchorPosition(entry.direction, index, entries.length, roomWidth, roomHeight);
      if (entry.type === 'exit') {
        resolvedExits[entry.id] = resolved;
      } else {
        resolvedEntrances[entry.id] = resolved;
      }
    });
  }

  return {
    exits: resolvedExits,
    entrances: resolvedEntrances,
  };
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
  const resolvedAnchors = resolveRoomAnchors(roomNode.exits, roomNode.entrances, roomWidth, roomHeight);
  const resolvedExits = Object.fromEntries(
    Object.entries(resolvedAnchors.exits).map(([id, anchor]) => [id, buildEdgePassage(anchor, roomWidth, roomHeight, rng)]),
  );
  const resolvedEntrances = Object.fromEntries(
    Object.entries(resolvedAnchors.entrances).map(([id, anchor]) => [id, buildEdgePassage(anchor, roomWidth, roomHeight, rng)]),
  );
  paintBaseTerrain(tilesGrid, rng);
  const roadMask = new Set();

  const primaryRoadPath = buildPrimaryRoadPath(
    Object.fromEntries(Object.entries(resolvedExits).map(([id, passage]) => [id, passage.roadAnchor])),
    Object.fromEntries(Object.entries(resolvedEntrances).map(([id, passage]) => [id, passage.roadAnchor])),
    terrainCenter,
  );
  carvePrimaryRoadNetwork(tilesGrid, primaryRoadPath, terrainCenter, rng, roadMask);
  const exitZones = [];
  const accessProtectionMask = new Set([`${center.x},${center.y}`]);

  for (const exit of Object.values(resolvedExits)) {
    carveRoadToAnchor(tilesGrid, center, exit.roadAnchor, rng, { roadMask });
    buildExitClearing(tilesGrid, exit.roadAnchor, rng, accessProtectionMask);
    carveExitOpening(tilesGrid, { ...exit.roadAnchor, direction: exit.direction });
    carveEdgePassage(tilesGrid, exit, roadMask, roomWidth, roomHeight);
    accessProtectionMask.add(`${exit.roadAnchor.x},${exit.roadAnchor.y}`);
  }

  for (const entrance of Object.values(resolvedEntrances)) {
    carveRoadToAnchor(tilesGrid, center, entrance.roadAnchor, rng, { roadMask });
    buildExitClearing(tilesGrid, entrance.roadAnchor, rng, accessProtectionMask);
    carveExitOpening(tilesGrid, { ...entrance.roadAnchor, direction: entrance.direction });
    carveEdgePassage(tilesGrid, entrance, roadMask, roomWidth, roomHeight);
    accessProtectionMask.add(`${entrance.roadAnchor.x},${entrance.roadAnchor.y}`);
  }

  const roadClearanceMask = createRoadClearanceMask(roadMask, roomWidth, roomHeight, 4);
  const terrainProtectionMask = new Set([...roadClearanceMask, ...accessProtectionMask]);
  const broadTerrainSpread = {
    centerBias: terrainCenter,
    spreadX: roomWidth * 0.9,
    spreadY: roomHeight * 0.9,
  };

  // 3) Terrain clusters
  paintTerrainRegion(tilesGrid, rng, {
    regionCount: randomInt(rng, 11, 16),
    radiusMin: 4,
    radiusMax: 11,
    tile: tiles.denseTree,
    avoidMask: terrainProtectionMask,
    noiseThreshold: 1.0,
    metadata: { type: 'forest' },
    ...broadTerrainSpread,
  });

  paintTerrainRegion(tilesGrid, rng, {
    regionCount: randomInt(rng, 5, 8),
    radiusMin: 3,
    radiusMax: 8,
    tile: tileFrom(tiles.rockCliff, { char: '∎', fg: '#8c8f96', bg: '#2a2e35' }),
    avoidMask: terrainProtectionMask,
    noiseThreshold: 0.95,
    metadata: { type: 'rock-field' },
    ...broadTerrainSpread,
  });

  paintTerrainRegion(tilesGrid, rng, {
    regionCount: randomInt(rng, 3, 6),
    radiusMin: 4,
    radiusMax: 9,
    tile: tiles.water,
    avoidMask: terrainProtectionMask,
    noiseThreshold: 1.0,
    metadata: { type: 'water' },
    ...broadTerrainSpread,
  });

  carveRoadClearings(tilesGrid, roadMask, rng);

  // Additional placements near roads and exits.
  const landmarkBufferMask = buildProtectedZoneMask(
    [
      ...Object.values(resolvedExits).map((passage) => passage.roadAnchor),
      ...Object.values(resolvedEntrances).map((passage) => passage.roadAnchor),
    ],
    roomWidth,
    roomHeight,
    7,
  );
  const landmarkPlacementMask = new Set(landmarkBufferMask);

  // Landmark placement
  tryPlaceLandmarks(tilesGrid, rng, roadMask, landmarkPlacementMask);

  // 4) Terrain object clusters
  const terrainClusterMask = new Set([...terrainProtectionMask, ...landmarkPlacementMask]);
  placeTerrainObjectClusters(tilesGrid, rng, terrainClusterMask, roadMask);

  // 5) Biome boundaries (cannot overwrite roads/exit clearings)
  applySoftBoundariesWithProtection(tilesGrid, boundaryTiles, rng, center, terrainProtectionMask);

  // Connectivity validation and self-heal pass.
  ensureAnchorConnectivity(
    tilesGrid,
    rng,
    center,
    [...Object.values(resolvedExits).map((passage) => passage.roadAnchor), ...Object.values(resolvedEntrances).map((passage) => passage.roadAnchor)],
    terrainProtectionMask,
    roadMask,
  );

  // 6) Decorative scattering (non-blocking)
  scatterDecoratives(tilesGrid, rng, terrainClusterMask);

  for (const [exitId, exit] of Object.entries(resolvedExits)) {
    exitZones.push(buildEdgeZone(exitId, exit));
  }

  return {
    id: roomNode.id,
    tiles: tilesGrid,
    entities: [],
    entrances: structuredClone(resolvedEntrances),
    exits: structuredClone(resolvedExits),
    exitZones,
    state: {
      visited: roomNode.state?.visited ?? false,
    },
  };
}
