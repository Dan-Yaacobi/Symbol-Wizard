import assert from 'node:assert/strict';
import { ObjectPlacementSystem } from '../world/ObjectPlacementSystem.js';
import { OBJECT_CATEGORY, objectLibrary } from '../world/ObjectLibrary.js';

function createRng(seed = 123456789) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function makeTiles(width, height) {
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
    const isBoundary = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    return {
      type: isBoundary ? 'wall' : 'grass',
      walkable: !isBoundary,
      char: isBoundary ? '#' : '.',
      fg: '#ffffff',
      bg: null,
    };
  }));
}

function footprintTiles(object) {
  return (object.footprint ?? [[0, 0]]).map((cell) => {
    const [dx, dy] = Array.isArray(cell) ? cell : [cell.x, cell.y];
    return { x: object.x + dx, y: object.y + dy };
  });
}

function installTestObjects() {
  objectLibrary.test_exported_array = {
    id: 'test_exported_array',
    category: OBJECT_CATEGORY.ENVIRONMENT,
    biomeTags: ['placement-test'],
    footprint: [[0, 0], [1, 0], [0, 1]],
    tiles: [
      { x: 0, y: 0, char: 'A', fg: '#ffffff', bg: null },
      { x: 1, y: 0, char: 'A', fg: '#ffffff', bg: null },
      { x: 0, y: 1, char: 'A', fg: '#ffffff', bg: null },
    ],
    rotations: true,
    blocksMovement: true,
    interactable: false,
    destructible: false,
    spawnWeight: 1,
    clusterMin: 1,
    clusterMax: 1,
    clusterRadius: 1,
    variants: [],
    centerOffset: { x: 0, y: 0 },
    drops: [],
    preferredZones: ['denseForest'],
  };

  objectLibrary.test_exported_object = {
    id: 'test_exported_object',
    category: OBJECT_CATEGORY.ENVIRONMENT,
    biomeTags: ['placement-test'],
    footprint: [{ x: 0, y: 0 }, { x: -1, y: 0 }],
    tiles: [
      { x: 0, y: 0, char: 'B', fg: '#ffffff', bg: null },
      { x: -1, y: 0, char: 'B', fg: '#ffffff', bg: null },
    ],
    rotations: false,
    blocksMovement: true,
    interactable: false,
    destructible: false,
    spawnWeight: 1,
    clusterMin: 1,
    clusterMax: 1,
    clusterRadius: 1,
    variants: [],
    centerOffset: { x: 0, y: 0 },
    drops: [],
    preferredZones: ['denseForest'],
  };
}

function removeTestObjects() {
  delete objectLibrary.test_exported_array;
  delete objectLibrary.test_exported_object;
}

function testNoOverlapAndBoundaryProtection() {
  installTestObjects();
  try {
    const width = 24;
    const height = 24;
    const tiles = makeTiles(width, height);
    const system = new ObjectPlacementSystem();
    const occupiedTiles = new Set();
    const objects = system.placeObjects({
      tiles,
      rng: createRng(42),
      blockedMask: new Set(),
      occupiedTiles,
      roomId: 'room-test',
      biomeType: 'placement-test',
      safetyConfig: {
        minDistanceFromMapEdge: 0,
        objectDensity: 1,
        clusterDensity: 1,
        clusterRadiusMultiplier: 1,
        maxAttemptsPerObjectType: 120,
      },
    });

    assert.ok(objects.length > 0, 'Expected at least one object placement for test biome.');

    const seen = new Set();
    for (const object of objects) {
      for (const tile of footprintTiles(object)) {
        assert.ok(tile.x > 1 && tile.x < width - 2, `Object tile spawned on protected map boundary at ${tile.x},${tile.y}`);
        assert.ok(tile.y > 1 && tile.y < height - 2, `Object tile spawned on protected map boundary at ${tile.x},${tile.y}`);

        const key = `${tile.x},${tile.y}`;
        assert.ok(!seen.has(key), `Overlapping object footprint tile found at ${key}`);
        seen.add(key);
      }
    }

    for (const key of seen) {
      assert.ok(occupiedTiles.has(key), `Placed footprint tile ${key} was not registered in global occupancy grid.`);
    }
  } finally {
    removeTestObjects();
  }
}

function run() {
  testNoOverlapAndBoundaryProtection();
  console.log('Object placement footprint tests passed.');
}

run();
