import { getSpriteFrame } from '../data/SpriteAssetLoader.js';
import { isEntityAttacking } from './EntityStateSystem.js';
import { palette } from '../data/SpritePalette.js';
import { getItemDefinition } from '../data/ItemRegistry.js';
import { glyphDensity, renderLayers, toRenderCell, toSafeGlyph, visualPalette, visualTheme } from '../data/VisualTheme.js';
import { directionToArrow, ensureEntityFacing, toCardinalDirection } from './FacingSystem.js';

function resolveDirectionalSprite(entity) {
  const directionalSprites = entity?.sprite;
  if (!directionalSprites || typeof directionalSprites !== 'object') return null;
  const direction = entity?.direction;
  if (direction && directionalSprites[direction]) return directionalSprites[direction];

  const cardinalFallbacks = {
    N: directionalSprites.up,
    S: directionalSprites.down,
    E: directionalSprites.right,
    W: directionalSprites.left,
  };
  if (direction && cardinalFallbacks[direction]) return cardinalFallbacks[direction];
  return directionalSprites.down ?? directionalSprites.right ?? directionalSprites.idle ?? null;
}

function getEntitySprite(entity) {
  const directionalSpriteId = resolveDirectionalSprite(entity);
  if (directionalSpriteId) {
    entity.lastRenderSpriteKey = directionalSpriteId;
    return getSpriteFrame(directionalSpriteId, entity.animationState ?? 'idle', entity.currentFrame ?? entity.frameIndex ?? 0);
  }
  entity.lastRenderSpriteKey = entity.spriteId;
  return getSpriteFrame(entity.spriteId, entity.animationState ?? 'idle', entity.currentFrame ?? entity.frameIndex ?? 0);
}

const c = visualTheme.colors;

const STATUS_STYLE = {
  burn: { icon: '🔥', tint: '#ff7a6a', effectColor: '#ff9a6a' },
  poison: { icon: '☠', tint: '#7edb7e', effectColor: '#87e48e' },
  slow: { icon: '~', tint: '#78b9ff', effectColor: '#8bc8ff' },
  shock: { icon: '⚡', tint: '#ffe76a', effectColor: '#fff09a' },
};

export function worldToScreenCell(worldCoordinate, cameraCoordinate) {
  return worldCoordinate - cameraCoordinate;
}

function blendHexColors(base, tint, amount = 0.28) {
  const parse = (hex) => {
    const normalized = typeof hex === 'string' ? hex.trim() : '';
    if (!/^#([0-9a-fA-F]{6})$/.test(normalized)) return null;
    return {
      r: Number.parseInt(normalized.slice(1, 3), 16),
      g: Number.parseInt(normalized.slice(3, 5), 16),
      b: Number.parseInt(normalized.slice(5, 7), 16),
    };
  };

  const a = parse(base);
  const b = parse(tint);
  if (!a || !b) return base;

  const ratio = Math.max(0, Math.min(1, amount));
  const toHex = (value) => Math.round(value).toString(16).padStart(2, '0');

  return `#${toHex(a.r + (b.r - a.r) * ratio)}${toHex(a.g + (b.g - a.g) * ratio)}${toHex(a.b + (b.b - a.b) * ratio)}`;
}

function getPrimaryStatus(entity) {
  if (!Array.isArray(entity?.activeStatuses) || entity.activeStatuses.length === 0) return null;
  return entity.activeStatuses[0];
}

function getEntityTintColor(entity, baseColor) {
  const statusType = getPrimaryStatus(entity);
  const statusStyle = statusType ? STATUS_STYLE[statusType] : null;
  if (!statusStyle?.tint) return baseColor;

  const statusMap = entity?.statusEffects;
  const status = statusMap instanceof Map ? statusMap.get(statusType) : null;
  const pulseFlash = Math.max(0, Math.min(0.3, status?.pulseFlash ?? 0));
  return blendHexColors(baseColor, statusStyle.tint, 0.2 + pulseFlash);
}

function drawStatusIcon(renderer, camera, entity) {
  const statusType = getPrimaryStatus(entity);
  if (!statusType) return;

  const style = STATUS_STYLE[statusType] ?? { icon: '*', tint: '#ffffff' };
  const sx = worldToScreenCell(entity.x, camera.x);
  const sy = worldToScreenCell(entity.y - 5, camera.y);
  drawCell(renderer, { glyph: style.icon, fg: style.tint, layer: renderLayers.effects }, sx, sy);
}

function drawCell(renderer, { glyph, fg, bg = c.worldBackground, layer = renderLayers.entities }, x, y) {
  renderer.drawCell(toRenderCell({ glyph, fg, bg, layer }), x, y);
}


function densityTierForGlyph(glyph) {
  if (glyphDensity.high.has(glyph)) return 'high';
  if (glyphDensity.medium.has(glyph)) return 'medium';
  return 'low';
}

export function spriteUsesAuthoredGlyphs(sprite) {
  if (!sprite?.cells?.length) return false;
  return sprite.cells.some((row) => row.some((cell) => cell?.fg != null || cell?.bg != null));
}

export function resolveSpriteRenderGlyph(entity, sprite, ch) {
  const safeGlyph = toSafeGlyph(ch);
  const preserveAuthoredGlyphs = spriteUsesAuthoredGlyphs(sprite);
  if (preserveAuthoredGlyphs) return safeGlyph;

  const densityTier = densityTierForGlyph(safeGlyph);
  const expectedTier = entity.type === 'player' || entity.type === 'enemy' ? 'high' : (entity.category ? 'low' : 'medium');
  return expectedTier === 'high' && densityTier === 'low' && ch !== ' ' ? '#' : safeGlyph;
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
    if (entity.spriteId?.includes('flower-red')) return '#d1788a';
    if (entity.spriteId?.includes('flower-yellow')) return '#d8bc6b';
    if (entity.spriteId?.includes('flower-blue')) return '#78aeda';
    if (entity.spriteId?.includes('tree-dark')) return '#4f8459';
    if (entity.spriteId?.includes('tree-bright')) return '#65a96f';
    if (entity.spriteId?.includes('stone')) return '#8a98ab';
    return '#6aa574';
  }
  if (entity.type === 'fence') return c.woodFg;
  return palette.npc;
}

