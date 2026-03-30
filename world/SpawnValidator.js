import { objectIntersectsCircle } from '../systems/ObjectInteractionSystem.js';

function tileKey(x, y) {
  return `${x},${y}`;
}

function resolveRadius(source, fallback = 1.2) {
  const value = Number(source?.radius ?? source?.combat?.radius);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0.25, value);
}

function resolveCollisionGroup(source, fallback = 'default') {
  if (typeof source?.collisionGroup === 'string' && source.collisionGroup.length > 0) return source.collisionGroup;
  if (typeof source?.type === 'string' && source.type.length > 0) return source.type;
  return fallback;
}

function resolveIgnoredGroups(source) {
  if (!Array.isArray(source?.ignoreCollisionWith)) return [];
  return source.ignoreCollisionWith.filter((group) => typeof group === 'string' && group.length > 0);
}

function canIgnoreObjectCollision(entity, object, ignoredObjects = new Set()) {
  if (!object || ignoredObjects.has(object)) return true;
  const objectGroup = resolveCollisionGroup(object, 'object');
  return resolveIgnoredGroups(entity).includes(objectGroup);
}

function collectSampleTiles(position, radius) {
  const sampleSet = new Set([tileKey(Math.round(position.x), Math.round(position.y))]);
  const points = Math.max(16, Math.round(radius * 20));
  for (let i = 0; i < points; i += 1) {
    const angle = (Math.PI * 2 * i) / points;
    const px = Math.round(position.x + (Math.cos(angle) * radius));
    const py = Math.round(position.y + (Math.sin(angle) * radius));
    sampleSet.add(tileKey(px, py));
  }
  return [...sampleSet].map((value) => {
    const [x, y] = value.split(',').map(Number);
    return { x, y };
  });
}

function failsTerrainCheck(position, radius, room) {
  const samples = collectSampleTiles(position, radius);
  for (const sample of samples) {
    const tile = room?.tiles?.[sample.y]?.[sample.x];
    if (!tile?.walkable) return true;
    if (room?.collisionMap?.[sample.y]?.[sample.x]) return true;
  }
  return false;
}

function collidesWithObject(position, radius, worldObjects = [], entity = null, ignoredObjects = new Set()) {
  for (const object of worldObjects) {
    if (!object || object.destroyed || !object.collision) continue;
    if (canIgnoreObjectCollision(entity, object, ignoredObjects)) continue;
    if (objectIntersectsCircle(object, position.x, position.y, radius)) return object;
  }
  return null;
}

function collidesWithEnemy(position, radius, enemies = [], ignoredEnemies = new Set()) {
  for (const enemy of enemies) {
    if (!enemy || ignoredEnemies.has(enemy) || enemy.alive === false) continue;
    const otherRadius = resolveRadius(enemy, 1.2);
    const distance = Math.hypot(position.x - enemy.x, position.y - enemy.y);
    if (distance < radius + otherRadius) return enemy;
  }
  return null;
}

export function evaluateSpawnPosition(position, entity, context = {}) {
  const normalizedPosition = { x: Math.round(position?.x ?? 0), y: Math.round(position?.y ?? 0) };
  const radius = resolveRadius(entity, 1.2);
  const ignoredObjects = new Set(context.ignoredObjects ?? []);
  const ignoredEnemies = new Set(context.ignoredEnemies ?? []);

  if (failsTerrainCheck(normalizedPosition, radius, context.room)) {
    return { valid: false, reason: 'blocked_tile', position: normalizedPosition, radius };
  }

  const objectCollision = collidesWithObject(
    normalizedPosition,
    radius,
    context.worldObjects,
    entity,
    ignoredObjects,
  );
  if (objectCollision) {
    return { valid: false, reason: 'blocked_object', position: normalizedPosition, radius, object: objectCollision };
  }

  const enemyCollision = collidesWithEnemy(normalizedPosition, radius, context.enemies, ignoredEnemies);
  if (enemyCollision) {
    return { valid: false, reason: 'enemy_overlap', position: normalizedPosition, radius, enemy: enemyCollision };
  }

  return { valid: true, reason: null, position: normalizedPosition, radius };
}

export function isValidSpawnPosition(position, entity, context = {}) {
  return evaluateSpawnPosition(position, entity, context).valid;
}

export function tryFindSpawnPosition(origin, options = {}) {
  const rng = options.rng ?? Math.random;
  const maxAttempts = Math.max(1, Number(options.maxAttempts) || 12);
  const searchRadius = Math.max(1, Number(options.searchRadius) || 4);
  const attempts = [];

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const position = attempt === 0
      ? { x: Math.round(origin.x), y: Math.round(origin.y) }
      : (() => {
        const angle = rng() * Math.PI * 2;
        const distance = rng() * searchRadius;
        return {
          x: Math.round(origin.x + Math.cos(angle) * distance),
          y: Math.round(origin.y + Math.sin(angle) * distance),
        };
      })();

    const result = evaluateSpawnPosition(position, options.entity, options.context);
    attempts.push(result);
    if (typeof options.onAttempt === 'function') options.onAttempt(result);
    if (result.valid) return { position: result.position, attempts };
  }

  return { position: null, attempts };
}

