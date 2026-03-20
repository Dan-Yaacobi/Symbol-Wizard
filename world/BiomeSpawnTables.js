export const BIOME_SPAWN_TABLES = {
  forest: [
    { enemyId: 'spider', weight: 4 },
    { enemyId: 'wasp', weight: 3 },
    { enemyId: 'swarm_bug', weight: 3 },
    { enemyId: 'forest_beetle', weight: 1 },
    { enemyId: 'forest_mantis', weight: 2 },
  ],
  cave: [
    { enemyId: 'spider', weight: 3 },
    { enemyId: 'wasp', weight: 4 },
    { enemyId: 'forest_beetle', weight: 4 },
    { enemyId: 'swarm_bug', weight: 2 },
    { enemyId: 'forest_mantis', weight: 2 },
  ],
  river: [
    { enemyId: 'spider', weight: 4 },
    { enemyId: 'wasp', weight: 4 },
    { enemyId: 'forest_beetle', weight: 2 },
    { enemyId: 'swarm_bug', weight: 3 },
    { enemyId: 'forest_mantis', weight: 3 },
  ],
  mountain: [
    { enemyId: 'spider', weight: 4 },
    { enemyId: 'wasp', weight: 2 },
    { enemyId: 'forest_beetle', weight: 5 },
    { enemyId: 'swarm_bug', weight: 2 },
    { enemyId: 'forest_mantis', weight: 2 },
  ],
};

export function getBiomeSpawnTable(biomeId) {
  return BIOME_SPAWN_TABLES[biomeId] ?? null;
}

export function getBiomeIds() {
  return Object.keys(BIOME_SPAWN_TABLES);
}
