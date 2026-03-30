import { Projectile } from '../entities/Projectile.js';
import { ENEMY_BEHAVIOR } from '../entities/Enemy.js';
import { applyPush, attemptMoveWithCollision, resolveWallOverlap } from './EnemyCollisionSystem.js';
import { ensureEntityState, setEntityState, syncEntityMovementState, updateEntityState } from './EntityStateSystem.js';
import { ensureEntityFacing, updateFacingFromVelocity, updateFacingTowardTarget } from './FacingSystem.js';

const ENEMY_POSITION_SMOOTHING = 0.2;
const ENEMY_VELOCITY_SMOOTHING = 0.2;
const ENEMY_SEPARATION_RADIUS = 1.8;
const ENEMY_SEPARATION_STRENGTH = 0.6;
const ENEMY_PERSONAL_SPACE_PUSH = 0.2;
const ENEMY_COLLISION_MIN_DISTANCE = 1;
const FACING_LOG_MAX_ENEMIES = 5;

function ensureTargetPosition(enemy) {
  if (!Number.isFinite(enemy.targetX)) enemy.targetX = enemy.x;
  if (!Number.isFinite(enemy.targetY)) enemy.targetY = enemy.y;
}

function interpolateEnemyPosition(enemy, smoothingFactor = ENEMY_POSITION_SMOOTHING) {
  ensureTargetPosition(enemy);
  enemy.x += (enemy.targetX - enemy.x) * smoothingFactor;
  enemy.y += (enemy.targetY - enemy.y) * smoothingFactor;
}

function stopEnemy(enemy) {
  enemy.vx = 0;
  enemy.vy = 0;
}

function hasAttackState(enemy) {
  return ensureEntityState(enemy).type === 'attack';
}

function beginAttack(enemy, duration) {
  enemy.attackStateDuration = duration;
  setEntityState(enemy, 'attack');
}

function updateAttackState(enemy, dt) {
  if (!hasAttackState(enemy)) return false;
  const attackDefinition = enemy.stateDefinitions.attack;
  attackDefinition.duration = enemy.attackStateDuration ?? attackDefinition.duration;
  updateEntityState(enemy, dt);
  return true;
}

function tryStartMeleeAttack(enemy, cooldownMultiplier = 1) {
  if ((enemy.attackTimer ?? 0) > 0 || hasAttackState(enemy)) return false;
  enemy.pendingAttackCooldown = (enemy.attackCooldown ?? 0.8) * cooldownMultiplier;
  beginAttack(enemy, (enemy.attackWindup ?? 0.4) + (enemy.attackDuration ?? 0.3));
  return true;
}

function move(enemy, dirX, dirY, dt, speedMultiplier = 1, jitter = 0) {
  void dt;
  ensureTargetPosition(enemy);
  const len = Math.hypot(dirX, dirY) || 1;
  const recoilSlowMultiplier = (enemy.postAttackSlowTimer ?? 0) > 0 ? 0.35 : 1;
  const targetVx = (dirX / len) * enemy.speed * speedMultiplier * recoilSlowMultiplier + jitter;
  const targetVy = (dirY / len) * enemy.speed * speedMultiplier * recoilSlowMultiplier;
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

function resolveEnemyCollisions(enemies, collisionMap) {
  for (let i = 0; i < enemies.length; i += 1) {
    const enemy = enemies[i];
    if (!enemy?.alive) continue;
    for (let j = i + 1; j < enemies.length; j += 1) {
      const other = enemies[j];
      if (!other?.alive) continue;
      const dx = enemy.x - other.x;
      const dy = enemy.y - other.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 0 || dist >= ENEMY_COLLISION_MIN_DISTANCE) continue;
      const overlap = ENEMY_COLLISION_MIN_DISTANCE - dist;
      const nx = dx / dist;
      const ny = dy / dist;
      enemy.x += nx * overlap * 0.5;
      enemy.y += ny * overlap * 0.5;
      other.x -= nx * overlap * 0.5;
      other.y -= ny * overlap * 0.5;
      resolveWallOverlap(enemy, collisionMap);
      resolveWallOverlap(other, collisionMap);
      enemy.targetX = enemy.x;
      enemy.targetY = enemy.y;
      other.targetX = other.x;
      other.targetY = other.y;
    }
  }
}

export function activateEnemyAggro(enemy, player = null, system = null) {
  if (!enemy || enemy.alive === false) return false;
  const wasAggroed = enemy.isAggroed;
  enemy.isAggroed = true;
  enemy.aggroLocked = true;
  if (player) enemy.target = player;
  if (!wasAggroed) {
    enemy.aggroFlashTimer = 0.3;
    system?.spawnEffect?.({ type: 'aggro-flash', x: enemy.x, y: enemy.y, color: '#ff4d4d', ttl: 0.2 });
  }
  return true;
}

