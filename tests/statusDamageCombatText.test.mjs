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

function run() {
  testStatusTickDamageReportsFloatingText();
  testPoisonTickDamageUsesDefaultValue();
  console.log('Status damage combat text tests passed.');
}

run();
