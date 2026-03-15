import { tiles } from './TilePalette.js';

function cloneTile(tile) {
  return { ...tile };
}

function tileFrom(baseTile, overrides = {}) {
  return { ...baseTile, ...overrides };
}

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const biomeWallTypes = {
  forest: ['denseTree', 'denseTreeSpire', 'denseTreeBloom', 'denseTreeCanopy', 'denseTreeShadow'],
  mountain: ['rockCliff'],
  river: ['deepWater'],
  cave: ['stoneWall'],
};

const MAX_EXITS_PER_ROOM = 4;
const MIN_EXITS_PER_ROOM = 1;
const MIN_EXIT_EDGE_DISTANCE_RATIO = 0.15;
const MAIN_ROAD_WIDTH = 3;
const BRANCH_ROAD_WIDTH = 2;
const ROAD_CLEAR_RADIUS = 1;
const ROAD_MERGE_DISTANCE = 5;

function pickBoundaryTileVariant(boundaryTiles, x, y, rng) {
  if (boundaryTiles.length === 1) return boundaryTiles[0];
  const band = (Math.floor(x / 2) + Math.floor(y / 2)) % boundaryTiles.length;
  const jitter = rng() < 0.18 ? 1 : 0;
  return boundaryTiles[(band + jitter) % boundaryTiles.length];
}

function carveFloor(tileMap, x, y, tile = tiles.floor, metadata = null, marker = null) {
  if (!tileMap[y]?.[x]) return;
  tileMap[y][x] = tileFrom(tile, metadata ?? {});
  if (marker) marker.add(`${x},${y}`);
}

function carveFloorCircle(tileMap, x, y, radius, tile, metadata, marker = null) {
  for (let oy = -radius; oy <= radius; oy += 1) {
    for (let ox = -radius; ox <= radius; ox += 1) {
      if ((ox * ox) + (oy * oy) > radius * radius) continue;
      carveFloor(tileMap, x + ox, y + oy, tile, metadata, marker);
    }
  }
}

function collectRoadPoints(roadMask) {
  const points = [];
  for (const key of roadMask) {
    const [xString, yString] = key.split(',');
    points.push({ x: Number(xString), y: Number(yString) });
  }
  return points;
}

function nearestRoadPoint(source, roadPoints) {
  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const point of roadPoints) {
    const distance = Math.hypot(source.x - point.x, source.y - point.y);
    if (distance >= nearestDistance) continue;
    nearest = point;
    nearestDistance = distance;
  }
  return nearest;
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
  const axisMax = direction === 'north' || direction === 'south' ? roomWidth - 5 : roomHeight - 5;
  const span = Math.max(minAxis, axisMax) - minAxis;
  const axis = slotCount <= 1
    ? Math.round((minAxis + Math.max(minAxis, axisMax)) / 2)
    : Math.round(minAxis + (span * ((slotIndex + 1) / (slotCount + 1))));

  if (direction === 'north') return { x: axis, y: 2, direction };
  if (direction === 'south') return { x: axis, y: roomHeight - 3, direction };
  if (direction === 'west') return { x: 2, y: axis, direction };
  return { x: roomWidth - 3, y: axis, direction };
}

function resolveRoomAnchors(exits, entrances, roomWidth, roomHeight) {
  const descriptors = [];
  for (const [id, anchor] of Object.entries(exits)) descriptors.push({ type: 'exit', id, direction: anchorDirection(anchor, roomWidth, roomHeight) });
  for (const [id, anchor] of Object.entries(entrances)) descriptors.push({ type: 'entrance', id, direction: anchorDirection(anchor, roomWidth, roomHeight) });

  const byDirection = new Map();
  for (const descriptor of descriptors) {
    if (!byDirection.has(descriptor.direction)) byDirection.set(descriptor.direction, []);
    byDirection.get(descriptor.direction).push(descriptor);
  }

  const resolvedExits = {};
  const resolvedEntrances = {};
  for (const entries of byDirection.values()) {
    entries.sort((a, b) => `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`));
    entries.forEach((entry, index) => {
      const resolved = slotAnchorPosition(entry.direction, index, entries.length, roomWidth, roomHeight);
      if (entry.type === 'exit') resolvedExits[entry.id] = resolved;
      else resolvedEntrances[entry.id] = resolved;
    });
  }

  return { exits: resolvedExits, entrances: resolvedEntrances };
}

