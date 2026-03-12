export function spawnGold(enemy) {
  return {
    type: 'gold',
    x: enemy.x,
    y: enemy.y,
    radius: 1.2,
    amount: 1 + Math.floor(Math.random() * 5),
  };
}

export function spawnDestructibleDrop(object) {
  const roll = Math.random();
  if (roll < 0.65) {
    const min = Number.isFinite(object?.dropMin) ? object.dropMin : 1;
    const max = Number.isFinite(object?.dropMax) ? object.dropMax : 4;
    const amount = min + Math.floor(Math.random() * (Math.max(min, max) - min + 1));

    return {
      type: 'gold',
      x: object.x,
      y: object.y,
      radius: 1.2,
      amount,
    };
  }

  return {
    type: 'minor-item',
    x: object.x,
    y: object.y,
    radius: 1.2,
    amount: 1,
  };
}

export function collectGold(player, goldPiles, combatTextSystem = null) {
  const kept = [];
  for (const g of goldPiles) {
    const dx = g.x - player.x;
    const dy = g.y - player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= 9) {
      if (g.type === 'minor-item') {
        player.mana = Math.min(player.maxMana, player.mana + 6);
      } else {
        player.gold += g.amount;
        combatTextSystem?.spawnGoldText(player, g.amount);
      }
    } else {
      kept.push(g);
    }
  }
  return kept;
}
