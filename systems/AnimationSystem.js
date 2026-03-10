import { sprites } from '../entities/SpriteLibrary.js';

export function updateEntityAnimation(entity, dt, moving) {
  if (!entity.frameDurations) return;

  const nextState = moving ? 'walk' : 'idle';
  if (entity.animationState !== nextState) {
    entity.animationState = nextState;
    entity.frameIndex = 0;
    entity.currentFrame = 0;
    entity.frameTimer = 0;
  }

  const stateFrames = sprites[entity.spriteKey]?.[entity.animationState];
  if (!stateFrames || stateFrames.length <= 1) return;

  // Base timing per frame is authored per state (idle/walk) on the entity.
  const baseFrameDuration = entity.frameDurations[entity.animationState] ?? 0.2;
  const speed = Math.hypot(entity.vx ?? 0, entity.vy ?? 0);
  // Walk cycles scale with move speed so footfalls stay in sync with travel distance.
  // Clamp prevents unreadable flicker at high speed and sluggishness at very low speed.
  const speedRatio = moving ? Math.max(0.35, Math.min(2, speed / (entity.speed || 1))) : 1;
  const frameDuration = baseFrameDuration / speedRatio;

  entity.animationFrames = stateFrames;
  entity.frameTimer += dt;

  while (entity.frameTimer >= frameDuration) {
    entity.frameTimer -= frameDuration;
    entity.frameIndex = (entity.frameIndex + 1) % stateFrames.length;
  }

  entity.currentFrame = entity.frameIndex;
}

export function updateProjectileAnimation(projectiles, dt) {
  for (const projectile of projectiles) {
    if (!projectile.spriteFrames || projectile.spriteFrames.length <= 1) continue;

    projectile.frameTimer += dt;
    while (projectile.frameTimer >= projectile.frameDuration) {
      projectile.frameTimer -= projectile.frameDuration;
      projectile.frameIndex = (projectile.frameIndex + 1) % projectile.spriteFrames.length;
    }
  }
}