function drawSprite(renderer, camera, entity, color, forceSprite = null) {
  ensureEntityFacing(entity);
  const sprite = forceSprite ?? getEntitySprite(entity);
  if (!sprite?.cells?.length) return;

  const baseX = entity.x - Math.floor(sprite.width / 2);
  const baseY = entity.y - 3 + (sprite.offsetY ?? 0);

  for (let sy = 0; sy < sprite.height; sy += 1) {
    for (let sx = 0; sx < sprite.width; sx += 1) {
      const cell = sprite.cells[sy]?.[sx];
      const ch = cell?.ch ?? ' ';
      if ((ch === ' ' || ch === '\0') && !cell?.bg) continue;
      const screenX = worldToScreenCell(baseX + sx, camera.x);
      const screenY = worldToScreenCell(baseY + sy, camera.y);
      const finalGlyph = resolveSpriteRenderGlyph(entity, sprite, ch);
      drawCell(renderer, { glyph: finalGlyph, fg: cell?.fg ?? color, bg: cell?.bg ?? c.worldBackground }, screenX, screenY);
    }
  }
}

function drawEnemyFacingGlyph(renderer, camera, enemy) {
  if (!enemy?.alive || enemy.type !== 'enemy') return;
  const direction = toCardinalDirection(enemy.direction, 'S');
  const glyph = enemy.facingGlyphs?.[direction];
  if (!glyph) return;
  drawCell(renderer, { glyph, fg: '#ffe7ad', layer: renderLayers.effects }, worldToScreenCell(enemy.x, camera.x), worldToScreenCell(enemy.y - 2, camera.y));
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
  const baseX = projectile.x - Math.floor(spriteWidth / 2);
  const baseY = projectile.y - 1;

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
        const glowX = worldToScreenCell(baseX + sx + ox, camera.x);
        const glowY = worldToScreenCell(baseY + sy + oy, camera.y);
        drawCell(renderer, { glyph: '·', fg: glowColor }, glowX, glowY);
      }
    }
  }

  for (const particle of projectile.trailParticles ?? []) {
    const alpha = (particle.ttl ?? 0) / (particle.maxTtl ?? 1);
    if (alpha <= 0) continue;
    const glyph = alpha > 0.66 ? '•' : (alpha > 0.33 ? '·' : '.');
    drawCell(
      renderer,
      { glyph, fg: particle.color ?? projectile.trailColor ?? c.projectileArcane },
      worldToScreenCell(particle.x, camera.x),
      worldToScreenCell(particle.y, camera.y),
    );
  }

  for (let sy = 0; sy < sprite.length; sy += 1) {
    const row = sprite[sy];
    for (let sx = 0; sx < row.length; sx += 1) {
      const ch = row[sx];
      if (ch === ' ') continue;
      const screenX = worldToScreenCell(baseX + sx, camera.x);
      const screenY = worldToScreenCell(baseY + sy, camera.y);
      drawCell(renderer, { glyph: toSafeGlyph(ch), fg: projectile.color }, screenX, screenY);
    }
  }
}

