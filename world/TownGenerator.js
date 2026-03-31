import { tiles, tileFrom } from './TilePalette.js';
import { House, StaticObject, TownNPC } from '../entities/WorldObjects.js';
import { ObjectPlacementSystem } from './ObjectPlacementSystem.js';
import { createSeededRng, hashSeed, pickOne, randomInt } from './SeededRandom.js';
import { buildCollidableMask, carveBoundaryCrossing, carvePath, floodFillWalkable } from './PathConnectivity.js';
import { createRegionResult, ensureRegionConnectivity, normalizeExit, placeRegionExits, townDefinitions } from './RegionGenerationSystem.js';
import { MIN_ROAD_WIDTH } from './GenerationConstants.js';
import { buildRoomTransitionCache } from './TransitionCache.js';

function cloneTile(tile) {
  return { ...tile };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeGrid(width, height, tile) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => cloneTile(tile)));
}

function paintGrass(grid, rng) {
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[0].length; x += 1) {
      grid[y][x] = cloneTile(rng() < 0.14 ? tiles.grassDark : tiles.grass);
    }
  }
}

function fillRect(grid, left, top, width, height, tile) {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      if (!grid[y]?.[x]) continue;
      grid[y][x] = cloneTile(tile);
    }
  }
}

function markRect(set, left, top, width, height, padding = 0) {
  for (let y = top - padding; y < top + height + padding; y += 1) {
    for (let x = left - padding; x < left + width + padding; x += 1) {
      set.add(`${x},${y}`);
    }
  }
}

function carveWidePath(grid, mask, start, end, rng, halfWidth = Math.ceil(MIN_ROAD_WIDTH / 2)) {
  const midA = {
    x: Math.round((start.x + end.x) / 2 + (rng() - 0.5) * 10),
    y: Math.round(start.y + (end.y - start.y) * 0.35 + (rng() - 0.5) * 8),
  };
  const midB = {
    x: Math.round((start.x + end.x) / 2 + (rng() - 0.5) * 10),
    y: Math.round(start.y + (end.y - start.y) * 0.7 + (rng() - 0.5) * 8),
  };
  const points = [start, midA, midB, end];

  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const cx = Math.round(a.x + ((b.x - a.x) * t));
      const cy = Math.round(a.y + ((b.y - a.y) * t));
      for (let oy = -halfWidth; oy <= halfWidth; oy += 1) {
        for (let ox = -halfWidth; ox <= halfWidth; ox += 1) {
          const tx = cx + ox;
          const ty = cy + oy;
          if (!grid[ty]?.[tx]) continue;
          const edge = Math.abs(ox) === halfWidth || Math.abs(oy) === halfWidth;
          grid[ty][tx] = tileFrom(edge ? tiles.dirtEdge : tiles.dirt, { type: 'road', walkable: true });
          mask.add(`${tx},${ty}`);
        }
      }
    }
  }
}

function buildCollisionMap(grid, objects = []) {
  const map = Array.from({ length: grid.length }, (_, y) => Array.from({ length: grid[0].length }, (_, x) => !grid[y][x].walkable));
  for (const object of objects) {
    if (!object?.collision) continue;
    const footprint = object.footprint ?? object.logicalShape?.tiles ?? [[0, 0]];
    for (const cell of footprint) {
      const dx = Array.isArray(cell) ? cell[0] : cell.x;
      const dy = Array.isArray(cell) ? cell[1] : cell.y;
      const x = Math.round(object.x + dx);
      const y = Math.round(object.y + dy);
      if (map[y]?.[x] == null) continue;
      map[y][x] = true;
    }
  }
  return map;
}

function sideDelta(side) {
  if (side === 'top') return { x: 0, y: -1 };
  if (side === 'bottom') return { x: 0, y: 1 };
  if (side === 'left') return { x: -1, y: 0 };
  return { x: 1, y: 0 };
}

function sideDirection(side) {
  if (side === 'top') return 'north';
  if (side === 'bottom') return 'south';
  if (side === 'left') return 'west';
  return 'east';
}

function edgeDistance(width, height, x, y) {
  return Math.min(x, y, (width - 1) - x, (height - 1) - y);
}

