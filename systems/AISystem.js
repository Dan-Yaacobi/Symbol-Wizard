import { Projectile } from '../entities/Projectile.js';
import { ENEMY_BEHAVIOR } from '../entities/Enemy.js';
import { applyPush, resolveWallOverlap } from './EnemyCollisionSystem.js';

function resetMeleeState(enemy) {
  enemy.isWindingUp = false;
  enemy.isAttacking = false;
  enemy.attackElapsed = 0;
  enemy.attackDamageApplied = false;
}

function stopEnemy(enemy) {
  enemy.vx = 0;
  enemy.vy = 0;
}

function applyMeleeLogic(enemy, dt, cooldownMultiplier = 1) {
  stopEnemy(enemy);

  if (enemy.isWindingUp) {
    enemy.attackElapsed = (enemy.attackElapsed ?? 0) + dt;
    if (enemy.attackElapsed >= (enemy.attackWindup ?? 0.4)) {
      enemy.isWindingUp = false;
      enemy.isAttacking = true;
      enemy.attackElapsed = 0;
      enemy.attackDamageApplied = false;
    }
    return;
  }

  if (enemy.isAttacking) {
    enemy.attackElapsed = (enemy.attackElapsed ?? 0) + dt;
    if (enemy.attackElapsed >= (enemy.attackDuration ?? 0.3)) {
      enemy.isAttacking = false;
      enemy.attackElapsed = 0;
      enemy.attackDamageApplied = false;
      enemy.attackTimer = (enemy.attackCooldown ?? 0.8) * cooldownMultiplier;
    }
    return;
  }

  if ((enemy.attackTimer ?? 0) <= 0) {
    enemy.isWindingUp = true;
    enemy.attackElapsed = 0;
    enemy.attackDamageApplied = false;
  }
}

function move(enemy, dirX, dirY, dt, speedMultiplier = 1, jitter = 0) {
  const len = Math.hypot(dirX, dirY) || 1;
  enemy.vx = (dirX / len) * enemy.speed * speedMultiplier + jitter;
  enemy.vy = (dirY / len) * enemy.speed * speedMultiplier;
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
}

function createEnemyProjectile(enemy, player) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const len = Math.hypot(dx, dy) || 1;
  const projectile = new Projectile(enemy.x, enemy.y, dx / len, dy / len);
  projectile.faction = 'enemy';
  projectile.projectileType = enemy.projectileType ?? 'enemyProjectile';
  projectile.damage = enemy.attackDamage ?? 2;
  projectile.speed = 40;
  projectile.ttl = 1.2;
  projectile.color = '#ffb893';
  projectile.glowColor = '#ffd4b8';
  projectile.trailColor = '#ffc69b';
  projectile.hitParticleColor = '#ffd6b8';
  return projectile;
}

