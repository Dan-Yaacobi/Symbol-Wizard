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

function drawSprite(renderer, camera, entity, color) {
  const sprite = getEntitySprite(entity);
  if (!sprite) return;

  const baseX = Math.round(entity.x) - 3;
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

export function renderWorld(renderer, camera, map, player, enemies, npc, projectiles, goldPiles) {
  renderer.renderBackground(map, camera);

  drawSprite(renderer, camera, npc, palette.npc);

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    drawSprite(renderer, camera, enemy, enemy.kind === 'slime' ? palette.slime : palette.skeleton);
  }

  for (const p of projectiles) {
    drawProjectile(renderer, camera, p);
  }

  for (const g of goldPiles) {
    const gx = Math.round(g.x) - camera.x;
    const gy = Math.round(g.y) - camera.y;
    renderer.drawEntityGlyph('$', palette.gold, '#0b1016', gx, gy);
  }

  drawSprite(renderer, camera, player, palette.player);
  const px = Math.round(player.x) - camera.x;
  const py = Math.round(player.y) - camera.y;
  renderer.drawEntityGlyph('!', palette.playerAccent, '#0b1016', px, py - 2);
}
