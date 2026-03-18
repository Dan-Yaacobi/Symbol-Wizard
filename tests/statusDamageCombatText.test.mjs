import assert from 'node:assert/strict';
import { AbilitySystem } from '../systems/AbilitySystem.js';

function createAbilitySystem(reportDamage) {
  return new AbilitySystem({
    definitions: [],
    player: { x: 0, y: 0, statusEffects: new Map(), activeStatuses: [] },
    enemies: [],
    map: [],
    camera: { x: 0, y: 0, viewW: 20, viewH: 20, startShake() {} },
    spawnProjectile() {},
    reportDamage,
    onEnemySlain() {},
  });
}

function testStatusTickDamageReportsFloatingText() {
  const damageReports = [];
  const enemy = {
    x: 3,
    y: 5,
    hp: 20,
    alive: true,
    statusEffects: new Map([
      ['burn', { duration: 2, tickTimer: 0, pulseTimer: 0, pulseFlash: 0 }],
    ]),
    activeStatuses: [],
  };

  const system = createAbilitySystem((entity, damage, isCritical) => {
    damageReports.push({ entity, damage, isCritical });
  });
  system.enemies.push(enemy);

  system.updateStatusEffects(0.5);

  assert.equal(enemy.hp, 18);
  assert.equal(damageReports.length, 1);
  assert.equal(damageReports[0].entity, enemy);
  assert.equal(damageReports[0].damage, 2);
  assert.equal(damageReports[0].isCritical, false);
}

function testPoisonTickDamageUsesDefaultValue() {
  const enemy = {
    x: 1,
    y: 1,
    hp: 8,
    alive: true,
    statusEffects: new Map([
      ['poison', { duration: 2, tickTimer: 0, pulseTimer: 0, pulseFlash: 0 }],
    ]),
    activeStatuses: [],
  };

  const system = createAbilitySystem(() => {});
  system.enemies.push(enemy);

  system.updateStatusEffects(0.5);

  assert.equal(enemy.hp, 7);
}



function createEnemy(x, y, hp, statuses = [], extras = {}) {
  return {
    x,
    y,
    hp,
    alive: true,
    statusEffects: new Map(statuses),
    activeStatuses: [],
    ...extras,
  };
}

function testFireAmplifiesDamageAgainstBurningTargets() {
  const reports = [];
  const enemy = createEnemy(2, 2, 20, [['burn', { duration: 2 }]]);
  const system = createAbilitySystem((entity, damage) => reports.push({ entity, damage }));
  system.enemies.push(enemy);

  system.applySpellDamage(enemy, 4, {
    eventName: 'onHit',
    instance: { currentElement: 'fire', base: { element: 'fire' }, parameters: {} },
    sourceX: 0,
    sourceY: 0,
  });

  assert.equal(enemy.hp, 14);
  assert.equal(reports.at(-1).damage, 6);
}

function testLightningChainsFromShockedTargets() {
  const reports = [];
  const primary = createEnemy(2, 2, 20, [['shock', { duration: 2 }]]);
  const nearby = createEnemy(4, 2, 12, []);
  const far = createEnemy(20, 20, 12, []);
  const system = createAbilitySystem((entity, damage) => reports.push({ entity, damage }));
  system.enemies.push(primary, nearby, far);

  system.applySpellDamage(primary, 4, {
    eventName: 'onHit',
    instance: { currentElement: 'lightning', base: { element: 'lightning' }, parameters: {} },
    sourceX: 0,
    sourceY: 0,
  });

  assert.equal(primary.hp, 16);
  assert.equal(nearby.hp, 10);
  assert.equal(far.hp, 12);
  assert.equal(reports.filter((entry) => entry.entity === nearby).length, 1);
}

function testLightningReactsToFrozenTargets() {
  const reports = [];
  const enemy = createEnemy(3, 3, 20, [], { frozen: true });
  const system = createAbilitySystem((entity, damage) => reports.push({ entity, damage }));
  system.enemies.push(enemy);
  system.activeFreeze = { shatterDamage: 0, targets: new Set([enemy]) };

  const result = system.applySpellDamage(enemy, 4, {
    eventName: 'onHit',
    instance: { currentElement: 'lightning', base: { element: 'lightning' }, parameters: {} },
    sourceX: 0,
    sourceY: 0,
  });

  assert.equal(enemy.hp, 14);
  assert.equal(enemy.frozen, false);
  assert.equal(enemy.statusEffects.has('shock'), true);
  assert.equal(result.resolution.metadata.reactedToFrozen, true);
  assert.equal(reports.at(-1).damage, 6);
}

function run() {
  testStatusTickDamageReportsFloatingText();
  testPoisonTickDamageUsesDefaultValue();
  testFireAmplifiesDamageAgainstBurningTargets();
  testLightningChainsFromShockedTargets();
  testLightningReactsToFrozenTargets();
  console.log('Status damage combat text tests passed.');
}

run();
