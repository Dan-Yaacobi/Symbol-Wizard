#!/usr/bin/env node
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT_DIR = process.cwd();
const IMPORT_DIR = path.join(ROOT_DIR, 'rexpaint_import', 'objects');
const OUTPUT_DIR = path.join(ROOT_DIR, 'assets', 'objects');
const DEFAULT_METADATA = {
  tags: ['forest'],
  spawnWeight: 1,
  clusterMin: 1,
  clusterMax: 1,
  clusterRadius: 1,
  rarity: 'common',
};

function readInt32LE(buffer, offset) {
  return buffer.readInt32LE(offset);
}

function readUInt32LE(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function isEmptyCell(cell) {
  return !cell || !cell.char || cell.char === ' ' || cell.char === '\0';
}

function parseXP(fileBuffer) {
  const inflated = zlib.gunzipSync(fileBuffer);
  let offset = 0;

  const version = readInt32LE(inflated, offset);
  offset += 4;
  const layerCount = readInt32LE(inflated, offset);
  offset += 4;

  const layers = [];

  for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
    const width = readInt32LE(inflated, offset);
    offset += 4;
    const height = readInt32LE(inflated, offset);
    offset += 4;

    const cells = [];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const codepoint = readUInt32LE(inflated, offset);
        offset += 4;

        const fg = [inflated[offset], inflated[offset + 1], inflated[offset + 2]];
        offset += 3;
        const bg = [inflated[offset], inflated[offset + 1], inflated[offset + 2]];
        offset += 3;

        const char = codepoint === 0 ? ' ' : String.fromCodePoint(codepoint);
        cells.push({ x, y, char, fg, bg });
      }
    }

    layers.push({ width, height, cells });
  }

  return { version, layers };
}

function getVisualBounds(visualLayer) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const cell of visualLayer?.cells ?? []) {
    if (isEmptyCell(cell)) continue;
    minX = Math.min(minX, cell.x);
    minY = Math.min(minY, cell.y);
    maxX = Math.max(maxX, cell.x);
    maxY = Math.max(maxY, cell.y);
  }

  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

function normalizeCells(cells, bounds) {
  return cells.map((cell) => ({ ...cell, x: cell.x - bounds.minX, y: cell.y - bounds.minY }));
}

function extractVisualLayer(layer, bounds) {
  const cropped = (layer?.cells ?? []).filter((cell) => {
    if (isEmptyCell(cell)) return false;
    return cell.x >= bounds.minX && cell.x <= bounds.maxX && cell.y >= bounds.minY && cell.y <= bounds.maxY;
  }).map((cell) => ({
    x: cell.x,
    y: cell.y,
    char: cell.char,
    fg: cell.fg,
    bg: cell.bg,
  }));

  return normalizeCells(cropped, bounds);
}

function extractMaskLayer(layer, bounds) {
  const cropped = (layer?.cells ?? []).filter((cell) => {
    if (isEmptyCell(cell)) return false;
    return cell.x >= bounds.minX && cell.x <= bounds.maxX && cell.y >= bounds.minY && cell.y <= bounds.maxY;
  }).map((cell) => ({ x: cell.x, y: cell.y }));

  return normalizeCells(cropped, bounds);
}

async function readMetadata(metaPath) {
  try {
    const raw = await fsp.readFile(metaPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

function applyMetadata(prefab, metadata) {
  return {
    ...prefab,
    ...DEFAULT_METADATA,
    ...metadata,
    tags: Array.isArray(metadata.tags) && metadata.tags.length > 0 ? metadata.tags : DEFAULT_METADATA.tags,
  };
}

async function writePrefab(prefabPath, prefab) {
  await fsp.writeFile(prefabPath, `${JSON.stringify(prefab, null, 2)}\n`, 'utf8');
}

async function writeRegistry(prefabIds) {
  const registryPath = path.join(OUTPUT_DIR, 'registry.json');
  const registry = {
    generatedAt: new Date().toISOString(),
    objects: prefabIds.map((id) => `${id}.json`),
  };
  await fsp.writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}

async function importXPFile(xpPath) {
  const id = path.basename(xpPath, '.xp');
  const source = path.basename(xpPath);
  const buffer = await fsp.readFile(xpPath);
  const parsed = parseXP(buffer);

  const visualLayer = parsed.layers[0] ?? { cells: [] };
  const collisionLayer = parsed.layers[1] ?? { cells: [] };
  const interactionLayer = parsed.layers[2] ?? { cells: [] };
  // layer 3 reserved/ignored for forward compatibility
  const bounds = getVisualBounds(visualLayer);

  const prefab = {
    id,
    source,
    visual: extractVisualLayer(visualLayer, bounds),
    collision: extractMaskLayer(collisionLayer, bounds),
    interaction: extractMaskLayer(interactionLayer, bounds),
  };

  const metaPath = path.join(path.dirname(xpPath), `${id}.meta.json`);
  const metadata = await readMetadata(metaPath);
  const merged = applyMetadata(prefab, metadata);

  const outputPath = path.join(OUTPUT_DIR, `${id}.json`);
  await writePrefab(outputPath, merged);

  return { id, source, output: `${id}.json` };
}

async function discoverXPFiles() {
  await fsp.mkdir(IMPORT_DIR, { recursive: true });
  const entries = await fsp.readdir(IMPORT_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.xp'))
    .map((entry) => path.join(IMPORT_DIR, entry.name));
}

async function runImport() {
  await fsp.mkdir(OUTPUT_DIR, { recursive: true });
  const xpFiles = await discoverXPFiles();
  const imported = [];

  for (const xpPath of xpFiles) {
    const result = await importXPFile(xpPath);
    imported.push(result.id);
    console.log(`Imported: ${result.source} → ${result.output}`);
  }

  await writeRegistry(imported);

  if (imported.length === 0) {
    console.log(`No .xp files found in ${path.relative(ROOT_DIR, IMPORT_DIR)}`);
  }
}

function watchMode() {
  let pending = null;
  const schedule = () => {
    clearTimeout(pending);
    pending = setTimeout(async () => {
      try {
        await runImport();
      } catch (error) {
        console.error('[rexpaintImporter] import failed:', error);
      }
    }, 100);
  };

  schedule();
  fs.watch(IMPORT_DIR, { persistent: true }, () => schedule());
  console.log(`Watching ${path.relative(ROOT_DIR, IMPORT_DIR)} for changes...`);
}

async function main() {
  const watch = process.argv.includes('--watch');
  if (watch) {
    await fsp.mkdir(IMPORT_DIR, { recursive: true });
    watchMode();
    return;
  }

  await runImport();
}

main().catch((error) => {
  console.error('[rexpaintImporter] fatal error:', error);
  process.exitCode = 1;
});

export {
  parseXP,
  extractVisualLayer,
  extractMaskLayer as extractCollisionLayer,
  normalizeCells,
  applyMetadata,
  writePrefab,
};
