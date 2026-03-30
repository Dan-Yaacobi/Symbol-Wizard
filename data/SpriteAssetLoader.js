import { getAllAssetPaths, loadAssetRegistry } from './AssetRegistry.js';
import { normalizeSpriteAsset, validateSpriteAsset } from './SpriteAssetSchema.js';

const DEFAULT_SPRITE_ASSET_FOLDER = './assets';
const spriteAssetStore = new Map();
let loadedAssetFolder = null;

function canUseNodeFs() {
  return typeof process !== 'undefined' && Boolean(process.versions?.node);
}

async function readJson(filePath) {
  if (canUseNodeFs()) {
    const fs = await import('node:fs/promises');
    return JSON.parse(await fs.default.readFile(filePath, 'utf8'));
  }
  const response = await fetch(filePath, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Failed to load ${filePath}: ${response.status}`);
  return response.json();
}

async function resolveFolder(folder) {
  if (!canUseNodeFs()) return folder;
  const path = await import('node:path');
  return path.default.resolve(folder);
}

async function listSpriteAssetFiles(folder) {
  await loadAssetRegistry();
  const normalizedFolder = folder.replace(/\/$/, '');
  return [...new Set(
    getAllAssetPaths()
      .filter((file) => typeof file === 'string' && file.endsWith('.json'))
      .map((file) => file.replace(/^\.?\//, ''))
      .map((file) => file.startsWith('assets/') ? file.slice('assets/'.length) : file)
      .map((file) => `${normalizedFolder}/${file}`),
  )].sort();
}

export function registerSpriteAsset(asset) {
  const normalized = normalizeSpriteAsset(asset);
  const validation = validateSpriteAsset(normalized);
  if (!validation.valid) {
    throw new Error(`Invalid sprite asset "${normalized.id}": ${validation.errors.join('; ')}`);
  }
  spriteAssetStore.set(normalized.id, normalized);
  return normalized;
}

export function getSpriteAsset(spriteId) {
  if (!spriteId) return null;
  return spriteAssetStore.get(spriteId) ?? null;
}

export function getAllSpriteAssets() {
  return [...spriteAssetStore.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function getSpriteAnimation(spriteId, state = 'idle') {
  const asset = getSpriteAsset(spriteId);
  if (!asset) return null;
  const frames = asset.animations?.[state];
  return Array.isArray(frames) && frames.length > 0 ? frames : null;
}

export function getSpriteFrame(spriteId, state = 'idle', frameIndex = 0) {
  const frames = getSpriteAnimation(spriteId, state);
  if (!frames) return null;
  const safeFrameIndex = Math.abs(Math.floor(frameIndex)) % frames.length;
  return frames[safeFrameIndex] ?? null;
}

export function getAnimationFrameCount(spriteId, state = 'idle') {
  return getSpriteAnimation(spriteId, state)?.length ?? 0;
}

export async function loadSpriteAsset(assetPath) {
  return registerSpriteAsset(await readJson(assetPath));
}

export async function loadAllSpriteAssets(folder = DEFAULT_SPRITE_ASSET_FOLDER) {
  const resolvedFolder = await resolveFolder(folder);
  if (loadedAssetFolder === resolvedFolder && spriteAssetStore.size > 0) return getAllSpriteAssets();
  await loadAssetRegistry();
  const files = [...new Set((await listSpriteAssetFiles(folder)).filter(Boolean))];
  resetSpriteAssetStore();
  await Promise.all(files.map(async (file) => {
    try {
      await loadSpriteAsset(file);
    } catch (error) {
      console.warn(`[SpriteAssetLoader] Failed to load sprite asset at ${file}.`, error);
    }
  }));
  loadedAssetFolder = resolvedFolder;
  return getAllSpriteAssets();
}

export async function reloadSpriteAssets(folder = loadedAssetFolder ?? DEFAULT_SPRITE_ASSET_FOLDER) {
  resetSpriteAssetStore();
  return loadAllSpriteAssets(folder);
}

export async function saveSpriteAsset(asset, outputPath = null) {
  const normalized = registerSpriteAsset(asset);
  const text = `${JSON.stringify(normalized, null, 2)}\n`;
  if (!outputPath) return text;
  if (!canUseNodeFs()) throw new Error('Direct file save is unavailable in this environment.');
  const fs = await import('node:fs/promises');
  await fs.default.writeFile(outputPath, text, 'utf8');
  return outputPath;
}

export function resetSpriteAssetStore() {
  spriteAssetStore.clear();
  loadedAssetFolder = null;
}
