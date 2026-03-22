/* global console */
import assert from 'node:assert/strict';
import { BiomeGenerator } from '../world/BiomeGenerator.js';
import { WorldMapManager } from '../world/WorldMapManager.js';
import { RoomTransitionSystem } from '../world/RoomTransitionSystem.js';
import { Player } from '../entities/Player.js';
import { buildCollidableMask, floodFillWalkable } from '../world/PathConnectivity.js';
import { tryInteract } from '../systems/InteractionSystem.js';

function edgeDistance(width, height, x, y) {
  return Math.min(x, y, (width - 1) - x, (height - 1) - y);
}


function assertReachable(room, spawn, point, label) {
  const reachable = floodFillWalkable(room.tiles, spawn, buildCollidableMask(room.objects ?? []));
  assert.ok(reachable.has(`${point.x},${point.y}`), `${label} should be reachable from spawn.`);
}

function isPlayerCenterUsable(room, x, y) {
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const tile = room.tiles?.[y + oy]?.[x + ox];
      if (!tile?.walkable) return false;
    }
  }
  return true;
}

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
  const houseExitCorridor = interior.exitCorridors.find((corridor) => corridor.exitId === 'house-exit');
  assert.ok(houseExitCorridor, 'House interior should expose a return trigger corridor.');
  const usableHouseTrigger = houseExitCorridor.triggerTiles.find((tile) => isPlayerCenterUsable(interior, tile.x, tile.y));
  assert.ok(usableHouseTrigger, 'House return exit should expose at least one trigger tile the player can occupy.');
  assert.equal(transitionSystemDetectExit(interior, usableHouseTrigger, biomeGenerator, worldMapManager), 'house-exit', 'House return trigger tile should resolve through the transition system.');

  const forestExit = town.exits.find((exit) => exit.targetMapType === 'forest');
  assert.ok(forestExit, 'Town should have a forest transition exit.');
  const walkableEdges = [];
  const envelopeWalkable = [];
  const roadEnvelope = [];
  for (let y = 0; y < town.tiles.length; y += 1) {
    for (let x = 0; x < town.tiles[0].length; x += 1) {
      const tile = town.tiles[y][x];
      const onBorder = x === 0 || y === 0 || x === town.tiles[0].length - 1 || y === town.tiles.length - 1;
      if (onBorder && tile.walkable) walkableEdges.push({ x, y, type: tile.type });
      if (edgeDistance(town.tiles[0].length, town.tiles.length, x, y) <= 12) {
        if (tile.walkable) envelopeWalkable.push({ x, y, type: tile.type });
        if (tile.type === 'road') roadEnvelope.push({ x, y });
      }
    }
  }
  assert.equal(walkableEdges.length, forestExit.width, 'Only the road exit should remain open on the map border.');
  assert.ok(roadEnvelope.length >= forestExit.width * 6, 'Road should carve deeply through the forest envelope.');
  const envelopeDensity = 1 - ((envelopeWalkable.length - roadEnvelope.length) / Math.max(1, town.metadata.forestEnvelope.envelopeTiles));
  assert.ok(envelopeDensity >= 0.7, `Forest envelope should stay dense, got ${envelopeDensity.toFixed(3)}.`);
  assert.ok(town.metadata.forestEnvelope.transitionTiles > 0, 'Town should expose a transition band between town and forest.');
  assertReachable(town, town.entrances['initial-spawn'].spawn, forestExit.position, 'Town forest exit');
  assertReachable(town, town.entrances['initial-spawn'].spawn, town.entrances[forestExit.id].spawn, 'Town forest exit landing');
  const townExitCorridor = town.exitCorridors.find((corridor) => corridor.exitId === forestExit.id);
  assert.ok(townExitCorridor, 'Town should provide trigger tiles for the forest exit.');
  assert.ok(
    townExitCorridor.triggerTiles.every((tile) => tile.x >= 0 && tile.y >= 0 && tile.x < town.tiles[0].length && tile.y < town.tiles.length),
    'Town exit trigger tiles should stay inside the map bounds.',
  );
  const usableTownTrigger = townExitCorridor.triggerTiles.find((tile) => isPlayerCenterUsable(town, tile.x, tile.y));
  assert.ok(usableTownTrigger, 'Town forest exit should expose at least one trigger tile the player can occupy.');
  assert.equal(transitionSystemDetectExit(town, usableTownTrigger, biomeGenerator, worldMapManager), forestExit.id, 'Town forest exit trigger tile should resolve through the transition system.');

  const forest = worldMapManager.resolveMapByExit(town, forestExit);
  assert.equal(forest.type, 'forest');
  assert.ok(forest.exits.some((exit) => exit.targetMapType === 'town'), 'Forest start map should include a town return exit.');
  assertReachable(forest, forest.entrances['forest_entry_from_town'].spawn, forest.entrances['forest_entry_from_town'].spawn, 'Forest entry spawn');
  const forestReturnExit = forest.exits.find((exit) => exit.targetMapType === 'town');
  assert.ok(forestReturnExit, 'Forest should expose a town return exit.');
  assertReachable(forest, forest.entrances['forest_entry_from_town'].spawn, forestReturnExit.position, 'Forest town return exit');

  const transitionSystem = new RoomTransitionSystem({ biomeGenerator, worldMapManager, fadeDurationMs: 1 });
  const player = new Player(house.door.x, house.door.y);
  const houseExit = town.exits.find((exit) => exit.id === `return-${house.id}`);
  assert.ok(houseExit, 'Town should register each house door as a structured exit.');
  const interactResult = tryInteract({
    actor: player,
    room: town,
    positions: [{ x: house.door.x, y: house.door.y }],
    triggerMode: 'button',
    context: { transitionSystem },
  });
  assert.equal(interactResult.success, true, 'House doors should be interactable via the unified interaction system.');
  assert.equal(interactResult.reason, 'transition_requested', 'House door interactions should request a room transition.');
  const entered = transitionSystem.update(0.01, { activeRoom: town, player });
  assert.equal(entered.room.type, 'house_interior', 'Transition system should enter interiors.');

  transitionSystem.requestTransition(entered.room.exits[0]);
  const returned = transitionSystem.update(0.01, { activeRoom: entered.room, player });
  assert.equal(returned.room.type, 'town', 'Interior exit should return to town.');
  assert.equal(Math.round(player.x), house.door.x);
  assert.equal(Math.round(player.y), house.door.y + 2);


  const malformedRoom = {
    tiles: [[{ walkable: true, interaction: { id: 'broken-pickup', isInteractable: true, interactionMode: 'touch' } }]],
    objects: [],
    npcs: [],
    entities: [],
    exits: [],
    exitCorridors: [],
  };
  const malformedResult = tryInteract({
    actor: player,
    room: malformedRoom,
    positions: [{ x: 0, y: 0 }],
    triggerMode: 'touch',
    debug: { enabled: true, prefix: '[InteractionTest]' },
  });
  assert.equal(malformedResult.success, false, 'Malformed interactables should be skipped without crashing.');
  assert.equal(malformedResult.reason, 'missing_interaction_type', 'Malformed interactables should report a clear failure reason.');

  console.log('Town world generation tests passed.');
}

function transitionSystemDetectExit(room, tile, biomeGenerator, worldMapManager) {
  const transitionSystem = new RoomTransitionSystem({ biomeGenerator, worldMapManager, fadeDurationMs: 1 });
  const player = new Player(tile.x, tile.y);
  return transitionSystem.detectExit(room, player)?.id ?? null;
}

run();
