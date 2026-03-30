/* eslint-env node */
import assert from 'node:assert/strict';
import { loadAllSpriteAssets, resetSpriteAssetStore, getSpriteFrame } from '../data/SpriteAssetLoader.js';
import { resolveSpriteRenderGlyph, spriteUsesAuthoredGlyphs } from '../systems/RenderSystem.js';
import { facingToDirection8, updateFacingFromVelocity, updateFacingTowardTarget } from '../systems/FacingSystem.js';

function renderGlyphMatrix(entity, sprite) {
  return sprite.cells.map((row) => row.map((cell) => resolveSpriteRenderGlyph(entity, sprite, cell?.ch ?? ' ')).join('')).join('\n');
}

resetSpriteAssetStore();
await loadAllSpriteAssets('./assets');

const plainFrame = getSpriteFrame('slime', 'walk', 0);
const authoredFrameA = getSpriteFrame('spider', 'walk', 0);
const authoredFrameB = getSpriteFrame('spider', 'walk', 1);

assert.ok(plainFrame);
assert.ok(authoredFrameA);
assert.ok(authoredFrameB);
assert.equal(spriteUsesAuthoredGlyphs(plainFrame), false);
assert.equal(spriteUsesAuthoredGlyphs(authoredFrameA), true);
assert.notEqual(renderGlyphMatrix({ type: 'enemy', spriteId: 'spider' }, authoredFrameA), renderGlyphMatrix({ type: 'enemy', spriteId: 'spider' }, authoredFrameB));

const facingEntity = { type: 'enemy', spriteId: 'spider', x: 0, y: 0, facing: { x: 0, y: 1 }, direction: 'S', vx: 0, vy: 0 };
updateFacingFromVelocity(facingEntity);
assert.deepEqual(facingEntity.facing, { x: 0, y: 1 });
assert.equal(facingEntity.direction, 'S');
facingEntity.vx = -1;
facingEntity.vy = 0;
for (let i = 0; i < 8; i += 1) updateFacingFromVelocity(facingEntity);
assert.ok(facingEntity.facing.x < 0);
assert.ok(['SW', 'W', 'NW'].includes(facingEntity.direction));
for (let i = 0; i < 12; i += 1) updateFacingTowardTarget(facingEntity, { x: facingEntity.x + 20, y: facingEntity.y });
assert.ok(facingEntity.facing.x > 0);
assert.ok(['SE', 'E', 'NE'].includes(facingEntity.direction));
assert.equal(facingToDirection8({ x: 0, y: -1 }), 'N');

console.log('renderSystemSpriteGlyphs.test.mjs passed');
