import assert from 'node:assert/strict';

import { Enemy, ENEMY_BEHAVIOR } from '../entities/Enemy.js';
import { updateEnemies } from '../systems/AISystem.js';
import { AbilitySystem } from '../systems/AbilitySystem.js';

function createConfig(overrides = {}) {
  return {
    get(key) {
      const values = {
        'enemies.detectRadius': 5,
        'enemies.attackRangeMultiplier': 1,
        'enemies.moveSpeedMultiplier': 1,
        'enemies.attackCooldownMultiplier': 1,
        'enemies.rangedAttackRange': 10,
        'enemies.rangedCooldown': 1.2,
        'enemies.tankSpeedMultiplier': 0.6,
        'enemies.flankerOffsetDistance': 5,
        'enemies.aggroChainRadius': 8,
        'enemies.swarmAggroRadius': 10,
        'enemies.swarmAggroChainDepth': 2,
        ...overrides,
      };
      return values[key];
    },
  };
}

function createEffectRecorder() {
  const effects = [];
  return {
    effects,
    spawnEffect(effect) {
      effects.push(effect);
    },
  };
}

function createAbilitySystem(player, enemies) {
  return new AbilitySystem({
    definitions: [],
    player,
    enemies,
    map: [],
    camera: { x: 0, y: 0, viewW: 20, viewH: 20, startShake() {} },
    spawnProjectile() {},
    reportDamage() {},
    onEnemySlain() {},
  });
}

function testAggroPersistsAfterDetection() {
  const player = { x: 0, y: 0, statusEffects: new Map(), activeStatuses: [] };
  const enemy = new Enemy('spider', 2, 0);
  const config = createConfig();

  const firstEffectSystem = createEffectRecorder();
  updateEnemies([enemy], player, 0.016, [], config, null, firstEffectSystem);

  assert.equal(enemy.isAggroed, true);
  assert.equal(enemy.aggroLocked, true);
  assert.equal(enemy.target, player);
  assert.equal(enemy.aggroFlashTimer, 0.3);
  assert.equal(firstEffectSystem.effects.some((effect) => effect.type === 'aggro-flash'), true);

  player.x = 50;
  player.y = 0;
  const secondEffectSystem = createEffectRecorder();
  updateEnemies([enemy], player, 0.016, [], config, null, secondEffectSystem);

  assert.equal(enemy.isAggroed, true);
  assert.equal(enemy.aggroLocked, true);
  assert.equal(enemy.target, player);
  assert.equal(enemy.aggroFlashTimer < 0.3 && enemy.aggroFlashTimer > 0, true);
  assert.equal(secondEffectSystem.effects.some((effect) => effect.type === 'aggro-flash'), false);
}

function testDamageImmediatelyActivatesAggro() {
  const player = { x: 25, y: 0, statusEffects: new Map(), activeStatuses: [] };
  const enemy = new Enemy('spider', 0, 0);
  const system = createAbilitySystem(player, [enemy]);

  assert.equal(enemy.isAggroed, false);
  assert.equal(enemy.target, null);

  system.damageEnemy(enemy, 3, { sourceX: player.x, sourceY: player.y });

  assert.equal(enemy.isAggroed, true);
  assert.equal(enemy.aggroLocked, true);
  assert.equal(enemy.target, player);
  assert.equal(enemy.aggroFlashTimer, 0.3);
  assert.equal(system.effects.some((effect) => effect.type === 'aggro-flash'), true);
}

function testRangedEnemiesChargeBeforeShooting() {
  const player = { x: 8, y: 0, statusEffects: new Map(), activeStatuses: [] };
  const enemy = new Enemy('wasp', 0, 0);
  const config = createConfig();
  const effectSystem = createEffectRecorder();
  const projectiles = [];

  enemy.isAggroed = true;
  enemy.aggroLocked = true;
  enemy.target = player;
  enemy.orbitPhase = 'shoot';
  enemy.attackTimer = 0;
  enemy.chargeDuration = 0.35;

  updateEnemies([enemy], player, 0.1, projectiles, config, null, effectSystem);
  assert.equal(enemy.state.type, 'attack');
  assert.equal(projectiles.length, 0);
  assert.equal(effectSystem.effects.some((effect) => effect.type === 'charge'), false);

  updateEnemies([enemy], player, 0.36, projectiles, config, null, effectSystem);
  assert.equal(projectiles.length, 1);
  assert.notEqual(enemy.state.type, 'attack');
  assert.equal(enemy.orbitPhase, 'wait');
}


function testSwarmAggroChainsOnlyToNearbySwarmEnemies() {
  const player = { x: 0, y: 0, statusEffects: new Map(), activeStatuses: [] };
  const config = createConfig({
    'enemies.aggroChainRadius': 3,
  });
  const system = { effects: [], spawnEffect(effect) { this.effects.push(effect); } };

  const source = new Enemy('spider', 2, 0);
  source.behavior = ENEMY_BEHAVIOR.SWARM;
  source.aggroRadius = 5;
  source.targetX = source.x;
  source.targetY = source.y;

  const nearbySwarm = new Enemy('spider', 9, 0);
  nearbySwarm.behavior = ENEMY_BEHAVIOR.SWARM;
  nearbySwarm.aggroRadius = 5;
  nearbySwarm.targetX = nearbySwarm.x;
  nearbySwarm.targetY = nearbySwarm.y;

  const chainedSwarm = new Enemy('spider', 17, 0);
  chainedSwarm.behavior = ENEMY_BEHAVIOR.SWARM;
  chainedSwarm.aggroRadius = 5;
  chainedSwarm.targetX = chainedSwarm.x;
  chainedSwarm.targetY = chainedSwarm.y;

  const nonSwarm = new Enemy('spider', 13, 2);
  nonSwarm.behavior = ENEMY_BEHAVIOR.CHASER;
  nonSwarm.aggroRadius = 5;
  nonSwarm.targetX = nonSwarm.x;
  nonSwarm.targetY = nonSwarm.y;

  const outOfRangeSwarm = new Enemy('spider', 40, 0);
  outOfRangeSwarm.behavior = ENEMY_BEHAVIOR.SWARM;
  outOfRangeSwarm.aggroRadius = 5;
  outOfRangeSwarm.targetX = outOfRangeSwarm.x;
  outOfRangeSwarm.targetY = outOfRangeSwarm.y;

  updateEnemies(
    [source, nearbySwarm, chainedSwarm, nonSwarm, outOfRangeSwarm],
    player,
    0.016,
    [],
    config,
    { map: null, tileSize: 1, system },
  );

  assert.equal(source.isAggroed, true);
  assert.equal(nearbySwarm.isAggroed, true);
  assert.equal(chainedSwarm.isAggroed, true);
  assert.equal(nonSwarm.isAggroed, false);
  assert.equal(outOfRangeSwarm.isAggroed, false);
  assert.equal(system.effects.length, 2);
  assert.deepEqual(system.effects.map((effect) => effect.type), ['swarm-link', 'swarm-link']);
}

function run() {
  testAggroPersistsAfterDetection();
  testDamageImmediatelyActivatesAggro();
  testSwarmAggroChainsOnlyToNearbySwarmEnemies();
  testRangedEnemiesChargeBeforeShooting();
  console.log('Enemy aggro tests passed.');
}

run();
