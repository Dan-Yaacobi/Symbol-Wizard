import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeSpriteAsset } from '../data/SpriteAssetSchema.js';
import { getBiomeIds } from '../world/BiomeSpawnTables.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const enemyRegistryPath = path.join(rootDir, 'data', 'EnemyRegistry.js');
const biomeSpawnTablesPath = path.join(rootDir, 'world', 'BiomeSpawnTables.js');

function usage() {
  console.error('Usage: node scripts/applySpriteMeta.js <path-to-sprite-json>');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function readSprite(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return normalizeSpriteAsset(JSON.parse(raw));
}

function validateMeta(sprite) {
  const meta = sprite.meta ?? {};
  if (!meta.isEnemy) return null;
  const validBiomes = new Set(getBiomeIds());
  const invalidBiomes = (meta.biomes ?? []).filter((biomeId) => !validBiomes.has(biomeId));
  if (invalidBiomes.length > 0) {
    throw new Error(`Unknown biome ids: ${invalidBiomes.join(', ')}`);
  }
  return {
    enemyId: meta.enemyId || sprite.id,
    biomes: meta.biomes ?? [],
    spawnWeight: Number(meta.spawnWeight) || 1,
  };
}

function buildEnemyEntry(enemyId, spriteId) {
  return `  ${enemyId}: {\n    id: '${enemyId}',\n    spriteId: '${spriteId}',\n    role: 'melee',\n    stats: {\n      hp: 10,\n      speed: 1,\n      damage: 2,\n      attackCooldown: 1.2,\n    },\n    animationTimings: {\n      idle: 0.4,\n      walk: 0.2,\n      attack: 0.15,\n    },\n  },`;
}

async function updateEnemyRegistry(enemyId, spriteId) {
  let source = await fs.readFile(enemyRegistryPath, 'utf8');
  const existingEntryPattern = new RegExp(`(^\\s*${escapeRegExp(enemyId)}: \\{[\\s\\S]*?^\\s*\\},)`, 'm');
  const match = source.match(existingEntryPattern);
  if (match) {
    const updated = match[1].replace(/spriteId: '([^']*)'/, `spriteId: '${spriteId}'`);
    source = source.replace(existingEntryPattern, updated);
  } else {
    source = source.replace(/export const ENEMY_REGISTRY = \{\n/, `export const ENEMY_REGISTRY = {\n${buildEnemyEntry(enemyId, spriteId)}\n`);
  }
  await fs.writeFile(enemyRegistryPath, source);
}

function buildSpawnEntry(enemyId, weight) {
  return `{ enemyId: '${enemyId}', weight: ${weight} }`;
}

async function updateBiomeSpawnTables(enemyId, biomes, weight) {
  let source = await fs.readFile(biomeSpawnTablesPath, 'utf8');
  for (const biomeId of biomes) {
    const biomePattern = new RegExp(`(${escapeRegExp(biomeId)}: \\[)([\\s\\S]*?)(\\n  \\],)`, 'm');
    const match = source.match(biomePattern);
    if (!match) throw new Error(`Biome spawn table not found for ${biomeId}`);
    const body = match[2];
    const existingPattern = new RegExp(`\\{ enemyId: '${escapeRegExp(enemyId)}', weight: \\d+ \\}`);
    const nextBody = existingPattern.test(body)
      ? body.replace(existingPattern, buildSpawnEntry(enemyId, weight))
      : `${body}\n    ${buildSpawnEntry(enemyId, weight)},`;
    source = source.replace(biomePattern, `$1${nextBody}$3`);
  }
  await fs.writeFile(biomeSpawnTablesPath, source);
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    usage();
    process.exitCode = 1;
    return;
  }

  const sprite = await readSprite(path.resolve(process.cwd(), input));
  const meta = validateMeta(sprite);
  if (!meta) {
    console.log(`Sprite ${sprite.id} is not marked as an enemy; no registry changes applied.`);
    return;
  }

  await updateEnemyRegistry(meta.enemyId, sprite.id);
  await updateBiomeSpawnTables(meta.enemyId, meta.biomes, meta.spawnWeight);
  console.log(`Applied enemy metadata for ${sprite.id} as ${meta.enemyId}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
