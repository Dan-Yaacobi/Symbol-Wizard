const DEFAULT_ASSET_ROOT = './assets';
const DEFAULT_REGISTRY_PATH = `${DEFAULT_ASSET_ROOT}/registry.json`;

let assetPathStore = new Map();
let loadedRegistryPath = null;

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

function joinAssetPath(root, relativePath) {
  const cleanRoot = `${root ?? DEFAULT_ASSET_ROOT}`.replace(/\/$/, '');
  const cleanRelative = `${relativePath ?? ''}`.replace(/^\.\//, '');
  return `${cleanRoot}/${cleanRelative}`;
}

export async function loadAssetRegistry(registryPath = DEFAULT_REGISTRY_PATH) {
  if (loadedRegistryPath === registryPath && assetPathStore.size > 0) return assetPathStore;
  const registry = await readJson(registryPath);
  const nextStore = new Map();
  for (const [assetId, relativePath] of Object.entries(registry?.assets ?? {})) {
    if (!assetId || !relativePath) continue;
    nextStore.set(assetId, joinAssetPath(DEFAULT_ASSET_ROOT, relativePath));
  }
  assetPathStore = nextStore;
  loadedRegistryPath = registryPath;
  return assetPathStore;
}

export function getAssetPath(assetId) {
  if (!assetId) return null;
  const resolved = assetPathStore.get(assetId) ?? null;
  if (!resolved) console.warn(`[AssetRegistry] Missing asset path for "${assetId}".`);
  return resolved;
}

export function hasAsset(assetId) {
  return Boolean(assetId) && assetPathStore.has(assetId);
}

export function getAllAssetPaths() {
  return [...assetPathStore.values()];
}

export function resetAssetRegistry() {
  assetPathStore = new Map();
  loadedRegistryPath = null;
}
