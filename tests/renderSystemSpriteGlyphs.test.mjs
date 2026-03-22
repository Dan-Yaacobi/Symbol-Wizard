/* eslint-env node */
import assert from 'node:assert/strict';
import { loadAllSpriteAssets, resetSpriteAssetStore, getSpriteFrame } from '../data/SpriteAssetLoader.js';
import { resolveSpriteRenderGlyph, spriteUsesAuthoredGlyphs } from '../systems/RenderSystem.js';
import { updateEntityFacingFromVelocity } from '../systems/EntityStateSystem.js';

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

function renderGlyphMatrixWithFacing(entity, sprite) {
  const width = sprite.width;
  return sprite.cells.map((row) => Array.from({ length: width }, (_, sx) => {
    const cellX = entity.facing === 'left' ? (width - 1) - sx : sx;
    return resolveSpriteRenderGlyph(entity, sprite, row[cellX]?.ch ?? ' ');
  }).join('')).join('\n');
}

const leftFacingEntity = { type: 'enemy', spriteId: 'spider', facing: 'left' };
assert.equal(renderGlyphMatrixWithFacing(leftFacingEntity, authoredFrameA), renderGlyphMatrixWithFacing({ type: 'enemy', spriteId: 'spider', facing: 'right' }, authoredFrameA).split('\n').map((row) => [...row].reverse().join('')).join('\n'));

const entityFacing = { facing: 'right', vx: 0 };
updateEntityFacingFromVelocity(entityFacing);
assert.equal(entityFacing.facing, 'right');
entityFacing.vx = -0.2;
updateEntityFacingFromVelocity(entityFacing);
assert.equal(entityFacing.facing, 'left');
entityFacing.vx = 0;
updateEntityFacingFromVelocity(entityFacing);
assert.equal(entityFacing.facing, 'left');

console.log('renderSystemSpriteGlyphs.test.mjs passed');
