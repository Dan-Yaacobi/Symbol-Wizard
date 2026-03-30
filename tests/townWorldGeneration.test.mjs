/* global console */
import assert from 'node:assert/strict';
import { BiomeGenerator } from '../world/BiomeGenerator.js';
import { WorldMapManager } from '../world/WorldMapManager.js';
import { RoomTransitionSystem } from '../world/RoomTransitionSystem.js';
import { Player } from '../entities/Player.js';
import { buildCollidableMask, floodFillWalkable } from '../world/PathConnectivity.js';
import { MIN_ROAD_WIDTH } from '../world/GenerationConstants.js';
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

function expectedOffsetPosition(entrance) {
  if (entrance.spawn) {
    return { x: entrance.spawn.x, y: entrance.spawn.y };
  }
  if (!entrance.direction) {
    return {
      x: entrance.spawn?.x ?? entrance.landingX ?? entrance.x,
      y: entrance.spawn?.y ?? entrance.landingY ?? entrance.y,
    };
  }
  if (entrance.direction === 'north') return { x: entrance.x, y: entrance.y + 2 };
  if (entrance.direction === 'south') return { x: entrance.x, y: entrance.y - 2 };
  if (entrance.direction === 'west') return { x: entrance.x + 2, y: entrance.y };
  if (entrance.direction === 'east') return { x: entrance.x - 2, y: entrance.y };
  return { x: entrance.x, y: entrance.y };
}

