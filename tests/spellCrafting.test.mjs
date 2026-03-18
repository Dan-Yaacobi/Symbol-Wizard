import assert from 'node:assert/strict';
import { MAX_CRAFTING_COST, calculateSpellCost, craftSpell } from '../systems/spells/SpellCrafting.js';
import { castSpell } from '../systems/spells/SpellCaster.js';

function testBaseOnly() {
  const spell = craftSpell({ base: 'magic_bolt' });
  assert.equal(spell.behavior, 'projectile');
  assert.deepEqual(spell.components, []);
  assert.ok(typeof spell.config === 'object');
  assert.equal(spell.config.damage, 4);
  assert.equal(spell.cost, 1);
}

function testBaseWithElement() {
  const spell = craftSpell({ base: 'magic-bolt', element: 'fire' });
  assert.equal(spell.behavior, 'projectile');
  assert.equal(spell.element, 'fire');
  assert.deepEqual(spell.components, ['apply_status_on_hit']);
  assert.equal(spell.config.statusType, 'burn');
  assert.equal(spell.cost, 4);
}

function testBaseWithComponent() {
  const spell = craftSpell({ base: 'magic-bolt', components: ['pierce', 'pierce'] });
  assert.equal(spell.behavior, 'projectile');
  assert.deepEqual(spell.components, ['pierce']);
  assert.ok(spell.config.speed > 0);
  assert.equal(spell.cost, 2);
}

function testBaseElementAndComponent() {
  const spell = craftSpell({
    base: 'magic_bolt',
    element: 'fire',
    components: ['pierce'],
  });

  assert.equal(spell.behavior, 'projectile');
  assert.deepEqual(
    spell.components,
    ['apply_status_on_hit', 'pierce'],
  );
  assert.equal(spell.config.statusType, 'burn');
  assert.equal(spell.cost, 5);

  const result = castSpell(spell, {
    player: { x: 0, y: 0, facingX: 1, facingY: 0 },
    system: {
      projectiles: [],
      createProjectile(x, y, dx, dy, payload) {
        const projectile = { x, y, dx, dy, ...payload };
        this.projectiles.push(projectile);
        return projectile;
      },
      applyDamage() {},
      addStatusEffect() {},
      spawnEffect() {},
      getEntitiesInRadius() {
        return [];
      },
    },
  });

  assert.equal(result.ok, true);
}

function testElementsStayStatusFocused() {
  const frost = craftSpell({ base: 'magic-bolt', element: 'frost' });
  const poison = craftSpell({ base: 'magic-bolt', element: 'poison' });

  assert.deepEqual(frost.components, ['apply_status_on_hit']);
  assert.equal(frost.config.statusType, 'slow');
  assert.equal(poison.config.statusType, 'poison');
  assert.equal('spawnZoneDamage' in poison.config, false);
}


function testAdditionalBaseBehaviorsAreCraftable() {
  const beamSpell = craftSpell({ base: 'beam_test', element: 'arcane' });
  const zoneSpell = craftSpell({ base: 'zone_test', components: ['apply_status_on_hit'] });

  assert.equal(beamSpell.behavior, 'beam');
  assert.equal(beamSpell.cost, 1);
  assert.equal(zoneSpell.behavior, 'zone');
  assert.deepEqual(zoneSpell.components, ['apply_status_on_hit']);
  assert.equal(zoneSpell.cost, 2);
}

function testCalculateSpellCostBreakdown() {
  const summary = calculateSpellCost({
    base: 'magic-bolt',
    element: 'fire',
    components: ['explode_on_hit', 'pierce', 'pierce'],
  });

  assert.equal(summary.maxCost, MAX_CRAFTING_COST);
  assert.equal(summary.totalCost, 7);
  assert.equal(summary.withinLimit, false);
  assert.deepEqual(summary.breakdown.components, [
    { id: 'explode_on_hit', cost: 3 },
    { id: 'pierce', cost: 1 },
  ]);
}

function testOverBudgetCraftingFails() {
  assert.throws(
    () => craftSpell({ base: 'magic-bolt', element: 'fire', components: ['explode_on_hit'] }),
    /Spell is too complex to craft \(7\/5\)\./,
  );
}

function run() {
  testBaseOnly();
  testBaseWithElement();
  testBaseWithComponent();
  testBaseElementAndComponent();
  testElementsStayStatusFocused();
  testAdditionalBaseBehaviorsAreCraftable();
  testCalculateSpellCostBreakdown();
  testOverBudgetCraftingFails();
  console.log('Spell crafting tests passed.');
}

run();
