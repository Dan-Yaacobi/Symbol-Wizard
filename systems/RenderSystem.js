import { palette, sprites } from '../entities/SpriteLibrary.js';

function getEntitySprite(entity) {
  const spriteEntry = sprites[entity.spriteKey];
  if (Array.isArray(spriteEntry)) return { art: spriteEntry, offsetY: 0 };

  const state = entity.animationState ?? 'idle';
  const stateFrames = spriteEntry?.[state] ?? spriteEntry?.idle;
  if (!stateFrames) return null;
  const frameIndex = (entity.currentFrame ?? entity.frameIndex ?? 0) % stateFrames.length;

  const frame = stateFrames[frameIndex];
  if (Array.isArray(frame)) return { art: frame, offsetY: 0 };
  return frame;
}

function colorForEntity(entity) {
  if (entity.type === 'npc') return palette[entity.role] ?? palette.npc;
  if (entity.type === 'house') {
    if (entity.variant?.includes('blue')) return '#7abce3';
    if (entity.variant?.includes('brown')) return '#be8e62';
    return '#d06f6f';
  }
  if (entity.type === 'destructible') {
    if (entity.kind === 'vase') return '#baa6e0';
    if (entity.kind === 'crate') return '#bc8a56';
    return '#9f7344';
  }
  if (entity.type === 'nature') {
    if (entity.spriteKey?.includes('flower-red')) return '#d66f82';
    if (entity.spriteKey?.includes('flower-yellow')) return '#d7b45a';
    if (entity.spriteKey?.includes('flower-blue')) return '#6a9fd4';
    if (entity.spriteKey?.includes('tree-dark')) return '#4a8458';
    if (entity.spriteKey?.includes('tree-bright')) return '#5da568';
    if (entity.spriteKey?.includes('stone')) return '#8d97a8';
    return '#5f9f68';
  }
  if (entity.type === 'fence') return '#b4916f';
  return palette.npc;
}

function drawSprite(renderer, camera, entity, color, forceSprite = null) {
  const sprite = forceSprite ?? getEntitySprite(entity);
  if (!sprite) return;

  const width = sprite.art[0]?.length ?? 7;
  const baseX = Math.round(entity.x) - Math.floor(width / 2);
  const baseY = Math.round(entity.y) - 3 + (sprite.offsetY ?? 0);

  for (let sy = 0; sy < sprite.art.length; sy += 1) {
    const row = sprite.art[sy];
    for (let sx = 0; sx < row.length; sx += 1) {
      const ch = row[sx];
      if (ch === ' ') continue;
      const screenX = baseX + sx - camera.x;
      const screenY = baseY + sy - camera.y;
      renderer.drawEntityGlyph(ch, color, '#0b1016', screenX, screenY);
    }
  }
}

function drawProjectile(renderer, camera, projectile) {
  const frames = projectile.spriteFrames;
  if (!frames || frames.length === 0) return;

  const sprite = frames[projectile.frameIndex % frames.length];
  const baseX = Math.round(projectile.x) - 2;
  const baseY = Math.round(projectile.y) - 1;

  for (let sy = 0; sy < sprite.length; sy += 1) {
    const row = sprite[sy];
    for (let sx = 0; sx < row.length; sx += 1) {
      const ch = row[sx];
      if (ch === ' ') continue;
      const screenX = baseX + sx - camera.x;
      const screenY = baseY + sy - camera.y;
      renderer.drawEntityGlyph(ch, projectile.color, '#0b1016', screenX, screenY);
    }
  }
}

