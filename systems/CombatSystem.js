import { collides } from './CollisionSystem.js';
import { applyAttackToObject, objectIntersectsCircle } from './ObjectInteractionSystem.js';

function spawnProjectileTrail(projectile) {
  const particleCount = 2 + Math.floor(Math.random() * 3);
  const minLife = projectile.trailParticleLifetime?.min ?? 0.15;
  const maxLife = projectile.trailParticleLifetime?.max ?? 0.25;

  projectile.trailParticles ??= [];
  for (let i = 0; i < particleCount; i += 1) {
    const ttl = minLife + Math.random() * (maxLife - minLife);
    projectile.trailParticles.push({
      x: projectile.x - projectile.dx * (0.18 + Math.random() * 0.3) + (Math.random() - 0.5) * 0.35,
      y: projectile.y - projectile.dy * (0.18 + Math.random() * 0.3) + (Math.random() - 0.5) * 0.35,
      vx: -projectile.dx * (2.5 + Math.random() * 2),
      vy: -projectile.dy * (2.5 + Math.random() * 2),
      ttl,
      maxTtl: ttl,
      color: projectile.trailColor,
    });
  }

  if (projectile.trailParticles.length > 20) {
    projectile.trailParticles.splice(0, projectile.trailParticles.length - 20);
  }
}


function triggerProjectileHit(projectile, payload) {
  const target = payload?.target ?? null;
  projectile.hitTargets ??= new Set();

  if (!target && projectile.hitHandled) return;
  if (target && projectile.hitTargets.has(target)) return;

  if (target) {
    projectile.hitTargets.add(target);
  } else {
    projectile.hitHandled = true;
  }

  console.log('[PROJECTILE HIT]', payload.x, payload.y);
  projectile.onHit?.(payload);
}

function updateProjectileTrail(projectile, dt) {
  projectile.trailParticles ??= [];
  projectile.trailSpawnTimer = (projectile.trailSpawnTimer ?? 0) - dt;

  const interval = projectile.trailSpawnInterval ?? 0.045;
  while (projectile.trailSpawnTimer <= 0) {
    spawnProjectileTrail(projectile);
    projectile.trailSpawnTimer += interval;
  }

  projectile.trailParticles = projectile.trailParticles.filter((particle) => {
    particle.ttl -= dt;
    particle.x += (particle.vx ?? 0) * dt;
    particle.y += (particle.vy ?? 0) * dt;
    return particle.ttl > 0;
  });
}
export function updateProjectiles(
  projectiles,
  map,
  enemies,
  player,
  dt,
  combatTextSystem = null,
  abilitySystem = null,
  worldObjects = [],
  onDestructibleDestroyed = null,
  config = null,
) {
  const deadProjectiles = new Set();
  const slain = [];

  for (const p of projectiles) {
    updateProjectileTrail(p, dt);
    const speedMult = config?.get?.('combat.projectileSpeedMultiplier') ?? 1;
    const ttlMult = config?.get?.('combat.projectileLifetimeMultiplier') ?? 1;
    p.ttl -= dt / Math.max(0.01, ttlMult);
    p.x += p.dx * p.speed * speedMult * dt;
    p.y += p.dy * p.speed * speedMult * dt;
    p.radius = config?.get?.('combat.projectileCollisionRadius') ?? p.radius;

    if (p.ttl <= 0) {
      triggerProjectileHit(p, { x: p.x, y: p.y, target: null, system: abilitySystem, instance: p.spellInstance });
      deadProjectiles.add(p);
    }

    const tx = Math.round(p.x);
    const ty = Math.round(p.y);
    if (!map[ty] || !map[ty][tx] || !map[ty][tx].walkable) {
      triggerProjectileHit(p, { x: p.x, y: p.y, target: null, system: abilitySystem, instance: p.spellInstance });
      deadProjectiles.add(p);
    }

    for (const object of worldObjects) {
      if (object.destroyed || !object.attackable) continue;
      if (objectIntersectsCircle(object, p.x, p.y, p.radius ?? 0.8)) {
        triggerProjectileHit(p, { x: p.x, y: p.y, target: object, system: abilitySystem, instance: p.spellInstance });
        if (!p.pierce) deadProjectiles.add(p);
        const result = applyAttackToObject(object, p.damage ?? 2);
        if (result.destroyed) onDestructibleDestroyed?.(object);
      }
    }

    if ((p.faction ?? 'player') === 'player') {
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        if (collides({ ...p, radius: p.radius ?? 0.8 }, enemy)) {
          if (p.hitTargets?.has(enemy)) continue;
          const isCritical = Math.random() < 0.2;
          const baseDamage = isCritical ? p.damage * 2 : p.damage;
          const multiplier = abilitySystem?.getDamageMultiplier(enemy) ?? 1;
          const damage = baseDamage * multiplier;
          abilitySystem?.applySpellDamage?.(enemy, damage, {
            eventName: 'onHit',
            instance: p.spellInstance,
            sourceX: p.x,
            sourceY: p.y,
            hitParticleColor: p.hitParticleColor,
          });
          triggerProjectileHit(p, {
            x: p.x,
            y: p.y,
            target: enemy,
            system: abilitySystem,
            instance: p.spellInstance,
          });
          if (!p.pierce) deadProjectiles.add(p);
          if (p.pierce && Number.isFinite(p.pierceCount) && p.hitTargets?.size >= p.pierceCount) deadProjectiles.add(p);
          if (enemy.hp <= 0) {
            enemy.alive = false;
            slain.push(enemy);
          }
        }
      }
    } else if (player && collides({ ...p, radius: p.radius ?? 0.8 }, player)) {
      const damage = p.damage ?? 1;
      player.hp = Math.max(0, player.hp - damage);
      combatTextSystem?.spawnDamageText(player, damage, false);
      triggerProjectileHit(p, { x: p.x, y: p.y, target: player, system: abilitySystem, instance: p.spellInstance });
      deadProjectiles.add(p);
    }
  }

  return {
    projectiles: projectiles.filter((p) => !deadProjectiles.has(p)),
    slain,
  };
}

export function updateEnemyPlayerInteractions(enemies, player, dt, combatTextSystem = null, config = null) {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    if (!enemy.isAttacking || enemy.attackDamageApplied) continue;

    const hitTime = enemy.attackHitTime ?? 0.08;
    if ((enemy.attackElapsed ?? 0) < hitTime) continue;

    const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    const attackRange = (enemy.attackRange ?? 3) * (config?.get?.('enemies.attackRangeMultiplier') ?? 1);
    if (distance > attackRange + player.radius * 0.5) {
      enemy.attackDamageApplied = true;
      continue;
    }

    const damage = enemy.attackDamage ?? 1;
    player.hp = Math.max(0, player.hp - damage);
    combatTextSystem?.spawnDamageText(player, damage, false);
    enemy.attackDamageApplied = true;
  }
}
