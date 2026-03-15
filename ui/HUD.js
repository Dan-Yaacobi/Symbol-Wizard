import { palette } from '../entities/SpriteLibrary.js';
import { visualTheme } from '../data/VisualTheme.js';

const c = visualTheme.colors;

export function drawHUD(renderer, player, abilitySystem) {
  renderer.drawUiText(`HP:${Math.ceil(player.hp)}/${player.maxHp}`, c.health, c.night, 1, 1);
  renderer.drawUiText(`MP:${Math.ceil(player.mana)}/${player.maxMana}`, c.mana, c.night, 1, 2);
  renderer.drawUiText(`Gold:${player.gold}`, palette.gold, c.night, 1, 3);

  for (let i = 0; i < 4; i += 1) {
    const ability = abilitySystem.getAbilityBySlot(i);
    const label = ability ? ability.name : 'Empty';
    const cooldown = ability ? abilitySystem.getCooldownPercent(ability.id) : 0;
    const suffix = cooldown > 0 ? ` (${Math.ceil(cooldown * 100)}%)` : '';
    const textColor = cooldown > 0 ? c.textMuted : c.text;
    renderer.drawUiText(`${i + 1}:${label}${suffix}`, textColor, c.night, 1, 5 + i);
  }
}