function drawAbilityEffect(renderer, camera, effect) {
  if (!effect) return;

  if (effect.type === 'lightning') {
    const dx = effect.toX - effect.fromX;
    const dy = effect.toY - effect.fromY;
    const distance = Math.hypot(dx, dy) || 1;
    const steps = Math.max(4, Math.round(distance * 3));
    const nx = -dy / distance;
    const ny = dx / distance;
    const jitterAmplitude = Math.min(1.2, 0.45 + distance * 0.04) * (effect.intensity ?? 1);

    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const pulse = 1 - Math.abs(0.5 - t) * 2;
      const jitter = (Math.random() - 0.5) * jitterAmplitude * pulse;
      const x = effect.fromX + dx * t + nx * jitter;
      const y = effect.fromY + dy * t + ny * jitter;
      const sx = Math.round(x) - camera.x;
      const sy = Math.round(y) - camera.y;

      renderer.drawEntityGlyph('*', effect.glowColor ?? '#9ad5ff', '#0b1016', sx, sy);
      renderer.drawEntityGlyph('⚡', effect.color ?? '#f3fbff', '#0b1016', sx, sy);
    }

    return;
  }

  if (effect.type === 'line') {
    const steps = Math.max(2, Math.round(Math.hypot(effect.toX - effect.fromX, effect.toY - effect.fromY) * 2));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = effect.fromX + (effect.toX - effect.fromX) * t;
      const y = effect.fromY + (effect.toY - effect.fromY) * t;
      renderer.drawEntityGlyph('~', effect.color ?? '#cfe7ff', '#0b1016', Math.round(x) - camera.x, Math.round(y) - camera.y);
    }
    return;
  }


  if (effect.type === 'freeze-wave') {
    const points = Math.max(20, Math.round(effect.radius * 2.5));
    for (let i = 0; i < points; i += 1) {
      const angle = (Math.PI * 2 * i) / points;
      const x = effect.x + Math.cos(angle) * effect.radius;
      const y = effect.y + Math.sin(angle) * effect.radius;
      renderer.drawEntityGlyph('·', effect.color ?? '#d8f1ff', '#0b1016', Math.round(x) - camera.x, Math.round(y) - camera.y);
    }
    return;
  }

  if (effect.type === 'freeze-burst') {
    const glyphs = ['*', '❄', '+'];
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10;
      const x = effect.x + Math.cos(angle) * (effect.radius ?? 2);
      const y = effect.y + Math.sin(angle) * (effect.radius ?? 2);
      renderer.drawEntityGlyph(glyphs[i % glyphs.length], effect.color ?? '#def5ff', '#0b1016', Math.round(x) - camera.x, Math.round(y) - camera.y);
    }
    return;
  }


  if (effect.type === 'hit-particles') {
    for (const particle of effect.particles ?? []) {
      const lifeRatio = particle.life / Math.max(0.0001, particle.maxLife ?? particle.life ?? 1);
      const glyph = lifeRatio > 0.5 ? '*' : '·';
      renderer.drawEntityGlyph(glyph, effect.color ?? '#d9dce3', '#0b1016', Math.round(particle.x) - camera.x, Math.round(particle.y) - camera.y);
    }
    return;
  }

  if (effect.type === 'burst') {
    const points = Math.max(8, Math.round(effect.radius * 8));
    for (let i = 0; i < points; i += 1) {
      const angle = (Math.PI * 2 * i) / points;
      const x = effect.x + Math.cos(angle) * effect.radius;
      const y = effect.y + Math.sin(angle) * effect.radius;
      renderer.drawEntityGlyph('*', effect.color ?? '#ffb36e', '#0b1016', Math.round(x) - camera.x, Math.round(y) - camera.y);
    }
  }
}



function drawDebugCursorOverlay(renderer, camera, mouse) {
  if (!mouse) return;

  const worldScreen = camera.worldToScreen(mouse.worldX, mouse.worldY);
  renderer.drawEntityGlyph('+', '#ff3f7f', '#0b1016', worldScreen.x, worldScreen.y);

  renderer.drawUiGlyph('+', '#53f7ff', '#0b1016', mouse.canvasCellX, mouse.canvasCellY);
}
export function renderWorld(renderer, camera, map, player, enemies, npcs, worldObjects, projectiles, goldPiles, combatTextSystem = null, abilityEffects = [], mouse = null) {
  renderer.renderBackground(map, camera);

  for (const object of worldObjects) {
    if (object.type === 'destructible' && object.destroyed && object.breakTimer > 0) {
      const progress = 1 - object.breakTimer / object.breakDuration;
      const index = Math.min(object.breakFrames.length - 1, Math.floor(progress * object.breakFrames.length));
      const breakArt = sprites[object.breakFrames[index]];
      if (breakArt) drawSprite(renderer, camera, object, colorForEntity(object), { art: breakArt, offsetY: 0 });
      continue;
    }

    if (object.destroyed) continue;
    drawSprite(renderer, camera, object, colorForEntity(object));
  }

  for (const npc of npcs) drawSprite(renderer, camera, npc, colorForEntity(npc));

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const baseColor = enemy.kind === 'slime' ? palette.slime : palette.skeleton;
    let renderColor = enemy.frozen ? (enemy.freezeTint ?? '#9edbff') : baseColor;

    if (enemy.hitFlashTimer > 0) {
      renderColor = '#f4f7ff';
    }

    drawSprite(renderer, camera, enemy, renderColor);

    if (enemy.frozen) {
      const sx = Math.round(enemy.x) - camera.x;
      const sy = Math.round(enemy.y) - 3 - camera.y;
      renderer.drawEntityGlyph('❄', enemy.freezeGlow ?? '#d8f4ff', '#0b1016', sx, sy);
    }
  }

  for (const p of projectiles) drawProjectile(renderer, camera, p);
  for (const effect of abilityEffects) drawAbilityEffect(renderer, camera, effect);

  for (const g of goldPiles) {
    const gx = Math.round(g.x) - camera.x;
    const gy = Math.round(g.y) - camera.y;
    renderer.drawEntityGlyph('$', palette.gold, '#0b1016', gx, gy);
  }

  drawSprite(renderer, camera, player, palette.player);
  const px = Math.round(player.x) - camera.x;
  const py = Math.round(player.y) - camera.y;
  renderer.drawEntityGlyph('!', palette.playerAccent, '#0b1016', px, py - 2);

  drawDebugCursorOverlay(renderer, camera, mouse);
  combatTextSystem?.render(renderer, camera);
}
