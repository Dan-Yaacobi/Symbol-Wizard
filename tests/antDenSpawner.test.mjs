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
      triggerRadius: 10,
      spawnIntervalMin: 0.8,
      spawnIntervalMax: 1.5,
      spawnCountMin: 5,
      spawnCountMax: 5,
      spawnRadius: 3,
      maxActiveAnts: 10,
      enemyType: 'fire_ant',
    },
    ...overrides,
  };
}

function createSequenceRng(values = []) {
  let index = 0;
  return () => {
    const value = values[index % values.length] ?? 0.5;
    index += 1;
    return value;
  };
}

function testActivationAndImmediateBurst() {
  const room = createRoom();
  const den = createDen();
  const player = { x: 12, y: 15 };
  const enemies = [];
  const spawnedTiles = [];
  const rng = createSequenceRng([
    0.4, // target spawn count roll
    0.1, // burst count => 1 ant
    0.25, 0.5, // spawn point angle/radius
    0.1, // next interval => 0.87s
  ]);
  const denFootprint = new Set((den.footprint ?? [[0, 0]]).map(([dx, dy]) => `${den.x + dx},${den.y + dy}`));

  updateAntDens({
    room,
    worldObjects: [den],
    enemies,
    player,
    dt: 0.1,
    rng,
    spawnEnemy: (_enemyType, spawnPoint) => {
      spawnedTiles.push(`${spawnPoint.x},${spawnPoint.y}`);
      const enemy = { alive: true, x: spawnPoint.x, y: spawnPoint.y };
      enemies.push(enemy);
      return enemy;
    },
  });

  assert.ok(spawnedTiles.length >= 1 && spawnedTiles.length <= 2, 'Ant den should burst-spawn 1-2 ants immediately.');
  for (const tile of spawnedTiles) {
    assert.equal(denFootprint.has(tile), false, `Spawned tile ${tile} should be outside den footprint.`);
  }
  assert.equal(den.state.phase, 'active');
  assert.equal(enemies[0].isAggroed, true);
  assert.equal(enemies[0].target, player);
}

function testSpawnIntervalRangeAndRandomization() {
  const room = createRoom();
  const den = createDen({ antSpawner: { ...createDen().antSpawner, spawnCountMin: 8, spawnCountMax: 8 } });
  const player = { x: 12, y: 15 };
  const enemies = [];
  const spawnTimes = [];
  const intervalSnapshots = [];
  const rng = createSequenceRng([
    0.5, // target count
    0.1, // activation burst = 1
    0.25, 0.35, // burst spawn point
    0.0, // interval => min 0.8
    0.6, 0.4, // next spawn point
    1.0, // interval => max 1.5
    0.8, 0.5, // next spawn point
    0.5, // interval => 1.15
  ]);
  let time = 0;

  const spawnEnemy = (_enemyType, spawnPoint) => {
    spawnTimes.push(time);
    intervalSnapshots.push(den.state.nextSpawnInterval);
    const enemy = { alive: true, x: spawnPoint.x, y: spawnPoint.y };
    enemies.push(enemy);
    return enemy;
  };

  updateAntDens({
    room,
    worldObjects: [den],
    enemies,
    player,
    dt: 0.1,
    rng,
    spawnEnemy,
  });
  time += 0.1;

  for (let i = 0; i < 35; i += 1) {
    updateAntDens({ room, worldObjects: [den], enemies, player, dt: 0.1, rng, spawnEnemy });
    time += 0.1;
  }

  assert.ok(spawnTimes.length >= 3, 'Expected at least three spawns in timing validation.');
  const intervals = spawnTimes.slice(1).map((entry, index) => Number((entry - spawnTimes[index]).toFixed(1)));
  assert.ok(intervals.some((value) => value >= 1.3), 'Expected a longer randomized interval.');
  assert.ok(intervals.some((value) => value <= 1.2), 'Expected a shorter randomized interval.');
  for (const interval of intervalSnapshots) {
    assert.ok(interval >= 0.8 && interval <= 1.5, `Spawn interval ${interval} outside expected range.`);
  }
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
  testActivationAndImmediateBurst();
  testSpawnIntervalRangeAndRandomization();
  testTotalCountAndDepletion();
  testDoesNotActivateWhenPlayerOutsideTrigger();
  console.log('Ant den spawner tests passed.');
}

run();