function computeEnvelopeMetrics(width, height, x, y, rngValue) {
  const envelopeBase = 6;
  const envelopeRange = 6;
  const transitionBase = 2;
  const transitionRange = 2;
  const sideDistance = edgeDistance(width, height, x, y);
  const radialX = (x / Math.max(1, width - 1)) - 0.5;
  const radialY = (y / Math.max(1, height - 1)) - 0.5;
  const radialDistance = Math.sqrt((radialX * radialX) + (radialY * radialY));
  const waveA = Math.sin((x * 0.11) + (rngValue * Math.PI * 2));
  const waveB = Math.cos((y * 0.09) - (rngValue * Math.PI * 1.7));
  const waveC = Math.sin(((x + y) * 0.045) + (rngValue * Math.PI * 3.1));
  const organicNoise = ((waveA * 0.45) + (waveB * 0.3) + (waveC * 0.25) + ((rngValue - 0.5) * 0.9));
  const envelopeThickness = clamp(
    Math.round(envelopeBase + (rngValue * envelopeRange) + (organicNoise * 2.75) + (radialDistance * 2.5)),
    6,
    12,
  );
  const transitionThickness = clamp(
    Math.round(transitionBase + (rngValue * transitionRange) + (organicNoise * 0.85)),
    2,
    4,
  );
  return {
    sideDistance,
    envelopeDepth: envelopeThickness,
    transitionDepth: envelopeThickness + transitionThickness,
    organicNoise,
    radialDistance,
  };
}

function chooseExitLayout(width, height, rng) {
  const side = pickOne(rng, ['top', 'bottom', 'left', 'right']) ?? 'top';
  const roadWidth = Math.max(MIN_ROAD_WIDTH, randomInt(rng, MIN_ROAD_WIDTH, MIN_ROAD_WIDTH + 1));
  const halfSpan = Math.floor((roadWidth - 1) / 2);

  if (side === 'top' || side === 'bottom') {
    const minX = 3 + halfSpan;
    const maxX = width - 4 - halfSpan;
    const x = randomInt(rng, minX, maxX);
    return {
      side,
      direction: sideDirection(side),
      roadWidth,
      edgeTiles: Array.from({ length: roadWidth }, (_, index) => ({
        x: x - halfSpan + index,
        y: side === 'top' ? 0 : height - 1,
      })),
      interiorAnchor: { x, y: side === 'top' ? 3 : height - 4 },
      exitPosition: { x, y: side === 'top' ? 0 : height - 1 },
    };
  }

  const minY = 3 + halfSpan;
  const maxY = height - 4 - halfSpan;
  const y = randomInt(rng, minY, maxY);
  return {
    side,
    direction: sideDirection(side),
    roadWidth,
    edgeTiles: Array.from({ length: roadWidth }, (_, index) => ({
      x: side === 'left' ? 0 : width - 1,
      y: y - halfSpan + index,
    })),
    interiorAnchor: { x: side === 'left' ? 3 : width - 4, y },
    exitPosition: { x: side === 'left' ? 0 : width - 1, y },
  };
}

function createExitCorridor(exit, direction, width = 3, depth = 3) {
  const tilesOut = [];
  const lowOffset = -Math.floor((width - 1) / 2);
  const highOffset = Math.ceil((width - 1) / 2);
  const outward = sideDelta(direction === 'north' ? 'top' : direction === 'south' ? 'bottom' : direction === 'west' ? 'left' : 'right');
  const delta = { x: -outward.x, y: -outward.y };
  const perp = direction === 'north' || direction === 'south' ? { x: 1, y: 0 } : { x: 0, y: 1 };
  for (let d = 0; d < depth; d += 1) {
    for (let w = lowOffset; w <= highOffset; w += 1) {
      tilesOut.push({
        x: exit.position.x + (delta.x * d) + (perp.x * w),
        y: exit.position.y + (delta.y * d) + (perp.y * w),
      });
    }
  }
  return {
    exitId: exit.id,
    triggerTiles: tilesOut,
  };
}

