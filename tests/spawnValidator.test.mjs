import assert from 'node:assert/strict';
import { isValidSpawnPosition, trySpawnPosition } from '../world/SpawnValidator.js';

function createRoom(width = 20, height = 20) {
  const tiles = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => ({
    walkable: x > 0 && y > 0 && x < width - 1 && y < height - 1,
    type: 'grass',
  })));
  const collisionMap = Array.from({ length: height }, () => Array.from({ length: width }, () => false));
  return { tiles, collisionMap };
}

function testObjectCollision() {
  const room = createRoom();
  const enemy = { radius: 1.3 };
  const object = { x: 10, y: 10, radius: 2.5, collision: true };
  assert.equal(isValidSpawnPosition({ x: 10, y: 10 }, enemy, { room, worldObjects: [object] }), false);
  assert.equal(isValidSpawnPosition({ x: 15, y: 15 }, enemy, { room, worldObjects: [object] }), true);
}

function testEntityCollision() {
  const room = createRoom();
  const candidate = { radius: 1.3 };
  const enemies = [{ id: 'e-1', alive: true, x: 8, y: 8, radius: 1.6 }];
  assert.equal(isValidSpawnPosition({ x: 9, y: 8 }, candidate, { room, entities: enemies }), false);
  assert.equal(isValidSpawnPosition({ x: 12, y: 8 }, candidate, { room, entities: enemies }), true);
}

function testRetrySearchFindsNearbyValidTile() {
  const room = createRoom();
  const enemy = { radius: 1.3 };
  const worldObjects = [{ x: 9, y: 9, radius: 2.5, collision: true }];
  const result = trySpawnPosition({ x: 9, y: 9 }, enemy, {
    room,
    worldObjects,
    maxAttempts: 16,
    searchRadius: 5,
    rng: (() => {
      const values = [0.0, 0.0, 0.25, 1, 0.5, 1];
      let index = 0;
      return () => {
        const value = values[index % values.length];
        index += 1;
        return value;
      };
    })(),
  });
  assert.ok(result.position, 'Expected retry search to find a nearby valid spawn.');
}

function run() {
  testObjectCollision();
  testEntityCollision();
  testRetrySearchFindsNearbyValidTile();
  console.log('Spawn validator tests passed.');
}

run();