function enterOrbitReposition(enemy) {
  enemy.orbitPhase = 'reposition';
  enemy.orbitWaitTimer = 0;
}

function fireOrbitShot(enemy, projectiles, rangedCooldown) {
  projectiles.push(createEnemyProjectile(enemy));
  enemy.attackTimer = Math.max(enemy.attackCooldown ?? rangedCooldown, rangedCooldown);
  enemy.orbitPhase = 'wait';
  enemy.orbitWaitTimer = enemy.orbitWaitDuration ?? 0.35;
}

function createEnemyProjectile(enemy) {
  ensureTargetPosition(enemy);
  ensureEntityFacing(enemy);
  const projectile = new Projectile(enemy.targetX, enemy.targetY, enemy.facing.x, enemy.facing.y);
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
  const tankSpeedMultiplier = config?.get?.('enemies.tankSpeedMultiplier') ?? 0.6;
  const flankerOffsetDistance = config?.get?.('enemies.flankerOffsetDistance') ?? 5;
  const collisionMap = collisionContext?.map ?? null;
  const tileSize = collisionContext?.tileSize ?? 1;
  const system = collisionContext?.system ?? effectSystemOverride ?? null;
  const aggroEffectSystem = effectSystemOverride ?? null;
  const facingDebugEnabled = Boolean(config?.get?.('debug.logEnemyFacing'));

  const aliveEnemies = [];
  const newlyAggroed = [];

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    ensureTargetPosition(enemy);
    ensureEntityFacing(enemy);
    ensureEntityState(enemy);
    enemy.stateContext = { player, projectiles, system, config };
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

    const isStunned = enemy.statusEffects instanceof Map && enemy.statusEffects.has('stun');
    if (enemy.frozen || isStunned) {
      stopEnemy(enemy);
      enemy.targetX = enemy.x;
      enemy.targetY = enemy.y;
      if (hasAttackState(enemy)) setEntityState(enemy, 'idle');
      continue;
    }

    enemy.attackTimer = Math.max(0, (enemy.attackTimer ?? 0) - dt);
    const distance = Math.hypot(player.x - enemy.targetX, player.y - enemy.targetY);
    const enemyDetectRadius = enemy.aggroRadius ?? detectRadius;
    const wasAggroed = Boolean(enemy.isAggroed);
    const shouldDetectPlayer = distance <= enemyDetectRadius;
    if (shouldDetectPlayer) activateEnemyAggro(enemy, player, aggroEffectSystem);
    enemy.isAggroed = Boolean(enemy.isAggroed || enemy.aggroLocked || shouldDetectPlayer);
    if (enemy.isAggroed && !wasAggroed) {
      if (player) enemy.target = player;
      newlyAggroed.push(enemy);
    }

    updateFacingFromVelocity(enemy);
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
      if (visitedSwarmEnemies.has(other) || other.behavior !== ENEMY_BEHAVIOR.SWARM || other.isAggroed) continue;
      const dx = other.targetX - source.targetX;
      const dy = other.targetY - source.targetY;
      if (Math.hypot(dx, dy) > swarmAggroRadius) continue;
      activateEnemyAggro(other, player, aggroEffectSystem);
      system?.spawnEffect?.({ type: 'swarm-link', x: other.x, y: other.y, color: '#ff6a6a', ttl: 0.15 });
      propagateSwarmAggro(other, depth + 1);
    }
  }
  for (const enemy of newlyAggroed) if (enemy.behavior === ENEMY_BEHAVIOR.SWARM) propagateSwarmAggro(enemy, 0);

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
      syncEntityMovementState(enemy);
      interpolateEnemyPosition(enemy);
      continue;
    }

    if (player) enemy.target = player;

    switch (enemy.behavior) {
      case ENEMY_BEHAVIOR.RANGED: {
        if (hasAttackState(enemy)) {
          updateFacingTowardTarget(enemy, player);
          const finishedAttack = enemy.state.time + dt >= (enemy.chargeDuration ?? 0.35);
          updateAttackState(enemy, dt);
          if (finishedAttack) {
            fireOrbitShot(enemy, projectiles, rangedCooldown);
          }
          break;
        }

        const targetRange = enemy.attackRange ?? rangedAttackRange;
        const minDistance = enemy.minShootDistance ?? targetRange * 0.6;
        if (!enemy.orbitPhase) enterOrbitReposition(enemy);
        switch (enemy.orbitPhase) {
          case 'shoot':
            updateFacingTowardTarget(enemy, player);
            stopEnemy(enemy);
            beginAttack(enemy, enemy.chargeDuration ?? 0.35);
            break;
          case 'wait':
            stopEnemy(enemy);
            enemy.orbitWaitTimer = Math.max(0, (enemy.orbitWaitTimer ?? 0) - dt);
            if ((enemy.orbitWaitTimer ?? 0) <= 0) enterOrbitReposition(enemy);
            syncEntityMovementState(enemy);
            break;
          case 'reposition': {
            const orbitDx = targetPlayerX - enemy.targetX;
            const orbitDy = targetPlayerY - enemy.targetY;
            const distance = Math.hypot(orbitDx, orbitDy);
            if (distance < minDistance) {
              move(enemy, -orbitDx, -orbitDy, dt, speedMult);
            } else if (distance > targetRange) {
              move(enemy, orbitDx, orbitDy, dt, speedMult);
            } else {
              enemy.orbitPhase = 'shoot';
              stopEnemy(enemy);
            }
            syncEntityMovementState(enemy);
            break;
          }
          default:
            enemy.orbitPhase = 'reposition';
            break;
        }
        break;
      }
      case ENEMY_BEHAVIOR.TANK:
      case ENEMY_BEHAVIOR.SWARM:
      case ENEMY_BEHAVIOR.FLANKER:
      case ENEMY_BEHAVIOR.CHASER:
      default: {
        if (hasAttackState(enemy)) {
          updateFacingTowardTarget(enemy, player);
          const finishedAttack = enemy.state.time + dt >= ((enemy.attackWindup ?? 0.4) + (enemy.attackDuration ?? 0.3));
          updateAttackState(enemy, dt);
          if (finishedAttack) enemy.attackTimer = enemy.pendingAttackCooldown ?? ((enemy.attackCooldown ?? 0.8) * cooldownMult);
          break;
        }

        if (!inAttackRange) {
          if (enemy.behavior === ENEMY_BEHAVIOR.TANK) {
            move(enemy, dx, dy, dt, speedMult * tankSpeedMultiplier);
          } else if (enemy.behavior === ENEMY_BEHAVIOR.FLANKER) {
            const angleToPlayer = Math.atan2(enemy.targetY - targetPlayerY, enemy.targetX - targetPlayerX);
            enemy.flankAngleOffset = (enemy.flankAngleOffset ?? 0) + dt * (enemy.flankOrbitSpeed ?? 1.2) * (enemy.flankDirection ?? 1);
            const orbitAngle = angleToPlayer + (enemy.flankDirection ?? 1) * (Math.PI / 2) + enemy.flankAngleOffset;
            const targetX = targetPlayerX + Math.cos(orbitAngle) * flankerOffsetDistance;
            const targetY = targetPlayerY + Math.sin(orbitAngle) * flankerOffsetDistance;
            move(enemy, targetX - enemy.targetX, targetY - enemy.targetY, dt, speedMult);
          } else {
            const jitter = (enemy.enemyType === 'spider' || enemy.enemyType === 'fire_ant')
              ? Math.sin((performance.now() * 0.01) + (enemy.targetX * 0.75) + (enemy.targetY * 0.5)) * 0.3
              : 0;
            move(enemy, dx, dy, dt, speedMult, jitter);
          }
          syncEntityMovementState(enemy);
          updateFacingFromVelocity(enemy);
        } else {
          updateFacingTowardTarget(enemy, player);
          stopEnemy(enemy);
          tryStartMeleeAttack(enemy, cooldownMult);
          syncEntityMovementState(enemy);
        }
        break;
      }
    }

    applyEnemySeparation(enemy, aliveEnemies);
    applyPlayerPersonalSpace(enemy, player);
    commitEnemyVelocity(enemy, dt, collisionMap, tileSize);
    const isTargetLocked = enemy.isAggroed && Boolean(enemy.target ?? player);
    const isMoving = Math.hypot(enemy.vx ?? 0, enemy.vy ?? 0) > 0.01;
    if (hasAttackState(enemy) || isTargetLocked) updateFacingTowardTarget(enemy, enemy.target ?? player);
    else if (isMoving) updateFacingFromVelocity(enemy);
    interpolateEnemyPosition(enemy);
    syncEntityMovementState(enemy);
  }

  resolveEnemyCollisions(aliveEnemies, collisionMap);

  if (facingDebugEnabled) {
    const rows = aliveEnemies.slice(0, FACING_LOG_MAX_ENEMIES).map((enemy) => ({
      id: enemy.id?.slice(0, 8),
      type: enemy.enemyType,
      state: enemy.state?.type ?? 'idle',
      velocity: `${(enemy.vx ?? 0).toFixed(2)},${(enemy.vy ?? 0).toFixed(2)}`,
      facing: `${(enemy.facing?.x ?? 0).toFixed(2)},${(enemy.facing?.y ?? 0).toFixed(2)}`,
      direction: enemy.direction,
      sprite: enemy.lastRenderSpriteKey ?? enemy.spriteId,
    }));
    if (rows.length) console.debug('[EnemyFacing]', rows);
  }
}
