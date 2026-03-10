import { palette, sprites } from '../entities/SpriteLibrary.js';

function drawSprite(renderer, camera, entity, color) {
  const sprite = sprites[entity.spriteKey];
  const baseX = Math.round(entity.x) - 3;
  const baseY = Math.round(entity.y) - 3;

  for (let sy = 0; sy < sprite.length; sy += 1) {
    const row = sprite[sy];
    for (let sx = 0; sx < row.length; sx += 1) {
      const ch = row[sx];
      if (ch === ' ') continue;
      const screenX = baseX + sx - camera.x;
      const screenY = baseY + sy - camera.y;
      renderer.drawEntityGlyph(ch, color, '#0b1016', screenX, screenY);
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
    const px = Math.round(p.x) - camera.x;
    const py = Math.round(p.y) - camera.y;
    const frame = p.frames[Math.floor((1 - p.ttl) * 10) % p.frames.length];
    renderer.drawEntityGlyph(frame, p.color, '#0b1016', px, py);
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