function drawAbilityEffect(renderer, camera, effect) {
  if (!effect) return;
  const lifeRatio = effect.maxTtl > 0 ? Math.max(0, effect.ttl / effect.maxTtl) : 1;

  if (effect.type === 'lightning') {
    const points = Array.isArray(effect.points) && effect.points.length >= 2
      ? effect.points
      : null;

    if (points) {
      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        const sx = worldToScreenCell(point.x, camera.x);
        const sy = worldToScreenCell(point.y, camera.y);
        const glyph = index % 2 === 0 ? '⚡' : '≈';
        drawCell(renderer, { glyph: '*', fg: effect.glowColor ?? '#9ad5ff', layer: renderLayers.effects }, sx, sy);
        drawCell(renderer, { glyph, fg: effect.color ?? '#f3fbff', layer: renderLayers.effects }, sx, sy);
      }
    } else {
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
        const sx = worldToScreenCell(x, camera.x);
        const sy = worldToScreenCell(y, camera.y);

        drawCell(renderer, { glyph: '*', fg: effect.glowColor ?? '#9ad5ff', layer: renderLayers.effects }, sx, sy);
        drawCell(renderer, { glyph: '≈', fg: effect.color ?? '#f3fbff', layer: renderLayers.effects }, sx, sy);
      }
    }

    return;
  }

  if (effect.type === 'beam') {
    const branches = Array.isArray(effect.branches) && effect.branches.length > 0
      ? effect.branches
      : [{ fromX: effect.fromX, fromY: effect.fromY, toX: effect.toX, toY: effect.toY, width: effect.width ?? 1.5, branchIndex: 0 }];
    const normalizedLife = effect.maxTtl > 0 ? Math.max(0, effect.ttl / effect.maxTtl) : 1;

    for (const branch of branches) {
      const dx = branch.toX - branch.fromX;
      const dy = branch.toY - branch.fromY;
      const distance = Math.hypot(dx, dy) || 1;
      const steps = Math.max(4, Math.round(distance * 3));
      const nx = -dy / distance;
      const ny = dx / distance;
      const width = Math.max(1, Math.round(branch.width ?? effect.width ?? 1.5));
      const glyphs = branch.branchIndex % 2 === 0 ? ['≈', '~'] : ['*', '·'];

      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const pulse = 0.45 + Math.sin((t + normalizedLife) * Math.PI) * 0.2;
        const x = branch.fromX + dx * t;
        const y = branch.fromY + dy * t;
        const coreX = worldToScreenCell(x, camera.x);
        const coreY = worldToScreenCell(y, camera.y);

        for (let lane = -Math.floor(width / 2); lane <= Math.floor(width / 2); lane += 1) {
          const offsetScale = lane * 0.45;
          const sx = worldToScreenCell(x + nx * offsetScale, camera.x);
          const sy = worldToScreenCell(y + ny * offsetScale, camera.y);
          const glyph = lane === 0 ? glyphs[0] : glyphs[1];
          const color = lane === 0 ? (effect.glowColor ?? '#f4fbff') : (effect.color ?? '#cfe7ff');
          drawCell(renderer, { glyph, fg: color, layer: renderLayers.effects }, sx, sy);
        }

        if (pulse > 0.5) {
          drawCell(renderer, { glyph: '·', fg: effect.color ?? '#cfe7ff', layer: renderLayers.effects }, coreX, coreY);
        }
      }
    }
    return;
  }

  if (effect.type === 'line') {
    const steps = Math.max(2, Math.round(Math.hypot(effect.toX - effect.fromX, effect.toY - effect.fromY) * 2));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = effect.fromX + (effect.toX - effect.fromX) * t;
      const y = effect.fromY + (effect.toY - effect.fromY) * t;
      drawCell(renderer, { glyph: '~', fg: effect.color ?? '#cfe7ff', layer: renderLayers.effects }, worldToScreenCell(x, camera.x), worldToScreenCell(y, camera.y));
    }
    return;
  }


  if (effect.type === 'freeze-wave') {
    const points = Math.max(20, Math.round(effect.radius * 2.5));
    for (let i = 0; i < points; i += 1) {
      const angle = (Math.PI * 2 * i) / points;
      const x = effect.x + Math.cos(angle) * effect.radius;
      const y = effect.y + Math.sin(angle) * effect.radius;
      drawCell(renderer, { glyph: '·', fg: effect.color ?? '#d8f1ff', layer: renderLayers.effects }, worldToScreenCell(x, camera.x), worldToScreenCell(y, camera.y));
    }
    return;
  }

  if (effect.type === 'freeze-burst') {
    const glyphs = ['*', '≈', '+'];
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10;
      const x = effect.x + Math.cos(angle) * (effect.radius ?? 2);
      const y = effect.y + Math.sin(angle) * (effect.radius ?? 2);
      drawCell(renderer, { glyph: glyphs[i % glyphs.length], fg: effect.color ?? '#def5ff', layer: renderLayers.effects }, worldToScreenCell(x, camera.x), worldToScreenCell(y, camera.y));
    }
    return;
  }


  if (effect.type === 'status-apply') {
    const style = STATUS_STYLE[effect.statusType] ?? { icon: '*', effectColor: '#ffffff' };
    const ringRadius = 1 + (1 - lifeRatio) * 2;
    const points = Math.max(8, Math.round(ringRadius * 7));
    for (let i = 0; i < points; i += 1) {
      const angle = (Math.PI * 2 * i) / points;
      const x = effect.x + Math.cos(angle) * ringRadius;
      const y = effect.y + Math.sin(angle) * ringRadius;
      drawCell(renderer, { glyph: '·', fg: style.effectColor ?? style.tint, layer: renderLayers.effects }, worldToScreenCell(x, camera.x), worldToScreenCell(y, camera.y));
    }
    drawCell(renderer, { glyph: style.icon, fg: style.tint ?? '#ffffff', layer: renderLayers.effects }, worldToScreenCell(effect.x, camera.x), worldToScreenCell(effect.y - 1, camera.y));
    return;
  }

  if (effect.type === 'status-tick') {
    const style = STATUS_STYLE[effect.statusType] ?? { icon: '*', effectColor: '#ffffff' };
    const glyph = lifeRatio > 0.5 ? '·' : '.';
    drawCell(renderer, { glyph, fg: style.effectColor ?? style.tint, layer: renderLayers.effects }, worldToScreenCell(effect.x, camera.x), worldToScreenCell(effect.y, camera.y));
    return;
  }

  if (effect.type === 'swarm-link') {
    const glyph = lifeRatio > 0.5 ? '⟡' : '·';
    const ringRadius = 0.5 + (1 - lifeRatio) * 1.5;
    const points = 6;
    for (let i = 0; i < points; i += 1) {
      const angle = (Math.PI * 2 * i) / points;
      const x = effect.x + Math.cos(angle) * ringRadius;
      const y = effect.y + Math.sin(angle) * ringRadius;
      drawCell(renderer, { glyph: '·', fg: effect.color ?? '#ff6a6a', layer: renderLayers.effects }, worldToScreenCell(x, camera.x), worldToScreenCell(y, camera.y));
    }
    drawCell(renderer, { glyph, fg: effect.color ?? '#ff8d8d', layer: renderLayers.effects }, worldToScreenCell(effect.x, camera.x), worldToScreenCell(effect.y, camera.y));
    return;
  }

  if (effect.type === 'hit-particles') {
    for (const particle of effect.particles ?? []) {
      const lifeRatio = particle.life / Math.max(0.0001, particle.maxLife ?? particle.life ?? 1);
      const glyph = lifeRatio > 0.5 ? '*' : '·';
      drawCell(renderer, { glyph, fg: effect.color ?? '#d9dce3', layer: renderLayers.effects }, worldToScreenCell(particle.x, camera.x), worldToScreenCell(particle.y, camera.y));
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
      drawCell(renderer, { glyph, fg: effect.color ?? '#ffb36e', layer: renderLayers.effects }, worldToScreenCell(x, camera.x), worldToScreenCell(y, camera.y));
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
      drawCell(renderer, { glyph, fg: effect.color ?? '#d5b79a', layer: renderLayers.effects }, worldToScreenCell(x, camera.x), worldToScreenCell(y, camera.y));
    }
  }
}





