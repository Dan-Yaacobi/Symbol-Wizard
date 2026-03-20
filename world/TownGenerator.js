import { tiles, tileFrom } from './TilePalette.js';
import { House, StaticObject, TownNPC } from '../entities/WorldObjects.js';
import { ObjectPlacementSystem } from './ObjectPlacementSystem.js';
import { createSeededRng, hashSeed, pickOne, randomInt } from './SeededRandom.js';

function cloneTile(tile) {
  return { ...tile };
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

function carveWidePath(grid, mask, start, end, rng, halfWidth = 1) {
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
          grid[ty][tx] = cloneTile(edge ? tiles.dirtEdge : tiles.dirt);
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

function createExitCorridor(exit, width = 3, depth = 3) {
  const tilesOut = [];
  const halfWidth = Math.max(1, Math.floor(width / 2));
  for (let d = 0; d < depth; d += 1) {
    for (let w = -halfWidth; w <= halfWidth; w += 1) {
      tilesOut.push({ x: exit.position.x + w, y: exit.position.y + d });
    }
  }
  return {
    exitId: exit.id,
    triggerTiles: tilesOut,
  };
}

function createHouseObject({ houseId, x, y, variant, footprint, interiorSeed, door }) {
  const house = new House(x, y, variant);
  house.id = houseId;
  house.footprint = footprint;
  house.enterable = true;
  house.interiorSeed = interiorSeed;
  house.door = door;
  house.interactable = true;
  house.interactionType = 'enter';
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

  generateTown(seed) {
    const rng = createSeededRng(seed);
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

    const exits = [];
    const northExitX = center.x + randomInt(rng, -6, 6);
    const townToForestSeed = hashSeed(seed, 'forest-exit', 0);
    exits.push({
      id: 'town-forest-exit-0',
      position: { x: northExitX, y: 2 },
      targetMapType: 'forest',
      targetSeed: townToForestSeed,
      targetEntryId: 'forest-town-return',
      width: 3,
      label: 'Forest Path',
    });
    carveWidePath(grid, roadMask, { x: center.x, y: center.y }, { x: northExitX, y: 10 }, rng, 1);

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
      house.mapRef = {
        targetMapType: 'house_interior',
        targetSeed: interiorSeed,
        targetEntryId: 'house-door',
      };
      houses.push(house);
      markRect(blocked, left, top, houseWidth, houseHeight, 3);
      carveWidePath(grid, roadMask, { x: door.x, y: door.y + 2 }, { x: center.x + randomInt(rng, -8, 8), y: center.y + randomInt(rng, -4, 4) }, rng, 1);
    }

    const objectBlockedMask = new Set(blocked);
    for (const key of roadMask) objectBlockedMask.add(key);
    for (const exit of exits) {
      for (const tile of createExitCorridor(exit, exit.width, 5).triggerTiles) {
        objectBlockedMask.add(`${tile.x},${tile.y}`);
      }
    }

    const decorativeObjects = this.objectPlacementSystem.placeObjects({
      tiles: grid,
      rng,
      blockedMask: objectBlockedMask,
      roomId: `town-${seed}`,
      biomeType: 'forest',
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
      'Need supplies? The forest trail north is never the same twice.',
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
    };

    const exitCorridors = exits.map((exit) => createExitCorridor(exit, exit.width, 5));

    const map = {
      id: `town-${seed}`,
      type: 'town',
      seed,
      tiles: grid,
      objects: [...decorativeObjects, ...houses],
      npcs,
      entities: [],
      exits,
      entrances,
      exitCorridors,
      collisionMap: buildCollisionMap(grid, [...decorativeObjects, ...houses]),
      state: { visited: false },
      metadata: {
        plaza,
        houseCount,
        townExitSeed: townToForestSeed,
      },
    };

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
    grid[height - 1][doorX] = tileFrom(tiles.wood, { walkable: true });
    grid[height - 2][doorX] = cloneTile(tiles.floor);

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
      position: { x: doorX, y: height - 1 },
      targetMapType: 'town',
      targetSeed: options.parentTownSeed ?? seed,
      targetEntryId: options.returnEntryId ?? 'house-return',
      width: 1,
      meta: { returnPosition: options.returnPosition ?? null },
    }];

    const npcs = [];
    if ((options.houseIndex ?? 0) % 2 === 0) {
      npcs.push(createNpc(seed, 0, doorX + 4, 8, 'villager', 'Welcome in. It is cozy, but the town square is livelier.'));
    }

    return {
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
          spawn: { x: doorX, y: height - 2 },
          landingX: doorX,
          landingY: height - 2,
        },
      },
      exitCorridors: [{ exitId: 'house-exit', triggerTiles: [{ x: doorX, y: height - 1 }] }],
      collisionMap: buildCollisionMap(grid, objects),
      state: { visited: false },
      metadata: {
        parentTownSeed: options.parentTownSeed ?? null,
        houseId: options.houseId ?? null,
      },
    };
  }
}
