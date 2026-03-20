import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {
  createEmptyFrame,
  createEmptySpriteAsset,
  ensureRequiredAnimations,
  normalizeSpriteAsset,
  resizeFrame,
  resizeSpriteAsset,
  validateSpriteAsset,
} from '../data/SpriteAssetSchema.js';
import { convertLegacyFrameToSpriteFrame, convertLegacySpriteEntryToAsset, getSpriteFrame as getLegacyCompatibleSpriteFrame, getSpriteCollisionOffsets } from '../entities/SpriteLibrary.js';
import { convertXpToSpriteAsset } from '../data/SpriteXpImporter.js';
import { loadSpriteAssetsFromFolder, resetSpriteAssetStore, getSpriteAsset, getSpriteAnimation, getSpriteFrame, getAnimationFrameCount } from '../data/SpriteAssetLoader.js';

function createXp(width, height, layers) {
  const header = Buffer.alloc(8);
  header.writeInt32LE(1, 0);
  header.writeInt32LE(layers.length, 4);
  const parts = [header];
  for (const layer of layers) {
    const layerHeader = Buffer.alloc(8);
    layerHeader.writeInt32LE(width, 0);
    layerHeader.writeInt32LE(height, 4);
    parts.push(layerHeader);
    for (let x = 0; x < width; x += 1) {
      for (let y = 0; y < height; y += 1) {
        const cell = layer(x, y) ?? { cp437: 0, fg: [0, 0, 0], bg: [0, 0, 0] };
        const buffer = Buffer.alloc(10);
        buffer.writeUInt32LE(cell.cp437 ?? 0, 0);
        buffer[4] = cell.fg?.[0] ?? 0; buffer[5] = cell.fg?.[1] ?? 0; buffer[6] = cell.fg?.[2] ?? 0;
        buffer[7] = cell.bg?.[0] ?? 0; buffer[8] = cell.bg?.[1] ?? 0; buffer[9] = cell.bg?.[2] ?? 0;
        parts.push(buffer);
      }
    }
  }
  return zlib.gzipSync(Buffer.concat(parts));
}

const emptyAsset = createEmptySpriteAsset('sample', 3, 2);
assert.equal(emptyAsset.defaultGrid.width, 3);
assert.equal(emptyAsset.animations.idle.length, 1);
assert.equal(emptyAsset.animations.walk.length, 0);
assert.equal(validateSpriteAsset(emptyAsset).valid, true);

const ensured = ensureRequiredAnimations({ id: 'partial', animations: { idle: [] } });
assert.deepEqual(Object.keys(ensured.animations).sort(), ['attack', 'idle', 'walk']);

const resizedFrame = resizeFrame(createEmptyFrame(2, 1), 4, 3, { pin: 'top-left' });
assert.equal(resizedFrame.width, 4);
assert.equal(resizedFrame.height, 3);

const resizedAsset = resizeSpriteAsset(emptyAsset, 5, 4, 'whole sprite asset', { pin: 'top-left' });
assert.equal(resizedAsset.defaultGrid.width, 5);
assert.equal(resizedAsset.animations.idle[0].width, 5);

const asset = normalizeSpriteAsset({ id: 'sample', animations: { idle: [{ width: 2, height: 1, cells: [[{ ch: 'A', fg: '#fff', bg: '#000' }, { ch: ' ', fg: null, bg: null }]] }] } });
assert.equal(validateSpriteAsset(asset).valid, true);

const legacyFrame = convertLegacyFrameToSpriteFrame([' @ ', '###']);
assert.equal(legacyFrame.width, 3);
assert.equal(legacyFrame.cells[0][1].ch, '@');

const legacyAsset = convertLegacySpriteEntryToAsset('legacy-spider', { idle: [[' # ']], walk: [['###'], [' @ ']] });
assert.equal(legacyAsset.id, 'legacy-spider');
assert.equal(legacyAsset.animations.walk.length, 2);

const collision = getSpriteCollisionOffsets({ width: 3, height: 2, offsetY: 1, cells: [[{ ch: ' ', fg: null, bg: null }, { ch: '#', fg: null, bg: null }, { ch: ' ', fg: null, bg: null }], [{ ch: '#', fg: null, bg: null }, { ch: '#', fg: null, bg: null }, { ch: '#', fg: null, bg: null }]] });
assert.deepEqual(collision, [{ x: 0, y: -2 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 }]);

const xp = createXp(2, 1, [
  (x) => x === 0 ? { cp437: 64, fg: [255, 0, 0], bg: [0, 0, 64] } : { cp437: 35, fg: [0, 255, 0], bg: [0, 0, 0] },
  (x) => x === 0 ? { cp437: 33, fg: [255, 255, 0], bg: [64, 0, 0] } : { cp437: 0, fg: [0, 0, 0], bg: [0, 0, 0] },
]);
const imported = await convertXpToSpriteAsset(xp, { id: 'xp-sprite', animation: 'attack', existingAsset: emptyAsset });
assert.equal(imported.animations.attack.length, 2);
assert.equal(imported.animations.attack[0].cells[0][0].ch, '@');
assert.equal(imported.animations.attack[1].cells[0][0].ch, '!');
assert.equal(imported.animations.attack[1].cells[0][0].bg, '#400000');
assert.equal(imported.animations.idle.length, 1);

resetSpriteAssetStore();
await loadSpriteAssetsFromFolder('./assets/sprites');
assert.ok(getSpriteAsset('player'));
assert.equal(getAnimationFrameCount('player', 'attack'), 1);
assert.equal(getSpriteAnimation('wasp', 'walk').length > 0, true);
const playerFrame = getSpriteFrame('player', 'walk', 1);
assert.equal(playerFrame.cells[1][2].ch, '@');
assert.equal(playerFrame.cells[2][1].bg, '#23374d');
const fallbackFrame = getLegacyCompatibleSpriteFrame('player', 'missing', 0);
assert.equal(fallbackFrame.cells[1][2].ch, '@');
console.log('spriteAssetPipeline.test.mjs passed');
