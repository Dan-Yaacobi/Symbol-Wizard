import { decodeCp437 } from '../world/Cp437.js';
import { normalizeSpriteAsset } from './SpriteAssetSchema.js';

function toUint8Array(bufferLike) {
  if (bufferLike instanceof Uint8Array) return bufferLike;
  if (bufferLike instanceof ArrayBuffer) return new Uint8Array(bufferLike);
  if (ArrayBuffer.isView(bufferLike)) return new Uint8Array(bufferLike.buffer, bufferLike.byteOffset, bufferLike.byteLength);
  return new Uint8Array(bufferLike);
}

function readInt32LE(view, offset) { return view.getInt32(offset, true); }
function readUInt32LE(view, offset) { return view.getUint32(offset, true); }
function rgbToHex([r, g, b]) { return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value | 0)).toString(16).padStart(2, '0')).join('')}`; }

async function gunzip(bufferLike) {
  const bytes = toUint8Array(bufferLike);
  if (typeof process !== 'undefined' && process.versions?.node) {
    const zlib = await import('node:zlib');
    return new Uint8Array(zlib.default.gunzipSync(bytes));
  }
  if (typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw new Error('No gzip decompressor available for XP import.');
}

export async function parseSpriteXp(bufferLike) {
  const inflated = await gunzip(bufferLike);
  const view = new DataView(inflated.buffer, inflated.byteOffset, inflated.byteLength);
  let offset = 0;
  const version = readInt32LE(view, offset); offset += 4;
  const layerCount = readInt32LE(view, offset); offset += 4;
  const layers = [];

  for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
    const width = readInt32LE(view, offset); offset += 4;
    const height = readInt32LE(view, offset); offset += 4;
    const cells = Array.from({ length: height }, () => Array.from({ length: width }, () => ({ ch: ' ', fg: null, bg: null })));
    for (let x = 0; x < width; x += 1) {
      for (let y = 0; y < height; y += 1) {
        const cp437 = readUInt32LE(view, offset); offset += 4;
        const fg = [inflated[offset], inflated[offset + 1], inflated[offset + 2]]; offset += 3;
        const bg = [inflated[offset], inflated[offset + 1], inflated[offset + 2]]; offset += 3;
        cells[y][x] = {
          ch: cp437 === 0 ? ' ' : decodeCp437(cp437),
          fg: cp437 === 0 ? null : rgbToHex(fg),
          bg: rgbToHex(bg),
        };
      }
    }
    layers.push({ width, height, offsetY: 0, cells });
  }

  return { version, layers };
}

export async function convertXpToSpriteAsset(bufferLike, { id, animation = 'idle', anchor = null } = {}) {
  const parsed = await parseSpriteXp(bufferLike);
  const frames = parsed.layers.map((layer) => ({
    width: layer.width,
    height: layer.height,
    offsetY: 0,
    cells: layer.cells.map((row) => row.map((cell) => ({
      ch: cell.ch,
      fg: cell.fg,
      bg: cell.ch === ' ' && /^#000000$/i.test(cell.bg ?? '') ? null : cell.bg,
    }))),
  }));
  const fallbackAnchor = { x: Math.floor((frames[0]?.width ?? 1) / 2), y: 3 };
  return normalizeSpriteAsset({ id, anchor: anchor ?? fallbackAnchor, animations: { [animation]: frames } });
}
