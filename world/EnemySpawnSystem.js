import { EncounterGenerator } from './EncounterGenerator.js';
import { EnemySpawner } from './EnemySpawner.js';
import { getSpawnDefinition } from '../data/SpawnDefinitionRegistry.js';

const DEFAULT_SETTINGS = {
  minDistanceFromEntrance: 10,
  minDistanceFromExit: 8,
  minDistanceFromSpawn: 10,
  minDistanceBetweenEnemyGroups: 14,
  minDistanceBetweenEnemies: 2,
  maxSpawnAttempts: 120,
};

export function spawnEnemyGroup(type, centerX, centerY, options = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...(options.settings ?? {}) };
  const spawner = new EnemySpawner(settings);
  const room = options.room;
  const allowedTiles = (room?.tiles ?? []).flatMap((row, y) => row.map((_, x) => ({ x, y })));
  const definition = getSpawnDefinition(type) ?? { id: type, spawnStyle: 'swarm', combat: { radius: 1.3 } };
  const context = {
    zoneId: options.zoneId ?? 'manual-zone',
    rng: options.rng ?? Math.random,
    settings,
    occupiedTiles: options.occupiedTiles ?? new Set(),
    worldObjects: room?.objects ?? [],
    allowedTileSet: options.allowedTileSet ?? new Set(allowedTiles.map((tile) => `${tile.x},${tile.y}`)),
    allowedTiles,
    placedEnemies: [],
    rejections: [],
    entranceAnchors: options.entranceAnchors ?? [],
    exitAnchors: options.exitAnchors ?? [],
    spawnAnchors: options.spawnAnchors ?? [],
  };
  return spawner.spawnSwarm({
    room,
    enemyType: type,
    definition,
    center: { x: Math.round(centerX), y: Math.round(centerY) },
    count: options.groupSize ?? 1,
    radius: options.clusterRadius ?? 4,
    threatLevel: options.threatLevel ?? 1,
    groupId: options.groupId ?? 'manual-group',
    context,
  });
}

export function spawnEnemiesForRoom(room, options = {}) {
  const generator = new EncounterGenerator(options.runtimeConfig);
  return generator.generate(room, options);
}
