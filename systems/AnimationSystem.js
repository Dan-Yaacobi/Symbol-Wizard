import { getSpriteAnimationFrames } from '../entities/SpriteLibrary.js';

export function updateEntityAnimation(entity, dt, moving, config = null) {
  if (!entity.frameDurations) return;

  const isCasting = (entity.castTimer ?? 0) > 0;
  const nextState = isCasting ? 'cast' : (entity.isAttacking ? 'attack' : (moving ? 'walk' : 'idle'));
  if (entity.animationState !== nextState) {
    entity.animationState = nextState;
    entity.frameIndex = 0;
    entity.currentFrame = 0;
    entity.frameTimer = 0;
  }

  const stateFrames = getSpriteAnimationFrames(entity.spriteKey, entity.animationState);
  if (!stateFrames || stateFrames.length <= 1) return;

  // Base timing per frame is authored per state (idle/walk) on the entity.
  const override = config?.get?.(`sprites.${entity.type === 'player' ? 'player' : 'enemy'}${entity.animationState[0].toUpperCase() + entity.animationState.slice(1)}FrameDuration`);
  const baseFrameDuration = Number.isFinite(override) ? override : (entity.frameDurations[entity.animationState] ?? 0.2);
  const speed = Math.hypot(entity.vx ?? 0, entity.vy ?? 0);
  // Walk cycles scale with move speed so footfalls stay in sync with travel distance.
  // Clamp prevents unreadable flicker at high speed and sluggishness at very low speed.
  const speedRatio = moving ? Math.max(0.35, Math.min(2, speed / (entity.speed || 1))) : 1;
  const globalPlayback = config?.get?.('sprites.animationPlaybackSpeed') ?? 1;
  const entityMult = entity.type === 'player' ? (config?.get?.('player.animationSpeedMultiplier') ?? 1) : (config?.get?.('enemies.animationSpeedMultiplier') ?? 1);
  const frameDuration = (baseFrameDuration / speedRatio) / Math.max(0.01, globalPlayback * entityMult);

  entity.animationFrames = stateFrames;
  entity.frameTimer += dt;

  while (entity.frameTimer >= frameDuration) {
    entity.frameTimer -= frameDuration;
    entity.frameIndex = (entity.frameIndex + 1) % stateFrames.length;
  }

  const pauseFrame = config?.get?.('sprites.pauseOnFrame') ?? -1;
  if (pauseFrame >= 0) entity.frameIndex = Math.min(stateFrames.length - 1, Math.max(0, Math.floor(pauseFrame)));

  entity.currentFrame = entity.frameIndex;
}

export function updateProjectileAnimation(projectiles, dt, config = null) {
  for (const projectile of projectiles) {
    if (!projectile.spriteFrames || projectile.spriteFrames.length <= 1) continue;

    projectile.frameTimer += dt;
    const frameDuration = config?.get?.('sprites.projectileFrameDuration') ?? projectile.frameDuration;
    while (projectile.frameTimer >= frameDuration) {
      projectile.frameTimer -= frameDuration;
      projectile.frameIndex = (projectile.frameIndex + 1) % projectile.spriteFrames.length;
    }
  }
}
