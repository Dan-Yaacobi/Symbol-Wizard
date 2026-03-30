import { SPAWN_CATEGORY } from '../data/DefinitionUtils.js';
import { getSpawnDefinitionsByCategory, weightedPickDefinition } from '../data/SpawnDefinitionRegistry.js';
import { ZonePlanner } from './ZonePlanner.js';
import { EnemySpawner } from './EnemySpawner.js';

function toInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
}

const DEFAULT_SETTINGS = {
  minDistanceFromEntrance: 10,
  minDistanceFromExit: 8,
  minDistanceFromSpawn: 10,
  minDistanceBetweenEnemyGroups: 14,
  minDistanceBetweenEnemies: 2,
  maxSpawnAttempts: 120,
};

function resolveSettings(runtimeConfig = null) {
  return {
    minDistanceFromEntrance: toInt(runtimeConfig?.get?.('enemyGeneration.minDistanceFromEntrance'), DEFAULT_SETTINGS.minDistanceFromEntrance),
    minDistanceFromExit: toInt(runtimeConfig?.get?.('enemyGeneration.minDistanceFromExit'), DEFAULT_SETTINGS.minDistanceFromExit),
    minDistanceFromSpawn: toInt(runtimeConfig?.get?.('enemyGeneration.minDistanceFromSpawn'), DEFAULT_SETTINGS.minDistanceFromSpawn),
    minDistanceBetweenEnemyGroups: toInt(runtimeConfig?.get?.('enemyGeneration.minDistanceBetweenEnemyGroups'), DEFAULT_SETTINGS.minDistanceBetweenEnemyGroups),
    minDistanceBetweenEnemies: toInt(runtimeConfig?.get?.('enemyGeneration.minDistanceBetweenEnemies'), DEFAULT_SETTINGS.minDistanceBetweenEnemies),
    maxSpawnAttempts: toInt(runtimeConfig?.get?.('enemyGeneration.maxSpawnAttempts'), DEFAULT_SETTINGS.maxSpawnAttempts),
  };
}

function fallbackThreatLevel(definition) {
  if (Number.isFinite(definition?.threatLevel)) return definition.threatLevel;
  if (definition?.role === 'tank') return 5;
  if (definition?.role === 'ranged' || definition?.role === 'flanker') return 3;
  if (definition?.role === 'swarm') return 1;
  return 2;
}

function pickDefinitionForZone(definitions, zone, rng) {
  const inRange = definitions.filter((definition) => {
    const threat = fallbackThreatLevel(definition);
    return threat >= zone.minThreatLevel && threat <= zone.maxThreatLevel;
  });
  const pool = inRange.length ? inRange : definitions;
  return weightedPickDefinition(pool, rng);
}

function zonePlan(zoneType, roomIndex) {
  const ramp = Math.max(0, Math.floor(roomIndex * 0.25));
  if (zoneType === 'rest') return { groupCount: [0, 1], groupSize: [0, 2], radius: 6, threatBudget: 3 + ramp };
  if (zoneType === 'skirmish') return { groupCount: [1, 2], groupSize: [2, 4], radius: 5, threatBudget: 8 + ramp };
  return { groupCount: [1, 2], groupSize: [5, 8], radius: 4, threatBudget: 16 + Math.floor(roomIndex * 0.5) };
}