function drawWorldObject(renderer, camera, object, spriteId = object.spriteId) {
  if (spriteId) {
    const sprite = getSpriteFrame(spriteId, object.animationState ?? 'idle', object.currentFrame ?? object.frameIndex ?? 0);
    if (sprite) {
      drawSprite(renderer, camera, object, colorForEntity(object), sprite);
      return;
    }
  }

  const tiles = object.tileVariants ?? object.tiles ?? [];
  for (const tile of tiles) {
    const sx = worldToScreenCell(object.x + (tile.x ?? 0), camera.x);
    const sy = worldToScreenCell(object.y + (tile.y ?? 0), camera.y);
    drawCell(renderer, { glyph: toSafeGlyph(tile.char ?? ' '), fg: tile.fg ?? '#d8d2c4', bg: tile.bg ?? c.worldBackground }, sx, sy);
  }
}

function drawAntDenEffects(renderer, camera, worldObjects = [], nowSeconds = performance.now() / 1000) {
  for (const object of worldObjects) {
    if (!object || object.destroyed || object.type !== 'ant_den') continue;
    const heatPulse = Number.isFinite(object.state?.heatPulse) ? object.state.heatPulse : nowSeconds;
    const spawnPulse = Math.max(0, Number(object.state?.lastSpawnPulse) || 0);
    const phase = object.state?.phase ?? 'idle';
    const activeBoost = phase === 'active' ? 0.22 : 0.08;
    const pulse = (Math.sin((heatPulse * 2.8) + (object.x * 0.37) + (object.y * 0.21)) + 1) * 0.5;
    const emberColor = pulse > 0.54 ? '#ff9b52' : '#ff6f3a';
    const coreColor = pulse > 0.55 ? '#ffb274' : '#de6f3f';
    const ringGlyph = pulse > 0.5 ? '·' : '.';
    const ringRadius = 3.2 + pulse * 0.35 + spawnPulse + activeBoost;

    const points = 9;
    for (let i = 0; i < points; i += 1) {
      const angle = (Math.PI * 2 * i) / points + heatPulse * 0.45;
      const x = object.x + Math.cos(angle) * ringRadius;
      const y = object.y + Math.sin(angle) * ringRadius;
      drawCell(renderer, { glyph: ringGlyph, fg: emberColor, layer: renderLayers.effects }, worldToScreenCell(x, camera.x), worldToScreenCell(y, camera.y));
    }

    drawCell(
      renderer,
      { glyph: pulse > 0.45 ? '•' : '·', fg: coreColor, layer: renderLayers.effects },
      worldToScreenCell(object.x, camera.x),
      worldToScreenCell(object.y - 1, camera.y),
    );
  }
}



