import assert from 'node:assert/strict';
import { loadSpriteAssetsFromFolder, resetSpriteAssetStore } from '../data/SpriteAssetLoader.js';
import { getSpriteFrame } from '../entities/SpriteLibrary.js';
import { resolveSpriteRenderGlyph, spriteUsesAuthoredGlyphs } from '../systems/RenderSystem.js';

function renderGlyphMatrix(entity, sprite) {
  return sprite.cells.map((row) => row.map((cell) => resolveSpriteRenderGlyph(entity, sprite, cell?.ch ?? ' ')).join('')).join('\n');
}

resetSpriteAssetStore();
await loadSpriteAssetsFromFolder('./assets/sprites');

const legacyFrame = getSpriteFrame('slime', 'walk', 0);
const assetFrameA = getSpriteFrame('spider', 'walk', 0);
const assetFrameB = getSpriteFrame('spider', 'walk', 1);

assert.ok(legacyFrame);
assert.ok(assetFrameA);
assert.ok(assetFrameB);

assert.equal(spriteUsesAuthoredGlyphs(legacyFrame), false);
assert.equal(spriteUsesAuthoredGlyphs(assetFrameA), true);

const enemyEntity = { type: 'enemy' };
const renderedLegacy = renderGlyphMatrix(enemyEntity, legacyFrame);
assert.match(renderedLegacy, /#/);
assert.doesNotMatch(renderedLegacy, /x/);

const renderedAssetA = renderGlyphMatrix(enemyEntity, assetFrameA);
const renderedAssetB = renderGlyphMatrix(enemyEntity, assetFrameB);
assert.match(renderedAssetA, /x/);
assert.notEqual(renderedAssetA, renderedAssetB);
