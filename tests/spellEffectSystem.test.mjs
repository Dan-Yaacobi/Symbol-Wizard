import assert from 'node:assert/strict';
import { SpellEffectSystem } from '../systems/spells/SpellEffectSystem.js';
import { createSpellInstance } from '../systems/spells/SpellInstance.js';

function makeEnemy(x, y) {
  return { x, y, hp: 20, alive: true, statusEffects: new Map(), activeStatuses: [] };
}

function makeSystem(enemies = []) {
  const spawnedProjectiles = [];
  const zones = [];
  const effects = [];
  const damageEvents = [];
  const activeSpellInstances = [];
  return {
    enemies,
    effects,
    zones,
    activeSpellInstances,
    spawnedProjectiles,
    map: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => ({ walkable: true }))),
    createProjectile(x, y, dx, dy, payload = {}) {
      const projectile = { x, y, dx, dy, speed: 10, damage: 4, ttl: 1, radius: 1, ...payload };
      spawnedProjectiles.push(projectile);
      return projectile;
    },
    spawnEffect(effect) { effects.push(effect); },
    getEntitiesInRadius(x, y, radius) {
      return enemies.filter((enemy) => enemy.alive && Math.hypot(enemy.x - x, enemy.y - y) <= radius);
    },
    applySpellDamage(target, amount, context = {}) {
      damageEvents.push({ target, amount, context });
      target.hp -= amount;
      if (target.hp <= 0) target.alive = false;
      return { damageApplied: true, resolution: { triggeredRules: [] } };
    },
    registerHitFeedback(target, hitContext) {
      target.lastKnockback = hitContext.knockbackDistance;
    },
    damageEvents,
  };
}

function buildInstance(effects) {
  return createSpellInstance({
    id: 'test-spell',
    behavior: 'projectile',
    components: effects,
    parameters: { damage: 4, speed: 10, ttl: 1, size: 1, color: '#fff' },
    cost: 1,
    cooldown: 0,
    manaCost: 0,
    name: 'Test',
    targeting: 'cursor',
  });
}

function testPierceCountDecrements() {
  const system = makeSystem();
  const instance = buildInstance([{ id: 'pierce', count: 2 }]);
  const projectile = SpellEffectSystem.initializeProjectile({ x: 0, y: 0, dx: 1, dy: 0, damage: 4 }, instance);
  const targetA = makeEnemy(1, 0);
  const targetB = makeEnemy(2, 0);
  const ctxA = { projectile, target: targetA };
  SpellEffectSystem.applyEffects('onHit', ctxA);
  assert.equal(projectile.remainingPierce, 1);
  assert.equal(ctxA.preventDestroy, true);
  const ctxB = { projectile, target: targetB };
  SpellEffectSystem.applyEffects('onHit', ctxB);
  assert.equal(projectile.remainingPierce, 0);
}

function testSplitDepthProtection() {
  const system = makeSystem();
  const instance = buildInstance([{ type: 'split', count: 3, maxDepth: 1 }]);
  const projectile = SpellEffectSystem.initializeProjectile({ x: 0, y: 0, dx: 1, dy: 0, damage: 4, speed: 10, ttl: 1, radius: 1 }, instance);
  SpellEffectSystem.applyEffects('onHit', { projectile, instance, system, x: 0, y: 0 });
  assert.equal(system.spawnedProjectiles.length, 3);
  const child = system.spawnedProjectiles[0];
  assert.equal(child.effectState.splitDepth, 1);
  SpellEffectSystem.applyEffects('onHit', { projectile: child, instance, system, x: 1, y: 0 });
  assert.equal(system.spawnedProjectiles.length, 3);
}

function testChainAvoidsRehits() {
  const a = makeEnemy(0, 0);
  const b = makeEnemy(2, 0);
  const c = makeEnemy(4, 0);
  const system = makeSystem([a, b, c]);
  const instance = buildInstance([{ type: 'chain', count: 3, radius: 3, damage: 2 }]);
  SpellEffectSystem.applyEffects('onHit', { system, target: a, instance, x: 0, y: 0, damage: 4 });
  assert.equal(system.damageEvents.length, 2);
  assert.deepEqual(system.damageEvents.map((entry) => entry.target), [b, c]);
 }

function testBounceCountDecrements() {
  const system = makeSystem();
  const instance = buildInstance([{ type: 'bounce', count: 2 }]);
  const projectile = SpellEffectSystem.initializeProjectile({ x: 5, y: 5, dx: 1, dy: 0, damage: 4 }, instance);
  const ctx = { projectile, instance, system, target: null, collisionNormal: { x: -1, y: 0 } };
  SpellEffectSystem.applyEffects('onExpire', ctx);
  assert.equal(projectile.remainingBounces, 1);
  assert.equal(ctx.preventDestroy, true);
 }

function testZoneOnHitSpawnsZone() {
  const system = makeSystem();
  const instance = buildInstance([{ type: 'zone_on_hit', radius: 2, duration: 1, tickInterval: 0.2, damage: 1 }]);
  SpellEffectSystem.applyEffects('onHit', { system, instance, x: 3, y: 4 });
  assert.equal(system.activeSpellInstances.length, 1);
  assert.equal(system.activeSpellInstances[0].instance.base.behavior, 'zone');
 }

function testExplodeDamagesNearbyEnemies() {
  const near = makeEnemy(1, 0);
  const far = makeEnemy(10, 0);
  const system = makeSystem([near, far]);
  const instance = buildInstance([{ type: 'explode', radius: 2, damage: 3 }]);
  SpellEffectSystem.applyEffects('onHit', { system, instance, x: 0, y: 0, target: null, damage: 4 });
  assert.equal(system.damageEvents.length, 1);
  assert.equal(system.damageEvents[0].target, near);
 }

function run() {
  testPierceCountDecrements();
  testSplitDepthProtection();
  testChainAvoidsRehits();
  testBounceCountDecrements();
  testZoneOnHitSpawnsZone();
  testExplodeDamagesNearbyEnemies();
  console.log('Spell effect system tests passed.');
}

run();
