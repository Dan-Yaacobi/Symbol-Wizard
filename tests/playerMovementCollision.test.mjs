/* eslint-env node */
/* global process */
import assert from 'node:assert/strict';

import { attemptSlideMove } from '../systems/CollisionSystem.js';
import { collidesWithBlockingObjectAt } from '../systems/WorldObjectSystem.js';

function createEntity(x, y, radius = 0.6) {
  return { x, y, radius };
}

function createWorldObjects() {
  return [
    {
      x: 3.2,
      y: 2,
      radius: 0.7,
      collision: true,
      destroyed: false,
    },
  ];
}

function testCombinedDiagonalMovePreservesSingleStep() {
  const entity = createEntity(5, 5);

  const result = attemptSlideMove(entity, 0.25, -0.25, () => true);

  assert.deepEqual(result, { movedX: true, movedY: true, blocked: false });
  assert.equal(entity.x, 5.25);
  assert.equal(entity.y, 4.75);
}

function testBlockedDiagonalSlidesAlongOpenAxis() {
  const entity = createEntity(2, 2);
  const canOccupy = (x, y) => !(x >= 2.4 && y <= 1.6);

  const result = attemptSlideMove(entity, 0.5, -0.5, canOccupy);

  assert.deepEqual(result, { movedX: true, movedY: false, blocked: false });
  assert.equal(entity.x, 2.5);
  assert.equal(entity.y, 2);
}

function testObjectCollisionBlocksOnlyImpactedAxis() {
  const entity = createEntity(2, 2, 0.6);
  const worldObjects = createWorldObjects();
  const canOccupy = (x, y) => !collidesWithBlockingObjectAt(entity, x, y, worldObjects);

  const result = attemptSlideMove(entity, 0.8, 0.7, canOccupy);

  assert.deepEqual(result, { movedX: false, movedY: true, blocked: false });
  assert.equal(entity.x, 2);
  assert.equal(entity.y, 2.7);
}


function testSlideFallbackChecksAxesFromOriginalPosition() {
  const entity = createEntity(2, 2);
  const blockedPositions = new Set(['2.6,2', '2,2.6']);
  const canOccupy = (x, y) => {
    const key = `${Number(x.toFixed(1))},${Number(y.toFixed(1))}`;
    if (x === 2.6 && y === 2.6) return false;
    return !blockedPositions.has(key);
  };

  const result = attemptSlideMove(entity, 0.6, 0.6, canOccupy);

  assert.deepEqual(result, { movedX: false, movedY: false, blocked: true });
  assert.equal(entity.x, 2);
  assert.equal(entity.y, 2);
}

function testSlideFallbackUsesDominantAxisWhenBothSingleAxisMovesAreOpen() {
  const entity = createEntity(4, 4);
  const canOccupy = (x, y) => !(x === 4.8 && y === 4.4);

  const result = attemptSlideMove(entity, 0.8, 0.4, canOccupy);

  assert.deepEqual(result, { movedX: true, movedY: false, blocked: false });
  assert.equal(entity.x, 4.8);
  assert.equal(entity.y, 4);
}

function run() {
  testCombinedDiagonalMovePreservesSingleStep();
  testBlockedDiagonalSlidesAlongOpenAxis();
  testObjectCollisionBlocksOnlyImpactedAxis();
  testSlideFallbackChecksAxesFromOriginalPosition();
  testSlideFallbackUsesDominantAxisWhenBothSingleAxisMovesAreOpen();
  process.stdout.write('Player movement collision tests passed.\\n');
}

run();
