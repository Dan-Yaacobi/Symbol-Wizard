import assert from 'node:assert/strict';

import { Player } from '../entities/Player.js';
import { CombatTextSystem } from '../systems/CombatTextSystem.js';
import { getItemDefinition, ItemRegistry } from '../data/ItemRegistry.js';
import { addItem, createInventory, ensureInventory, getItemCount, hasItem, isInventory, removeItem } from '../systems/InventorySystem.js';
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

function run() {
  testItemRegistryContainsCraftingFeeders();
  testInventoryStacksAndCountsItems();
  testInventoryFailsWhenFull();
  testPlayerKeepsCanonicalInventoryShape();
  testEnsureInventoryProvidesSafeFallback();
  testEnemyDropsSpawnOnGroundInsteadOfDirectInventoryInsertion();
  testPickupCombatTextMergesNearbyItemBursts();
  console.log('Inventory and enemy drop tests passed.');
}

run();