function buildEdgePassage(anchor, roomWidth, roomHeight, rng) {
  const direction = anchor.direction;
  const corridorWidth = randomInt(rng, 8, 14);
  const halfWidth = Math.floor(corridorWidth / 2);
  const triggerDepth = 7;

  if (direction === 'north' || direction === 'south') {
    const edgeY = direction === 'north' ? 0 : roomHeight - 1;
    const baseX = clamp(anchor.x, 4, roomWidth - 5);
    const edgeStartX = clamp(baseX - halfWidth, 0, roomWidth - 1);
    const edgeEndX = clamp(baseX + halfWidth, 0, roomWidth - 1);
    const centerX = Math.round((edgeStartX + edgeEndX) / 2);
    return {
      direction,
      edgeStart: { x: edgeStartX, y: edgeY },
      edgeEnd: { x: edgeEndX, y: edgeY },
      roadAnchor: { x: centerX, y: direction === 'north' ? 4 : roomHeight - 5 },
      spawn: { x: centerX, y: direction === 'north' ? 4 : roomHeight - 5 },
      triggerDepth,
    };
  }

  const edgeX = direction === 'west' ? 0 : roomWidth - 1;
  const baseY = clamp(anchor.y, 4, roomHeight - 5);
  const edgeStartY = clamp(baseY - halfWidth, 0, roomHeight - 1);
  const edgeEndY = clamp(baseY + halfWidth, 0, roomHeight - 1);
  const centerY = Math.round((edgeStartY + edgeEndY) / 2);

  return {
    direction,
    edgeStart: { x: edgeX, y: edgeStartY },
    edgeEnd: { x: edgeX, y: edgeEndY },
    roadAnchor: { x: direction === 'west' ? 4 : roomWidth - 5, y: centerY },
    spawn: { x: direction === 'west' ? 4 : roomWidth - 5, y: centerY },
    triggerDepth,
  };
}

function edgeAxisValue(anchor) {
  if (anchor.direction === 'north' || anchor.direction === 'south') return anchor.x;
  return anchor.y;
}

function pickExitSubset(exits, roomWidth, roomHeight, rng) {
  const exitEntries = Object.entries(exits ?? {});
  if (!exitEntries.length) return {};

  const maxTarget = exitEntries.length >= MAX_EXITS_PER_ROOM && rng() < 0.7 ? MAX_EXITS_PER_ROOM - 1 : MAX_EXITS_PER_ROOM;
  const targetCount = Math.min(maxTarget, Math.max(MIN_EXITS_PER_ROOM, exitEntries.length));
  const minEdgeDistance = Math.max(2, Math.round((Math.min(roomWidth, roomHeight)) * MIN_EXIT_EDGE_DISTANCE_RATIO));
  const shuffled = [...exitEntries].sort(() => rng() - 0.5);
  const selected = [];

  for (const [id, anchor] of shuffled) {
    if (selected.length >= targetCount) break;
    const direction = anchorDirection(anchor, roomWidth, roomHeight);
    const axis = edgeAxisValue({ ...anchor, direction });
    const tooClose = selected.some(([, chosenAnchor]) => {
      const chosenDirection = anchorDirection(chosenAnchor, roomWidth, roomHeight);
      if (chosenDirection !== direction) return false;
      const chosenAxis = edgeAxisValue({ ...chosenAnchor, direction: chosenDirection });
      return Math.abs(axis - chosenAxis) < minEdgeDistance;
    });
    if (!tooClose) selected.push([id, anchor]);
  }

  if (selected.length < MIN_EXITS_PER_ROOM) {
    selected.push(shuffled[0]);
  }

  const selectedIds = new Set(selected.map(([id]) => id));
  if (selected.length < targetCount) {
    for (const entry of shuffled) {
      if (selected.length >= targetCount) break;
      if (selectedIds.has(entry[0])) continue;
      selected.push(entry);
      selectedIds.add(entry[0]);
    }
  }

  return Object.fromEntries(selected.slice(0, targetCount));
}

