/* eslint-env node */
import assert from 'node:assert/strict';
import { loadAllSpriteAssets, resetSpriteAssetStore } from '../data/SpriteAssetLoader.js';
import { updateEntityAnimation, DEBUG_DISABLE_PLAYER_ANIMATION } from '../systems/AnimationSystem.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { setEntityState } from '../systems/EntityStateSystem.js';

resetSpriteAssetStore();
await loadAllSpriteAssets('./assets');

assert.equal(DEBUG_DISABLE_PLAYER_ANIMATION, true);

const player = new Player(0, 0);
player.vx = 10;
setEntityState(player, 'walk');
player.animationState = 'walk';
player.frameIndex = 3;
player.currentFrame = 3;
player.frameTimer = 1.2;

updateEntityAnimation(player, 0.16, true, null);

assert.equal(player.animationState, 'idle');
assert.equal(player.frameIndex, 0);
assert.equal(player.currentFrame, 0);
assert.equal(player.frameTimer, 0);
assert.ok(Array.isArray(player.animationFrames));
assert.ok(player.animationFrames.length >= 1);

const enemy = new Enemy(0, 0, 'spider');
enemy.vx = enemy.speed ?? 1;
setEntityState(enemy, 'walk');
updateEntityAnimation(enemy, 0.01, true, null);
enemy.frameIndex = 1;
enemy.currentFrame = 1;
enemy.frameTimer = 0.05;
updateEntityAnimation(enemy, 0.01, true, null);

assert.equal(enemy.animationState, 'walk');
assert.equal(enemy.frameIndex, 1);
assert.equal(enemy.currentFrame, 1);
assert.notEqual(enemy.frameTimer, 0);

console.log('playerAnimationDebugToggle.test.mjs passed');
