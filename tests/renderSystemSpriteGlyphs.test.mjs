import assert from 'node:assert/strict';
import { loadAllSpriteAssets, resetSpriteAssetStore, getSpriteFrame } from '../data/SpriteAssetLoader.js';
import { resolveSpriteRenderGlyph, spriteUsesAuthoredGlyphs } from '../systems/RenderSystem.js';

function renderGlyphMatrix(entity, sprite) {
  return sprite.cells.map((row) => row.map((cell) => resolveSpriteRenderGlyph(entity, sprite, cell?.ch ?? ' ')).join('')).join('\n');
}

resetSpriteAssetStore();
await loadAllSpriteAssets('./assets/sprites');

const plainFrame = getSpriteFrame('slime', 'walk', 0);
const authoredFrameA = getSpriteFrame('spider', 'walk', 0);
const authoredFrameB = getSpriteFrame('spider', 'walk', 1);

assert.ok(plainFrame);
assert.ok(authoredFrameA);
assert.ok(authoredFrameB);
assert.equal(spriteUsesAuthoredGlyphs(plainFrame), false);
assert.equal(spriteUsesAuthoredGlyphs(authoredFrameA), true);
assert.notEqual(renderGlyphMatrix({ type: 'enemy', spriteId: 'spider' }, authoredFrameA), renderGlyphMatrix({ type: 'enemy', spriteId: 'spider' }, authoredFrameB));

console.log('renderSystemSpriteGlyphs.test.mjs passed');