export function updateEnemies(enemies, player, dt, projectiles = [], config = null, collisionContext = null) {
  const detectRadius = config?.get?.('enemies.detectRadius') ?? config?.get?.('enemies.aggroRange') ?? 8;
  const chaseRadius = config?.get?.('enemies.chaseRadius') ?? config?.get?.('enemies.disengageRange') ?? 18;
  const aggroMemory = config?.get?.('enemies.aggroMemory') ?? 2.5;
  const aggroChainRadius = config?.get?.('enemies.aggroChainRadius') ?? 8;
  const attackRangeMult = config?.get?.('enemies.attackRangeMultiplier') ?? 1;
  const speedMult = config?.get?.('enemies.moveSpeedMultiplier') ?? 1;
  const cooldownMult = config?.get?.('enemies.attackCooldownMultiplier') ?? 1;
  const rangedAttackRange = config?.get?.('enemies.rangedAttackRange') ?? 10;
  const rangedCooldown = config?.get?.('enemies.rangedCooldown') ?? 1.2;
  const tankSpeedMultiplier = config?.get?.('enemies.tankSpeedMultiplier') ?? 0.6;
  const flankerOffsetDistance = config?.get?.('enemies.flankerOffsetDistance') ?? 5;
  const collisionMap = collisionContext?.map ?? null;
  const tileSize = collisionContext?.tileSize ?? 1;

  const aliveEnemies = [];
  const newlyAggroed = [];

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    aliveEnemies.push(enemy);

    if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);

    if (enemy.hitKnockbackTimer > 0) {
      applyPush(enemy, enemy.hitKnockbackX * dt, enemy.hitKnockbackY * dt, collisionMap, tileSize);
      resolveWallOverlap(enemy, collisionMap);
      enemy.hitKnockbackTimer = Math.max(0, enemy.hitKnockbackTimer - dt);
      if (enemy.hitKnockbackTimer === 0) {
        enemy.hitKnockbackX = 0;
        enemy.hitKnockbackY = 0;
      }
    }

    if (enemy.frozen) {
      stopEnemy(enemy);
      resetMeleeState(enemy);
      continue;
    }

    enemy.attackTimer = Math.max(0, (enemy.attackTimer ?? 0) - dt);

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    const enemyDetectRadius = enemy.aggroRadius ?? detectRadius;
    if (distance <= enemyDetectRadius) {
      enemy.aggroMemoryTimer = aggroMemory;
    } else {
      enemy.aggroMemoryTimer = Math.max(0, (enemy.aggroMemoryTimer ?? 0) - dt);
    }

    const wasAggroed = Boolean(enemy.isAggroed);
    enemy.isAggroed = distance <= enemyDetectRadius || (enemy.aggroMemoryTimer ?? 0) > 0;
    if (enemy.isAggroed && !wasAggroed) {
      newlyAggroed.push(enemy);
    }
  }

  for (let i = 0; i < newlyAggroed.length; i += 1) {
    const source = newlyAggroed[i];
    for (const nearby of aliveEnemies) {
      if (nearby === source || nearby.isAggroed) continue;
      const nx = nearby.x - source.x;
      const ny = nearby.y - source.y;
      if (Math.hypot(nx, ny) > aggroChainRadius) continue;
      nearby.isAggroed = true;
      nearby.aggroMemoryTimer = Math.max(nearby.aggroMemoryTimer ?? 0, aggroMemory);
      newlyAggroed.push(nearby);
    }
  }

  for (const enemy of aliveEnemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    const attackRange = (enemy.attackRange ?? 3) * attackRangeMult;
    const inAttackRange = distance <= attackRange;

    if (!enemy.isAggroed || distance > chaseRadius) {
      enemy.isAggroed = false;
      stopEnemy(enemy);
      resetMeleeState(enemy);
      continue;
    }

    switch (enemy.behavior) {
      case ENEMY_BEHAVIOR.RANGED: {
        resetMeleeState(enemy);
        const retreatDistance = enemy.retreatDistance ?? 4;
        const targetRange = Math.max(enemy.attackRange ?? rangedAttackRange, rangedAttackRange);

        if (distance < retreatDistance) {
          move(enemy, -dx, -dy, dt, speedMult);
        } else if (distance > targetRange) {
          move(enemy, dx, dy, dt, speedMult);
        } else {
          stopEnemy(enemy);
          if ((enemy.attackTimer ?? 0) <= 0) {
            projectiles.push(createEnemyProjectile(enemy, player));
            enemy.attackTimer = Math.max(enemy.attackCooldown ?? rangedCooldown, rangedCooldown);
          }
        }
        break;
      }
      case ENEMY_BEHAVIOR.TANK: {
        if (!inAttackRange) {
          resetMeleeState(enemy);
          move(enemy, dx, dy, dt, speedMult * tankSpeedMultiplier);
        } else {
          applyMeleeLogic(enemy, dt, cooldownMult);
        }
        break;
      }
      case ENEMY_BEHAVIOR.SWARM: {
        if (!inAttackRange) {
          resetMeleeState(enemy);
          move(enemy, dx, dy, dt, speedMult);
        } else {
          applyMeleeLogic(enemy, dt, cooldownMult);
        }
        break;
      }
      case ENEMY_BEHAVIOR.FLANKER: {
        if (!inAttackRange) {
          resetMeleeState(enemy);
          const angleToPlayer = Math.atan2(enemy.y - player.y, enemy.x - player.x);
          enemy.flankAngleOffset = (enemy.flankAngleOffset ?? 0) + dt * (enemy.flankOrbitSpeed ?? 1.2) * (enemy.flankDirection ?? 1);
          const orbitAngle = angleToPlayer + (enemy.flankDirection ?? 1) * (Math.PI / 2) + enemy.flankAngleOffset;
          const targetX = player.x + Math.cos(orbitAngle) * flankerOffsetDistance;
          const targetY = player.y + Math.sin(orbitAngle) * flankerOffsetDistance;
          move(enemy, targetX - enemy.x, targetY - enemy.y, dt, speedMult);
        } else {
          applyMeleeLogic(enemy, dt, cooldownMult);
        }
        break;
      }
      case ENEMY_BEHAVIOR.CHASER:
      default: {
        if (!inAttackRange) {
          resetMeleeState(enemy);
          const jitter = enemy.enemyType === 'spider' ? Math.sin(performance.now() * 0.01 + enemy.x) * 0.3 : 0;
          move(enemy, dx, dy, dt, speedMult, jitter);
        } else {
          applyMeleeLogic(enemy, dt, cooldownMult);
        }
        break;
      }
    }
  }
}