function contiguousRoadSpan(room, point, axis) {
  let span = 1;
  const delta = axis === 'horizontal' ? { x: 1, y: 0 } : { x: 0, y: 1 };
  for (const sign of [-1, 1]) {
    let cursor = { x: point.x + (delta.x * sign), y: point.y + (delta.y * sign) };
    while (room.tiles?.[cursor.y]?.[cursor.x]?.walkable) {
      span += 1;
      cursor = { x: cursor.x + (delta.x * sign), y: cursor.y + (delta.y * sign) };
    }
  }
  return span;
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
  assert.equal(
    town.objects.some((object) => object.type === 'ant_den'),
    false,
    'Town object pool should not place forest-only ant dens.',
  );

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
  const townRoadAxis = forestExit.direction === 'north' || forestExit.direction === 'south' ? 'horizontal' : 'vertical';
  assert.ok(contiguousRoadSpan(town, forestExit.position, townRoadAxis) >= MIN_ROAD_WIDTH, 'Town border crossing should preserve the minimum road width.');
  const forestEntry = forest.entrances['forest_entry_from_town'];
  assert.equal(forestEntry.direction, forestExit.direction, 'Forest entry direction should mirror the connected town exit.');
  if (forestExit.direction === 'north' || forestExit.direction === 'south') {
    assert.equal(forestEntry.x, forestExit.position.x, 'Forest entry anchor should align with the town exit lane.');
  } else {
    assert.equal(forestEntry.y, forestExit.position.y, 'Forest entry anchor should align with the town exit lane.');
  }
  assert.deepEqual(forestEntry.spawn, { x: forestEntry.landingX, y: forestEntry.landingY }, 'Forest spawn should be the validated landing tile.');
  const forestRoadAxis = forestEntry.direction === 'north' || forestEntry.direction === 'south' ? 'horizontal' : 'vertical';
  assert.ok(contiguousRoadSpan(forest, { x: forestEntry.x, y: forestEntry.y }, forestRoadAxis) >= MIN_ROAD_WIDTH, 'Forest entry corridor should preserve the minimum road width.');
  let safeZoneWalkable = 0;
  for (let oy = -4; oy <= 4; oy += 1) {
    for (let ox = -4; ox <= 4; ox += 1) {
      if ((ox * ox) + (oy * oy) > 16) continue;
      if (forest.tiles?.[forestEntry.spawn.y + oy]?.[forestEntry.spawn.x + ox]?.walkable) safeZoneWalkable += 1;
    }
  }
  assert.ok(safeZoneWalkable >= 30, 'Forest entry should open into a broad, walkable safety zone.');
  assert.ok(forest.metadata?.reachability?.reachableTiles >= forest.metadata?.reachability?.minimumReachableArea, 'Forest entry connectivity validation should guarantee a sufficiently large reachable area.');

  const forestRoomExit = forest.exits.find((exit) => exit.targetRoomId);
  assert.ok(forestRoomExit, 'Forest start room should expose an internal room transition.');
  const connectedForestRoom = worldMapManager.resolveMapByExit(forest, forestRoomExit);
  assert.equal(connectedForestRoom.type, 'forest', 'Forest room transitions should stay inside the forest biome.');
  assert.notEqual(connectedForestRoom.sourceRoomId, forest.sourceRoomId, 'Forest room transition should load a different room.');
  assert.equal(connectedForestRoom.seed, forest.seed, 'Forest room transitions should keep the same biome seed.');
  const forestBackExit = connectedForestRoom.exits.find((exit) => exit.targetRoomId === forest.sourceRoomId);
  assert.ok(forestBackExit, 'Connected forest room should provide a path back to the start room.');
  const restoredForestStart = worldMapManager.resolveMapByExit(connectedForestRoom, forestBackExit);
  assert.equal(restoredForestStart.sourceRoomId, forest.sourceRoomId, 'Returning through the room graph should restore the start room.');
  assert.ok(restoredForestStart.exits.some((exit) => exit.targetMapType === 'town'), 'Returning to the start room should preserve the town return exit.');

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
  const houseDoorEntrance = entered.room.entrances['house-door'];
  assert.ok(houseDoorEntrance, 'House interior should expose the requested entrance.');
  const expectedHouseSpawn = expectedOffsetPosition(houseDoorEntrance);
  assert.ok(
    Math.abs(Math.round(player.x) - expectedHouseSpawn.x) <= 1 && Math.abs(Math.round(player.y) - expectedHouseSpawn.y) <= 1,
    'House entry spawn should land on or immediately beside the intended entrance landing tile.',
  );
  assert.ok(entered.room.tiles[player.y]?.[player.x]?.walkable, 'Offset house spawn should be walkable.');
  assert.ok(!entered.room.collisionMap?.[player.y]?.[player.x], 'Offset house spawn should not collide.');
  assert.equal(transitionSystem.detectExit(entered.room, player), null, 'Entering a room should not immediately retrigger its exit.');

  transitionSystem.requestTransition(entered.room.exits[0]);
  const returned = transitionSystem.update(0.01, { activeRoom: entered.room, player });
  assert.equal(returned.room.type, 'town', 'Interior exit should return to town.');
  assert.equal(Math.round(player.x), house.door.x);
  assert.equal(Math.round(player.y), house.door.y + 2);
  assert.equal(transitionSystem.detectExit(returned.room, player), null, 'Returning to town should not immediately retrigger the forest or house exit.');

  transitionSystem.requestTransition(forestExit);
  const enteredForest = transitionSystem.update(0.01, { activeRoom: town, player });
  assert.equal(enteredForest.room.type, 'forest', 'Town exit should enter the forest.');
  const forestEntrance = enteredForest.room.entrances['forest_entry_from_town'];
  const expectedForestSpawn = expectedOffsetPosition(forestEntrance);
  assert.ok(
    Math.round(player.x) >= expectedForestSpawn.x && Math.round(player.y) === expectedForestSpawn.y,
    'Forest entry spawn should land at or beyond the two-tile inside offset when avoiding an invalid exit trigger tile.',
  );
  assert.ok(enteredForest.room.tiles[player.y]?.[player.x]?.walkable, 'Forest spawn should be walkable.');
  assert.ok(!enteredForest.room.collisionMap?.[player.y]?.[player.x], 'Forest spawn should not collide.');
  assert.notDeepEqual(
    { x: Math.round(player.x), y: Math.round(player.y) },
    forestReturnExit.position,
    'Forest spawn should not land directly on the town return exit tile.',
  );
  assert.equal(transitionSystem.detectExit(enteredForest.room, player), null, 'Entering forest should not instantly trigger the town return exit.');


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