function paintForestEnvelope(grid, rng, roadMask, exitLayout, center, plaza) {
  const width = grid[0]?.length ?? 0;
  const height = grid.length;
  const denseVariants = [tiles.denseTree, tiles.denseTreeSpire, tiles.denseTreeBloom, tiles.denseTreeCanopy, tiles.denseTreeShadow];
  const transitionProps = [
    () => cloneTile(tiles.grassDark),
    () => tileFrom(tiles.grassDark, { char: '"', type: 'transition-grass', walkable: true }),
    () => tileFrom(tiles.pathPebble, { char: '*', fg: '#7fb06e', bg: '#243526', type: 'transition-prop', walkable: true }),
    () => tileFrom(tiles.pathPebble, { char: '·', fg: '#9bb18b', bg: '#1f2c22', type: 'transition-prop', walkable: true }),
  ];
  const envelopeMask = new Set();
  const denseMask = new Set();
  const transitionMask = new Set();

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const localRng = rng();
      const metrics = computeEnvelopeMetrics(width, height, x, y, localRng);
      const key = `${x},${y}`;
      const plazaDistance = Math.hypot(x - center.x, y - center.y);
      const preserveTownInterior = x >= plaza.left - 8
        && x <= plaza.left + plaza.width + 8
        && y >= plaza.top - 8
        && y <= plaza.top + plaza.height + 8
        && plazaDistance < Math.max(plaza.width, plaza.height) * 1.05;

      if (preserveTownInterior) continue;
      if (roadMask.has(key)) continue;

      if (metrics.sideDistance <= metrics.envelopeDepth) {
        envelopeMask.add(key);
        const edgeFactor = 1 - clamp(metrics.sideDistance / Math.max(1, metrics.envelopeDepth), 0, 1);
        const densityBias = clamp(0.72 + (edgeFactor * 0.2) + (metrics.organicNoise * 0.08), 0.7, 0.92);
        if (localRng <= densityBias) {
          const variantRoll = rng();
          if (variantRoll < 0.12) {
            grid[y][x] = cloneTile(tiles.rockCliff);
          } else {
            const variantIndex = Math.floor(rng() * denseVariants.length);
            grid[y][x] = cloneTile(denseVariants[variantIndex] ?? tiles.denseTree);
          }
          denseMask.add(key);
        } else {
          grid[y][x] = cloneTile(rng() < 0.55 ? tiles.grassDark : tiles.grass);
        }
        continue;
      }

      if (metrics.sideDistance <= metrics.transitionDepth) {
        envelopeMask.add(key);
        transitionMask.add(key);
        const edgeFactor = 1 - clamp((metrics.sideDistance - metrics.envelopeDepth) / Math.max(1, metrics.transitionDepth - metrics.envelopeDepth), 0, 1);
        const treeChance = clamp(0.18 + (edgeFactor * 0.35) + (metrics.organicNoise * 0.08), 0.14, 0.52);
        const rockChance = clamp(0.04 + (edgeFactor * 0.08), 0.02, 0.12);
        if (localRng < rockChance) {
          grid[y][x] = tileFrom(tiles.rockCliff, { type: 'transition-rock', walkable: false });
          denseMask.add(key);
        } else if (localRng < treeChance) {
          const variantIndex = Math.floor(rng() * denseVariants.length);
          grid[y][x] = cloneTile(denseVariants[variantIndex] ?? tiles.denseTree);
          denseMask.add(key);
        } else {
          grid[y][x] = transitionProps[Math.floor(rng() * transitionProps.length)]();
        }
      }
    }
  }

  const allowedEdge = new Set(exitLayout.edgeTiles.map(({ x, y }) => `${x},${y}`));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (!isBorder) continue;
      const key = `${x},${y}`;
      if (allowedEdge.has(key) || roadMask.has(key)) continue;
      envelopeMask.add(key);
      denseMask.add(key);
      grid[y][x] = cloneTile(denseVariants[Math.floor(rng() * denseVariants.length)] ?? tiles.denseTree);
    }
  }

  return { envelopeMask, denseMask, transitionMask };
}