function drawWorldObjectToContext(renderer, ctx, object, overrideSpriteId = null) {
  if (!object || object.destroyed) return;

  const sprite = overrideSpriteId ? getSpriteFrame(overrideSpriteId, 'idle', 0) : getEntitySprite(object);
  if (sprite?.cells?.length) {
    const color = colorForEntity(object);
    const baseX = object.x - Math.floor(sprite.width / 2);
    const baseY = object.y - 3 + (sprite.offsetY ?? 0);

    for (let sy = 0; sy < sprite.height; sy += 1) {
      for (let sx = 0; sx < sprite.width; sx += 1) {
        const cell = sprite.cells[sy]?.[sx];
        const ch = cell?.ch ?? ' ';
        if ((ch === ' ' || ch === ' ') && !cell?.bg) continue;
        const finalGlyph = resolveSpriteRenderGlyph(object, sprite, ch);
        renderer.drawCellToContext(ctx, {
          glyph: finalGlyph,
          fg: cell?.fg ?? color,
          bg: cell?.bg ?? c.worldBackground,
          layer: renderLayers.background,
        }, baseX + sx, baseY + sy);
      }
    }
    return;
  }

  const tiles = object.tileVariants ?? object.tiles ?? [];
  for (const tile of tiles) {
    renderer.drawCellToContext(ctx, {
      glyph: toSafeGlyph(tile.char ?? ' '),
      fg: tile.fg ?? '#d8d2c4',
      bg: tile.bg ?? c.worldBackground,
      layer: renderLayers.background,
    }, object.x + (tile.x ?? 0), object.y + (tile.y ?? 0));
  }
}

function isCachedStaticObject(object) {
  return Boolean(object)
    && !object.destroyed
    && object.interaction !== 'destroy'
    && object.breakTimer == null
    && object.type !== 'npc';
}

function backgroundCacheKey(map, worldObjects) {
  const width = map?.[0]?.length ?? 0;
  const height = map?.length ?? 0;
  const staticObjects = (worldObjects ?? [])
    .filter(isCachedStaticObject)
    .map((object) => [object.type, object.spriteId, object.variant ?? '', object.x, object.y, object.facing ?? '', object.category ?? ''])
    .sort((a, b) => String(a).localeCompare(String(b)));

  return JSON.stringify({ width, height, staticObjects });
}

function ensureBackgroundCache(renderer, map, worldObjects = []) {
  const width = map?.[0]?.length ?? 0;
  const height = map?.length ?? 0;
  if (width <= 0 || height <= 0) {
    renderer.invalidateBackgroundCache();
    return;
  }

  const key = backgroundCacheKey(map, worldObjects);
  if (renderer.backgroundCache?.key === key) return;

  const cache = renderer.createOffscreenCanvas(width * renderer.cellW, height * renderer.cellH);
  const fallbackTile = { char: ' ', fg: visualTheme.colors.floorFg, bg: visualTheme.colors.worldBackground };

  for (let y = 0; y < height; y += 1) {
    const row = map[y] ?? [];
    for (let x = 0; x < width; x += 1) {
      const tile = row[x] ?? fallbackTile;
      renderer.drawCellToContext(cache.ctx, {
        glyph: tile.char,
        fg: tile.fg,
        bg: tile.bg,
        layer: renderLayers.background,
      }, x, y);
    }
  }

  for (const object of worldObjects) {
    if (!isCachedStaticObject(object)) continue;
    drawWorldObjectToContext(renderer, cache.ctx, object);
  }

  renderer.setBackgroundCache({ ...cache, key });
}


function drawWorldDrop(renderer, camera, drop) {
  const item = getItemDefinition(drop?.itemId);
  const glyph = item?.icon ?? '*';
  const fg = item?.type === 'rare' ? '#ffe07d' : '#f5f1de';
  const screenX = worldToScreenCell(drop.x, camera.x);
  const screenY = worldToScreenCell(drop.y ?? 0, camera.y);
  drawCell(renderer, { glyph, fg, layer: renderLayers.entities }, screenX, screenY);
}

