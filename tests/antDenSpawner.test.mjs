import assert from 'node:assert/strict';

import { updateAntDens } from '../world/AntDenSystem.js';

function createRoom(width = 24, height = 24) {
  const tiles = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => ({
    walkable: x > 0 && y > 0 && x < width - 1 && y < height - 1,
    type: 'grass',
  })));
  const collisionMap = Array.from({ length: height }, () => Array.from({ length: width }, () => false));
  return { tiles, collisionMap };
}

function createDen(overrides = {}) {
  return {
    id: 'den-1',
    type: 'ant_den',
    x: 12,
    y: 12,
    state: {},
    antSpawner: {
      triggerRadius: 7,
      spawnInterval: 0.5,
      spawnCountMin: 5,
      spawnCountMax: 5,
      spawnRadius: 3,
      maxActiveAnts: 10,
      enemyType: 'fire_ant',
    },
    ...overrides,
  };
}

function testActivationAndSpawnCadence() {
  const room = createRoom();
  const den = createDen();
  const player = { x: 12, y: 15 };
  const enemies = [];

  updateAntDens({
    room,
    worldObjects: [den],
    enemies,
    player,
    dt: 0.1,
    spawnEnemy: () => {
      throw new Error('Should not spawn before interval elapses.');
    },
  });

  let spawned = 0;
  updateAntDens({
    room,
    worldObjects: [den],
    enemies,
    player,
    dt: 0.4,
    spawnEnemy: () => {
      spawned += 1;
      const enemy = { alive: true, x: 12, y: 12 };
      enemies.push(enemy);
      return enemy;
    },
  });

  assert.equal(spawned, 1);
  assert.equal(den.state.spawnedCount, 1);
  assert.equal(enemies[0].isAggroed, true);
  assert.equal(enemies[0].target, player);
}

function testTotalCountAndDepletion() {
  const room = createRoom();
  const den = createDen();
  const player = { x: 12, y: 12 };
  const enemies = [];
  let spawned = 0;

  for (let i = 0; i < 20; i += 1) {
    updateAntDens({
      room,
      worldObjects: [den],
      enemies,
      player,
      dt: 0.5,
      spawnEnemy: () => {
        spawned += 1;
        const enemy = { alive: true, x: 12, y: 12 };
        enemies.push(enemy);
        return enemy;
      },
    });
  }

  assert.equal(spawned, 5);
  assert.equal(den.state.phase, 'depleted');
}

function testDoesNotActivateWhenPlayerOutsideTrigger() {
  const room = createRoom();
  const den = createDen();
  const player = { x: 1, y: 1 };
  let spawned = 0;

  updateAntDens({
    room,
    worldObjects: [den],
    enemies: [],
    player,
    dt: 2,
    spawnEnemy: () => {
      spawned += 1;
      return { alive: true };
    },
  });

  assert.equal(spawned, 0);
  assert.equal(den.state.phase, 'idle');
}

function run() {
  testActivationAndSpawnCadence();
  testTotalCountAndDepletion();
  testDoesNotActivateWhenPlayerOutsideTrigger();
  console.log('Ant den spawner tests passed.');
}

run();
