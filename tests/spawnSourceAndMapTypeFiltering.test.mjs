import assert from 'node:assert/strict';

import { SPAWN_CATEGORY } from '../data/DefinitionUtils.js';
import { getSpawnDefinitionsByCategory } from '../data/SpawnDefinitionRegistry.js';
import { getEnemyDefinition } from '../data/EnemyRegistry.js';
import { OBJECT_CATEGORY } from '../world/ObjectLibrary.js';
import { buildBiomePool } from '../world/ObjectPlacementSystem.js';
import { filterEncounterDefinitions } from '../world/EncounterGenerator.js';

function testEnemySpawnSourceFiltering() {
  const fireAntDefinition = getEnemyDefinition('fire_ant');
  assert.equal(fireAntDefinition?.spawnSource, 'structure', 'fire_ant should be structure-spawn-only.');

  const forestEnemyPool = getSpawnDefinitionsByCategory(SPAWN_CATEGORY.ENEMY, 'forest');
  assert.ok(forestEnemyPool.some((definition) => definition.id === 'fire_ant'), 'fire_ant should still exist in the forest enemy registry pool.');

  const worldEncounterPool = filterEncounterDefinitions(forestEnemyPool);
  assert.equal(worldEncounterPool.some((definition) => definition.id === 'fire_ant'), false, 'fire_ant should be excluded from encounter world generation.');
  assert.equal(
    worldEncounterPool.some((definition) => definition.spawnSource === 'structure'),
    false,
    'Encounter pool should exclude all structure-only enemies.',
  );
}

function testObjectMapTypeFiltering() {
  const forestEnvironmentPool = buildBiomePool('forest', OBJECT_CATEGORY.ENVIRONMENT, 'forest');
  assert.ok(forestEnvironmentPool.some((definition) => definition.id === 'ant_den'), 'ant_den should remain available in forest map generation.');

  const townEnvironmentPool = buildBiomePool('forest', OBJECT_CATEGORY.ENVIRONMENT, 'town');
  assert.equal(townEnvironmentPool.some((definition) => definition.id === 'ant_den'), false, 'ant_den should be excluded from town map generation.');
}

function run() {
  testEnemySpawnSourceFiltering();
  testObjectMapTypeFiltering();
  console.log('Spawn source and map-type filtering tests passed.');
}

run();
