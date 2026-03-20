import assert from 'node:assert/strict';
import { BiomeGenerator } from '../world/BiomeGenerator.js';
import { WorldMapManager } from '../world/WorldMapManager.js';
import { RoomTransitionSystem } from '../world/RoomTransitionSystem.js';
import { Player } from '../entities/Player.js';

function run() {
  const biomeGenerator = new BiomeGenerator({ roomWidth: 120, roomHeight: 90, runtimeConfig: null });
  const worldMapManager = new WorldMapManager({ biomeGenerator, roomWidth: 120, roomHeight: 90, runtimeConfig: null });

  const townSeed = 1337;
  const town = worldMapManager.enterStartingWorld(townSeed);
  assert.equal(town.type, 'town');
  assert.ok(Array.isArray(town.exits) && town.exits.length >= 1, 'Town should expose structured exits.');
  const houses = town.objects.filter((object) => object.enterable);
  assert.ok(houses.length >= 3 && houses.length <= 6, 'Town should generate multiple enterable houses.');
  assert.ok((town.npcs ?? []).length >= 2, 'Town should generate NPCs.');

  const sameTown = worldMapManager.enterStartingWorld(townSeed);
  assert.deepEqual(
    houses.map((house) => ({ id: house.id, x: house.x, y: house.y, interiorSeed: house.interiorSeed })),
    sameTown.objects.filter((object) => object.enterable).map((house) => ({ id: house.id, x: house.x, y: house.y, interiorSeed: house.interiorSeed })),
    'Town generation should be deterministic for the same seed.',
  );

  const house = houses[0];
  const interior = worldMapManager.loadMap({
    type: 'house_interior',
    seed: house.interiorSeed,
    context: { parentTownSeed: town.seed, houseId: house.id, houseIndex: 0, returnEntryId: `return-${house.id}`, returnPosition: { x: house.door.x, y: house.door.y + 2 } },
  });
  assert.equal(interior.type, 'house_interior');
  assert.equal(interior.seed, house.interiorSeed);
  assert.ok(interior.exits.some((exit) => exit.targetMapType === 'town'), 'Interior should contain a return exit.');

  const forestExit = town.exits.find((exit) => exit.targetMapType === 'forest');
  assert.ok(forestExit, 'Town should have a forest transition exit.');
  const forest = worldMapManager.resolveMapByExit(town, forestExit);
  assert.equal(forest.type, 'forest');
  assert.ok(forest.exits.some((exit) => exit.id === 'forest-town-return'), 'Forest start map should include a town return exit.');

  const transitionSystem = new RoomTransitionSystem({ biomeGenerator, worldMapManager, fadeDurationMs: 1 });
  const player = new Player(house.door.x, house.door.y + 2);
  transitionSystem.requestTransition({
    id: 'test-house-enter',
    targetMapType: 'house_interior',
    targetSeed: house.interiorSeed,
    targetEntryId: 'house-door',
    meta: {
      parentTownSeed: town.seed,
      returnEntryId: `return-${house.id}`,
      returnPosition: { x: house.door.x, y: house.door.y + 2 },
      houseId: house.id,
      houseIndex: 0,
    },
  });
  const entered = transitionSystem.update(0.01, { activeRoom: town, player });
  assert.equal(entered.room.type, 'house_interior', 'Transition system should enter interiors.');

  transitionSystem.requestTransition(entered.room.exits[0]);
  const returned = transitionSystem.update(0.01, { activeRoom: entered.room, player });
  assert.equal(returned.room.type, 'town', 'Interior exit should return to town.');
  assert.equal(Math.round(player.x), house.door.x);
  assert.equal(Math.round(player.y), house.door.y + 2);

  console.log('Town world generation tests passed.');
}

run();
