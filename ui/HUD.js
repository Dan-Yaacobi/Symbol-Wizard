import { palette } from '../entities/SpriteLibrary.js';

export function drawHUD(renderer, player) {
  const hpText = `HP:${player.hp}/${player.maxHp}`;
  const goldText = `Gold:${player.gold}`;
  for (let i = 0; i < hpText.length; i += 1) {
    renderer.buffer.set(1 + i, 1, hpText[i], '#ff8b8b', '#0b1016');
  }
  for (let i = 0; i < goldText.length; i += 1) {
    renderer.buffer.set(1 + i, 2, goldText[i], palette.gold, '#0b1016');
  }
}
