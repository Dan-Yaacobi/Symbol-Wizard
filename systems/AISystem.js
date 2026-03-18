import { Projectile } from '../entities/Projectile.js';
import { ENEMY_BEHAVIOR } from '../entities/Enemy.js';
import { applyPush, attemptMoveWithCollision, resolveWallOverlap } from './EnemyCollisionSystem.js';

const ENEMY_POSITION_SMOOTHING = 0.2;

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
  ensureTargetPosition(enemy);
  const len = Math.hypot(dirX, dirY) || 1;
  enemy.vx = (dirX / len) * enemy.speed * speedMultiplier + jitter;
  enemy.vy = (dirY / len) * enemy.speed * speedMultiplier;

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


function setOrbitTarget(enemy, player, angle = Math.random() * Math.PI * 2) {
  enemy.orbitAngle = angle;
  enemy.orbitTargetPlayerX = player.x;
  enemy.orbitTargetPlayerY = player.y;
}

function getOrbitTarget(enemy, player) {
  const orbitRadius = enemy.orbitRadius ?? 8;
  const orbitAngle = enemy.orbitAngle ?? 0;
  return {
    x: player.x + Math.cos(orbitAngle) * orbitRadius,
    y: player.y + Math.sin(orbitAngle) * orbitRadius,
  };
}

function enterOrbitReposition(enemy, player, angle = Math.random() * Math.PI * 2) {
  enemy.orbitPhase = 'reposition';
  enemy.orbitWaitTimer = 0;
  setOrbitTarget(enemy, player, angle);
}

