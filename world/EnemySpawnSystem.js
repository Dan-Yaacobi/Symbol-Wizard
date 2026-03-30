import { EncounterGenerator } from './EncounterGenerator.js';
import { EnemySpawner } from './EnemySpawner.js';

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
  return spawner.spawnGroup({
    room: options.room,
    enemyType: type,
    center: { x: Math.round(centerX), y: Math.round(centerY) },
    groupSize: options.groupSize ?? 1,
    radius: options.clusterRadius ?? 4,
    threatLevel: options.threatLevel ?? 1,
    groupId: options.groupId ?? 'manual-group',
    context: {
      zoneId: options.zoneId ?? 'manual-zone',
      rng: options.rng ?? Math.random,
      settings,
      occupiedTiles: options.occupiedTiles ?? new Set(),
      allowedTileSet: options.allowedTileSet ?? new Set((options.room?.tiles ?? []).flatMap((row, y) => row.map((_, x) => `${x},${y}`))),
      entranceAnchors: options.entranceAnchors ?? [],
      exitAnchors: options.exitAnchors ?? [],
      spawnAnchors: options.spawnAnchors ?? [],
    },
  });
}

export function spawnEnemiesForRoom(room, options = {}) {
  const generator = new EncounterGenerator(options.runtimeConfig);
  return generator.generate(room, options);
}

