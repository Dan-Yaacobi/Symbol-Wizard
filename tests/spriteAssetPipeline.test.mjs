import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {
  createEmptySpriteAsset,
  ensureRequiredAnimations,
  normalizeSpriteAsset,
  resizeSprite,
  resizeSpriteAsset,
  validateSpriteAsset,
  getSpriteCollisionOffsets,
} from '../data/SpriteAssetSchema.js';
import { convertXpToSpriteAsset } from '../data/SpriteXpImporter.js';
import {
  loadAllSpriteAssets,
  resetSpriteAssetStore,
  registerSpriteAsset,
  getSpriteAsset,
  getSpriteAnimation,
  getSpriteFrame,
  getAnimationFrameCount,
} from '../data/SpriteAssetLoader.js';


function createXpLayer(cp437, fg = [255, 255, 255], bg = [0, 0, 0]) {
  return Buffer.from([
    1, 0, 0, 0,
    1, 0, 0, 0,
    cp437, 0, 0, 0,
    fg[0], fg[1], fg[2],
    bg[0], bg[1], bg[2],
  ]);
}

function createXpFile(layers) {
  return zlib.gzipSync(Buffer.concat([
    Buffer.from([1, 0, 0, 0, layers.length, 0, 0, 0]),
    ...layers,
  ]));
}

const emptyAsset = createEmptySpriteAsset('sample', 3, 2);
assert.equal(emptyAsset.animations.idle.length, 1);
assert.equal(emptyAsset.animations.walk.length, 0);
assert.equal(validateSpriteAsset(emptyAsset).valid, true);

const ensured = ensureRequiredAnimations({ id: 'partial', animations: { idle: [] } });
assert.deepEqual(Object.keys(ensured.animations).sort(), ['attack', 'idle', 'walk']);

const resizedAsset = resizeSpriteAsset(emptyAsset, 5, 4, 'whole sprite asset', { pin: 'top-left' });
assert.equal(resizedAsset.animations.idle[0].width, 5);

const spriteFrame = {
  width: 2,
  height: 2,
  offsetY: 0,
  cells: [
    [{ ch: 'A', fg: '#ffffff', bg: null }, { ch: 'B', fg: '#ffffff', bg: null }],
    [{ ch: 'C', fg: '#ffffff', bg: null }, { ch: 'D', fg: '#ffffff', bg: null }],
  ],
};
const resizedBigger = resizeSprite(spriteFrame, 4, 3, { pin: 'top-left' });
assert.equal(resizedBigger, spriteFrame);
assert.equal(spriteFrame.width, 4);
assert.equal(spriteFrame.height, 3);
assert.equal(spriteFrame.cells[0][0].ch, 'A');
assert.equal(spriteFrame.cells[1][1].ch, 'D');
assert.equal(spriteFrame.cells[2][3].ch, ' ');

resizeSprite(spriteFrame, 1, 1, { pin: 'top-left' });
assert.equal(spriteFrame.width, 1);
assert.equal(spriteFrame.height, 1);
assert.equal(spriteFrame.cells[0][0].ch, 'A');

const asset = normalizeSpriteAsset({ id: 'sample', animations: { idle: [{ width: 2, height: 1, cells: [[{ ch: 'A', fg: '#fff', bg: '#000' }, { ch: ' ', fg: null, bg: null }]] }], walk: [], attack: [] } });
assert.equal(validateSpriteAsset(asset).valid, true);

const collision = getSpriteCollisionOffsets({ width: 3, height: 2, offsetY: 1, cells: [[{ ch: ' ', fg: null, bg: null }, { ch: '#', fg: null, bg: null }, { ch: ' ', fg: null, bg: null }], [{ ch: '#', fg: null, bg: null }, { ch: '#', fg: null, bg: null }, { ch: '#', fg: null, bg: null }]] });
assert.equal(collision.length, 4);

const xp = createXpFile([createXpLayer(64), createXpLayer(33, [255, 255, 255], [64, 0, 0])]);
const imported = await convertXpToSpriteAsset(xp, { id: 'xp-sprite', animation: 'attack', existingAsset: emptyAsset });
assert.equal(imported.animations.attack.length, 2);
assert.equal(imported.animations.attack[0].cells[0][0].ch, '@');
assert.equal(imported.animations.attack[1].cells[0][0].ch, '!');
assert.equal(imported.animations.attack[1].cells[0][0].bg, '#400000');
assert.equal(imported.animations.idle.length, 1);
assert.equal(imported.animations.walk.length, 0);

resetSpriteAssetStore();
await loadAllSpriteAssets('./assets');
assert.ok(getSpriteAsset('player'));
assert.ok(getSpriteAsset('tree-dark'));
assert.ok(getSpriteAsset('barrel'));
assert.ok(getSpriteAsset('drop-resource'));
assert.equal(getSpriteAnimation('wasp', 'walk').length > 0, true);
const playerFrame = getSpriteFrame('player', 'walk', 1);
assert.equal(playerFrame.width, 5);
assert.equal(getAnimationFrameCount('player', 'walk') >= 2, true);
assert.equal(getSpriteAnimation('player', 'cast'), null);

resetSpriteAssetStore();
const registered = getSpriteAsset(registerSpriteAsset(asset).id);
assert.equal(registered.id, 'sample');
assert.equal(getSpriteFrame('sample', 'idle', 0).cells[0][0].ch, 'A');

console.log('spriteAssetPipeline.test.mjs passed');