function carveTownExitRoad(grid, roadMask, exitLayout, center, rng) {
  const width = grid[0]?.length ?? 0;
  const height = grid.length;
  const pathEnd = { ...exitLayout.exitPosition };
  const denseVariants = [tiles.denseTree, tiles.denseTreeSpire, tiles.denseTreeBloom, tiles.denseTreeCanopy, tiles.denseTreeShadow];
  const driftRange = exitLayout.side === 'top' || exitLayout.side === 'bottom' ? 3 : 2;
  const curvedTarget = {
    x: clamp(exitLayout.interiorAnchor.x + randomInt(rng, -driftRange, driftRange), 2, width - 3),
    y: clamp(exitLayout.interiorAnchor.y + randomInt(rng, -driftRange, driftRange), 2, height - 3),
  };
  carveWidePath(grid, roadMask, { x: center.x, y: center.y }, curvedTarget, rng, Math.ceil(Math.max(MIN_ROAD_WIDTH, exitLayout.roadWidth) / 2));
  carveWidePath(grid, roadMask, curvedTarget, pathEnd, rng, Math.ceil(Math.max(MIN_ROAD_WIDTH, exitLayout.roadWidth) / 2));
  carveBoundaryCrossing(grid, pathEnd, exitLayout.direction, { width: Math.max(MIN_ROAD_WIDTH, exitLayout.roadWidth), carvedMask: roadMask });
  for (const tile of exitLayout.edgeTiles) {
    if (!grid[tile.y]?.[tile.x]) continue;
    grid[tile.y][tile.x] = tileFrom(tiles.dirt, { type: 'road', walkable: true });
    roadMask.add(`${tile.x},${tile.y}`);
  }
  const allowedEdge = new Set(exitLayout.edgeTiles.map(({ x, y }) => `${x},${y}`));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (!isBorder || allowedEdge.has(`${x},${y}`)) continue;
      roadMask.delete(`${x},${y}`);
      if (grid[y]?.[x]?.type === 'road') {
        grid[y][x] = cloneTile(denseVariants[Math.floor(rng() * denseVariants.length)] ?? tiles.denseTree);
      }
    }
  }
}

function sealForestLeaks(grid, envelopeMask, roadMask, exitLayout, rng) {
  const allowedRoad = new Set([...roadMask]);
  const denseVariants = [tiles.denseTree, tiles.denseTreeSpire, tiles.denseTreeBloom, tiles.denseTreeCanopy, tiles.denseTreeShadow];

  for (const key of envelopeMask) {
    if (allowedRoad.has(key)) continue;
    const [x, y] = key.split(',').map(Number);
    const isBorder = x === 0 || y === 0 || x === grid[0].length - 1 || y === grid.length - 1;
    if (!isBorder || !grid[y]?.[x]?.walkable) continue;
    grid[y][x] = cloneTile(rng() < 0.16 ? tiles.rockCliff : (denseVariants[Math.floor(rng() * denseVariants.length)] ?? tiles.denseTree));
  }

  const walkableEnvelopeTiles = [...envelopeMask].filter((key) => {
    if (roadMask.has(key)) return false;
    const [x, y] = key.split(',').map(Number);
    return Boolean(grid[y]?.[x]?.walkable);
  }).length;
  const densityValue = envelopeMask.size === 0 ? 1 : 1 - (walkableEnvelopeTiles / envelopeMask.size);
  console.log('Forest envelope density:', Number(densityValue.toFixed(3)));

  const borderLeaks = [];
  const allowedEdge = new Set(exitLayout.edgeTiles.map(({ x, y }) => `${x},${y}`));
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[0].length; x += 1) {
      const isBorder = x === 0 || y === 0 || x === grid[0].length - 1 || y === grid.length - 1;
      if (!isBorder) continue;
      const key = `${x},${y}`;
      const walkable = Boolean(grid[y][x]?.walkable);
      if (allowedEdge.has(key)) {
        if (!walkable) borderLeaks.push({ x, y, reason: 'exit-blocked' });
      } else if (walkable) {
        borderLeaks.push({ x, y, reason: 'border-leak' });
      }
    }
  }

  return {
    valid: borderLeaks.length === 0,
    leaks: borderLeaks,
    walkableEnvelopeTiles,
    densityValue,
  };
}



