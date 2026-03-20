import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {
  createEmptySpriteAsset,
  ensureRequiredAnimations,
  normalizeSpriteAsset,
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
await loadAllSpriteAssets('./assets/sprites');
assert.ok(getSpriteAsset('player'));
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
