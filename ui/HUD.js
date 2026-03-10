import { palette } from '../entities/SpriteLibrary.js';

export function drawHUD(renderer, player, abilitySystem) {
  renderer.drawUiText(`HP:${Math.ceil(player.hp)}/${player.maxHp}`, '#ff8b8b', '#0b1016', 1, 1);
  renderer.drawUiText(`MP:${Math.ceil(player.mana)}/${player.maxMana}`, '#82d1ff', '#0b1016', 1, 2);
  renderer.drawUiText(`Gold:${player.gold}`, palette.gold, '#0b1016', 1, 3);

  for (let i = 0; i < 4; i += 1) {
    const ability = abilitySystem.getAbilityBySlot(i);
    const label = ability ? ability.name : 'Empty';
    const cooldown = ability ? abilitySystem.getCooldownPercent(ability.id) : 0;
    const suffix = cooldown > 0 ? ` (${Math.ceil(cooldown * 100)}%)` : '';
    renderer.drawUiText(`${i + 1}:${label}${suffix}`, '#d9e4ff', '#0b1016', 1, 5 + i);
  }
}
