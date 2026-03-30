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
  minDistanceFromEntrance: 8,
  minDistanceFromExit: 6,
  minDistanceFromSpawn: 8,
  minDistanceBetweenEnemyGroups: 12,
  minDistanceBetweenEnemies: 2,
  maxSpawnAttempts: 140,
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

function zonePlan(zoneType, roomIndex) {
  const ramp = Math.max(0, Math.floor(roomIndex * 0.35));
  if (zoneType === 'rest') return { targetRange: [2 + ramp, 5 + ramp], threatBudget: 8 + ramp, swarmChance: 0.08 };
  if (zoneType === 'skirmish') return { targetRange: [5 + ramp, 9 + ramp], threatBudget: 16 + ramp, swarmChance: 0.12 };
  return { targetRange: [8 + ramp, 13 + ramp], threatBudget: 24 + ramp, swarmChance: 0.2 };
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

function filterDefinitionsForZone(definitions, threatBudget) {
  const ranged = definitions.filter((definition) => fallbackThreatLevel(definition) <= threatBudget);
  return ranged.length ? ranged : definitions;
}

function resolveSpawnStyle(definition) {
  return definition?.spawnStyle ?? 'scattered';
}

function isEligibleWorldSpawnSource(definition) {
  const source = definition?.spawnSource ?? 'world';
  return source === 'world' || source === 'both';
}

export function filterEncounterDefinitions(definitions = []) {
  return definitions.filter((definition) => isEligibleWorldSpawnSource(definition));
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
    const definitions = filterEncounterDefinitions(getSpawnDefinitionsByCategory(SPAWN_CATEGORY.ENEMY, options.biomeType));
    if (!definitions.length) return { enemies: [], debug: { encounterZones: debugZoneTiles(zones) } };

    const occupiedTiles = collectOccupiedTiles(room);
    const enemies = [];
    const enemySpawnPoints = [];
    const enemyGroupCenters = [];
    const enemySpawnRejections = [];
    const roomIndex = Math.max(0, Number(options.roomDepth ?? 0));
    const placedEnemies = [];
    const zoneSpawnSummary = [];
    let groupIndex = 0;

    for (const zone of zones) {
      const plan = zonePlan(zone.type, roomIndex);
      const targetCount = randomInt(rng, plan.targetRange[0], plan.targetRange[1]);
      const zonePool = filterDefinitionsForZone(definitions, plan.threatBudget);
      const context = {
        zoneId: zone.id,
        rng,
        settings: this.settings,
        occupiedTiles,
        allowedTileSet: zone.tileSet,
        allowedTiles: zone.tiles,
        placedEnemies,
        rejections: enemySpawnRejections,
        entranceAnchors: options.entranceAnchors ?? [],
        exitAnchors: options.exitAnchors ?? [],
        spawnAnchors: [options.spawnPoint ?? { x: Math.floor(room.tiles[0].length / 2), y: Math.floor(room.tiles.length / 2) }],
      };

      let spawnedInZone = 0;
      const styleCounts = { scattered: 0, swarm: 0, elite: 0 };
      let zoneAttempts = 0;
      while (spawnedInZone < targetCount && zoneAttempts < targetCount * 4) {
        zoneAttempts += 1;
        const definition = weightedPickDefinition(zonePool, rng);
        if (!definition?.id) continue;

        const threat = fallbackThreatLevel(definition);
        const style = resolveSpawnStyle(definition);
        if (style !== 'swarm') {
          const result = this.enemySpawner.spawnScattered({
            room,
            enemyType: definition.id,
            definition,
            count: 1,
            threatLevel: threat,
            context,
          });
          if (!result.enemies.length) continue;
          enemies.push(...result.enemies);
          enemySpawnPoints.push(...result.points);
          spawnedInZone += result.enemies.length;
          styleCounts[style] = (styleCounts[style] ?? 0) + result.enemies.length;
          continue;
        }

        if (rng() > plan.swarmChance) continue;
        const swarmMax = Math.max(2, Math.min(targetCount - spawnedInZone, definition.clusterMax ?? 6));
        const swarmMin = Math.min(swarmMax, Math.max(2, definition.clusterMin ?? 3));
        const swarmCount = randomInt(rng, swarmMin, swarmMax);
        const centerTile = zone.tiles[randomInt(rng, 0, zone.tiles.length - 1)] ?? null;
        if (!centerTile) continue;
        const groupId = `${zone.id}-swarm-${groupIndex}`;
        const result = this.enemySpawner.spawnSwarm({
          room,
          enemyType: definition.id,
          definition,
          center: { x: centerTile.x, y: centerTile.y },
          count: swarmCount,
          radius: definition.clusterRadius ?? 4,
          threatLevel: threat,
          groupId,
          context,
        });
        if (!result.enemies.length) continue;
        enemies.push(...result.enemies);
        enemySpawnPoints.push(...result.points);
        enemyGroupCenters.push({ x: centerTile.x, y: centerTile.y, zoneId: zone.id, type: definition.id, groupId, spawnStyle: 'swarm' });
        spawnedInZone += result.enemies.length;
        styleCounts.swarm += result.enemies.length;
        groupIndex += 1;
      }

      zoneSpawnSummary.push({ zoneId: zone.id, zoneType: zone.type, targetCount, spawned: spawnedInZone, styles: styleCounts });
    }

    return {
      enemies,
      debug: {
        enemySpawnPoints,
        enemyGroupCenters,
        enemySpawnRejections,
        encounterZones: debugZoneTiles(zones),
        encounterZoneSummaries: zones.map((zone) => ({ id: zone.id, type: zone.type, tileCount: zone.tiles.length })),
        encounterModel: zones.map((zone) => ({ type: zone.type, density: zone.density })),
        enemySpawnSummary: zoneSpawnSummary,
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
          minDistanceBetweenEnemies: this.settings.minDistanceBetweenEnemies,
        },
      },
    };
  }
}
