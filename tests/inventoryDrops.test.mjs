import assert from 'node:assert/strict';

import { Player } from '../entities/Player.js';
import { getItemDefinition, ItemRegistry } from '../data/ItemRegistry.js';
import { addItem, createInventory, getItemCount, hasItem, removeItem } from '../systems/InventorySystem.js';
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

function testEnemyDropsGoDirectlyIntoInventoryAndShowFeedback() {
  const player = new Player(0, 0);
  const infoTexts = [];
  const combatTextSystem = { spawnInfoText(entity, text) { infoTexts.push({ entity, text }); } };

  withMockedRandom([0.0, 0.6, 0.9], () => {
    const result = awardEnemyDrops(player, { enemyType: 'spider' }, combatTextSystem);
    assert.deepEqual(result.added, [
      { itemId: 'essence', quantity: 2 },
    ]);
  });

  withMockedRandom([0.0, 0.2, 0.0, 0.0], () => {
    const result = awardEnemyDrops(player, { enemyType: 'spider' }, combatTextSystem);
    assert.deepEqual(result.added, [
      { itemId: 'essence', quantity: 1 },
      { itemId: 'spider_eye', quantity: 1 },
    ]);
  });

  assert.equal(getItemCount(player.inventory, 'essence'), 3);
  assert.equal(getItemCount(player.inventory, 'spider_eye'), 1);
  assert.deepEqual(infoTexts.map((entry) => entry.text), ['+2 Essence', '+1 Essence', '+1 Spider Eye']);
}

function run() {
  testItemRegistryContainsCraftingFeeders();
  testInventoryStacksAndCountsItems();
  testInventoryFailsWhenFull();
  testEnemyDropsGoDirectlyIntoInventoryAndShowFeedback();
  console.log('Inventory and enemy drop tests passed.');
}

run();
