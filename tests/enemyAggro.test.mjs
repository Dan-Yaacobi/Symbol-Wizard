import assert from 'node:assert/strict';

import { Enemy } from '../entities/Enemy.js';
import { updateEnemies } from '../systems/AISystem.js';
import { AbilitySystem } from '../systems/AbilitySystem.js';

function createConfig() {
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
  assert.equal(enemy.isChargingShot, true);
  assert.equal(projectiles.length, 0);
  assert.equal(effectSystem.effects.some((effect) => effect.type === 'charge'), true);

  updateEnemies([enemy], player, 0.3, projectiles, config, null, effectSystem);
  assert.equal(projectiles.length, 1);
  assert.equal(enemy.isChargingShot, false);
  assert.equal(enemy.orbitPhase, 'wait');
}

function run() {
  testAggroPersistsAfterDetection();
  testDamageImmediatelyActivatesAggro();
  testRangedEnemiesChargeBeforeShooting();
  console.log('Enemy aggro tests passed.');
}

run();
