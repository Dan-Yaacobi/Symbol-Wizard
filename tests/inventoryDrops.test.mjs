import assert from 'node:assert/strict';

import { Player } from '../entities/Player.js';
import { CombatTextSystem } from '../systems/CombatTextSystem.js';
import { getItemDefinition, ItemRegistry } from '../data/ItemRegistry.js';
import { addItem, createInventory, ensureInventory, getItemCount, hasItem, isInventory, populateInventoryWithMaxStacks, removeItem } from '../systems/InventorySystem.js';
import { awardEnemyDrops } from '../systems/LootSystem.js';

function withMockedRandom(sequence, fn) {
  const original = Math.random;
  let index = 0;
  Math.random = () => sequence[Math.min(index++, sequence.length - 1)];
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function testItemRegistryContainsCraftingFeeders() {
  assert.equal(getItemDefinition('wood')?.name, 'Wood');
  assert.equal(getItemDefinition('essence')?.type, 'currency');
  assert.equal(ItemRegistry.poison_gland?.tier, 2);
  assert.equal(ItemRegistry.ember_dust?.icon, '•');
  assert.equal(ItemRegistry.storm_shard?.icon, '⚡');
}

function testInventoryStacksAndCountsItems() {
  const inventory = createInventory(2);

  let result = addItem(inventory, 'wood', 70);
  assert.equal(result.success, true);
  result = addItem(inventory, 'wood', 40);
  assert.equal(result.success, true);
  assert.equal(inventory.slots.length, 2);
  assert.deepEqual(inventory.slots, [
    { itemId: 'wood', quantity: 99 },
    { itemId: 'wood', quantity: 11 },
  ]);
  assert.equal(getItemCount(inventory, 'wood'), 110);
  assert.equal(hasItem(inventory, 'wood', 100), true);

  const removed = removeItem(inventory, 'wood', 100);
  assert.equal(removed.success, true);
  assert.equal(getItemCount(inventory, 'wood'), 10);
}

function testInventoryFailsWhenFull() {
  const inventory = createInventory(1);
  addItem(inventory, 'stone', 99);
  const result = addItem(inventory, 'essence', 1);
  assert.equal(result.success, false);
  assert.equal(result.added, 0);
  assert.equal(result.remaining, 1);
}

function testPlayerKeepsCanonicalInventoryShape() {
  const player = new Player(0, 0);

  assert.equal(isInventory(player.inventory), true);

  const addResult = player.addItem('essence', 5);
  assert.equal(addResult.success, true);
  assert.equal(player.getItemCount('essence'), 5);
  assert.equal(player.hasItem('essence', 5), true);
  assert.equal(player.removeItem('essence', 3), true);
  assert.equal(player.getItemCount('essence'), 2);
}

function testEnsureInventoryProvidesSafeFallback() {
  const fallback = ensureInventory(new Map(), { fallbackMaxSlots: 8 });
  assert.deepEqual(fallback, { slots: [], maxSlots: 8 });
}

function testPopulateInventoryWithMaxStacksUsesDefinedMaximums() {
  const inventory = createInventory(24);

  const results = populateInventoryWithMaxStacks(inventory);

  assert.equal(results.every((result) => result.success), true);
  Object.values(ItemRegistry).forEach((item) => {
    const expectedQuantity = item.stackable ? item.maxStack : 1;
    assert.equal(getItemCount(inventory, item.id), expectedQuantity);
  });
}

function testEnemyDropsSpawnOnGroundInsteadOfDirectInventoryInsertion() {
  const player = new Player(0, 0);

  withMockedRandom([0.0, 0.6, 0.9], () => {
    const result = awardEnemyDrops(player, { enemyType: 'spider', x: 12, y: 18 });
    assert.deepEqual(result.added, []);
    assert.deepEqual(result.rejected, []);
    assert.deepEqual(result.drops, [
      { type: 'item', itemId: 'essence', quantity: 2, x: 12, y: 18 },
    ]);
  });

  assert.equal(getItemCount(player.inventory, 'essence'), 0);
}

function testPickupCombatTextMergesNearbyItemBursts() {
  const combatTextSystem = new CombatTextSystem();

  const player = { x: 4, y: 6 };
  combatTextSystem.spawnPickupText(player, 'stone', 2, 10);
  combatTextSystem.spawnPickupText(player, 'stone', 3, 10.2);
  combatTextSystem.spawnPickupText(player, 'ember_dust', 1, 10.25);

  assert.equal(combatTextSystem.pickupStack.length, 2);
  assert.deepEqual(
    combatTextSystem.pickupStack.map(({ itemId, quantity }) => ({ itemId, quantity })),
    [
      { itemId: 'stone', quantity: 5 },
      { itemId: 'ember_dust', quantity: 1 },
    ],
  );

  combatTextSystem.update(0.1, 13.5);
  assert.equal(combatTextSystem.pickupStack.length, 0);
}


function testCombatTextGroupsStackNearbyBursts() {
  const combatTextSystem = new CombatTextSystem();
  const enemy = { x: 10, y: 10 };

  withMockedRandom([0.5, 0.5, 0.5, 0.5], () => {
    combatTextSystem.spawnDamageText(enemy, 10, false, 1.0);
  });
  combatTextSystem.spawnDamageText(enemy, 12, false, 1.05);
  combatTextSystem.spawnGoldText(enemy, 5, 1.1);

  assert.equal(combatTextSystem.textGroups.length, 1);
  assert.deepEqual(
    combatTextSystem.textGroups[0].entries.map((entry) => entry.text),
    ['22', '+5$'],
  );

  combatTextSystem.update(0.5, 1.5);
  assert.equal(combatTextSystem.textGroups[0].y < enemy.y - 3.8, true);
}

function testCombatTextSeparatesDistinctTargetsAndExpiresByGroupLifetime() {
  const combatTextSystem = new CombatTextSystem();

  combatTextSystem.spawnDamageText({ x: 0, y: 0 }, 8, false, 2.0);
  combatTextSystem.spawnDamageText({ x: 5, y: 5 }, 9, false, 2.05);

  assert.equal(combatTextSystem.textGroups.length, 2);

  combatTextSystem.update(2.5, 4.6);
  assert.equal(combatTextSystem.textGroups.length, 0);
}

function testPickupCombatTextUsesLaneScatterMotionFadeAndVerticalSpacing() {
  const combatTextSystem = new CombatTextSystem();
  const player = { x: 4, y: 6 };

  withMockedRandom(new Array(40).fill(0.5), () => {
    ['stone', 'ember_dust', 'essence', 'wood', 'poison_gland', 'storm_shard'].forEach((itemId, index) => {
      combatTextSystem.spawnPickupText(player, itemId, 1, 10 + index * 0.05);
    });
  });

  assert.equal(combatTextSystem.pickupStack[0].anchorX, 4);
  assert.equal(combatTextSystem.pickupStack[0].anchorY, 4);
  assert.equal(combatTextSystem.pickupStack[0].lane, -2);
  assert.equal(combatTextSystem.pickupStack[1].lane, -1);
  assert.equal(combatTextSystem.pickupStack[4].lane, 2);
  assert.equal(combatTextSystem.pickupStack[5].lane, -2);
  assert.equal(combatTextSystem.pickupStack[0].x, 2.8);
  assert.equal(combatTextSystem.pickupStack[0].y, 4);
  assert.equal(combatTextSystem.pickupStack[0].vx, -0.3);
  assert.equal(Math.abs(combatTextSystem.pickupStack[0].vy + 0.75) < 1e-9, true);
  assert.equal(combatTextSystem.pickupStack[0].style.fontScale, 1.5);

  combatTextSystem.update(0.5, 10.5);

  assert.equal(combatTextSystem.pickupStack[0].opacity > 0 && combatTextSystem.pickupStack[0].opacity < 1, true);
  assert.equal(combatTextSystem.pickupStack[0].y < 4, true);
  assert.equal(combatTextSystem.pickupStack[5].y <= combatTextSystem.pickupStack[0].y - 1, true);

  const dx = combatTextSystem.pickupStack[0].x - combatTextSystem.pickupStack[1].x;
  assert.equal(Math.abs(dx) > 0, true);
}

function testPickupCombatTextCapsVisibleEntries() {
  const combatTextSystem = new CombatTextSystem();
  const player = { x: 4, y: 6 };

  ['stone', 'ember_dust', 'essence', 'wood', 'poison_gland', 'storm_shard', 'fire_core'].forEach((itemId, index) => {
    combatTextSystem.spawnPickupText(player, itemId, 1, 10 + index);
  });

  assert.equal(combatTextSystem.pickupStack.length, 6);
  assert.deepEqual(
    combatTextSystem.pickupStack.map(({ itemId }) => itemId),
    ['ember_dust', 'essence', 'wood', 'poison_gland', 'storm_shard', 'fire_core'],
  );
  assert.equal(combatTextSystem.pickupStack.every((entry) => Number.isFinite(entry.x) && Number.isFinite(entry.y)), true);
}

function run() {
  testItemRegistryContainsCraftingFeeders();
  testInventoryStacksAndCountsItems();
  testInventoryFailsWhenFull();
  testPlayerKeepsCanonicalInventoryShape();
  testEnsureInventoryProvidesSafeFallback();
  testPopulateInventoryWithMaxStacksUsesDefinedMaximums();
  testEnemyDropsSpawnOnGroundInsteadOfDirectInventoryInsertion();
  testPickupCombatTextMergesNearbyItemBursts();
  testCombatTextGroupsStackNearbyBursts();
  testCombatTextSeparatesDistinctTargetsAndExpiresByGroupLifetime();
  testPickupCombatTextUsesLaneScatterMotionFadeAndVerticalSpacing();
  testPickupCombatTextCapsVisibleEntries();
  console.log('Inventory and enemy drop tests passed.');
}

run();
