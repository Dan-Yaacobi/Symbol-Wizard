import { Enemy } from '../entities/Enemy.js';
import { evaluateSpawnPosition, tryFindSpawnPosition } from './SpawnValidator.js';

function randomInt(rng, min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function tileKey(x, y) {
  return `${x},${y}`;
}

function isNearAnchors(x, y, anchors, radius) {
  if (!Array.isArray(anchors) || radius <= 0) return false;
  const radiusSq = radius * radius;
  return anchors.some((anchor) => ((x - anchor.x) ** 2) + ((y - anchor.y) ** 2) <= radiusSq);
}

function resolveSpawnStyle(definition) {
  return definition?.spawnStyle ?? 'scattered';
}

function separationMultiplierForStyle(style) {
  if (style === 'swarm') return 0.75;
  if (style === 'elite') return 1.5;
  return 1;
}

export class EnemySpawner {
  constructor(settings) {
    this.settings = settings;
  }

  minSpawnSeparation(candidateRadius, otherRadius, style = 'scattered') {
    const base = Math.max(0.5, this.settings.minDistanceBetweenEnemies ?? 2);
    const radiusBuffer = Math.max(0.25, (candidateRadius ?? 1.3) + (otherRadius ?? 1.3));
    return Math.max(base * separationMultiplierForStyle(style), radiusBuffer);
  }

  resolveRejectionReason(room, x, y, definition, context) {
    if (context.occupiedTiles.has(tileKey(x, y))) return 'blocked_object';
    if (!context.allowedTileSet.has(tileKey(x, y))) return 'invalid_zone';
    if (isNearAnchors(x, y, context.entranceAnchors, context.settings.minDistanceFromEntrance)) return 'near_entrance';
    if (isNearAnchors(x, y, context.exitAnchors, context.settings.minDistanceFromExit)) return 'near_exit';
    if (isNearAnchors(x, y, context.spawnAnchors, context.settings.minDistanceFromSpawn)) return 'near_spawn';

    const candidateRadius = definition?.combat?.radius ?? definition?.radius ?? 1.3;
    const terrainAndObjectValidation = evaluateSpawnPosition(
      { x, y },
      { radius: candidateRadius },
      { room, worldObjects: room?.objects ?? [], enemies: [] },
    );
    if (!terrainAndObjectValidation.valid) return terrainAndObjectValidation.reason;

    const style = resolveSpawnStyle(definition);
    for (const enemy of context.placedEnemies) {
      const distance = Math.hypot(enemy.x - x, enemy.y - y);
      const minDistance = this.minSpawnSeparation(candidateRadius, enemy.radius, style);
      if (distance < minDistance) return 'enemy_overlap';
    }

    return null;
  }

  registerEnemy(enemy, context, pointMeta = {}) {
    context.occupiedTiles.add(tileKey(enemy.x, enemy.y));
    context.placedEnemies.push({ x: enemy.x, y: enemy.y, radius: enemy.radius ?? 1.3, type: enemy.enemyType, spawnStyle: enemy.spawnStyle ?? 'scattered' });
    return {
      x: enemy.x,
      y: enemy.y,
      type: enemy.enemyType,
      zoneId: context.zoneId,
      threatLevel: pointMeta.threatLevel ?? 1,
      spawnStyle: enemy.spawnStyle ?? 'scattered',
      groupId: pointMeta.groupId ?? null,
    };
  }

  createEnemy(enemyType, x, y, definition, context, metadata = {}) {
    const enemy = new Enemy(enemyType, x, y);
    enemy.threatLevel = metadata.threatLevel ?? 1;
    enemy.encounterZone = context.zoneId;
    enemy.encounterGroupId = metadata.groupId ?? null;
    enemy.spawnStyle = resolveSpawnStyle(definition);
    return enemy;
  }

  findValidPoint(room, candidateTiles, definition, context, around = null, radius = 0) {
    if (!candidateTiles.length) return null;
    const localAttempts = Math.max(10, Math.min(24, Math.floor(context.settings.maxSpawnAttempts * 0.12)));
    const searchRadius = Math.max(2, radius || (context.settings.spawnRetryRadius ?? 5));

    for (let attempt = 0; attempt < context.settings.maxSpawnAttempts; attempt += 1) {
      const seed = around
        ? {
          x: Math.round(around.x + Math.cos(context.rng() * Math.PI * 2) * (context.rng() * radius)),
          y: Math.round(around.y + Math.sin(context.rng() * Math.PI * 2) * (context.rng() * radius)),
        }
        : candidateTiles[randomInt(context.rng, 0, candidateTiles.length - 1)];

      const trial = tryFindSpawnPosition(seed, {
        entity: { radius: definition?.combat?.radius ?? definition?.radius ?? 1.3 },
        maxAttempts: localAttempts,
        searchRadius,
        rng: context.rng,
        context: { room, worldObjects: room?.objects ?? [], enemies: [] },
        onAttempt: (result) => {
          if (result.valid) return;
          context.rejections.push({ x: result.position.x, y: result.position.y, reason: result.reason, zoneId: context.zoneId });
        },
      });

      if (!trial.position) continue;
      const rejection = this.resolveRejectionReason(room, trial.position.x, trial.position.y, definition, context);
      if (!rejection) return { x: trial.position.x, y: trial.position.y };
      context.rejections.push({ x: trial.position.x, y: trial.position.y, reason: rejection, zoneId: context.zoneId });
    }
    return null;
  }

  spawnScattered({ room, enemyType, definition, count, threatLevel = 1, context }) {
    const enemies = [];
    const points = [];
    const candidateTiles = [...context.allowedTiles];
    for (let i = 0; i < count; i += 1) {
      const point = this.findValidPoint(room, candidateTiles, definition, context);
      if (!point) continue;
      const enemy = this.createEnemy(enemyType, point.x, point.y, definition, context, { threatLevel });
      enemies.push(enemy);
      points.push(this.registerEnemy(enemy, context, { threatLevel }));
    }
    return { enemies, points };
  }

  spawnSwarm({ room, enemyType, definition, center, count, radius, threatLevel = 1, groupId, context }) {
    const enemies = [];
    const points = [];
    for (let i = 0; i < count; i += 1) {
      const point = this.findValidPoint(room, context.allowedTiles, definition, context, center, radius);
      if (!point) continue;
      const enemy = this.createEnemy(enemyType, point.x, point.y, definition, context, { threatLevel, groupId });
      enemies.push(enemy);
      points.push(this.registerEnemy(enemy, context, { threatLevel, groupId }));
    }
    return { enemies, points };
  }

  pickGroupCenters(zone, count, context) {
    const centers = [];
    if (!zone.tiles.length) return centers;
    const minGroupDistanceSq = context.settings.minDistanceBetweenEnemyGroups ** 2;
    for (let i = 0; i < count; i += 1) {
      let center = null;
      for (let attempt = 0; attempt < context.settings.maxSpawnAttempts; attempt += 1) {
        const tile = zone.tiles[randomInt(context.rng, 0, zone.tiles.length - 1)];
        const tooClose = centers.some((existing) => ((existing.x - tile.x) ** 2) + ((existing.y - tile.y) ** 2) < minGroupDistanceSq);
        if (tooClose) continue;
        center = { x: tile.x, y: tile.y };
        break;
      }
      if (center) centers.push(center);
    }
    return centers;
  }
}
