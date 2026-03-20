import assert from 'node:assert/strict';

import { Enemy } from '../entities/Enemy.js';
import { updateEnemies } from '../systems/AISystem.js';
import { updateEnemyPlayerInteractions } from '../systems/CombatSystem.js';
import { setEntityState } from '../systems/EntityStateSystem.js';

function createConfig(overrides = {}) {
  return {
    get(key) {
      const values = {
        'enemies.detectRadius': 10,
        'enemies.attackRangeMultiplier': 1,
        'enemies.moveSpeedMultiplier': 1,
        'enemies.attackCooldownMultiplier': 1,
        'enemies.rangedAttackRange': 10,
        'enemies.rangedCooldown': 1.2,
        'enemies.rangedOrbitWaitDuration': 0.35,
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

function testMeleeWindupTelegraphsBeforeDamage() {
  const player = { x: 0, y: 0, radius: 1, hp: 20, statusEffects: new Map(), activeStatuses: [] };
  const enemy = new Enemy('spider', 1, 0);
  enemy.isAggroed = true;
  enemy.aggroLocked = true;
  enemy.target = player;
  enemy.attackTimer = 0;

  updateEnemies([enemy], player, 0.05, [], createConfig());
  assert.equal(enemy.state.type, 'attack');
  assert.equal(enemy.state.time, 0);

  updateEnemyPlayerInteractions([enemy], player, 0.05, null, createConfig());
  assert.equal(player.hp, 20);

  updateEnemies([enemy], player, (enemy.attackWindup ?? 0.2) + 0.01, [], createConfig());
  assert.equal(enemy.state.type, 'attack');
  assert.ok(enemy.state.time >= (enemy.attackWindup ?? 0.2));
}

function testMeleeAttackAppliesRecoilAfterHit() {
  const player = { x: 0, y: 0, radius: 1, hp: 20, statusEffects: new Map(), activeStatuses: [] };
  const enemy = new Enemy('spider', 1, 0);
  setEntityState(enemy, 'attack');
  enemy.state.time = (enemy.attackWindup ?? 0.2) + (enemy.attackHitTime ?? 0.08);
  enemy.attackImpactApplied = false;
  enemy.vx = 0;
  enemy.vy = 0;

  updateEnemyPlayerInteractions([enemy], player, 0.016, null, createConfig());

  assert.equal(player.hp, 18);
  assert.ok(enemy.hitKnockbackX > 0);
  assert.equal(enemy.hitKnockbackY, 0);
  assert.ok(enemy.hitKnockbackTimer > 0);
  assert.equal(enemy.attackImpactApplied, true);
  assert.ok(enemy.postAttackSlowTimer > 0);

  const beforeX = enemy.x;
  updateEnemies([enemy], player, 0.05, [], createConfig());
  assert.ok(enemy.x > beforeX);
}

function testEnemySpawnAttackTimersAreDesynced() {
  const timers = Array.from({ length: 20 }, () => new Enemy('spider', 0, 0).attackTimer);
  assert.ok(timers.every((timer) => timer >= 0 && timer <= 0.4));
  assert.ok(new Set(timers.map((timer) => timer.toFixed(4))).size > 1);
}

function testEnemyCollisionSeparatesOverlappingEnemies() {
  const player = { x: 20, y: 20, radius: 1, hp: 20, statusEffects: new Map(), activeStatuses: [] };
  const enemyA = new Enemy('spider', 5, 5);
  const enemyB = new Enemy('spider', 5.2, 5);
  for (const enemy of [enemyA, enemyB]) {
    enemy.isAggroed = false;
    enemy.aggroLocked = false;
    enemy.targetX = enemy.x;
    enemy.targetY = enemy.y;
    enemy.vx = 0;
    enemy.vy = 0;
  }

  updateEnemies([enemyA, enemyB], player, 0.016, [], createConfig());

  const distance = Math.hypot(enemyA.x - enemyB.x, enemyA.y - enemyB.y);
  assert.ok(distance >= 0.99);
}

function run() {
  testMeleeWindupTelegraphsBeforeDamage();
  testMeleeAttackAppliesRecoilAfterHit();
  testEnemySpawnAttackTimersAreDesynced();
  testEnemyCollisionSeparatesOverlappingEnemies();
  console.log('Enemy combat feel tests passed.');
}

run();
