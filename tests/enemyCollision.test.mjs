import assert from 'node:assert/strict';

import { Enemy } from '../entities/Enemy.js';
import { applyPush, collidesWithWall, resolveWallOverlap } from '../systems/EnemyCollisionSystem.js';

function createRoom(width, height) {
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => ({
    walkable: x > 0 && y > 0 && x < width - 1 && y < height - 1,
  })));
}

function testPushStopsAtWalls() {
  const map = createRoom(12, 12);
  const enemy = new Enemy('spider', 2.5, 5);

  applyPush(enemy, -0.5, 0, map, 1);

  assert.equal(collidesWithWall(enemy, enemy.x, enemy.y, map), false);
  assert.ok(enemy.x >= 2.25);
}

function testCornerPushSlidesWithoutClipping() {
  const map = createRoom(12, 12);
  const enemy = new Enemy('spider', 2.5, 2.5);

  applyPush(enemy, -0.5, 0.5, map, 1);

  assert.equal(collidesWithWall(enemy, enemy.x, enemy.y, map), false);
  assert.ok(enemy.x >= 2.25);
  assert.ok(enemy.y > 2.5);
}

function testResolveWallOverlapEjectsEnemy() {
  const map = createRoom(12, 12);
  const enemy = new Enemy('forest_beetle', 0, 5);

  assert.equal(collidesWithWall(enemy, enemy.x, enemy.y, map), true);

  resolveWallOverlap(enemy, map);

  assert.equal(collidesWithWall(enemy, enemy.x, enemy.y, map), false);
}

function run() {
  testPushStopsAtWalls();
  testCornerPushSlidesWithoutClipping();
  testResolveWallOverlapEjectsEnemy();
  console.log('Enemy collision tests passed.');
}

run();
