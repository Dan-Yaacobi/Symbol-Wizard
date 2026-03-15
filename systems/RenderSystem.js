import { getSpriteFrame, palette } from '../entities/SpriteLibrary.js';
import { glyphDensity, renderLayers, toRenderCell, toSafeGlyph, visualPalette, visualTheme } from '../data/VisualTheme.js';

function getEntitySprite(entity) {
  return getSpriteFrame(entity.spriteKey, entity.animationState ?? 'idle', entity.currentFrame ?? entity.frameIndex ?? 0);
}

const c = visualTheme.colors;

function drawCell(renderer, { glyph, fg, bg = c.worldBackground, layer = renderLayers.entities }, x, y) {
  renderer.drawCell(toRenderCell({ glyph, fg, bg, layer }), x, y);
}


function densityTierForGlyph(glyph) {
  if (glyphDensity.high.has(glyph)) return 'high';
  if (glyphDensity.medium.has(glyph)) return 'medium';
  return 'low';
}

function colorForEntity(entity) {
  if (entity.type === 'npc') return palette[entity.role] ?? palette.npc;
  if (entity.type === 'house') {
    if (entity.variant?.includes('blue')) return '#8fbbe0';
    if (entity.variant?.includes('brown')) return c.woodFg;
    return '#c97d7d';
  }
  if (entity.interaction === 'destroy') {
    if (entity.kind === 'vase') return '#a893cf';
    if (entity.kind === 'crate') return '#b18456';
    return '#976d45';
  }
  if (entity.category === 'decorative' || entity.category === 'terrain') {
    if (entity.spriteKey?.includes('flower-red')) return '#d1788a';
    if (entity.spriteKey?.includes('flower-yellow')) return '#d8bc6b';
    if (entity.spriteKey?.includes('flower-blue')) return '#78aeda';
    if (entity.spriteKey?.includes('tree-dark')) return '#4f8459';
    if (entity.spriteKey?.includes('tree-bright')) return '#65a96f';
    if (entity.spriteKey?.includes('stone')) return '#8a98ab';
    return '#6aa574';
  }
  if (entity.type === 'fence') return c.woodFg;
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
      const safeGlyph = toSafeGlyph(ch);
      const densityTier = densityTierForGlyph(safeGlyph);
      const expectedTier = entity.type === 'player' || entity.type === 'enemy' ? 'high' : (entity.category ? 'low' : 'medium');
      const finalGlyph = expectedTier === 'high' && densityTier === 'low' ? '#' : safeGlyph;
      drawCell(renderer, { glyph: finalGlyph, fg: color }, screenX, screenY);
    }
  }
}

function resolveProjectileDirection(projectile) {
  const dx = projectile.dx ?? 0;
  const dy = projectile.dy ?? 0;

  const horizontal = Math.abs(dx) > 0.25 ? (dx > 0 ? 'east' : 'west') : '';
  const vertical = Math.abs(dy) > 0.25 ? (dy > 0 ? 'south' : 'north') : '';

  if (horizontal && vertical) return `${vertical}${horizontal}`;
  return horizontal || vertical || 'east';
}

function getProjectileFrame(projectile) {
  const directionalFrames = projectile.directionalSpriteFrames;
  if (directionalFrames && typeof directionalFrames === 'object') {
    const key = resolveProjectileDirection(projectile);
    const frames = directionalFrames[key];
    if (Array.isArray(frames) && frames.length > 0) return frames;
  }

  return projectile.spriteFrames;
}

