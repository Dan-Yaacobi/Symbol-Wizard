import { ENEMY_REGISTRY } from './EnemyRegistry.js';
import { objectLibrary } from '../world/ObjectLibrary.js';

function normalizeBiome(biome) {
  return String(biome ?? '').trim().toLowerCase();
}

export function getAllSpawnDefinitions() {
  return [
    ...Object.values(ENEMY_REGISTRY),
    ...Object.values(objectLibrary),
  ];
}

export function getSpawnDefinition(id) {
  if (!id) return null;
  return getAllSpawnDefinitions().find((definition) => definition.id === id) ?? null;
}

export function getSpawnDefinitionsByCategory(category, biome = null) {
  const normalizedBiome = normalizeBiome(biome);
  return getAllSpawnDefinitions().filter((definition) => {
    if (!definition || (category && definition.category !== category)) return false;
    if (!normalizedBiome) return true;
    return Array.isArray(definition.biomeTags) && definition.biomeTags.includes(normalizedBiome);
  });
}

export function weightedPickDefinition(definitions, rng = Math.random) {
  const pool = definitions.filter((definition) => Number(definition.spawnWeight) > 0);
  const total = pool.reduce((sum, definition) => sum + Number(definition.spawnWeight), 0);
  if (total <= 0) return pool[0] ?? null;
  let roll = rng() * total;
  for (const definition of pool) {
    roll -= Number(definition.spawnWeight);
    if (roll <= 0) return definition;
  }
  return pool[pool.length - 1] ?? null;
}

export function spawnByCategory(category, biome, rng = Math.random) {
  const definitions = getSpawnDefinitionsByCategory(category, biome);
  return weightedPickDefinition(definitions, rng);
}
