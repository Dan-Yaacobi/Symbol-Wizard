import { collides } from './CollisionSystem.js';

export function updateTownNpcs(npcs, map, dt) {
  for (const npc of npcs) {
    if (npc.dialogueEngaged) {
      npc.vx = 0;
      npc.vy = 0;
      continue;
    }

    npc.wanderTimer -= dt;
    if (npc.wanderRadius <= 0) {
      npc.vx = 0;
      npc.vy = 0;
      continue;
    }

    if (npc.wanderTimer <= 0) {
      npc.wanderTimer = 1 + Math.random() * 2.5;
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * npc.wanderRadius;
      npc.targetX = npc.homeX + Math.cos(angle) * distance;
      npc.targetY = npc.homeY + Math.sin(angle) * distance;
    }

    if (npc.targetX == null || npc.targetY == null) {
      npc.vx = 0;
      npc.vy = 0;
      continue;
    }

    const dx = npc.targetX - npc.x;
    const dy = npc.targetY - npc.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.4) {
      npc.vx = 0;
      npc.vy = 0;
      npc.targetX = null;
      npc.targetY = null;
      continue;
    }

    npc.vx = (dx / distance) * npc.speed;
    npc.vy = (dy / distance) * npc.speed;
    const nx = npc.x + npc.vx * dt;
    const ny = npc.y + npc.vy * dt;
    const tx = Math.round(nx);
    const ty = Math.round(ny);
    if (!map[ty]?.[tx]?.walkable) {
      npc.targetX = null;
      npc.targetY = null;
      npc.vx = 0;
      npc.vy = 0;
      continue;
    }

    npc.x = nx;
    npc.y = ny;
  }
}

export function resolveObjectCollision(entity, worldObjects) {
  for (const object of worldObjects) {
    if (object.destroyed || !object.blocksMovement) continue;
    if (!collides(entity, object)) continue;

    const dx = entity.x - object.x;
    const dy = entity.y - object.y;
    const distance = Math.hypot(dx, dy) || 0.001;
    const overlap = (entity.radius + object.radius) - distance;
    if (overlap <= 0) continue;

    entity.x += (dx / distance) * overlap;
    entity.y += (dy / distance) * overlap;
  }
}

export function updateDestructibleAnimations(worldObjects, dt) {
  for (const object of worldObjects) {
    if (!object.destroyed || object.breakTimer <= 0) continue;
    object.breakTimer = Math.max(0, object.breakTimer - dt);
  }
}

export function cleanupDestroyedObjects(worldObjects) {
  for (let i = worldObjects.length - 1; i >= 0; i -= 1) {
    const object = worldObjects[i];
    if (object.type !== 'destructible' || !object.destroyed) continue;
    if (object.breakTimer > 0) continue;
    worldObjects.splice(i, 1);
  }
}