function drawProjectile(renderer, camera, projectile) {
  const frames = getProjectileFrame(projectile);
  if (!frames || frames.length === 0) return;

  const sprite = frames[projectile.frameIndex % frames.length];
  const spriteWidth = sprite[0]?.length ?? 5;
  const baseX = Math.round(projectile.x) - Math.floor(spriteWidth / 2);
  const baseY = Math.round(projectile.y) - 1;

  const occupied = new Set();
  for (let sy = 0; sy < sprite.length; sy += 1) {
    const row = sprite[sy];
    for (let sx = 0; sx < row.length; sx += 1) {
      if (row[sx] === ' ') continue;
      occupied.add(`${sx},${sy}`);
    }
  }

  const glowColor = projectile.glowColor ?? '#d9f7ff';
  for (let sy = 0; sy < sprite.length; sy += 1) {
    const row = sprite[sy];
    for (let sx = 0; sx < row.length; sx += 1) {
      if (row[sx] === ' ') continue;

      const glowOffsets = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];

      for (const [ox, oy] of glowOffsets) {
        if (occupied.has(`${sx + ox},${sy + oy}`)) continue;
        const glowX = baseX + sx + ox - camera.x;
        const glowY = baseY + sy + oy - camera.y;
        drawCell(renderer, { glyph: '·', fg: glowColor }, glowX, glowY);
      }
    }
  }

  for (const particle of projectile.trailParticles ?? []) {
    const alpha = (particle.ttl ?? 0) / (particle.maxTtl ?? 1);
    if (alpha <= 0) continue;
    const glyph = alpha > 0.66 ? '•' : (alpha > 0.33 ? '·' : '.');
    drawCell(renderer, { glyph, fg: particle.color ?? projectile.trailColor ?? c.projectileArcane }, Math.round(particle.x) - camera.x, Math.round(particle.y) - camera.y);
  }

  for (let sy = 0; sy < sprite.length; sy += 1) {
    const row = sprite[sy];
    for (let sx = 0; sx < row.length; sx += 1) {
      const ch = row[sx];
      if (ch === ' ') continue;
      const screenX = baseX + sx - camera.x;
      const screenY = baseY + sy - camera.y;
      drawCell(renderer, { glyph: toSafeGlyph(ch), fg: projectile.color }, screenX, screenY);
    }
  }
}

function drawAbilityEffect(renderer, camera, effect) {
  if (!effect) return;
  const lifeRatio = effect.maxTtl > 0 ? Math.max(0, effect.ttl / effect.maxTtl) : 1;

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

      drawCell(renderer, { glyph: '*', fg: effect.glowColor ?? '#9ad5ff', layer: renderLayers.effects }, sx, sy);
      drawCell(renderer, { glyph: '≈', fg: effect.color ?? '#f3fbff', layer: renderLayers.effects }, sx, sy);
    }

    return;
  }

  if (effect.type === 'line') {
    const steps = Math.max(2, Math.round(Math.hypot(effect.toX - effect.fromX, effect.toY - effect.fromY) * 2));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = effect.fromX + (effect.toX - effect.fromX) * t;
      const y = effect.fromY + (effect.toY - effect.fromY) * t;
      drawCell(renderer, { glyph: '~', fg: effect.color ?? '#cfe7ff', layer: renderLayers.effects }, Math.round(x) - camera.x, Math.round(y) - camera.y);
    }
    return;
  }


  if (effect.type === 'freeze-wave') {
    const points = Math.max(20, Math.round(effect.radius * 2.5));
    for (let i = 0; i < points; i += 1) {
      const angle = (Math.PI * 2 * i) / points;
      const x = effect.x + Math.cos(angle) * effect.radius;
      const y = effect.y + Math.sin(angle) * effect.radius;
      drawCell(renderer, { glyph: '·', fg: effect.color ?? '#d8f1ff', layer: renderLayers.effects }, Math.round(x) - camera.x, Math.round(y) - camera.y);
    }
    return;
  }

  if (effect.type === 'freeze-burst') {
    const glyphs = ['*', '≈', '+'];
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10;
      const x = effect.x + Math.cos(angle) * (effect.radius ?? 2);
      const y = effect.y + Math.sin(angle) * (effect.radius ?? 2);
      drawCell(renderer, { glyph: glyphs[i % glyphs.length], fg: effect.color ?? '#def5ff', layer: renderLayers.effects }, Math.round(x) - camera.x, Math.round(y) - camera.y);
    }
    return;
  }


  if (effect.type === 'hit-particles') {
    for (const particle of effect.particles ?? []) {
      const lifeRatio = particle.life / Math.max(0.0001, particle.maxLife ?? particle.life ?? 1);
      const glyph = lifeRatio > 0.5 ? '*' : '·';
      drawCell(renderer, { glyph, fg: effect.color ?? '#d9dce3', layer: renderLayers.effects }, Math.round(particle.x) - camera.x, Math.round(particle.y) - camera.y);
    }
    return;
  }

  if (effect.type === 'burst') {
    const points = Math.max(8, Math.round(effect.radius * 8));
    for (let i = 0; i < points; i += 1) {
      const angle = (Math.PI * 2 * i) / points;
      const x = effect.x + Math.cos(angle) * effect.radius;
      const y = effect.y + Math.sin(angle) * effect.radius;
      const glyph = lifeRatio > 0.45 ? '*' : '·';
      drawCell(renderer, { glyph, fg: effect.color ?? '#ffb36e', layer: renderLayers.effects }, Math.round(x) - camera.x, Math.round(y) - camera.y);
    }
    return;
  }

  if (effect.type === 'debris') {
    const pieces = effect.pieces ?? [];
    const glyph = lifeRatio > 0.5 ? '*' : '.';
    for (const piece of pieces) {
      const travel = (1 - lifeRatio) * (piece.speed ?? 2.2);
      const x = effect.x + Math.cos(piece.angle) * travel;
      const y = effect.y + Math.sin(piece.angle) * travel;
      drawCell(renderer, { glyph, fg: effect.color ?? '#d5b79a', layer: renderLayers.effects }, Math.round(x) - camera.x, Math.round(y) - camera.y);
    }
  }
}





