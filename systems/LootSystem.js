export function spawnGold(enemy) {
  return {
    type: 'gold',
    x: enemy.x,
    y: enemy.y,
    radius: 1.2,
    amount: 1 + Math.floor(Math.random() * 5),
  };
}

export function collectGold(player, goldPiles, combatTextSystem = null) {
  const kept = [];
  for (const g of goldPiles) {
    const dx = g.x - player.x;
    const dy = g.y - player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= 9) {
      player.gold += g.amount;
      combatTextSystem?.spawnGoldText(player, g.amount);
    } else {
      kept.push(g);
    }
  }
  return kept;
}