function randomInt(rng, min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function collectOccupiedTiles(room) {
  const occupied = new Set();
  for (const object of room?.objects ?? []) {
    const footprint = object?.footprint ?? object?.logicalShape?.tiles ?? [[0, 0]];
    for (const [dx, dy] of footprint) occupied.add(`${Math.round(object.x + dx)},${Math.round(object.y + dy)}`);
  }
  return occupied;
}

function debugZoneTiles(zones) {
  return zones.flatMap((zone) => zone.tiles.map((tile) => ({ x: tile.x, y: tile.y, zoneId: zone.id, zoneType: zone.type, color: zone.debugColor })));
}

export class EncounterGenerator {
  constructor(runtimeConfig = null) {
    this.settings = resolveSettings(runtimeConfig);
    this.zonePlanner = new ZonePlanner();
    this.enemySpawner = new EnemySpawner(this.settings);
  }

  generate(room, options = {}) {
    if (!room?.tiles?.length) return { enemies: [], debug: {} };
    const rng = options.rng ?? Math.random;
    const zones = this.zonePlanner.plan({
      room,
      entranceAnchors: options.entranceAnchors ?? [],
      exitAnchors: options.exitAnchors ?? [],
      pathMask: options.pathMask ?? new Set(),
    });
    const definitions = getSpawnDefinitionsByCategory(SPAWN_CATEGORY.ENEMY, options.biomeType);
    if (!definitions.length) return { enemies: [], debug: { encounterZones: debugZoneTiles(zones) } };

    const occupiedTiles = collectOccupiedTiles(room);
    const enemies = [];
    const enemySpawnPoints = [];
    const enemyGroupCenters = [];
    const roomIndex = Math.max(0, Number(options.roomDepth ?? 0));
    let groupIndex = 0;

    for (const zone of zones) {
      const plan = zonePlan(zone.type, roomIndex);
      const groupCount = randomInt(rng, plan.groupCount[0], plan.groupCount[1]);
      const centers = this.enemySpawner.pickGroupCenters(zone, groupCount, {
        rng,
        settings: this.settings,
      });

      for (const center of centers) {
        const definition = pickDefinitionForZone(definitions, {
          minThreatLevel: 1,
          maxThreatLevel: plan.threatBudget,
        }, rng);
        if (!definition?.id) continue;
        const threat = fallbackThreatLevel(definition);
        const maxSizeByThreat = Math.max(1, Math.floor(plan.threatBudget / Math.max(1, threat)));
        const targetSize = Math.min(
          randomInt(rng, plan.groupSize[0], plan.groupSize[1]),
          maxSizeByThreat,
        );
        if (targetSize <= 0) continue;

        const groupId = `${zone.id}-group-${groupIndex}`;
        const group = this.enemySpawner.spawnGroup({
          room,
          enemyType: definition.id,
          center,
          groupSize: targetSize,
          radius: definition.clusterRadius ?? plan.radius,
          threatLevel: threat,
          groupId,
          context: {
            zoneId: zone.id,
            rng,
            settings: this.settings,
            occupiedTiles,
            allowedTileSet: zone.tileSet,
            entranceAnchors: options.entranceAnchors ?? [],
            exitAnchors: options.exitAnchors ?? [],
            spawnAnchors: [options.spawnPoint ?? { x: Math.floor(room.tiles[0].length / 2), y: Math.floor(room.tiles.length / 2) }],
          },
        });

        if (!group.enemies.length) continue;
        enemies.push(...group.enemies);
        enemySpawnPoints.push(...group.points);
        enemyGroupCenters.push({ x: center.x, y: center.y, zoneId: zone.id, type: definition.id, groupId });
        groupIndex += 1;
      }
    }

    return {
      enemies,
      debug: {
        enemySpawnPoints,
        enemyGroupCenters,
        encounterZones: debugZoneTiles(zones),
        encounterZoneSummaries: zones.map((zone) => ({ id: zone.id, type: zone.type, tileCount: zone.tiles.length })),
        encounterModel: zones.map((zone) => ({ type: zone.type, density: zone.density })),
        entranceSafetyAnchors: options.entranceAnchors ?? [],
        exitSafetyAnchors: options.exitAnchors ?? [],
        pathSafetyTiles: [...(options.pathMask ?? new Set())].map((key) => {
          const [x, y] = key.split(',').map(Number);
          return { x, y };
        }),
        safetySettings: {
          minDistanceFromEntrance: this.settings.minDistanceFromEntrance,
          minDistanceFromExit: this.settings.minDistanceFromExit,
          minDistanceFromSpawn: this.settings.minDistanceFromSpawn,
        },
      },
    };
  }
}
