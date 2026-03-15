import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { parseXP } from '../tools/rexpaintImporter.js';
import { buildPrefabFromXP } from '../world/PrefabPipeline.js';
import { decodeCp437, encodeCp437 } from '../world/Cp437.js';

function createXpLayer(width, height, writer) {
  const parts = [];
  const header = Buffer.alloc(8);
  header.writeInt32LE(width, 0);
  header.writeInt32LE(height, 4);
  parts.push(header);

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      const { cp437 = 0, fg = [255, 255, 255], bg = [0, 0, 0] } = writer(x, y) ?? {};
      const cell = Buffer.alloc(10);
      cell.writeUInt32LE(cp437, 0);
      cell[4] = fg[0];
      cell[5] = fg[1];
      cell[6] = fg[2];
      cell[7] = bg[0];
      cell[8] = bg[1];
      cell[9] = bg[2];
      parts.push(cell);
    }
  }

  return Buffer.concat(parts);
}

function createXpFile(layers) {
  const header = Buffer.alloc(8);
  header.writeInt32LE(1, 0);
  header.writeInt32LE(layers.length, 4);
  return zlib.gzipSync(Buffer.concat([header, ...layers]));
}

function testOrientationAndDimensions() {
  const verticalTree = createXpLayer(3, 4, (x, y) => {
    if (x === 1 && y >= 1) return { cp437: 5, fg: [10, 200, 10], bg: [0, 0, 0] };
    return { cp437: 0, fg: [0, 0, 0], bg: [0, 0, 0] };
  });
  const parsed = parseXP(createXpFile([verticalTree]));
  const prefab = buildPrefabFromXP(parsed, { id: 'tree' });

  assert.equal(prefab.width, 1);
  assert.equal(prefab.height, 3);
  assert.deepEqual(
    prefab.visual.map((cell) => [cell.x, cell.y]),
    [[0, 0], [0, 1], [0, 2]],
  );
}

function testCp437RoundTrip() {
  assert.equal(decodeCp437(5), '♣');
  assert.equal(encodeCp437('♣'), 5);

  const layer = createXpLayer(1, 1, () => ({ cp437: 5, fg: [1, 2, 3], bg: [4, 5, 6] }));
  const parsed = parseXP(createXpFile([layer]));
  const prefab = buildPrefabFromXP(parsed, { id: 'glyph' }, { autoCrop: false });

  assert.equal(prefab.visual[0].char, '♣');
  assert.equal(prefab.visual[0].cp437, 5);
}

function testColorPreservation() {
  const layer = createXpLayer(1, 1, () => ({ cp437: 219, fg: [12, 34, 56], bg: [78, 90, 123] }));
  const parsed = parseXP(createXpFile([layer]));
  const prefab = buildPrefabFromXP(parsed, { id: 'colors' }, { autoCrop: false });

  assert.deepEqual(prefab.visual[0].fg, [12, 34, 56]);
  assert.deepEqual(prefab.visual[0].bg, [78, 90, 123]);
}

function testMultiLayerMergeTopDown() {
  const bottom = createXpLayer(2, 1, (x) => ({ cp437: x === 0 ? 176 : 177, fg: [20, 20, 20], bg: [0, 0, 0] }));
  const top = createXpLayer(2, 1, (x) => (x === 0 ? { cp437: 5, fg: [200, 10, 10], bg: [1, 2, 3] } : { cp437: 0, fg: [0, 0, 0], bg: [0, 0, 0] }));
  const parsed = parseXP(createXpFile([bottom, top]));
  const prefab = buildPrefabFromXP(parsed, { id: 'layers' }, { autoCrop: false });

  const left = prefab.visual.find((cell) => cell.x === 0 && cell.y === 0);
  const right = prefab.visual.find((cell) => cell.x === 1 && cell.y === 0);
  assert.equal(left.char, '♣');
  assert.deepEqual(left.fg, [200, 10, 10]);
  assert.equal(right.char, '▒');
}

function run() {
  testOrientationAndDimensions();
  testCp437RoundTrip();
  testColorPreservation();
  testMultiLayerMergeTopDown();
  console.log('XP import pipeline tests passed.');
}

run();
