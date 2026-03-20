import { normalizeSpriteAsset } from './SpriteAssetSchema.js';

const spriteAssetStore = new Map();
let loadedFolders = new Set();

function canUseNodeFs() {
  return typeof process !== 'undefined' && Boolean(process.versions?.node);
}

async function readJson(url) {
  if (canUseNodeFs()) {
    const [{ default: fs }, { fileURLToPath }] = await Promise.all([
      import('node:fs/promises'),
      import('node:url'),
    ]);
    const resolved = String(url).startsWith('file:') ? fileURLToPath(url) : url;
    return JSON.parse(await fs.readFile(resolved, 'utf8'));
  }
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return response.json();
}

async function resolveFolderUrl(folder) {
  if (canUseNodeFs()) {
    const nodePath = await import('node:path');
    if (/^file:/.test(folder)) return folder;
    return nodePath.default.resolve(folder);
  }
  return folder;
}

async function joinUrl(base, next) {
  if (canUseNodeFs()) {
    if (String(base).startsWith('file:')) return new URL(next, base.endsWith('/') ? base : `${base}/`).toString();
    const nodePath = await import('node:path');
    return nodePath.default.join(base, next);
  }
  const normalizedBase = new URL(base.endsWith('/') ? base : `${base}/`, globalThis.location?.href);
  return new URL(next, normalizedBase).toString();
}

export function registerSpriteAsset(asset) {
  const normalized = normalizeSpriteAsset(asset);
  spriteAssetStore.set(normalized.id, normalized);
  return normalized;
}

export function getSpriteAsset(spriteId) {
  return spriteAssetStore.get(spriteId) ?? null;
}

export function getAllSpriteAssets() {
  return [...spriteAssetStore.values()];
}

const ANIMATION_FALLBACKS = Object.freeze({
  cast: ['attack', 'idle'],
  attack: ['cast', 'idle'],
  walk: ['idle'],
  idle: ['walk'],
});

export function getSpriteAnimation(spriteId, animationName = 'idle') {
  const asset = getSpriteAsset(spriteId);
  if (!asset) return null;

  const candidates = [animationName, ...(ANIMATION_FALLBACKS[animationName] ?? []), 'idle'];
  for (const candidate of candidates) {
    const frames = asset.animations?.[candidate];
    if (Array.isArray(frames) && frames.length > 0) return frames;
  }

  return null;
}

export function getSpriteFrame(spriteId, animationName = 'idle', frameIndex = 0) {
  const frames = getSpriteAnimation(spriteId, animationName);
  if (!frames?.length) return null;
  const safeFrameIndex = Math.abs(Math.floor(frameIndex)) % frames.length;
  return frames[safeFrameIndex] ?? null;
}

export function getAnimationFrameCount(spriteId, animationName = 'idle') {
  return getSpriteAnimation(spriteId, animationName)?.length ?? 0;
}

export async function loadSpriteAsset(assetPath) {
  const json = await readJson(assetPath);
  return registerSpriteAsset(json);
}

export async function loadSpriteAssetsFromFolder(folder = './assets/sprites') {
  const resolvedFolder = await resolveFolderUrl(folder);
  if (loadedFolders.has(resolvedFolder)) return getAllSpriteAssets();

  const registryPath = await joinUrl(resolvedFolder, 'registry.json');
  const registry = await readJson(registryPath);
  const files = Array.isArray(registry?.sprites) ? registry.sprites : [];
  await Promise.all(files.map(async (file) => loadSpriteAsset(await joinUrl(resolvedFolder, file))));
  loadedFolders.add(resolvedFolder);
  return getAllSpriteAssets();
}

export async function saveSpriteAsset(asset, outputPath = null) {
  const normalized = registerSpriteAsset(asset);
  const text = `${JSON.stringify(normalized, null, 2)}\n`;
  if (!outputPath) return text;
  if (canUseNodeFs()) {
    const fs = await import('node:fs/promises');
    await fs.default.writeFile(outputPath, text, 'utf8');
    return outputPath;
  }
  throw new Error('Direct file save is unavailable in this environment.');
}

export function resetSpriteAssetStore() {
  spriteAssetStore.clear();
  loadedFolders = new Set();
}