function ensureTownExitReachable({ grid, objects, spawn, exit, entrance, roadMask, rng, allowedEdgeTiles = [] }) {
  const objectMask = buildCollidableMask(objects);
  const reachable = floodFillWalkable(grid, spawn, objectMask);
  const exitKey = `${exit.position.x},${exit.position.y}`;
  const entranceKey = `${entrance.landingX},${entrance.landingY}`;

  if (!reachable.has(exitKey) || !reachable.has(entranceKey)) {
    console.warn('[TownGenerator] Exit connectivity repair', {
      exitReachable: reachable.has(exitKey),
      entranceReachable: reachable.has(entranceKey),
      exitId: exit.id,
    });
    carvePath(grid, spawn, exit.position, {
      rng,
      width: Math.max(MIN_ROAD_WIDTH, exit.width ?? MIN_ROAD_WIDTH),
      jitterBias: 0.32,
      carvedMask: roadMask,
      removableObjects: objects,
    });

    const allowedEdge = new Set(allowedEdgeTiles.map(({ x, y }) => `${x},${y}`));
    const denseVariants = [tiles.denseTree, tiles.denseTreeSpire, tiles.denseTreeBloom, tiles.denseTreeCanopy, tiles.denseTreeShadow];
    for (let y = 0; y < grid.length; y += 1) {
      for (let x = 0; x < grid[0].length; x += 1) {
        const isBorder = x === 0 || y === 0 || x === grid[0].length - 1 || y === grid.length - 1;
        const key = `${x},${y}`;
        if (!isBorder || allowedEdge.has(key)) continue;
        if (!grid[y][x]?.walkable) continue;
        grid[y][x] = cloneTile(denseVariants[Math.floor(rng() * denseVariants.length)] ?? tiles.denseTree);
        roadMask.delete(key);
      }
    }
  }

  const repairedMask = buildCollidableMask(objects);
  const finalReachable = floodFillWalkable(grid, spawn, repairedMask);
  return {
    exitReachable: finalReachable.has(exitKey),
    entranceReachable: finalReachable.has(entranceKey),
  };
}

function createHouseObject({ houseId, x, y, variant, footprint, interiorSeed, door }) {
  const house = new House(x, y, variant);
  house.id = houseId;
  house.footprint = footprint;
  house.enterable = true;
  house.interiorSeed = interiorSeed;
  house.door = door;
  house.isInteractable = true;
  house.interactable = true;
  house.interactionType = 'door';
  house.interactionMode = 'button';
  house.interactionPriority = 70;
  house.targetMapType = 'house_interior';
  house.targetMap = 'house_interior';
  house.targetSeed = interiorSeed;
  house.targetEntryId = 'house-door';
  house.meta = {
    houseId,
  };
  house.interactionData = {
    targetMap: 'house_interior',
    targetRoom: 'house_interior',
    targetSeed: interiorSeed,
    targetEntryId: 'house-door',
    houseId,
  };
  return house;
}

function createNpc(seed, index, x, y, role, dialogue) {
  const npc = new TownNPC({
    x,
    y,
    name: ['Lina', 'Brom', 'Ro', 'Mira', 'Tobin', 'Sela'][index % 6],
    role,
    dialogue,
    wanderRadius: 0,
  });
  npc.id = `npc-${seed}-${index}`;
  npc.speed = 0;
  return npc;
}

export class TownGenerator {
  constructor({ width = 240, height = 160, runtimeConfig = null } = {}) {
    this.width = width;
    this.height = height;
    this.runtimeConfig = runtimeConfig;
    this.objectPlacementSystem = new ObjectPlacementSystem();
  }

