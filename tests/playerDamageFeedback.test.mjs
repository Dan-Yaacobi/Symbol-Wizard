/* eslint-env node */
/* global process */
import assert from 'node:assert/strict';

import { Enemy } from '../entities/Enemy.js';
import { Projectile } from '../entities/Projectile.js';
import { updateEnemyPlayerInteractions, updateProjectiles } from '../systems/CombatSystem.js';
import { setEntityState } from '../systems/EntityStateSystem.js';

function createConfig() {
  return {
    get(key) {
      const values = {
        'enemies.attackRangeMultiplier': 1,
      };
      return values[key];
    },
  };
}

function testMeleeDamageReportsImpactContext() {
  const player = { x: 0, y: 0, radius: 1, hp: 20, hitImpact: { vx: 0, vy: 0, timer: 0, duration: 0 }, hitFlashTimer: 0, hitFlashDuration: 0 };
  const enemy = new Enemy('spider', 1, 0);
  setEntityState(enemy, 'attack');
  enemy.state.time = (enemy.attackWindup ?? 0.2) + (enemy.attackHitTime ?? 0.08);
  enemy.attackImpactApplied = false;
  let hitPayload = null;

  updateEnemyPlayerInteractions([enemy], player, 0.016, null, createConfig(), (payload) => {
    hitPayload = payload;
  });

  assert.equal(player.hp, 18);
  assert.ok(hitPayload);
  assert.equal(hitPayload.attacker, enemy);
  assert.equal(hitPayload.sourceX, enemy.x);
  assert.equal(hitPayload.sourceY, enemy.y);
  assert.ok(hitPayload.knockbackForce > 0);
  assert.equal(hitPayload.flashDuration, 0.1);
}

function testProjectileDamageReportsImpactContext() {
  const player = { x: 0, y: 0, radius: 1.8, hp: 20, hitImpact: { vx: 0, vy: 0, timer: 0, duration: 0 }, hitFlashTimer: 0, hitFlashDuration: 0 };
  const projectile = new Projectile(0.5, 0, -1, 0);
  projectile.faction = 'enemy';
  projectile.damage = 3;
  projectile.speed = 0;
  projectile.ttl = 1;
  projectile.radius = 0.8;
  let hitPayload = null;

  const result = updateProjectiles([projectile], [[{ walkable: true }]], [], player, 0.016, null, null, [], null, null, (payload) => {
    hitPayload = payload;
  });

  assert.equal(player.hp, 17);
  assert.equal(result.projectiles.length, 0);
  assert.ok(hitPayload);
  assert.equal(hitPayload.attacker, projectile);
  assert.equal(hitPayload.sourceX, projectile.x);
  assert.equal(hitPayload.sourceY, projectile.y);
  assert.equal(hitPayload.shakeDuration, 0.1);
  assert.equal(hitPayload.flashDuration, 0.1);
}

function run() {
  testMeleeDamageReportsImpactContext();
  testProjectileDamageReportsImpactContext();
  process.stdout.write('Player damage feedback tests passed.\n');
}

run();
