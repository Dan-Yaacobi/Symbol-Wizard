import { Enemy } from '../entities/Enemy.js';
import { validateSpawnPosition, trySpawnPosition } from './SpawnValidator.js';

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
    const candidate = {
      x,
      y,
      radius: definition?.combat?.radius ?? definition?.radius ?? 1.3,
      ignoreCollisionWith: [],
    };
    const validation = validateSpawnPosition(candidate, candidate, {
      room,
      worldObjects: context.worldObjects,
      entities: context.placedEnemies,
      extraValidation: ({ tileKey: candidateTileKey }) => {
        if (context.occupiedTiles.has(candidateTileKey)) return { valid: false, reason: 'blocked_object' };
        if (!context.allowedTileSet.has(candidateTileKey)) return { valid: false, reason: 'invalid_zone' };
        if (isNearAnchors(x, y, context.entranceAnchors, context.settings.minDistanceFromEntrance)) return { valid: false, reason: 'near_entrance' };
        if (isNearAnchors(x, y, context.exitAnchors, context.settings.minDistanceFromExit)) return { valid: false, reason: 'near_exit' };
        if (isNearAnchors(x, y, context.spawnAnchors, context.settings.minDistanceFromSpawn)) return { valid: false, reason: 'near_spawn' };
        return { valid: true };
      },
    });
    if (!validation.valid) return validation.reason;

    const style = resolveSpawnStyle(definition);
    const candidateRadius = candidate.radius;
    for (const enemy of context.placedEnemies) {
      const minDistance = this.minSpawnSeparation(candidateRadius, enemy.radius, style);
      if (Math.hypot(enemy.x - x, enemy.y - y) < minDistance) return 'enemy_overlap';
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
    for (let attempt = 0; attempt < context.settings.maxSpawnAttempts; attempt += 1) {
      const baseTile = around
        ? { x: around.x, y: around.y }
        : candidateTiles[randomInt(context.rng, 0, candidateTiles.length - 1)];

      const result = trySpawnPosition(baseTile, { radius: definition?.combat?.radius ?? definition?.radius ?? 1.3 }, {
        room,
        worldObjects: context.worldObjects,
        entities: context.placedEnemies,
        rng: context.rng,
        maxAttempts: around ? Math.min(16, context.settings.maxSpawnAttempts) : 1,
        searchRadius: around ? Math.max(1, radius) : 1,
      });
      if (result.position) {
        const rejection = this.resolveRejectionReason(room, result.position.x, result.position.y, definition, context);
        if (!rejection) return { x: result.position.x, y: result.position.y };
        context.rejections.push({ x: result.position.x, y: result.position.y, reason: rejection, zoneId: context.zoneId });
        continue;
      }
      if (result.validation?.reason) {
        context.rejections.push({ x: baseTile.x, y: baseTile.y, reason: result.validation.reason, zoneId: context.zoneId });
      }
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
