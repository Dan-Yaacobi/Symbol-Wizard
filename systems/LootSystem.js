
export const ENEMY_DROP_TABLES = Object.freeze({
  spider: {
    drops: [
      { itemId: 'essence', chance: 1, min: 1, max: 3 },
      { itemId: 'spider_eye', chance: 0.4, min: 1, max: 1 },
      { itemId: 'ember_dust', chance: 0.22, min: 1, max: 2 },
    ],
  },
  wasp: {
    drops: [
      { itemId: 'essence', chance: 1, min: 1, max: 2 },
      { itemId: 'wasp_stinger', chance: 0.45, min: 1, max: 1 },
      { itemId: 'poison_gland', chance: 0.12, min: 1, max: 1 },
      { itemId: 'storm_shard', chance: 0.08, min: 1, max: 1 },
    ],
  },
  forest_beetle: {
    drops: [
      { itemId: 'essence', chance: 1, min: 2, max: 4 },
      { itemId: 'stone', chance: 0.35, min: 1, max: 2 },
      { itemId: 'skull_fragment', chance: 0.18, min: 1, max: 1 },
      { itemId: 'ember_dust', chance: 0.16, min: 1, max: 2 },
    ],
  },
  swarm_bug: {
    drops: [
      { itemId: 'essence', chance: 1, min: 1, max: 1 },
      { itemId: 'wood', chance: 0.25, min: 1, max: 1 },
      { itemId: 'ember_dust', chance: 0.12, min: 1, max: 1 },
    ],
  },
  forest_mantis: {
    drops: [
      { itemId: 'essence', chance: 1, min: 2, max: 3 },
      { itemId: 'poison_gland', chance: 0.3, min: 1, max: 1 },
      { itemId: 'skull_fragment', chance: 0.15, min: 1, max: 1 },
      { itemId: 'storm_shard', chance: 0.1, min: 1, max: 1 },
    ],
  },
});

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function rollEnemyDrops(enemy) {
  const enemyType = enemy?.enemyType ?? enemy?.kind;
  const table = ENEMY_DROP_TABLES[enemyType];
  if (!table?.drops?.length) return [];

  const drops = [];
  for (const drop of table.drops) {
    if (!drop?.itemId || Math.random() > (drop.chance ?? 0)) continue;
    const min = Number.isFinite(drop.min) ? drop.min : 1;
    const max = Number.isFinite(drop.max) ? Math.max(min, drop.max) : min;
    const quantity = randomInt(min, max);
    if (quantity <= 0) continue;
    drops.push({ itemId: drop.itemId, quantity });
  }
  return drops;
}

export function awardEnemyDrops(player, enemy, combatTextSystem = null) {
  void player;
  void combatTextSystem;

  const drops = rollEnemyDrops(enemy);
  if (!drops.length) return { drops: [], added: [], rejected: [] };

  return {
    drops: drops.map((drop) => ({
      type: 'item',
      itemId: drop.itemId,
      quantity: drop.quantity,
      x: enemy?.x ?? 0,
      y: enemy?.y ?? 0,
    })),
    added: [],
    rejected: [],
  };
}

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