  generateTown(seed, context = {}) {
    const townType = context.townType ?? 'forestTown';
    const townDefinition = townDefinitions[townType] ?? townDefinitions.forestTown;
    const debug = context.options?.debug ?? false;
    const logDebug = debug ? (message, details = {}) => console.info('[TownGenerator]', message, details) : () => {};
    const rng = createSeededRng(seed);
    logDebug('generation started', { townType, seed });
    const grid = makeGrid(this.width, this.height, tiles.grass);
    paintGrass(grid, rng);

    const center = { x: Math.floor(this.width / 2), y: Math.floor(this.height / 2) };
    const plaza = {
      left: center.x - randomInt(rng, 12, 16),
      top: center.y - randomInt(rng, 8, 11),
      width: randomInt(rng, 26, 34),
      height: randomInt(rng, 16, 22),
    };
    fillRect(grid, plaza.left, plaza.top, plaza.width, plaza.height, tileFrom(tiles.dirt, { bg: '#3f3126' }));

    const roadMask = new Set();
    markRect(roadMask, plaza.left, plaza.top, plaza.width, plaza.height, 0);

    const exitLayout = chooseExitLayout(this.width, this.height, rng);
    const forestSeed = hashSeed(seed, 'forest_exit');
    const exitId = 'town_exit_main';
    const exits = [{
      id: exitId,
      category: 'interactable',
      isInteractable: true,
      interactionType: 'exit',
      interactionMode: 'touch',
      interactionPriority: 100,
      interactionData: {
        targetMap: 'forest',
        targetBiome: null,
        targetRoomId: null,
        targetExitId: null,
        targetEntryId: 'forest_entry_from_town',
        targetSeed: forestSeed,
      },
      position: { ...exitLayout.exitPosition },
      direction: exitLayout.direction,
      side: exitLayout.side,
      targetMapType: 'forest',
      targetMap: 'forest',
      targetSeed: forestSeed,
      targetEntryId: 'forest_entry_from_town',
      width: exitLayout.roadWidth,
      label: 'Forest Path',
      targetType: 'biome',
      targetId: forestSeed,
      meta: {
        townSeed: seed,
        forestSeed,
        exitSide: exitLayout.side,
        roadWidth: exitLayout.roadWidth,
        townType,
      },
    }].map((exit) => normalizeExit(exit, { targetType: 'biome', targetId: forestSeed, entryId: 'forest_entry_from_town' }));

    const candidateRows = [plaza.top - 24, plaza.top - 10, plaza.top + plaza.height + 8, plaza.top + plaza.height + 22]
      .filter((y) => y > 10 && y < this.height - 14);
    const houseCount = randomInt(rng, 3, 6);
    const houses = [];
    const blocked = new Set();
    markRect(blocked, plaza.left, plaza.top, plaza.width, plaza.height, 3);

    for (let index = 0; index < houseCount; index += 1) {
      const houseWidth = randomInt(rng, 9, 11);
      const houseHeight = 5;
      const row = candidateRows[index % candidateRows.length] ?? (center.y + ((index % 2 === 0) ? -20 : 20));
      const spread = Math.floor((index - ((houseCount - 1) / 2)) * 24 + (rng() - 0.5) * 10);
      const left = Math.max(6, Math.min(this.width - houseWidth - 6, center.x + spread - Math.floor(houseWidth / 2)));
      const top = Math.max(6, Math.min(this.height - houseHeight - 8, row));
      const door = { x: left + Math.floor(houseWidth / 2), y: top + houseHeight - 1 };
      const footprint = [];
      for (let fy = 0; fy < houseHeight; fy += 1) {
        for (let fx = 0; fx < houseWidth; fx += 1) footprint.push([fx - Math.floor(houseWidth / 2), fy - 2]);
      }
      const houseId = `house-${index}`;
      const interiorSeed = hashSeed(seed, houseId);
      const house = createHouseObject({
        houseId,
        x: left + Math.floor(houseWidth / 2),
        y: top + 2,
        variant: pickOne(rng, ['red', 'blue', 'brown', 'red-chimney', 'blue-chimney']) ?? 'red',
        footprint,
        interiorSeed,
        door,
      });
      houses.push(house);
      markRect(blocked, left, top, houseWidth, houseHeight, 3);
      carveWidePath(grid, roadMask, { x: door.x, y: door.y + 2 }, { x: center.x + randomInt(rng, -8, 8), y: center.y + randomInt(rng, -4, 4) }, rng, Math.ceil(MIN_ROAD_WIDTH / 2));
    }

    carveTownExitRoad(grid, roadMask, exitLayout, center, rng);
    const forestEnvelope = paintForestEnvelope(grid, rng, roadMask, exitLayout, center, plaza);
    const boundaryValidation = sealForestLeaks(grid, forestEnvelope.envelopeMask, roadMask, exitLayout, rng);
    if (!boundaryValidation.valid) {
      throw new Error(`Town boundary validation failed for seed ${seed}: ${JSON.stringify(boundaryValidation.leaks.slice(0, 8))}`);
    }

    const objectBlockedMask = new Set(blocked);
    for (const key of roadMask) objectBlockedMask.add(key);
    for (const key of forestEnvelope.denseMask) objectBlockedMask.add(key);
    for (const exit of exits) {
      for (const tile of createExitCorridor(exit, exit.direction, exit.width, 5).triggerTiles) {
        objectBlockedMask.add(`${tile.x},${tile.y}`);
      }
    }

    const decorativeObjects = this.objectPlacementSystem.placeObjects({
      tiles: grid,
      rng,
      blockedMask: objectBlockedMask,
      roomId: `town-${seed}`,
      biomeType: 'forest',
      mapType: 'town',
      safetyConfig: {
        pathTiles: Array.from(roadMask).map((key) => {
          const [x, y] = key.split(',').map(Number);
          return { x, y };
        }),
        objectDensity: 0.55,
        clusterDensity: 0.7,
        minDistanceFromPath: 3,
        minDistanceFromExit: 5,
      },
    });

    const npcSpots = [
      { x: center.x - 4, y: center.y - 2 },
      { x: center.x + 8, y: center.y + 1 },
      { x: plaza.left + 4, y: plaza.top + plaza.height - 3 },
      { x: plaza.left + plaza.width - 5, y: plaza.top + 3 },
    ];
    const roles = ['villager', 'merchant', 'guard', 'villager'];
    const lines = [
      'The square stays busy whenever the forest road is safe.',
      'Need supplies? The forest trail beyond the gate is never the same twice.',
      'Keep the paths clear and the town will thrive.',
      'Some homes keep their doors open for friendly travelers.',
    ];
    const npcCount = randomInt(rng, 2, 4);
    const npcs = npcSpots.slice(0, npcCount).map((spot, index) => createNpc(seed, index, spot.x, spot.y, roles[index], lines[index]));

    const entryX = center.x;
    const entryY = Math.min(this.height - 4, plaza.top + plaza.height + 6);
    const entrances = {
      'initial-spawn': {
        id: 'initial-spawn',
        x: entryX,
        y: entryY,
        spawn: { x: entryX, y: entryY },
        landingX: entryX,
        landingY: entryY,
      },
      [exitId]: {
        id: exitId,
        x: exitLayout.interiorAnchor.x,
        y: exitLayout.interiorAnchor.y,
        spawn: { x: exitLayout.interiorAnchor.x, y: exitLayout.interiorAnchor.y },
        landingX: exitLayout.interiorAnchor.x,
        landingY: exitLayout.interiorAnchor.y,
      },
    };

    const exitCorridors = exits.map((exit) => createExitCorridor(exit, exit.direction, exit.width, 5));

    const validation = ensureTownExitReachable({
      grid,
      objects: decorativeObjects,
      spawn: { x: entryX, y: entryY },
      exit: exits[0],
      entrance: entrances[exitId],
      roadMask,
      rng,
      allowedEdgeTiles: exitLayout.edgeTiles,
    });

    const map = createRegionResult({
      id: `town-${seed}`,
      regionType: 'town',
      tiles: grid,
      objects: [...decorativeObjects, ...houses],
      npcs,
      entities: [],
      exits,
      entrances,
      exitCorridors,
      collisionMap: buildCollisionMap(grid, [...decorativeObjects, ...houses]),
      metadata: {
        townType,
        seed,
        biomeType: townDefinition.biomeType,
        plaza,
        houseCount,
        townExitSeed: forestSeed,
        townExitSide: exitLayout.side,
        townExitPosition: { ...exitLayout.exitPosition },
        boundaryValidation,
        forestEnvelope: {
          envelopeTiles: forestEnvelope.envelopeMask.size,
          denseTiles: forestEnvelope.denseMask.size,
          transitionTiles: forestEnvelope.transitionMask.size,
        },
        generationPipeline: ['terrain', 'structures', 'objects', 'exits', 'connectivity'],
        reachability: validation,
      },
    });

    placeRegionExits({ region: map, exits, metadataType: 'townType', metadataValue: townType, seed, debug });
    ensureRegionConnectivity(map, { spawn: { x: entryX, y: entryY }, debug, pathWidth: Math.max(MIN_ROAD_WIDTH, exitLayout.roadWidth) });
    buildRoomTransitionCache(map);
    logDebug('exit placement', { exits: map.exits.map((exit) => ({ id: exit.id, x: exit.x, y: exit.y, interactionData: exit.interactionData })) });
    console.log('Town exit side:', exitLayout.side, 'position:', exitLayout.exitPosition.x, exitLayout.exitPosition.y);
    console.log('Town → Forest', seed, '→', forestSeed);
    console.log('Generated town', seed, houseCount);
    return map;
  }

