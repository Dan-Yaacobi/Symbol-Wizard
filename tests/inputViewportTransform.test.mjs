/* eslint-env node */
import assert from 'node:assert/strict';
import { Viewport } from '../engine/Viewport.js';

globalThis.getComputedStyle = () => ({
  borderLeftWidth: '2px',
  borderTopWidth: '4px',
  borderRightWidth: '6px',
  borderBottomWidth: '8px',
});

const canvas = {
  width: 1200,
  height: 800,
  getBoundingClientRect() {
    return { left: 100, top: 50, width: 608, height: 412 };
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

const canvasPos = viewport.screenToCanvas(252, 174);
assert.deepEqual(canvasPos, { x: 300, y: 240 });


const borderEdgePos = viewport.screenToCanvas(102, 54);
assert.deepEqual(borderEdgePos, { x: 0, y: 0 });

const farCornerPos = viewport.screenToCanvas(702, 454);
assert.deepEqual(farCornerPos, { x: 1200, y: 800 });

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
