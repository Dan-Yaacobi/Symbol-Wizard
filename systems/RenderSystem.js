import { palette, sprites } from '../entities/SpriteLibrary.js';

function drawSprite(renderer, camera, entity, color) {
  const sprite = sprites[entity.spriteKey];
  const baseX = Math.round(entity.x) - 3;
  const baseY = Math.round(entity.y) - 3;

  for (let sy = 0; sy < sprite.length; sy += 1) {
    for (let sx = 0; sx < sprite[sy].length; sx += 1) {
      const ch = sprite[sy][sx];
      if (ch === ' ') continue;
      const wx = baseX + sx;
      const wy = baseY + sy;
      const { x, y } = camera.worldToScreen(wx, wy);
      renderer.buffer.set(x, y, ch, color, '#0b1016');
    }
  }
}

export function renderWorld(renderer, camera, map, player, enemies, npc, projectiles, goldPiles) {
  for (let y = 0; y < camera.viewH; y += 1) {
    for (let x = 0; x < camera.viewW; x += 1) {
      const wx = x + camera.x;
      const wy = y + camera.y;
      const t = map[wy]?.[wx];
      if (t) renderer.buffer.set(x, y, t.char, t.fg, t.bg);
    }
  }

  drawSprite(renderer, camera, npc, palette.npc);

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    drawSprite(renderer, camera, enemy, enemy.kind === 'slime' ? palette.slime : palette.skeleton);
  }

  for (const p of projectiles) {
    const { x, y } = camera.worldToScreen(Math.round(p.x), Math.round(p.y));
    const frame = p.frames[Math.floor((1 - p.ttl) * 10) % p.frames.length];
    renderer.buffer.set(x, y, frame, p.color, '#0b1016');
  }

  for (const g of goldPiles) {
    const { x, y } = camera.worldToScreen(Math.round(g.x), Math.round(g.y));
    renderer.buffer.set(x, y, '$', palette.gold, '#0b1016');
  }

  drawSprite(renderer, camera, player, palette.player);
  const p = camera.worldToScreen(Math.round(player.x), Math.round(player.y));
  renderer.buffer.set(p.x, p.y - 2, '!', palette.playerAccent, '#0b1016');
}