  generateHouseInterior(seed, options = {}) {
    const rng = createSeededRng(seed);
    const width = 28;
    const height = 20;
    const grid = makeGrid(width, height, tiles.wall);
    fillRect(grid, 1, 1, width - 2, height - 2, tiles.floor);

    const doorX = Math.floor(width / 2);
    for (let offset = -1; offset <= 1; offset += 1) {
      grid[height - 1][doorX + offset] = tileFrom(tiles.wood, { walkable: true });
      grid[height - 2][doorX + offset] = cloneTile(tiles.floor);
    }

    const objects = [];
    const furniture = [
      { id: 'table', spriteId: 'crate', x: doorX - 4, y: 8 },
      { id: 'bed', spriteId: 'barrel', x: width - 6, y: 6 },
      { id: 'stool', spriteId: 'vase', x: doorX + 3, y: 11 },
    ];
    const count = randomInt(rng, 1, furniture.length);
    for (let i = 0; i < count; i += 1) {
      const piece = furniture[i];
      objects.push(new StaticObject({
        id: `${piece.id}-${seed}-${i}`,
        type: piece.id,
        x: piece.x + randomInt(rng, -1, 1),
        y: piece.y + randomInt(rng, -1, 1),
        spriteId: piece.spriteId,
        radius: 1,
        collision: true,
        footprint: [[0, 0]],
      }));
    }

    const exits = [{
      id: 'house-exit',
      category: 'interactable',
      isInteractable: true,
      interactionType: 'exit',
      interactionMode: 'touch',
      interactionPriority: 100,
      interactionData: {
        targetMap: 'town',
        targetBiome: null,
        targetExitId: options.returnEntryId ?? 'house-return',
        targetEntryId: options.returnEntryId ?? 'house-return',
        targetSeed: options.parentTownSeed ?? seed,
      },
      position: { x: doorX, y: height - 1 },
      targetMapType: 'town',
      targetMap: 'town',
      targetSeed: options.parentTownSeed ?? seed,
      targetEntryId: options.returnEntryId ?? 'house-return',
      width: 1,
      meta: { returnPosition: options.returnPosition ?? null },
    }];

    const npcs = [];
    if ((options.houseIndex ?? 0) % 2 === 0) {
      npcs.push(createNpc(seed, 0, doorX + 4, 8, 'villager', 'Welcome in. It is cozy, but the town square is livelier.'));
    }

    const map = {
      id: `house-${seed}`,
      type: 'house_interior',
      seed,
      tiles: grid,
      objects,
      npcs,
      entities: [],
      exits,
      entrances: {
        'house-door': {
          id: 'house-door',
          x: doorX,
          y: height - 1,
          direction: 'south',
          spawn: { x: doorX, y: height - 2 },
          landingX: doorX,
          landingY: height - 2,
        },
        house_entry: {
          id: 'house_entry',
          x: doorX,
          y: height - 1,
          spawn: { x: doorX, y: height - 2 },
          landingX: doorX,
          landingY: height - 2,
        },
      },
      exitCorridors: [createExitCorridor({ id: 'house-exit', position: { x: doorX, y: height - 1 } }, 'south', 1, 2)],
      collisionMap: buildCollisionMap(grid, objects),
      state: { visited: false },
      metadata: {
        parentTownSeed: options.parentTownSeed ?? null,
        houseId: options.houseId ?? null,
      },
    };

    buildRoomTransitionCache(map);
    return map;
  }
}
