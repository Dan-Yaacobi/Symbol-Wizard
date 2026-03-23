/* eslint-env node */
import assert from 'node:assert/strict';
import { Viewport } from '../engine/Viewport.js';

const canvas = {
  width: 1200,
  height: 800,
  getBoundingClientRect() {
    return { left: 100, top: 50, width: 600, height: 400 };
  },
};

const renderer = {
  compositeScale: 2,
  offsetX: 80,
  offsetY: 40,
  background: {
    canvas: {
      width: 520,
      height: 290,
    },
  },
};

const viewport = new Viewport(canvas, renderer);
const camera = { x: 10, y: 20 };

const canvasPos = viewport.screenToCanvas(250, 170);
assert.deepEqual(canvasPos, { x: 300, y: 240 });

const worldPos = viewport.canvasToWorld(canvasPos.x, canvasPos.y, camera, 8, 8);
assert.equal(worldPos.logicalX, 110);
assert.equal(worldPos.logicalY, 100);
assert.equal(worldPos.x, 23.75);
assert.equal(worldPos.y, 32.5);
assert.equal(worldPos.inside, true);

const outside = viewport.canvasToWorld(20, 10, camera, 8, 8);
assert.equal(outside.rawLogicalX, -30);
assert.equal(outside.rawLogicalY, -15);
assert.equal(outside.logicalX, 0);
assert.equal(outside.logicalY, 0);
assert.equal(outside.inside, false);

console.log('inputViewportTransform.test.mjs passed');
