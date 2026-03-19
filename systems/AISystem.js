import { Projectile } from '../entities/Projectile.js';
import { ENEMY_BEHAVIOR } from '../entities/Enemy.js';
import { applyPush, attemptMoveWithCollision, resolveWallOverlap } from './EnemyCollisionSystem.js';

const ENEMY_POSITION_SMOOTHING = 0.2;
const ENEMY_VELOCITY_SMOOTHING = 0.2;
const ENEMY_SEPARATION_RADIUS = 1.8;
const ENEMY_SEPARATION_STRENGTH = 0.6;
const ENEMY_PERSONAL_SPACE_PUSH = 0.2;

function ensureTargetPosition(enemy) {
  if (!Number.isFinite(enemy.targetX)) enemy.targetX = enemy.x;
  if (!Number.isFinite(enemy.targetY)) enemy.targetY = enemy.y;
}

function interpolateEnemyPosition(enemy, smoothingFactor = ENEMY_POSITION_SMOOTHING) {
  ensureTargetPosition(enemy);
  enemy.x += (enemy.targetX - enemy.x) * smoothingFactor;
  enemy.y += (enemy.targetY - enemy.y) * smoothingFactor;
}

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

function move(enemy, dirX, dirY, dt, speedMultiplier = 1, jitter = 0, collisionMap = null, tileSize = 1) {
  void dt;
  void collisionMap;
  void tileSize;
  ensureTargetPosition(enemy);
  const len = Math.hypot(dirX, dirY) || 1;
  const targetVx = (dirX / len) * enemy.speed * speedMultiplier + jitter;
  const targetVy = (dirY / len) * enemy.speed * speedMultiplier;
  enemy.vx += (targetVx - enemy.vx) * ENEMY_VELOCITY_SMOOTHING;
  enemy.vy += (targetVy - enemy.vy) * ENEMY_VELOCITY_SMOOTHING;

}

function applyEnemySeparation(enemy, neighbors) {
  for (const other of neighbors) {
    if (other === enemy || !other.alive) continue;
    const dx = enemy.targetX - other.targetX;
    const dy = enemy.targetY - other.targetY;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0 || dist >= ENEMY_SEPARATION_RADIUS) continue;
    const force = (ENEMY_SEPARATION_RADIUS - dist) * ENEMY_SEPARATION_STRENGTH;
    enemy.vx += (dx / dist) * force;
    enemy.vy += (dy / dist) * force;
  }
}

function applyPlayerPersonalSpace(enemy, player) {
  if (!enemy.isAggroed || !player) return;
  const dx = enemy.targetX - player.x;
  const dy = enemy.targetY - player.y;
  const distanceToPlayer = Math.hypot(dx, dy);
  if (distanceToPlayer >= (enemy.personalSpaceDistance ?? enemy.preferredDistance ?? 2)) return;

  enemy.vx *= 0.5;
  enemy.vy *= 0.5;
  enemy.vx += dx * ENEMY_PERSONAL_SPACE_PUSH;
  enemy.vy += dy * ENEMY_PERSONAL_SPACE_PUSH;
}

function commitEnemyVelocity(enemy, dt, collisionMap, tileSize) {
  const nextPosition = { ...enemy, x: enemy.targetX, y: enemy.targetY };
  attemptMoveWithCollision(nextPosition, enemy.vx * dt, enemy.vy * dt, collisionMap, tileSize);
  enemy.targetX = nextPosition.x;
  enemy.targetY = nextPosition.y;
}

export function activateEnemyAggro(enemy, player = null, system = null) {
  if (!enemy || enemy.alive === false) return false;

  const wasAggroed = enemy.isAggroed;

  enemy.isAggroed = true;
  enemy.aggroLocked = true;

  if (player) enemy.target = player;

  if (!wasAggroed) {
    enemy.aggroFlashTimer = 0.3;

    system?.spawnEffect?.({
      type: 'aggro-flash',
      x: enemy.x,
      y: enemy.y,
      color: '#ff4d4d',
      ttl: 0.2,
    });
  }

  return true;
}


