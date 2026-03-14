import { TerrainGenerator } from './TerrainGenerator.js';
import { ObjectPlacementSystem } from './ObjectPlacementSystem.js';
import { buildCollisionMap, scanExitCorridors } from './RuntimeSystems.js';

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mergeMask(target, source) {
  for (const key of source) target.add(key);
}

export class RoomGenerator {
  constructor({ roomWidth = 240, roomHeight = 160 } = {}) {
    this.roomWidth = roomWidth;
    this.roomHeight = roomHeight;
    this.terrainGenerator = new TerrainGenerator({ roomWidth, roomHeight });
    this.objectPlacementSystem = new ObjectPlacementSystem();
  }

  generate(roomNode) {
    const rng = createRng(roomNode.seed >>> 0);
    const center = { x: Math.floor(this.roomWidth / 2), y: Math.floor(this.roomHeight / 2) };

    const { grid } = this.terrainGenerator.initializeTiles(roomNode, rng);

    // 1) generate exits
    const {
      resolvedExits,
      resolvedEntrances,
      roadMask: exitRoadMask,
    } = this.terrainGenerator.generateExits(grid, roomNode, rng);

    const mainRoadMask = new Set(exitRoadMask);
    const branchRoadMask = new Set();
    const allAnchors = [
      ...Object.values(resolvedExits).map((passage) => passage.roadAnchor),
      ...Object.values(resolvedEntrances).map((passage) => passage.roadAnchor),
    ];

    // 2) generate main road
    this.terrainGenerator.generateMainRoad(grid, center, allAnchors, rng, mainRoadMask);

    // 3) generate branch roads
    this.terrainGenerator.generateBranchRoads(grid, rng, allAnchors, mainRoadMask, branchRoadMask, center);

    const roadMask = new Set();
    mergeMask(roadMask, mainRoadMask);
    mergeMask(roadMask, branchRoadMask);

    const spawnMask = new Set();
    for (const passage of Object.values(resolvedEntrances)) {
      if (!passage?.spawn) continue;
      const sx = Math.round(passage.spawn.x);
      const sy = Math.round(passage.spawn.y);
      for (let oy = -2; oy <= 2; oy += 1) {
        for (let ox = -2; ox <= 2; ox += 1) {
          spawnMask.add(`${sx + ox},${sy + oy}`);
        }
      }
    }

    const protectedMask = new Set(roadMask);
    mergeMask(protectedMask, spawnMask);

    // 4) generate terrain patches
    this.terrainGenerator.generateTerrainPatches(grid, rng, protectedMask, center);

    const objectBlockedMask = new Set(protectedMask);

    // 5) place objects
    const objects = this.objectPlacementSystem.placeObjects({
      tiles: grid,
      rng,
      roadMask,
      blockedMask: objectBlockedMask,
      roomId: roomNode.id,
    });

    // 6) place landmarks
    const landmarkMask = new Set(objectBlockedMask);
    this.terrainGenerator.placeLandmarks(grid, rng, roadMask, landmarkMask);

    // 7) decorate
    this.terrainGenerator.decorate(grid, rng, landmarkMask);

    // 8) build collision map
    const collisionMap = buildCollisionMap(grid, objects);
    const exitCorridors = scanExitCorridors(grid, resolvedExits, this.roomWidth, this.roomHeight);

    return {
      id: roomNode.id,
      tiles: grid,
      collisionMap,
      entities: [],
      objects,
      entrances: structuredClone(resolvedEntrances),
      exits: structuredClone(resolvedExits),
      exitCorridors,
      state: {
        visited: roomNode.state?.visited ?? false,
      },
    };
  }
}