function fireOrbitShot(enemy, player, projectiles, rangedCooldown) {
  projectiles.push(createEnemyProjectile(enemy, player));
  enemy.attackTimer = Math.max(enemy.attackCooldown ?? rangedCooldown, rangedCooldown);
  enemy.orbitPhase = 'wait';
  enemy.orbitWaitTimer = enemy.orbitWaitDuration ?? 0.35;
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

export function updateEnemies(enemies, player, dt, projectiles = [], config = null, collisionContext = null, system = null) {
  const detectRadius = config?.get?.('enemies.detectRadius') ?? config?.get?.('enemies.aggroRange') ?? 8;
  const aggroChainRadius = config?.get?.('enemies.aggroChainRadius') ?? 8;
  const swarmAggroRadius = config?.get?.('enemies.swarmAggroRadius') ?? 10;
  const swarmAggroChainDepth = config?.get?.('enemies.swarmAggroChainDepth') ?? 2;
  const attackRangeMult = config?.get?.('enemies.attackRangeMultiplier') ?? 1;
  const speedMult = config?.get?.('enemies.moveSpeedMultiplier') ?? 1;
  const cooldownMult = config?.get?.('enemies.attackCooldownMultiplier') ?? 1;
  const rangedAttackRange = config?.get?.('enemies.rangedAttackRange') ?? 10;
  const rangedCooldown = config?.get?.('enemies.rangedCooldown') ?? 1.2;
  const rangedOrbitRadius = config?.get?.('enemies.rangedOrbitRadius') ?? 8;
  const rangedOrbitArrivalThreshold = config?.get?.('enemies.rangedOrbitArrivalThreshold') ?? 0.75;
  const rangedOrbitPlayerDriftThreshold = config?.get?.('enemies.rangedOrbitPlayerDriftThreshold') ?? 1.5;
  const rangedOrbitWaitDuration = config?.get?.('enemies.rangedOrbitWaitDuration') ?? 0.35;
  const tankSpeedMultiplier = config?.get?.('enemies.tankSpeedMultiplier') ?? 0.6;
  const flankerOffsetDistance = config?.get?.('enemies.flankerOffsetDistance') ?? 5;
  const collisionMap = collisionContext?.map ?? null;
  const tileSize = collisionContext?.tileSize ?? 1;
  const system = collisionContext?.system ?? null;

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

    const dx = player.x - enemy.targetX;
    const dy = player.y - enemy.targetY;
    const distance = Math.hypot(dx, dy);
    const enemyDetectRadius = enemy.aggroRadius ?? detectRadius;
    const wasAggroed = Boolean(enemy.isAggroed);
    const shouldDetectPlayer = distance <= enemyDetectRadius;
    if (shouldDetectPlayer) activateEnemyAggro(enemy, player, system);
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
      activateEnemyAggro(nearby, player, system);
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

      activateEnemyAggro(other, player);
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
    const dx = player.x - enemy.targetX;
    const dy = player.y - enemy.targetY;
    const distance = Math.hypot(dx, dy);
    const attackRange = (enemy.attackRange ?? 3) * attackRangeMult;
    const inAttackRange = distance <= attackRange;

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
        const orbitRadius = enemy.orbitRadius ?? rangedOrbitRadius;
        const arrivalThreshold = enemy.orbitRepositionThreshold ?? rangedOrbitArrivalThreshold;
        const playerDriftThreshold = enemy.orbitPlayerDriftThreshold ?? rangedOrbitPlayerDriftThreshold ?? Math.max(1, orbitRadius * 0.2);
        const targetRange = Math.max(enemy.attackRange ?? rangedAttackRange, rangedAttackRange);
        const minShootDistance = enemy.minShootDistance ?? 6;
        const preferredDistance = enemy.preferredDistance ?? 8;

        if (!enemy.orbitPhase) {
          enterOrbitReposition(enemy, player);
        }

        const playerMovedSinceLock = Math.hypot(
          player.x - (enemy.orbitTargetPlayerX ?? player.x),
          player.y - (enemy.orbitTargetPlayerY ?? player.y),
        );

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
              fireOrbitShot(enemy, player, projectiles, rangedCooldown);
              enemy.isChargingShot = false;
              enemy.chargeTimer = 0;
            }

            break;
          }
          case 'wait': {
            stopEnemy(enemy);
            enemy.orbitWaitTimer = Math.max(0, (enemy.orbitWaitTimer ?? 0) - dt);
            if ((enemy.orbitWaitTimer ?? 0) <= 0) {
              enterOrbitReposition(enemy, player);
            }
            break;
          }
          case 'reposition':
          default: {
            if (playerMovedSinceLock >= playerDriftThreshold) {
              enemy.orbitTargetPlayerX = player.x;
              enemy.orbitTargetPlayerY = player.y;
            }

            const orbitTarget = getOrbitTarget(enemy, player);
            const preferredOrbitRadius = enemy.preferredDistance ?? preferredDistance;
            const targetDx = orbitTarget.x - enemy.x;
            const targetDy = orbitTarget.y - enemy.y;
            const targetDistance = Math.hypot(targetDx, targetDy);
            const orbitDistanceError = Math.abs(distance - preferredOrbitRadius);

            if (distance < minShootDistance) {
              move(enemy, -dx, -dy, dt, speedMult, 0, collisionMap, tileSize);
            } else if (distance > targetRange * 1.35) {
              move(enemy, dx, dy, dt, speedMult, 0, collisionMap, tileSize);
            } else if (targetDistance <= arrivalThreshold || orbitDistanceError <= arrivalThreshold * 0.5) {
              enemy.orbitWaitDuration = enemy.orbitWaitDuration ?? rangedOrbitWaitDuration;
              enemy.orbitPhase = 'shoot';
              stopEnemy(enemy);
            } else {
              move(enemy, targetDx, targetDy, dt, speedMult, 0, collisionMap, tileSize);
            }
            break;
          }
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
          const angleToPlayer = Math.atan2(enemy.targetY - player.y, enemy.targetX - player.x);
          enemy.flankAngleOffset = (enemy.flankAngleOffset ?? 0) + dt * (enemy.flankOrbitSpeed ?? 1.2) * (enemy.flankDirection ?? 1);
          const orbitAngle = angleToPlayer + (enemy.flankDirection ?? 1) * (Math.PI / 2) + enemy.flankAngleOffset;
          const targetX = player.x + Math.cos(orbitAngle) * flankerOffsetDistance;
          const targetY = player.y + Math.sin(orbitAngle) * flankerOffsetDistance;
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

    interpolateEnemyPosition(enemy);
  }
}
