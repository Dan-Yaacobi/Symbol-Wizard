import assert from 'node:assert/strict';
import { craftSpell } from '../systems/spells/SpellCrafting.js';
import { castSpell } from '../systems/spells/SpellCaster.js';

function testBaseOnly() {
  const spell = craftSpell({ base: 'magic_bolt' });
  assert.equal(spell.behavior, 'projectile');
  assert.deepEqual(spell.components, []);
  assert.ok(typeof spell.config === 'object');
  assert.equal(spell.config.damage, 4);
}

function testBaseWithElement() {
  const spell = craftSpell({ base: 'magic-bolt', element: 'fire' });
  assert.equal(spell.behavior, 'projectile');
  assert.equal(spell.element, 'fire');
  assert.ok(spell.components.includes('explode_on_hit'));
  assert.ok(spell.components.includes('apply_status_on_hit'));
  assert.equal(spell.config.statusType, 'burn');
}

function testBaseWithComponent() {
  const spell = craftSpell({ base: 'magic-bolt', components: ['pierce', 'pierce'] });
  assert.equal(spell.behavior, 'projectile');
  assert.deepEqual(spell.components, ['pierce']);
  assert.ok(spell.config.speed > 0);
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
    ['explode_on_hit', 'apply_status_on_hit', 'pierce'],
  );
  assert.equal(spell.config.statusType, 'burn');

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

function run() {
  testBaseOnly();
  testBaseWithElement();
  testBaseWithComponent();
  testBaseElementAndComponent();
  console.log('Spell crafting tests passed.');
}

run();