function drawDebugOverlays(renderer, camera, player, enemies, projectiles, worldObjects, activeRoom, debugOptions = {}) {
  if (!debugOptions?.overlaysEnabled) return;

  if (debugOptions.grid) {
    const w = camera.viewW;
    const h = camera.viewH;
    for (let x = 0; x < w; x += 4) drawCell(renderer, { glyph: '|', fg: '#223142' }, x, 0);
    for (let y = 0; y < h; y += 4) drawCell(renderer, { glyph: '-', fg: '#223142' }, 0, y);
  }

  const drawCircle = (cx, cy, radius, glyph, fg) => {
    const points = Math.max(12, Math.round(radius * 7));
    for (let i = 0; i < points; i += 1) {
      const a = (Math.PI * 2 * i) / points;
      drawCell(renderer, { glyph, fg }, Math.round(cx + Math.cos(a) * radius) - camera.x, Math.round(cy + Math.sin(a) * radius) - camera.y);
    }
  };

  const drawLine = (x0, y0, x1, y1, glyph, fg) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = Math.round(x0 + dx * t) - camera.x;
      const y = Math.round(y0 + dy * t) - camera.y;
      drawCell(renderer, { glyph, fg }, x, y);
    }
  };

  const drawBounds = (entity, color = '#ffc2c2') => {
    if (!entity) return;
    const radius = Math.max(0.5, entity.radius ?? 1);
    drawCircle(entity.x, entity.y, radius, '·', color);
  };

  if (debugOptions.attackRanges) enemies.forEach((enemy) => enemy.alive && drawCircle(enemy.x, enemy.y, enemy.attackRange ?? 3, '.', '#ff9f84'));
  if (debugOptions.aggroRanges) enemies.forEach((enemy) => enemy.alive && drawCircle(enemy.x, enemy.y, enemy.aggroRange ?? debugOptions.aggroRange ?? 26, '.', '#84d8ff'));
  if (debugOptions.projectileCollision) projectiles.forEach((p) => drawCircle(p.x, p.y, p.radius ?? 1, '·', '#90f0d1'));

  if (debugOptions.entityFootprints) {
    const entities = [player, ...enemies.filter((e) => e.alive)];
    for (const entity of entities) {
      drawCell(renderer, { glyph: '□', fg: '#f5e3a8' }, Math.round(entity.x) - camera.x, Math.round(entity.y) - camera.y);
    }
  }

  if (debugOptions.facingMarker) {
    const facingEntities = [player, ...enemies.filter((enemy) => enemy.alive)];
    for (const entity of facingEntities) {
      if (!entity) continue;
      const facing = ensureEntityFacing(entity);
      drawCell(
        renderer,
        { glyph: directionToArrow(entity.direction), fg: entity.type === 'player' ? '#7ce6ff' : '#ffcf84' },
        Math.round(entity.x + facing.x * 2) - camera.x,
        Math.round(entity.y + facing.y * 2) - camera.y,
      );
    }
  }

  if (debugOptions.facingLabels) {
    for (const enemy of enemies.filter((entity) => entity.alive)) {
      const direction = toCardinalDirection(enemy.direction, 'S');
      const glyph = enemy.facingGlyphs?.[direction] ?? '?';
      drawCell(renderer, { glyph: direction, fg: '#ffe9a6' }, Math.round(enemy.x) - camera.x, Math.round(enemy.y - 6) - camera.y);
      drawCell(renderer, { glyph, fg: '#ffcf84' }, Math.round(enemy.x + 1) - camera.x, Math.round(enemy.y - 6) - camera.y);
    }
  }

  if (debugOptions.cameraCenter) {
    drawCell(renderer, { glyph: '+', fg: '#f9dd7b' }, Math.floor(camera.viewW / 2), Math.floor(camera.viewH / 2));
  }


  if (debugOptions.collisionBounds) {
    drawBounds(player, '#ffe08a');
    enemies.forEach((enemy) => enemy.alive && drawBounds(enemy, '#ff9e9e'));
    projectiles.forEach((projectile) => drawBounds(projectile, '#8fd8ff'));
  }

  if (debugOptions.chaseLines && player) {
    enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      drawLine(enemy.x, enemy.y, player.x, player.y, '·', '#8ec5ff');
    });
  }

  if (debugOptions.layerLabels) {
    drawCell(renderer, { glyph: 'W', fg: '#88c1ff' }, 1, 1);
    drawCell(renderer, { glyph: 'E', fg: '#c8ff88' }, 3, 1);
    drawCell(renderer, { glyph: 'U', fg: '#ffcc88' }, 5, 1);
  }

  if (debugOptions.selectedEntity && debugOptions.selectedEntityRef) drawCircle(debugOptions.selectedEntityRef.x, debugOptions.selectedEntityRef.y, 2.2, '*', '#fff091');
  if (debugOptions.selectedTile && debugOptions.selectedTileRef) drawCell(renderer, { glyph: '▣', fg: '#9effaa' }, debugOptions.selectedTileRef.x - camera.x, debugOptions.selectedTileRef.y - camera.y);

  const overlay = activeRoom?.debugOverlay;
  if (debugOptions.showReservedCorridors) {
    for (const tile of overlay?.reservedCorridorTiles ?? []) {
      drawCell(renderer, { glyph: '·', fg: '#6dff8d' }, tile.x - camera.x, tile.y - camera.y);
    }
  }
  if (debugOptions.showExitAnchors) {
    for (const tile of overlay?.exitAnchors ?? []) {
      drawCell(renderer, { glyph: '◆', fg: '#46e7ff' }, tile.x - camera.x, tile.y - camera.y);
    }
  }
  if (debugOptions.showLandingTiles) {
    for (const tile of overlay?.landingTiles ?? []) {
      drawCell(renderer, { glyph: '■', fg: '#ffdf55' }, tile.x - camera.x, tile.y - camera.y);
    }
  }

  if (debugOptions.showEnemySpawnZones) {
    const enemyOverlay = activeRoom?.debugOverlay;
    const safety = enemyOverlay?.enemySafetySettings ?? {};

    for (const tile of enemyOverlay?.enemySpawnPoints ?? []) {
      drawCell(renderer, { glyph: '✦', fg: '#ff7ee2' }, tile.x - camera.x, tile.y - camera.y);
    }

    for (const center of enemyOverlay?.enemyGroupCenters ?? []) {
      drawCell(renderer, { glyph: '◎', fg: '#ff3cbf' }, center.x - camera.x, center.y - camera.y);
    }

    if (debugOptions.showEnemySpawnRejections) {
      for (const rejection of enemyOverlay?.enemySpawnRejections ?? []) {
        const glyph = rejection.reason === 'enemy_overlap' ? '×' : (rejection.reason === 'blocked_tile' ? '■' : '·');
        const color = rejection.reason === 'enemy_overlap' ? '#ff6565' : (rejection.reason === 'blocked_tile' ? '#8f9aa8' : '#ffd07a');
        drawCell(renderer, { glyph, fg: color }, rejection.x - camera.x, rejection.y - camera.y);
      }
    }

    const drawSafetyRing = (anchors, radius, color) => {
      const dist = Math.max(1, Number(radius) || 1);
      for (const anchor of anchors ?? []) drawCircle(anchor.x, anchor.y, dist, '·', color);
    };

    drawSafetyRing(enemyOverlay?.entranceSafetyAnchors, safety.minDistanceFromEntrance, '#7ec7ff');
    drawSafetyRing(enemyOverlay?.exitSafetyAnchors, safety.minDistanceFromExit, '#ffe38a');

    const pathDist = Math.max(1, Number(safety.minDistanceFromPath) || 1);
    for (const tile of enemyOverlay?.pathSafetyTiles ?? []) {
      drawCircle(tile.x, tile.y, pathDist, '·', '#7effb4');
    }
  }

  if (debugOptions.showAntDenTriggerRadius) {
    for (const object of worldObjects ?? []) {
      if (!object || object.type !== 'ant_den' || object.destroyed) continue;
      const triggerRadius = Math.max(1, Number(object.antSpawner?.triggerRadius) || 7);
      const phase = object.state?.phase ?? 'idle';
      const color = phase === 'depleted' ? '#808080' : (phase === 'active' ? '#ff9a4d' : '#ffaa66');
      drawCircle(object.x, object.y, triggerRadius, '·', color);
    }
  }

  if (debugOptions.showObjectClearanceRadius) {
    const overlayZones = activeRoom?.debugOverlay?.objectClearanceZones ?? [];
    for (const zone of overlayZones) {
      const radius = Math.max(1, Number(zone.radius) || 0);
      drawCircle(zone.x, zone.y, radius, '·', '#7ec7ff');
    }
  }
}


