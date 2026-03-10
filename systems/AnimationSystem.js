import { sprites } from '../entities/SpriteLibrary.js';

export function updateEntityAnimation(entity, dt, moving) {
  if (!entity.frameDurations) return;

  const nextState = moving ? 'walk' : 'idle';
  if (entity.animationState !== nextState) {
    entity.animationState = nextState;
    entity.frameIndex = 0;
    entity.frameTimer = 0;
  }

  const stateFrames = sprites[entity.spriteKey]?.[entity.animationState];
  if (!stateFrames || stateFrames.length <= 1) return;

  const frameDuration = entity.frameDurations[entity.animationState] ?? 0.2;
  entity.frameTimer += dt;

  while (entity.frameTimer >= frameDuration) {
    entity.frameTimer -= frameDuration;
    entity.frameIndex = (entity.frameIndex + 1) % stateFrames.length;
  }
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
