import { getAnimationFrameCount, getSpriteAnimation } from '../data/SpriteAssetLoader.js';
import { getEntityAnimationState } from './EntityStateSystem.js';

function resolveEntityAnimationState(entity) {
  if (entity?.type === 'player' && entity.activeAction) {
    if (entity.activeAction.type === 'cast') return 'attack';
    return entity.activeAction.type;
  }

  return getEntityAnimationState(entity);
}

export function updateEntityAnimation(entity, dt, _moving = false, config = null) {
  void _moving;
  const animationTimings = entity.animationTimings ?? entity.frameDurations;
  if (!animationTimings || !entity.spriteId) return;

  const nextState = resolveEntityAnimationState(entity);
  if (entity.animationState !== nextState) {
    entity.animationState = nextState;
    entity.frameIndex = 0;
    entity.currentFrame = 0;
    entity.frameTimer = 0;
  }

  const frames = getSpriteAnimation(entity.spriteId, entity.animationState);
  if (!frames?.length) throw new Error(`Missing sprite animation "${entity.animationState}" for sprite "${entity.spriteId}".`);

  const frameCount = getAnimationFrameCount(entity.spriteId, entity.animationState);
  const override = config?.get?.(`sprites.${entity.type === 'player' ? 'player' : 'enemy'}${entity.animationState[0].toUpperCase() + entity.animationState.slice(1)}FrameDuration`);
  const baseFrameDuration = Number.isFinite(override) ? override : (animationTimings[entity.animationState] ?? animationTimings.idle ?? 0.2);
  const speed = Math.hypot(entity.vx ?? 0, entity.vy ?? 0);
  const speedRatio = entity.animationState === 'walk' ? Math.max(0.35, Math.min(2, speed / (entity.speed || 1))) : 1;
  const globalPlayback = config?.get?.('sprites.animationPlaybackSpeed') ?? 1;
  const entityMult = entity.type === 'player' ? (config?.get?.('player.animationSpeedMultiplier') ?? 1) : (config?.get?.('enemies.animationSpeedMultiplier') ?? 1);
  const frameDuration = (baseFrameDuration / speedRatio) / Math.max(0.01, globalPlayback * entityMult);

  entity.animationFrames = frames;
  entity.frameTimer += dt;
  while (entity.frameTimer >= frameDuration && frameCount > 1) {
    entity.frameTimer -= frameDuration;
    entity.frameIndex = (entity.frameIndex + 1) % frameCount;
  }

  const pauseFrame = config?.get?.('sprites.pauseOnFrame') ?? -1;
  if (pauseFrame >= 0) entity.frameIndex = Math.min(frameCount - 1, Math.max(0, Math.floor(pauseFrame)));
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