function drawDebugCursorOverlay(renderer, mouse) {
  if (!mouse) return;

  const worldScreenX = mouse.logicalX / renderer.cellW;
  const worldScreenY = mouse.logicalY / renderer.cellH;
  drawCell(renderer, { glyph: '+', fg: '#ff3f7f' }, worldScreenX, worldScreenY);

  if (mouse.insideViewport) {
    renderer.drawCell(toRenderCell({ glyph: '+', fg: '#53f7ff', layer: renderLayers.ui }), mouse.logicalCellX, mouse.logicalCellY);
  }
}

function traceCoordinateRoundTrip(renderer, camera, mouse, player) {
  if (!renderer?.coordinateTraceEnabled || !mouse || !player) return;

  const rect = renderer.canvas.getBoundingClientRect();
  const scale = renderer.compositeScale > 0 ? renderer.compositeScale : 1;
  const compositeOffsetX = renderer.offsetX ?? 0;
  const compositeOffsetY = renderer.offsetY ?? 0;

  const playerLogicalX = (player.x - camera.x) * renderer.cellW;
  const playerLogicalY = (player.y - camera.y) * renderer.cellH;
  const playerCanvasX = compositeOffsetX + playerLogicalX * scale;
  const playerCanvasY = compositeOffsetY + playerLogicalY * scale;
  const playerScreenX = rect.left + playerCanvasX;
  const playerScreenY = rect.top + playerCanvasY;

  const cursorLogicalX = (mouse.worldX - camera.x) * renderer.cellW;
  const cursorLogicalY = (mouse.worldY - camera.y) * renderer.cellH;
  const expectedCanvasX = compositeOffsetX + cursorLogicalX * scale;
  const expectedCanvasY = compositeOffsetY + cursorLogicalY * scale;
  const expectedScreenX = rect.left + expectedCanvasX;
  const expectedScreenY = rect.top + expectedCanvasY;

  console.debug('[CoordinateTrace][RoundTrip]', {
    frameId: renderer.compositeFrameId ?? 0,
    camera: { x: camera.x, y: camera.y },
    player: {
      worldX: player.x,
      worldY: player.y,
      logicalX: playerLogicalX,
      logicalY: playerLogicalY,
      renderedCanvasX: playerCanvasX,
      renderedCanvasY: playerCanvasY,
      renderedScreenX: playerScreenX,
      renderedScreenY: playerScreenY,
    },
    cursor: {
      actualScreenX: mouse.screenX,
      actualScreenY: mouse.screenY,
      canvasX: mouse.canvasX,
      canvasY: mouse.canvasY,
      logicalX: mouse.logicalX,
      logicalY: mouse.logicalY,
      worldX: mouse.worldX,
      worldY: mouse.worldY,
      expectedCanvasX,
      expectedCanvasY,
      expectedScreenX,
      expectedScreenY,
      deltaScreenX: mouse.screenX - expectedScreenX,
      deltaScreenY: mouse.screenY - expectedScreenY,
      deltaCanvasX: mouse.canvasX - expectedCanvasX,
      deltaCanvasY: mouse.canvasY - expectedCanvasY,
    },
    transform: {
      compositeScale: scale,
      compositeOffsetX,
      compositeOffsetY,
      rectLeft: rect.left,
      rectTop: rect.top,
      rectWidth: rect.width,
      rectHeight: rect.height,
      canvasWidth: renderer.canvas.width,
      canvasHeight: renderer.canvas.height,
    },
    timing: {
      frameTimestampMs: renderer.lastCompositeTimestamp ?? 0,
      pointerTimestampMs: mouse.eventTimestampMs ?? null,
      pointerMinusCompositeMs: mouse.eventTimestampMs == null ? null : mouse.eventTimestampMs - (renderer.lastCompositeTimestamp ?? 0),
      pointerFrameId: mouse.renderTransformFrameId ?? null,
      currentFrameId: renderer.compositeFrameId ?? 0,
    },
  });
}

