import { palette } from '../entities/SpriteLibrary.js';

export function drawHUD(renderer, player) {
  renderer.drawUiText(`HP:${player.hp}/${player.maxHp}`, '#ff8b8b', '#0b1016', 1, 1);
  renderer.drawUiText(`Gold:${player.gold}`, palette.gold, '#0b1016', 1, 2);
}
