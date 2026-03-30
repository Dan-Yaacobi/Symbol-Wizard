import { Enemy } from '../entities/Enemy.js';

function randomInt(rng, min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function isNearAnchors(x, y, anchors, radius) {
  if (!Array.isArray(anchors) || radius <= 0) return false;
  const radiusSq = radius * radius;
  return anchors.some((anchor) => ((x - anchor.x) ** 2) + ((y - anchor.y) ** 2) <= radiusSq);
}

function tileKey(x, y) {
  return `${x},${y}`;
}

export class EnemySpawner {
  constructor(settings) {
    this.settings = settings;
  }

  isValidSpawnTile(room, x, y, context) {
    if (!room?.tiles?.[y]?.[x]?.walkable) return false;
    if (room.collisionMap?.[y]?.[x]) return false;
    if (context.occupiedTiles.has(tileKey(x, y))) return false;
    if (!context.allowedTileSet.has(tileKey(x, y))) return false;
    if (isNearAnchors(x, y, context.entranceAnchors, context.settings.minDistanceFromEntrance)) return false;
    if (isNearAnchors(x, y, context.exitAnchors, context.settings.minDistanceFromExit)) return false;
    if (isNearAnchors(x, y, context.spawnAnchors, context.settings.minDistanceFromSpawn)) return false;
    return true;
  }

  spawnGroup({ room, enemyType, center, groupSize, radius, threatLevel = 1, groupId, context }) {
    const enemies = [];
    const points = [];
    for (let i = 0; i < groupSize; i += 1) {
      let found = null;
      for (let attempt = 0; attempt < context.settings.maxSpawnAttempts; attempt += 1) {
        const angle = context.rng() * Math.PI * 2;
        const distance = context.rng() * radius;
        const x = Math.round(center.x + Math.cos(angle) * distance);
        const y = Math.round(center.y + Math.sin(angle) * distance);
        if (!this.isValidSpawnTile(room, x, y, context)) continue;

        const minDistanceSq = context.settings.minDistanceBetweenEnemies ** 2;
        const overlap = points.some((point) => ((point.x - x) ** 2) + ((point.y - y) ** 2) < minDistanceSq);
        if (overlap) continue;
        found = { x, y };
        break;
      }

      if (!found) continue;
      context.occupiedTiles.add(tileKey(found.x, found.y));
      const enemy = new Enemy(enemyType, found.x, found.y);
      enemy.threatLevel = threatLevel;
      enemy.encounterZone = context.zoneId;
      enemy.encounterGroupId = groupId;
      enemies.push(enemy);
      points.push({ x: found.x, y: found.y, type: enemyType, groupId, zoneId: context.zoneId, threatLevel });
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