export function renderWorld(renderer, camera, map, player, enemies, npcs, worldObjects, projectiles, goldPiles, worldDrops = [], combatTextSystem = null, abilityEffects = [], mouse = null, debugOptions = {}, activeRoom = null) {
  const safeAbilityEffects = Array.isArray(abilityEffects) ? abilityEffects : [];
  const safeWorldDrops = Array.isArray(worldDrops) ? worldDrops : [];
  ensureBackgroundCache(renderer, map, worldObjects);
  renderer.renderBackground(map, camera);

  for (const object of worldObjects) {
    if (isCachedStaticObject(object)) continue;

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
  drawAntDenEffects(renderer, camera, worldObjects);

  for (const npc of npcs) {
    const npcBaseColor = npc.dialogueEngaged ? '#f5df9a' : colorForEntity(npc);
    const npcColor = getEntityTintColor(npc, npcBaseColor);
    drawSprite(renderer, camera, npc, npcColor);
    drawStatusIcon(renderer, camera, npc);

    if (npc.dialogueEngaged) {
      const pulse = npc.dialoguePulse > 0 ? '○' : '·';
      const sx = worldToScreenCell(npc.x, camera.x);
      const sy = worldToScreenCell(npc.y - 5, camera.y);
      drawCell(renderer, { glyph: '*', fg: '#ffe6a8' }, sx, sy);
      drawCell(renderer, { glyph: pulse, fg: '#f7c66e' }, sx, sy + 1);
    }
  }

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const baseColor = enemy.spriteId === 'slime' ? palette.slime : palette.skeleton;
    let renderColor = enemy.frozen ? (enemy.freezeTint ?? '#9edbff') : baseColor;
    renderColor = getEntityTintColor(enemy, renderColor);

    if (enemy.hitFlashTimer > 0) {
      renderColor = '#f4f7ff';
    } else if (enemy.behavior === 'ranged' && isEntityAttacking(enemy)) {
      renderColor = '#ffb893';
    } else if (enemy.aggroFlashTimer > 0) {
      renderColor = '#ff7a7a';
    }

    drawSprite(renderer, camera, enemy, renderColor);
    drawEnemyFacingGlyph(renderer, camera, enemy);

    if (isEntityAttacking(enemy) && enemy.behavior !== 'ranged' && (enemy.state?.time ?? 0) < (enemy.attackWindup ?? 0.4)) {
      const sx = worldToScreenCell(enemy.x, camera.x);
      const sy = worldToScreenCell(enemy.y, camera.y);
      drawCell(renderer, { glyph: '!', fg: '#ffd166' }, sx, sy);
    }

    drawStatusIcon(renderer, camera, enemy);

    if (enemy.frozen) {
      const sx = worldToScreenCell(enemy.x, camera.x);
      const sy = worldToScreenCell(enemy.y - 3, camera.y);
      drawCell(renderer, { glyph: '*', fg: enemy.freezeGlow ?? '#d8f4ff' }, sx, sy);
    }
  }

  for (const p of projectiles) drawProjectile(renderer, camera, p);
  for (const effect of safeAbilityEffects) drawAbilityEffect(renderer, camera, effect);

  for (const g of goldPiles) {
    const gx = worldToScreenCell(g.x, camera.x);
    const gy = worldToScreenCell(g.y, camera.y);
    if (g.type === 'minor-item') {
      drawCell(renderer, { glyph: '*', fg: visualPalette.gold.lootSpark }, gx, gy);
      continue;
    }
    drawCell(renderer, { glyph: '$', fg: palette.gold }, gx, gy);
  }

  for (const drop of safeWorldDrops) drawWorldDrop(renderer, camera, drop);

  const playerColor = getEntityTintColor(player, palette.player);
  drawSprite(renderer, camera, player, playerColor);
  drawStatusIcon(renderer, camera, player);
  const px = worldToScreenCell(player.x, camera.x);
  const py = worldToScreenCell(player.y, camera.y);
  drawCell(renderer, { glyph: '!', fg: palette.playerAccent }, px, py - 2);

  drawDebugOverlays(renderer, camera, player, enemies, projectiles, worldObjects, activeRoom, debugOptions);
  drawDebugCursorOverlay(renderer, mouse);
  traceCoordinateRoundTrip(renderer, camera, mouse, player);
  if (typeof combatTextSystem?.render === 'function') combatTextSystem.render(renderer, camera);
}