function drawWorldObject(renderer, camera, object, overrideTiles = null) {
  const tiles = Array.isArray(overrideTiles) ? overrideTiles : (object.tileVariants ?? object.tiles ?? []);
  for (const tile of tiles) {
    const sx = Math.round(object.x + (tile.x ?? 0)) - camera.x;
    const sy = Math.round(object.y + (tile.y ?? 0)) - camera.y;
    drawCell(renderer, { glyph: toSafeGlyph(tile.char ?? ' '), fg: tile.fg ?? '#d8d2c4', bg: tile.bg ?? c.worldBackground }, sx, sy);
  }
}

function drawDebugCursorOverlay(renderer, camera, mouse) {
  if (!mouse) return;

  const worldScreen = camera.worldToScreen(mouse.worldX, mouse.worldY);
  drawCell(renderer, { glyph: '+', fg: '#ff3f7f' }, worldScreen.x, worldScreen.y);

  renderer.drawCell(toRenderCell({ glyph: '+', fg: '#53f7ff', layer: renderLayers.ui }), mouse.canvasCellX, mouse.canvasCellY);
}
export function renderWorld(renderer, camera, map, player, enemies, npcs, worldObjects, projectiles, goldPiles, combatTextSystem = null, abilityEffects = [], mouse = null) {
  renderer.renderBackground(map, camera);

  for (const object of worldObjects) {
    if (object.destroyed && Array.isArray(object.breakFrames) && object.breakTimer > 0) {
      const duration = Math.max(0.001, object.breakDuration ?? 0.25);
      const progress = 1 - (object.breakTimer / duration);
      const index = Math.min(object.breakFrames.length - 1, Math.max(0, Math.floor(progress * object.breakFrames.length)));
      drawWorldObject(renderer, camera, object, object.breakFrames[index]);
      continue;
    }

    if (object.destroyed) continue;
    drawWorldObject(renderer, camera, object);
  }

  for (const npc of npcs) {
    const npcColor = npc.dialogueEngaged ? '#f5df9a' : colorForEntity(npc);
    drawSprite(renderer, camera, npc, npcColor);

    if (npc.dialogueEngaged) {
      const pulse = npc.dialoguePulse > 0 ? '○' : '·';
      const sx = Math.round(npc.x) - camera.x;
      const sy = Math.round(npc.y) - 5 - camera.y;
      drawCell(renderer, { glyph: '*', fg: '#ffe6a8' }, sx, sy);
      drawCell(renderer, { glyph: pulse, fg: '#f7c66e' }, sx, sy + 1);
    }
  }

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
      drawCell(renderer, { glyph: '*', fg: enemy.freezeGlow ?? '#d8f4ff' }, sx, sy);
    }
  }

  for (const p of projectiles) drawProjectile(renderer, camera, p);
  for (const effect of abilityEffects) drawAbilityEffect(renderer, camera, effect);

  for (const g of goldPiles) {
    const gx = Math.round(g.x) - camera.x;
    const gy = Math.round(g.y) - camera.y;
    if (g.type === 'minor-item') {
      drawCell(renderer, { glyph: '*', fg: visualPalette.gold.lootSpark }, gx, gy);
      continue;
    }
    drawCell(renderer, { glyph: '$', fg: palette.gold }, gx, gy);
  }

  drawSprite(renderer, camera, player, palette.player);
  const px = Math.round(player.x) - camera.x;
  const py = Math.round(player.y) - camera.y;
  drawCell(renderer, { glyph: '!', fg: palette.playerAccent }, px, py - 2);

  drawDebugCursorOverlay(renderer, camera, mouse);
  combatTextSystem?.render(renderer, camera);
}
