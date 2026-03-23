/* eslint-env node */
import assert from 'node:assert/strict';
import { worldToScreenCell } from '../systems/RenderSystem.js';

const playerX = 10.4;
const cameraX = 4.15;

assert.equal(worldToScreenCell(playerX, cameraX), 6.25);
assert.notEqual(worldToScreenCell(playerX, cameraX), Math.round(playerX) - cameraX);

const playerY = 20.35;
const cameraY = 15.1;
assert.ok(Math.abs(worldToScreenCell(playerY, cameraY) - 5.25) < 1e-9);

console.log('renderCoordinatePrecision.test.mjs passed');