function carveRoadBrush(tileMap, x, y, width, marker = null) {
  const start = -Math.floor(width / 2);
  const end = start + width - 1;
  for (let oy = start; oy <= end; oy += 1) {
    for (let ox = start; ox <= end; ox += 1) {
      carveFloor(tileMap, x + ox, y + oy, tiles.pathPebble, { type: 'road' }, marker);
    }
  }
}

function carveRoadToAnchor(tileMap, start, anchor, rng, { roadWidth, roadMask }) {
  const position = { x: start.x, y: start.y };
  const totalDistance = Math.max(1, Math.hypot(anchor.x - start.x, anchor.y - start.y));
  const maxSteps = Math.ceil(totalDistance * 1.75);

  carveRoadBrush(tileMap, Math.round(position.x), Math.round(position.y), roadWidth, roadMask);

  for (let step = 0; step < maxSteps; step += 1) {
    const dx = anchor.x - position.x;
    const dy = anchor.y - position.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1.2) break;

    const towardX = dx / distance;
    const towardY = dy / distance;
    const progress = 1 - Math.min(1, distance / totalDistance);
    const lateralJitter = Math.sin((progress * Math.PI * 1.25) + (rng() * Math.PI * 2)) * 0.16;
    const stepLength = 0.9 + rng() * 0.7;

    position.x += (towardX - (towardY * lateralJitter)) * stepLength;
    position.y += (towardY + (towardX * lateralJitter)) * stepLength;

    carveRoadBrush(tileMap, Math.round(position.x), Math.round(position.y), roadWidth, roadMask);
  }

  carveRoadBrush(tileMap, anchor.x, anchor.y, roadWidth, roadMask);
}

function clearRoadCorridor(tileMap, roadMask, radius = ROAD_CLEAR_RADIUS) {
  const width = tileMap[0]?.length ?? 0;
  const height = tileMap.length;
  for (const key of roadMask) {
    const [xString, yString] = key.split(',');
    const x = Number(xString);
    const y = Number(yString);
    for (let oy = -radius; oy <= radius; oy += 1) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        const tx = x + ox;
        const ty = y + oy;
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
        if (roadMask.has(`${tx},${ty}`)) continue;
        const tile = tileMap[ty]?.[tx];
        if (!tile || tile.walkable) continue;
        tileMap[ty][tx] = tileFrom(tiles.grass, { type: 'ground' });
      }
    }
  }
}