function enterOrbitReposition(enemy) {
  enemy.orbitPhase = 'reposition';
  enemy.orbitWaitTimer = 0;
}

function fireOrbitShot(enemy, player, projectiles, rangedCooldown, rangedOrbitWaitDuration) {
  projectiles.push(createEnemyProjectile(enemy, player));
  enemy.attackTimer = Math.max(enemy.attackCooldown ?? rangedCooldown, rangedCooldown);
  enemy.orbitPhase = 'wait';
  enemy.orbitWaitTimer = enemy.orbitWaitDuration ?? rangedOrbitWaitDuration;
}

function createEnemyProjectile(enemy, player) {
  ensureTargetPosition(enemy);
  const dx = player.x - enemy.targetX;
  const dy = player.y - enemy.targetY;
  const len = Math.hypot(dx, dy) || 1;
  const projectile = new Projectile(enemy.targetX, enemy.targetY, dx / len, dy / len);
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

export function updateEnemies(enemies, player, dt, projectiles = [], config = null, collisionContext = null, effectSystemOverride = null) {
  const detectRadius = config?.get?.('enemies.detectRadius') ?? config?.get?.('enemies.aggroRange') ?? 8;
  const aggroChainRadius = config?.get?.('enemies.aggroChainRadius') ?? 8;
  const swarmAggroRadius = config?.get?.('enemies.swarmAggroRadius') ?? 10;
  const swarmAggroChainDepth = config?.get?.('enemies.swarmAggroChainDepth') ?? 2;
  const attackRangeMult = config?.get?.('enemies.attackRangeMultiplier') ?? 1;
  const speedMult = config?.get?.('enemies.moveSpeedMultiplier') ?? 1;
  const cooldownMult = config?.get?.('enemies.attackCooldownMultiplier') ?? 1;
  const rangedAttackRange = config?.get?.('enemies.rangedAttackRange') ?? 10;
  const rangedCooldown = config?.get?.('enemies.rangedCooldown') ?? 1.2;
  const rangedOrbitWaitDuration = config?.get?.('enemies.rangedOrbitWaitDuration') ?? 0.35;
  const tankSpeedMultiplier = config?.get?.('enemies.tankSpeedMultiplier') ?? 0.6;
  const flankerOffsetDistance = config?.get?.('enemies.flankerOffsetDistance') ?? 5;
  const collisionMap = collisionContext?.map ?? null;
  const tileSize = collisionContext?.tileSize ?? 1;
  const system = collisionContext?.system ?? effectSystemOverride ?? null;
  const aggroEffectSystem = effectSystemOverride ?? null;

  const aliveEnemies = [];
  const newlyAggroed = [];

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    ensureTargetPosition(enemy);
    aliveEnemies.push(enemy);

    if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
    if (enemy.aggroFlashTimer > 0) enemy.aggroFlashTimer = Math.max(0, enemy.aggroFlashTimer - dt);

    if (enemy.hitKnockbackTimer > 0) {
      applyPush(enemy, enemy.hitKnockbackX * dt, enemy.hitKnockbackY * dt, collisionMap, tileSize);
      resolveWallOverlap(enemy, collisionMap);
      enemy.targetX = enemy.x;
      enemy.targetY = enemy.y;
      enemy.hitKnockbackTimer = Math.max(0, enemy.hitKnockbackTimer - dt);
      if (enemy.hitKnockbackTimer === 0) {
        enemy.hitKnockbackX = 0;
        enemy.hitKnockbackY = 0;
      }
    }

    if (enemy.frozen) {
      stopEnemy(enemy);
      enemy.targetX = enemy.x;
      enemy.targetY = enemy.y;
      resetMeleeState(enemy);
      continue;
    }

    enemy.attackTimer = Math.max(0, (enemy.attackTimer ?? 0) - dt);

    const targetPlayerX = player.x + (enemy.offsetX ?? 0);
    const targetPlayerY = player.y + (enemy.offsetY ?? 0);
    const dx = player.x - enemy.targetX;
    const dy = player.y - enemy.targetY;
    const distance = Math.hypot(dx, dy);
    const enemyDetectRadius = enemy.aggroRadius ?? detectRadius;
    const wasAggroed = Boolean(enemy.isAggroed);
    const shouldDetectPlayer = distance <= enemyDetectRadius;
    if (shouldDetectPlayer) activateEnemyAggro(enemy, player, aggroEffectSystem);
    enemy.isAggroed = Boolean(enemy.isAggroed || enemy.aggroLocked || shouldDetectPlayer);
    if (enemy.isAggroed && !wasAggroed) {
      if (player) enemy.target = player;
      newlyAggroed.push(enemy);
    }
  }

  for (let i = 0; i < newlyAggroed.length; i += 1) {
    const source = newlyAggroed[i];
    for (const nearby of aliveEnemies) {
      if (nearby === source || nearby.isAggroed) continue;
      const nx = nearby.targetX - source.targetX;
      const ny = nearby.targetY - source.targetY;
      if (Math.hypot(nx, ny) > aggroChainRadius) continue;
      activateEnemyAggro(nearby, player, aggroEffectSystem);
      newlyAggroed.push(nearby);
    }
  }

  const visitedSwarmEnemies = new Set();

  function propagateSwarmAggro(source, depth = 0) {
    if (!source || depth > swarmAggroChainDepth) return;

    visitedSwarmEnemies.add(source);

    for (const other of aliveEnemies) {
      if (visitedSwarmEnemies.has(other)) continue;
      if (other.behavior !== ENEMY_BEHAVIOR.SWARM) continue;
      if (other.isAggroed) continue;

      const dx = other.targetX - source.targetX;
      const dy = other.targetY - source.targetY;
      if (Math.hypot(dx, dy) > swarmAggroRadius) continue;

      activateEnemyAggro(other, player, aggroEffectSystem);
      system?.spawnEffect?.({
        type: 'swarm-link',
        x: other.x,
        y: other.y,
        color: '#ff6a6a',
        ttl: 0.15,
      });
      propagateSwarmAggro(other, depth + 1);
    }
  }

  for (const enemy of newlyAggroed) {
    if (enemy.behavior === ENEMY_BEHAVIOR.SWARM) {
      propagateSwarmAggro(enemy, 0);
    }
  }

  for (const enemy of aliveEnemies) {
    const targetPlayerX = player.x + (enemy.offsetX ?? 0);
    const targetPlayerY = player.y + (enemy.offsetY ?? 0);
    const dx = targetPlayerX - enemy.targetX;
    const dy = targetPlayerY - enemy.targetY;
    const distanceToPlayer = Math.hypot(player.x - enemy.targetX, player.y - enemy.targetY);
    const attackRange = (enemy.attackRange ?? 3) * attackRangeMult;
    const inAttackRange = distanceToPlayer <= attackRange;

    if (!enemy.isAggroed) {
      stopEnemy(enemy);
      resetMeleeState(enemy);
      interpolateEnemyPosition(enemy);
      continue;
    }

    if (player) enemy.target = player;

    switch (enemy.behavior) {
      case ENEMY_BEHAVIOR.RANGED: {
        resetMeleeState(enemy);
        const targetRange = enemy.attackRange ?? rangedAttackRange;
        const minDistance = enemy.minShootDistance ?? targetRange * 0.6;
        if (!enemy.orbitPhase) {
          enterOrbitReposition(enemy);
        }

        switch (enemy.orbitPhase) {
          case 'shoot': {
            stopEnemy(enemy);

            if (!enemy.isChargingShot) {
              enemy.isChargingShot = true;
              enemy.chargeTimer = 0;
            }

            enemy.chargeTimer += dt;

            system?.spawnEffect?.({
              type: 'charge',
              x: enemy.x,
              y: enemy.y,
              color: '#ffb893',
              ttl: 0.1,
            });

            if (enemy.chargeTimer >= (enemy.chargeDuration ?? 0.35)) {
              fireOrbitShot(enemy, player, projectiles, rangedCooldown, rangedOrbitWaitDuration);
              enemy.isChargingShot = false;
              enemy.chargeTimer = 0;
            }

            break;
          }
          case 'wait': {
            stopEnemy(enemy);
            enemy.orbitWaitTimer = Math.max(0, (enemy.orbitWaitTimer ?? 0) - dt);
            if ((enemy.orbitWaitTimer ?? 0) <= 0) {
              enterOrbitReposition(enemy);
            }
            break;
          }
          case 'reposition': {
            const dx = targetPlayerX - enemy.targetX;
            const dy = targetPlayerY - enemy.targetY;
            const distance = Math.hypot(dx, dy);

            // too close → run away
            if (distance < minDistance) {
              move(enemy, -dx, -dy, dt, speedMult, 0, collisionMap, tileSize);
              break;
            }

            // too far → move closer
            if (distance > targetRange) {
              move(enemy, dx, dy, dt, speedMult, 0, collisionMap, tileSize);
              break;
            }

            // good distance → shoot
            enemy.orbitPhase = 'shoot';
            stopEnemy(enemy);
            break;
          }
          default:
            enemy.orbitPhase = 'reposition';
            break;
        }
        break;
      }
      case ENEMY_BEHAVIOR.TANK: {
        if (!inAttackRange) {
          resetMeleeState(enemy);
          move(enemy, dx, dy, dt, speedMult * tankSpeedMultiplier, 0, collisionMap, tileSize);
        } else {
          applyMeleeLogic(enemy, dt, cooldownMult);
        }
        break;
      }
      case ENEMY_BEHAVIOR.SWARM: {
        if (!inAttackRange) {
          resetMeleeState(enemy);
          move(enemy, dx, dy, dt, speedMult, 0, collisionMap, tileSize);
        } else {
          applyMeleeLogic(enemy, dt, cooldownMult);
        }
        break;
      }
      case ENEMY_BEHAVIOR.FLANKER: {
        if (!inAttackRange) {
          resetMeleeState(enemy);
          const angleToPlayer = Math.atan2(enemy.targetY - targetPlayerY, enemy.targetX - targetPlayerX);
          enemy.flankAngleOffset = (enemy.flankAngleOffset ?? 0) + dt * (enemy.flankOrbitSpeed ?? 1.2) * (enemy.flankDirection ?? 1);
          const orbitAngle = angleToPlayer + (enemy.flankDirection ?? 1) * (Math.PI / 2) + enemy.flankAngleOffset;
          const targetX = targetPlayerX + Math.cos(orbitAngle) * flankerOffsetDistance;
          const targetY = targetPlayerY + Math.sin(orbitAngle) * flankerOffsetDistance;
          move(enemy, targetX - enemy.targetX, targetY - enemy.targetY, dt, speedMult, 0, collisionMap, tileSize);
        } else {
          applyMeleeLogic(enemy, dt, cooldownMult);
        }
        break;
      }
      case ENEMY_BEHAVIOR.CHASER:
      default: {
        if (!inAttackRange) {
          resetMeleeState(enemy);
          const jitter = enemy.enemyType === 'spider' ? Math.sin(performance.now() * 0.01 + enemy.targetX) * 0.3 : 0;
          move(enemy, dx, dy, dt, speedMult, jitter, collisionMap, tileSize);
        } else {
          applyMeleeLogic(enemy, dt, cooldownMult);
        }
        break;
      }
    }

    applyEnemySeparation(enemy, aliveEnemies);
    applyPlayerPersonalSpace(enemy, player);
    commitEnemyVelocity(enemy, dt, collisionMap, tileSize);
    interpolateEnemyPosition(enemy);
  }
}
