import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { parseXP } from '../tools/rexpaintImporter.js';
import { buildPrefabFromXP } from '../world/PrefabPipeline.js';
import { registerPrefabObject, spawnObject } from '../world/ObjectLibrary.js';
import { renderWorld } from '../systems/RenderSystem.js';
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

  assert.equal(prefab.visual[0].fg, '#0c2238');
  assert.equal(prefab.visual[0].bg, '#4e5a7b');
}

function testMultiLayerMergeTopDown() {
  const bottom = createXpLayer(2, 1, (x) => ({ cp437: x === 0 ? 176 : 177, fg: [20, 20, 20], bg: [0, 0, 0] }));
  const top = createXpLayer(2, 1, (x) => (x === 0 ? { cp437: 5, fg: [200, 10, 10], bg: [1, 2, 3] } : { cp437: 0, fg: [0, 0, 0], bg: [0, 0, 0] }));
  const parsed = parseXP(createXpFile([bottom, top]));
  const prefab = buildPrefabFromXP(parsed, { id: 'layers' }, { autoCrop: false });

  const left = prefab.visual.find((cell) => cell.x === 0 && cell.y === 0);
  const right = prefab.visual.find((cell) => cell.x === 1 && cell.y === 0);
  assert.equal(left.char, '♣');
  assert.equal(left.fg, '#c80a0a');
  assert.equal(right.char, '▒');
}

function testPrefabLoadToRendererColorPipeline() {
  const layer = createXpLayer(1, 1, () => ({ cp437: 205, fg: [12, 34, 56], bg: [78, 90, 123] }));
  const parsed = parseXP(createXpFile([layer]));
  const prefab = buildPrefabFromXP(parsed, { id: 'pipeline-color' }, { autoCrop: false });
  const prefabJson = JSON.parse(JSON.stringify(prefab));

  const jsonCell = prefabJson.visual[0];
  console.log('[trace] stage 1 (after JSON read):', jsonCell);
  assert.equal(jsonCell.fg, '#0c2238');
  assert.equal(jsonCell.bg, '#4e5a7b');
  assert.equal(jsonCell.cp437, 205);

  const definition = registerPrefabObject(prefabJson);
  const normalizedCell = definition.tiles[0];
  console.log('[trace] stage 2 (after prefab normalization):', normalizedCell);
  assert.equal(normalizedCell.fg, '#0c2238');
  assert.equal(normalizedCell.bg, '#4e5a7b');

  const object = spawnObject('pipeline-color', { x: 2, y: 3 });
  const objectCell = object.tiles[0];
  console.log('[trace] stage 3 (after object construction):', objectCell);
  assert.equal(objectCell.fg, '#0c2238');
  assert.equal(objectCell.bg, '#4e5a7b');

  const drawCalls = [];
  const renderer = {
    renderBackground() {},
    drawCell(cell) {
      drawCalls.push(cell);
    },
  };

  const camera = { x: 0, y: 0, worldToScreen: (x, y) => ({ x, y }) };
  const map = [[{ char: '.', fg: '#000000', bg: '#000000' }]];
  const player = { x: 999, y: 999, type: 'player', spriteId: 'none' };

  renderWorld(renderer, camera, map, player, [], [], [object], [], [], null, [], null, {});
  const renderCell = drawCalls.find((cell) => cell.glyph === '═');
  console.log('[trace] stage 4 (before renderer input):', renderCell);

  assert.ok(renderCell, 'Expected object glyph draw call.');
  assert.equal(renderCell.fg, '#0c2238');
  assert.equal(renderCell.bg, '#4e5a7b');
}

function run() {
  testOrientationAndDimensions();
  testCp437RoundTrip();
  testColorPreservation();
  testMultiLayerMergeTopDown();
  testPrefabLoadToRendererColorPipeline();
  console.log('XP import pipeline tests passed.');
}

run();