function mergeNearbyRoads(tileMap, roadMask, rng, { roadWidth, threshold = ROAD_MERGE_DISTANCE, maxMerges = 10 }) {
  const points = collectRoadPoints(roadMask);
  if (points.length < 2) return;

  const gridSize = threshold;
  const buckets = new Map();
  for (const point of points) {
    const bx = Math.floor(point.x / gridSize);
    const by = Math.floor(point.y / gridSize);
    const key = `${bx},${by}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(point);
  }

  let merges = 0;
  const shuffled = [...points].sort(() => rng() - 0.5);
  for (const point of shuffled) {
    if (merges >= maxMerges) break;
    const bx = Math.floor(point.x / gridSize);
    const by = Math.floor(point.y / gridSize);
    let nearest = null;
    let nearestDist = Number.POSITIVE_INFINITY;

    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        const neighborKey = `${bx + ox},${by + oy}`;
        const candidates = buckets.get(neighborKey) ?? [];
        for (const candidate of candidates) {
          const dist = Math.hypot(point.x - candidate.x, point.y - candidate.y);
          if (dist <= 2 || dist >= threshold || dist >= nearestDist) continue;
          nearest = candidate;
          nearestDist = dist;
        }
      }
    }

    if (!nearest) continue;
    carveRoadToAnchor(tileMap, point, nearest, rng, { roadWidth, roadMask });
    merges += 1;
  }
}

function generateEdgeDepths(length, rng, minDepth, maxDepth, drift = 1.2) {
  const values = Array.from({ length }, () => minDepth);
  let current = randomInt(rng, minDepth, maxDepth);
  for (let i = 0; i < length; i += 1) {
    current += (rng() - 0.5) * drift;
    current = clamp(current, minDepth, maxDepth);
    values[i] = Math.round(current);
  }
  return values;
}

function applyBiomeBoundaryRing(tileMap, boundaryTiles, rng, biomeType, thickness = 3) {
  const width = tileMap[0]?.length ?? 0;
  const height = tileMap.length;
  if (!width || !height || !boundaryTiles.length) return;

  if (biomeType !== 'forest') {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const edgeDistance = Math.min(x, y, (width - 1) - x, (height - 1) - y);
        if (edgeDistance >= thickness) continue;
        tileMap[y][x] = cloneTile(pickBoundaryTileVariant(boundaryTiles, x, y, rng));
      }
    }
    return;
  }

  const topDepth = generateEdgeDepths(width, rng, 4, 12, 1.1);
  const bottomDepth = generateEdgeDepths(width, rng, 5, 14, 1.35);
  const leftDepth = generateEdgeDepths(height, rng, 4, 11, 1.15);
  const rightDepth = generateEdgeDepths(height, rng, 5, 13, 1.4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const distTop = y;
      const distBottom = (height - 1) - y;
      const distLeft = x;
      const distRight = (width - 1) - x;

      const hardEdge = distTop <= topDepth[x]
        || distBottom <= bottomDepth[x]
        || distLeft <= leftDepth[y]
        || distRight <= rightDepth[y];

      const softEdge = distTop <= topDepth[x] + 3
        || distBottom <= bottomDepth[x] + 3
        || distLeft <= leftDepth[y] + 3
        || distRight <= rightDepth[y] + 3;

      if (hardEdge || (softEdge && rng() < 0.45)) {
        tileMap[y][x] = cloneTile(pickBoundaryTileVariant(boundaryTiles, x + Math.floor(rng() * 3), y, rng));
      }
    }
  }
}



function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = ((yi > y) !== (yj > y))
      && (x < (((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9)) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function buildRoomPolygon(roomWidth, roomHeight, rng, biomeConfig = null) {
  const irregularity = clamp(biomeConfig?.shapeIrregularity ?? 0.7, 0, 1);
  const range = biomeConfig?.roomSizeRange ?? [0.58, 0.9];
  const minScale = clamp(Math.min(range[0], range[1]), 0.35, 0.98);
  const maxScale = clamp(Math.max(range[0], range[1]), minScale, 0.98);

  const center = {
    x: Math.floor(roomWidth / 2) + Math.round((rng() - 0.5) * 8),
    y: Math.floor(roomHeight / 2) + Math.round((rng() - 0.5) * 8),
  };

  const baseRadius = (Math.min(roomWidth, roomHeight) * (minScale + ((maxScale - minScale) * rng()))) / 2;
  const vertexCount = randomInt(rng, 8, 12 + Math.round(irregularity * 6));
  const points = [];

  for (let i = 0; i < vertexCount; i += 1) {
    const angleJitter = ((rng() - 0.5) * (Math.PI / vertexCount)) * (0.4 + irregularity);
    const angle = ((Math.PI * 2 * i) / vertexCount) + angleJitter;
    const radialNoise = 1 + ((rng() - 0.5) * (0.3 + (irregularity * 0.65)));
    const radiusX = baseRadius * radialNoise;
    const radiusY = baseRadius * (0.8 + (rng() * 0.35)) * (1 + ((rng() - 0.5) * irregularity * 0.4));

    points.push({
      x: clamp(Math.round(center.x + (Math.cos(angle) * radiusX)), 1, roomWidth - 2),
      y: clamp(Math.round(center.y + (Math.sin(angle) * radiusY)), 1, roomHeight - 2),
    });
  }

  return points;
}

function applyPolygonMask(tileMap, boundaryTiles, rng, polygon) {
  for (let y = 0; y < tileMap.length; y += 1) {
    for (let x = 0; x < (tileMap[0]?.length ?? 0); x += 1) {
      if (pointInPolygon(x + 0.5, y + 0.5, polygon)) continue;
      tileMap[y][x] = cloneTile(pickBoundaryTileVariant(boundaryTiles, x, y, rng));
    }
  }
}
function paintIrregularTerrainPatch(tileMap, rng, { center, radius, tile, metadata, avoidMask, protectedMask, deformation = 0.35 }) {
  const width = tileMap[0].length;
  const height = tileMap.length;
  const radiusX = Math.max(2, Math.round(radius * (0.8 + rng() * 0.5)));
  const radiusY = Math.max(2, Math.round(radius * (0.8 + rng() * 0.5)));

  for (let y = center.y - radiusY - 1; y <= center.y + radiusY + 1; y += 1) {
    if (y < 1 || y >= height - 1) continue;
    for (let x = center.x - radiusX - 1; x <= center.x + radiusX + 1; x += 1) {
      if (x < 1 || x >= width - 1) continue;
      if (avoidMask.has(`${x},${y}`)) continue;
      const nx = (x - center.x) / Math.max(1, radiusX);
      const ny = (y - center.y) / Math.max(1, radiusY);
      const distortion = Math.sin((Math.atan2(ny, nx) * 3.4) + (rng() * Math.PI * 2)) * deformation;
      if ((nx * nx) + (ny * ny) + distortion + ((rng() - 0.5) * deformation * 0.5) > 1.03) continue;
      tileMap[y][x] = tileFrom(tile, metadata);
      protectedMask.add(`${x},${y}`);
    }
  }
}

function stampCells(tileMap, center, cells, tileBuilder) {
  for (const cell of cells) {
    const x = center.x + cell.x;
    const y = center.y + cell.y;
    if (!tileMap[y]?.[x]) continue;
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
      if ((x * x) + (y * y) <= radius * radius) cells.push({ x, y });
    }
  }
  return cells;
}

function canStamp(tileMap, center, cells, blockedMask) {
  for (const cell of cells) {
    const x = center.x + cell.x;
    const y = center.y + cell.y;
    if (!tileMap[y]?.[x]?.walkable) return false;
    if (blockedMask.has(`${x},${y}`)) return false;
  }
  return true;
}

function markCells(mask, center, cells, padding = 1) {
  for (const cell of cells) {
    const cx = center.x + cell.x;
    const cy = center.y + cell.y;
    for (let oy = -padding; oy <= padding; oy += 1) {
      for (let ox = -padding; ox <= padding; ox += 1) mask.add(`${cx + ox},${cy + oy}`);
    }
  }
}

export class TerrainGenerator {
  constructor({ roomWidth, roomHeight } = {}) {
    this.roomWidth = roomWidth;
    this.roomHeight = roomHeight;
  }

  initializeTiles(roomNode, rng, biomeConfig = null) {
    const biomeType = roomNode.biomeType ?? 'forest';
    const boundaryTiles = (biomeWallTypes[biomeType] ?? biomeWallTypes.forest).map((key) => tiles[key]).filter(Boolean);
    const grid = Array.from({ length: this.roomHeight }, (_, y) => Array.from({ length: this.roomWidth }, (_, x) => cloneTile(pickBoundaryTileVariant(boundaryTiles, x, y, rng))));

    for (let y = 0; y < this.roomHeight; y += 1) {
      for (let x = 0; x < this.roomWidth; x += 1) {
        const noise = rng();
        const patchBand = ((Math.floor(x / 11) + Math.floor(y / 9)) % 10) / 10;
        grid[y][x] = patchBand + noise * 0.35 > 0.94
          ? tileFrom(tiles.grassDark, { type: 'ground' })
          : tileFrom(tiles.grass, { type: 'ground' });
      }
    }

    const polygon = buildRoomPolygon(this.roomWidth, this.roomHeight, rng, biomeConfig);
    applyPolygonMask(grid, boundaryTiles, rng, polygon);
    applyBiomeBoundaryRing(grid, boundaryTiles, rng, biomeType, 2);

    return { grid, boundaryTiles, polygon };
  }

  generateExits(tileMap, roomNode, rng) {
    const roadMask = new Set();
    const limitedExits = pickExitSubset(roomNode.exits, this.roomWidth, this.roomHeight, rng);
    if (Object.keys(limitedExits).length > MAX_EXITS_PER_ROOM) {
      console.warn('Exit overflow detected');
    }

    const resolvedAnchors = resolveRoomAnchors(limitedExits, roomNode.entrances, this.roomWidth, this.roomHeight);
    const resolvedExits = Object.fromEntries(Object.entries(resolvedAnchors.exits).map(([id, anchor]) => [id, buildEdgePassage(anchor, this.roomWidth, this.roomHeight, rng)]));
    const resolvedEntrances = Object.fromEntries(Object.entries(resolvedAnchors.entrances).map(([id, anchor]) => [id, buildEdgePassage(anchor, this.roomWidth, this.roomHeight, rng)]));

    for (const passage of [...Object.values(resolvedExits), ...Object.values(resolvedEntrances)]) {
      const isVertical = passage.direction === 'north' || passage.direction === 'south';
      const depth = passage.triggerDepth ?? 7;
      for (let depthStep = 0; depthStep < depth; depthStep += 1) {
        if (isVertical) {
          const y = (passage.direction === 'north' ? 0 : this.roomHeight - 1) + (passage.direction === 'north' ? depthStep : -depthStep);
          for (let x = passage.edgeStart.x; x <= passage.edgeEnd.x; x += 1) carveRoadBrush(tileMap, x, y, MAIN_ROAD_WIDTH, roadMask);
        } else {
          const x = (passage.direction === 'west' ? 0 : this.roomWidth - 1) + (passage.direction === 'west' ? depthStep : -depthStep);
          for (let y = passage.edgeStart.y; y <= passage.edgeEnd.y; y += 1) carveRoadBrush(tileMap, x, y, MAIN_ROAD_WIDTH, roadMask);
        }
      }
      carveRoadBrush(tileMap, passage.roadAnchor.x, passage.roadAnchor.y, MAIN_ROAD_WIDTH, roadMask);
    }

    clearRoadCorridor(tileMap, roadMask);
    return { resolvedExits, resolvedEntrances, roadMask };
  }

  generateMainRoad(tileMap, center, anchors, rng, roadMask) {
    carveRoadBrush(tileMap, center.x, center.y, MAIN_ROAD_WIDTH, roadMask);
    const ordered = [...anchors].sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x));
    for (const anchor of ordered) {
      carveRoadToAnchor(tileMap, center, anchor, rng, { roadWidth: MAIN_ROAD_WIDTH, roadMask });
    }
    mergeNearbyRoads(tileMap, roadMask, rng, { roadWidth: MAIN_ROAD_WIDTH });
    clearRoadCorridor(tileMap, roadMask);
  }

  generateBranchRoads(tileMap, rng, anchors, mainRoadMask, branchRoadMask, center, biomeConfig = null) {
    const branchDensity = clamp(biomeConfig?.roadBranchDensity ?? 0.6, 0, 1);
    const mainRoadPoints = collectRoadPoints(mainRoadMask);
    for (const anchor of anchors) {
      if (rng() > branchDensity) continue;
      const target = nearestRoadPoint(anchor, mainRoadPoints) ?? center;
      carveRoadToAnchor(tileMap, anchor, target, rng, { roadWidth: BRANCH_ROAD_WIDTH, roadMask: branchRoadMask });
    }

    const desiredBranches = randomInt(rng, 1, Math.max(1, Math.round(2 + (8 * branchDensity))));
    for (let i = 0; i < desiredBranches; i += 1) {
      const branchStart = mainRoadPoints[randomInt(rng, 0, Math.max(0, mainRoadPoints.length - 1))] ?? center;
      const angle = rng() * Math.PI * 2;
      const distance = randomInt(rng, 10, 20);
      const target = {
        x: clamp(Math.round(branchStart.x + Math.cos(angle) * distance), 2, this.roomWidth - 3),
        y: clamp(Math.round(branchStart.y + Math.sin(angle) * distance), 2, this.roomHeight - 3),
      };
      carveRoadToAnchor(tileMap, branchStart, target, rng, { roadWidth: BRANCH_ROAD_WIDTH, roadMask: branchRoadMask });
    }

    mergeNearbyRoads(tileMap, branchRoadMask, rng, { roadWidth: BRANCH_ROAD_WIDTH, maxMerges: 6 });
    clearRoadCorridor(tileMap, branchRoadMask);
  }

  generateTerrainPatches() {
    // Terrain blobs intentionally removed. Environmental objects now come from ObjectPlacementSystem + ObjectLibrary.
  }

  placeLandmarks(tileMap, rng, roadMask, blockedMask, biomeConfig = null) {
    const roadPoints = collectRoadPoints(roadMask);
    const landmarkFrequency = clamp(biomeConfig?.landmarkFrequency ?? 0.65, 0, 1);
    const landmarkCount = randomInt(rng, 0, Math.max(1, Math.round(1 + (4 * landmarkFrequency))));
    for (let i = 0; i < landmarkCount; i += 1) {
      let placed = false;
      for (let attempt = 0; attempt < 45 && !placed; attempt += 1) {
        const road = roadPoints[randomInt(rng, 0, Math.max(0, roadPoints.length - 1))] ?? { x: Math.floor(this.roomWidth / 2), y: Math.floor(this.roomHeight / 2) };
        const center = {
          x: Math.round(road.x + Math.cos(rng() * Math.PI * 2) * randomInt(rng, 6, 12)),
          y: Math.round(road.y + Math.sin(rng() * Math.PI * 2) * randomInt(rng, 6, 12)),
        };
        const layouts = [
          { cells: diskCells(4), painter: () => tileFrom(tiles.dirt, { type: 'landmark-clearing' }) },
          { cells: diskCells(5), painter: () => tileFrom(tiles.grass, { type: 'landmark-clearing' }) },
          { cells: [...diskCells(3), ...ringCells(5)], painter: () => tileFrom(tiles.rockCliff, { type: 'landmark-rubble', walkable: true }) },
        ];
        const layout = layouts[randomInt(rng, 0, layouts.length - 1)];
        if (!canStamp(tileMap, center, layout.cells, blockedMask)) continue;
        stampCells(tileMap, center, layout.cells, layout.painter);
        markCells(blockedMask, center, layout.cells, 2);
        placed = true;
      }
    }
  }

  decorate(tileMap, rng, blockedMask) {
    const decorativeTiles = [
      () => tileFrom(tiles.grassDark, { char: '"', type: 'decorative', walkable: true }),
      () => tileFrom(tiles.pathPebble, { char: '*', fg: '#d86464', bg: '#3b2f20', type: 'decorative', walkable: true }),
      () => tileFrom(tiles.pathPebble, { char: '·', fg: '#a4adb8', bg: '#373838', type: 'decorative', walkable: true }),
    ];

    const attempts = Math.floor((this.roomWidth * this.roomHeight) / 85);
    for (let i = 0; i < attempts; i += 1) {
      const x = randomInt(rng, 2, this.roomWidth - 3);
      const y = randomInt(rng, 2, this.roomHeight - 3);
      if (blockedMask.has(`${x},${y}`)) continue;
      if (!tileMap[y]?.[x]?.walkable || tileMap[y][x].type === 'road') continue;
      tileMap[y][x] = decorativeTiles[randomInt(rng, 0, decorativeTiles.length - 1)]();
    }
  }
}
