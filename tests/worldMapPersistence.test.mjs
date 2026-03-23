import assert from 'node:assert/strict';
import { BiomeGenerator } from '../world/BiomeGenerator.js';
import { WorldMapManager } from '../world/WorldMapManager.js';

const seed = 1337;
const biomeGenerator = new BiomeGenerator({ roomWidth: 120, roomHeight: 120 });
const worldMapManager = new WorldMapManager({ biomeGenerator, roomWidth: 120, roomHeight: 120 });

const town = worldMapManager.loadTown(seed);
assert.equal(town.id, `town-${seed}`);
assert.strictEqual(worldMapManager.loadTown(seed), town, 'Town should be cached by seed.');

const townForestExit = town.exits.find((exit) => exit.targetMapType === 'forest');
assert.ok(townForestExit, 'Town should expose a forest exit.');
assert.equal(townForestExit.targetEntryId, 'forest_entry_from_town');
assert.ok(townForestExit.targetRoomId, 'Town forest exit should point to a stable forest room.');

const forestStart = worldMapManager.resolveMapByExit(town, townForestExit);
assert.equal(forestStart.id, `forest-${townForestExit.targetSeed}-${forestStart.sourceRoomId}`);
assert.strictEqual(
  worldMapManager.loadForest(townForestExit.targetSeed, { roomId: forestStart.sourceRoomId }),
  forestStart,
  'Forest start room should be cached by stable room id.',
);

const forestReturnExit = forestStart.exits.find((exit) => exit.targetMapType === 'town');
assert.ok(forestReturnExit, 'Forest start room should link back to town.');
assert.equal(forestReturnExit.targetEntryId, townForestExit.id, 'Forest return exit should point at the originating town exit.');

const originalTownForestExit = structuredClone(townForestExit);
const returnedTown = worldMapManager.resolveMapByExit(forestStart, forestReturnExit);
assert.strictEqual(returnedTown, town, 'Returning from the forest should restore the same town instance.');
assert.deepEqual(townForestExit, originalTownForestExit, 'Town forest exit should remain unchanged after forest traversal.');

const forestStartAgain = worldMapManager.resolveMapByExit(returnedTown, townForestExit);
assert.strictEqual(forestStartAgain, forestStart, 'Town → Forest → Town → Forest should keep the same forest start room instance.');

const forestRoomExit = forestStart.exits.find((exit) => exit.targetRoomId);
assert.ok(forestRoomExit, 'Forest start room should link to another forest room.');
assert.notEqual(forestStartAgain.sourceRoomId, forestRoomExit.targetRoomId, 'Re-entering the forest should preserve a distinct internal room edge.');
const connectedForestRoom = worldMapManager.resolveMapByExit(forestStart, forestRoomExit);
assert.equal(connectedForestRoom.id, `forest-${forestStart.seed}-${connectedForestRoom.sourceRoomId}`);

const forestBackExit = connectedForestRoom.exits.find((exit) => exit.targetRoomId === forestStart.sourceRoomId);
assert.ok(forestBackExit, 'Connected forest room should expose a reverse edge.');
assert.strictEqual(
  worldMapManager.resolveMapByExit(connectedForestRoom, forestBackExit),
  forestStart,
  'Forest graph traversal should return to the same cached room instance.',
);

assert.notEqual(townForestExit.targetRoomId, town.id, 'Town forest exit should never self-loop to the town map.');
assert.equal(forestReturnExit.targetRoomId ?? null, null, 'Forest return exit should remain a town link, not an internal forest-room edge.');

console.log('World map persistence checks passed.');
