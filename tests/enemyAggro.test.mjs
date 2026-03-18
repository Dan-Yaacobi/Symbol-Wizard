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

  updateEnemies([enemy], player, 0.016, [], config, null);
  assert.equal(enemy.isAggroed, true);
  assert.equal(enemy.aggroLocked, true);
  assert.equal(enemy.target, player);

  player.x = 50;
  player.y = 0;
  updateEnemies([enemy], player, 0.016, [], config, null);

  assert.equal(enemy.isAggroed, true);
  assert.equal(enemy.aggroLocked, true);
  assert.equal(enemy.target, player);
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
}

function run() {
  testAggroPersistsAfterDetection();
  testDamageImmediatelyActivatesAggro();
  console.log('Enemy aggro tests passed.');
}

run();
