import assert from 'node:assert/strict';
import { SpellEffectSystem } from '../systems/spells/SpellEffectSystem.js';
import { createSpellInstance } from '../systems/spells/SpellInstance.js';
import { castSpell, updateSpellInstances } from '../systems/spells/SpellCaster.js';
import { validateSpell } from '../systems/spells/SpellValidator.js';

function makeEnemy(x, y) {
  return { x, y, hp: 20, alive: true, statusEffects: new Map(), activeStatuses: [], radius: 1 };
}

function makeSystem(enemies = []) {
  const spawnedProjectiles = [];
  const effects = [];
  const damageEvents = [];
  const activeSpellInstances = [];
  return {
    enemies,
    effects,
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

function buildInstance(effects, behavior = 'projectile', parameters = {}) {
  const baseParameters = {
    damage: 4,
    speed: 10,
    ttl: 1,
    size: 1,
    color: '#fff',
    duration: 0.4,
    radius: 2,
    tickInterval: 0.2,
    width: 1,
    range: 6,
    ...parameters,
  };
  return createSpellInstance({
    id: 'test-spell',
    behavior,
    components: effects,
    parameters: baseParameters,
    cost: 1,
    cooldown: 0,
    manaCost: 0,
    name: 'Test',
    description: 'test',
    targeting: 'cursor',
    element: 'arcane',
  });
}

function testPierceCountDecrements() {
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

function testProjectileZoneOnHitAndPierceCoexist() {
  const system = makeSystem();
  const instance = buildInstance([{ type: 'zone_on_hit', radius: 2, duration: 1, tickInterval: 0.2, damage: 1 }, { type: 'pierce', count: 2 }]);
  const projectile = SpellEffectSystem.initializeProjectile({ x: 0, y: 0, dx: 1, dy: 0, damage: 4 }, instance);
  const target = makeEnemy(1, 0);
  const ctx = { projectile, target, system, instance, x: 1, y: 0, damage: 4 };
  SpellEffectSystem.applyEffects('onHit', ctx);
  assert.equal(ctx.preventDestroy, true);
  assert.equal(system.activeSpellInstances.length, 1);
}

function testBeamContinuousDamageHonorsPerTargetCooldown() {
  const target = makeEnemy(4, 0);
  const system = makeSystem([target]);
  const beamSpell = {
    id: 'beam-tick',
    name: 'Beam Tick',
    description: 'test',
    behavior: 'beam',
    targeting: 'cursor',
    element: 'arcane',
    components: [],
    effects: [],
    parameters: { damage: 2, duration: 0.35, width: 1.8, range: 8, tickInterval: 0.05, hitCooldownPerTarget: 0.15, color: '#fff' },
    cost: 1,
    cooldown: 0,
    manaCost: 0,
  };

  const result = castSpell(beamSpell, {
    system,
    player: { x: 0, y: 0, facingX: 1, facingY: 0 },
    targetPosition: { x: 8, y: 0 },
    activeSpellInstances: system.activeSpellInstances,
  });

  assert.equal(result.ok, true);
  assert.equal(system.damageEvents.length, 1);

  updateSpellInstances(system.activeSpellInstances, 0.1, { system, player: { x: 0, y: 0 } });
  assert.equal(system.damageEvents.length, 1);

  updateSpellInstances(system.activeSpellInstances, 0.05, { system, player: { x: 0, y: 0 } });
  assert.equal(system.damageEvents.length, 2);

  updateSpellInstances(system.activeSpellInstances, 0.15, { system, player: { x: 0, y: 0 } });
  assert.equal(system.damageEvents.length, 3);
}

function testBeamForkSpawnsDistinctBranches() {
  const system = makeSystem();
  const beamSpell = {
    id: 'beam-fork',
    name: 'Beam Fork',
    description: 'test',
    behavior: 'beam',
    targeting: 'cursor',
    element: 'lightning',
    components: [],
    effects: [{ type: 'split', count: 3, spreadDegrees: 18 }],
    parameters: { damage: 3, duration: 0.3, width: 1.8, range: 10, tickInterval: 0.05, color: '#fff' },
    cost: 1,
    cooldown: 0,
    manaCost: 0,
  };

  const result = castSpell(beamSpell, {
    system,
    player: { x: 0, y: 0, facingX: 1, facingY: 0 },
    targetPosition: { x: 10, y: 0 },
    activeSpellInstances: system.activeSpellInstances,
  });

  assert.equal(result.ok, true);
  const beamEffect = system.effects.find((effect) => effect.type === 'beam');
  assert.ok(beamEffect);
  assert.equal(beamEffect.branches.length, 3);
  assert.notEqual(beamEffect.branches[0].toY, beamEffect.branches[1].toY);
  assert.notEqual(beamEffect.branches[1].toY, beamEffect.branches[2].toY);
}

function testBeamZoneOnHitHooksThroughRuntime() {
  const target = makeEnemy(4, 0);
  const system = makeSystem([target]);
  const beamSpell = {
    id: 'beam-zone',
    name: 'Beam Zone',
    description: 'test',
    behavior: 'beam',
    targeting: 'cursor',
    element: 'arcane',
    components: [],
    effects: [{ type: 'zone_on_hit', radius: 2, duration: 1, tickInterval: 0.2, damage: 1 }],
    parameters: { damage: 5, duration: 0.3, width: 1, range: 6, color: '#fff' },
    cost: 1,
    cooldown: 0,
    manaCost: 0,
  };

  const result = castSpell(beamSpell, {
    system,
    player: { x: 0, y: 0, facingX: 1, facingY: 0 },
    targetPosition: { x: 6, y: 0 },
    activeSpellInstances: system.activeSpellInstances,
  });

  assert.equal(result.ok, true);
  assert.equal(system.damageEvents.length, 1);
  assert.equal(system.activeSpellInstances.length, 2);
  assert.equal(system.activeSpellInstances.some((entry) => entry.instance.base.behavior === 'zone'), true);
}

function testBeamEmitProjectilesAugmentsInsteadOfReplacing() {
  const target = makeEnemy(4, 0);
  const system = makeSystem([target]);
  const beamSpell = {
    id: 'beam-emit',
    name: 'Beam Emit',
    description: 'test',
    behavior: 'beam',
    targeting: 'cursor',
    element: 'arcane',
    components: ['emit_projectiles'],
    effects: [],
    parameters: { damage: 4, duration: 0.5, width: 1, range: 6, speed: 12, ttl: 0.8, spriteFrames: ['*'] },
    cost: 1,
    cooldown: 0,
    manaCost: 0,
  };

  const result = castSpell(beamSpell, {
    system,
    player: { x: 0, y: 0, facingX: 1, facingY: 0 },
    targetPosition: { x: 6, y: 0 },
    activeSpellInstances: system.activeSpellInstances,
  });

  assert.equal(result.ok, true);
  assert.equal(system.activeSpellInstances.length, 1);
  assert.equal(system.activeSpellInstances[0].instance.base.behavior, 'beam');
  assert.ok(system.spawnedProjectiles.length >= 2);
}

function testZoneZoneOnHitCanCascadeWithDepthCap() {
  const target = makeEnemy(3, 3);
  const system = makeSystem([target]);
  const zoneSpell = {
    id: 'zone-echo',
    name: 'Zone Echo',
    description: 'test',
    behavior: 'zone',
    targeting: 'cursor',
    element: 'poison',
    components: [],
    effects: [{ type: 'zone_on_hit', radius: 1.5, duration: 0.5, tickInterval: 0.2, damage: 1, maxDepth: 1 }],
    parameters: { damage: 2, duration: 0.5, radius: 2, tickInterval: 0.2, color: '#0f0' },
    cost: 1,
    cooldown: 0,
    manaCost: 0,
  };

  const result = castSpell(zoneSpell, {
    system,
    player: { x: 0, y: 0, facingX: 1, facingY: 0 },
    targetPosition: { x: 3, y: 3 },
    activeSpellInstances: system.activeSpellInstances,
  });
  assert.equal(result.ok, true);
  assert.equal(system.activeSpellInstances.length, 1);

  updateSpellInstances(system.activeSpellInstances, 0.2, { system, player: { x: 0, y: 0 } });
  assert.equal(system.activeSpellInstances.length, 2);

  updateSpellInstances(system.activeSpellInstances, 0.2, { system, player: { x: 0, y: 0 } });
  assert.equal(system.activeSpellInstances.length, 2);
}

function testExplicitUnsupportedCombosAreRejected() {
  const beamSplit = validateSpell({
    id: 'beam-split',
    name: 'Beam Split',
    description: 'test',
    behavior: 'beam',
    targeting: 'cursor',
    element: 'arcane',
    components: [],
    effects: [{ type: 'split', count: 2 }],
    parameters: { damage: 3, duration: 0.2, width: 1, range: 5 },
    cost: 1,
  });
  assert.equal(beamSplit.valid, true);

  const zoneEmit = validateSpell({
    id: 'zone-emit',
    name: 'Zone Emit',
    description: 'test',
    behavior: 'zone',
    targeting: 'cursor',
    element: 'arcane',
    components: ['emit_projectiles'],
    effects: [],
    parameters: { damage: 2, duration: 0.5, radius: 2, tickInterval: 0.2 },
    cost: 1,
  });
  assert.equal(zoneEmit.valid, false);
}

function testOrbGravityPullAppliesContinuousForce() {
  const enemy = makeEnemy(5, 0);
  enemy.targetX = enemy.x;
  enemy.targetY = enemy.y;
  enemy.vx = 0;
  enemy.vy = 0;
  const system = makeSystem([enemy]);
  const instance = buildInstance([{ type: 'gravity_pull', radius: 8, force: 4 }]);
  const projectile = SpellEffectSystem.initializeProjectile({ x: 0, y: 0, dx: 1, dy: 0, damage: 8 }, instance);
  SpellEffectSystem.applyEffects('onTick', { projectile, instance, system, dt: 0.1, x: projectile.x, y: projectile.y, damage: projectile.damage });
  assert.ok(enemy.targetX < 5);
}

function testOrbPeriodicExplosionUsesInterval() {
  const enemy = makeEnemy(0.6, 0);
  const system = makeSystem([enemy]);
  const instance = buildInstance([{ type: 'periodic_explosion', interval: 0.5, radius: 1.4, damage: 2 }]);
  const projectile = SpellEffectSystem.initializeProjectile({ x: 0, y: 0, dx: 1, dy: 0, damage: 8 }, instance);
  SpellEffectSystem.applyEffects('onTick', { projectile, instance, system, dt: 0.2, x: projectile.x, y: projectile.y, damage: projectile.damage });
  assert.equal(system.damageEvents.length, 0);
  SpellEffectSystem.applyEffects('onTick', { projectile, instance, system, dt: 0.3, x: projectile.x, y: projectile.y, damage: projectile.damage });
  assert.equal(system.damageEvents.length, 1);
  SpellEffectSystem.applyEffects('onTick', { projectile, instance, system, dt: 0.1, x: projectile.x, y: projectile.y, damage: projectile.damage });
  assert.equal(system.damageEvents.length, 1);
}

function testOrbZoneTrailSpawnsWithIntervalAndDistance() {
  const system = makeSystem();
  const instance = buildInstance([{ type: 'zone_trail', interval: 0.4, minDistance: 0.5, radius: 1.2, duration: 1 }]);
  const projectile = SpellEffectSystem.initializeProjectile({ x: 0, y: 0, dx: 1, dy: 0, damage: 8 }, instance);
  SpellEffectSystem.applyEffects('onTick', { projectile, instance, system, dt: 0.4, x: projectile.x, y: projectile.y, damage: projectile.damage });
  assert.equal(system.activeSpellInstances.length, 0);
  projectile.x = 0.7;
  SpellEffectSystem.applyEffects('onTick', { projectile, instance, system, dt: 0.4, x: projectile.x, y: projectile.y, damage: projectile.damage });
  assert.equal(system.activeSpellInstances.length, 1);
  SpellEffectSystem.applyEffects('onTick', { projectile, instance, system, dt: 0.1, x: projectile.x, y: projectile.y, damage: projectile.damage });
  assert.equal(system.activeSpellInstances.length, 1);
}

function testOrbAugmentationsStackTogether() {
  const enemy = makeEnemy(1, 0);
  enemy.targetX = enemy.x;
  enemy.targetY = enemy.y;
  const system = makeSystem([enemy]);
  const instance = buildInstance([
    { type: 'gravity_pull', radius: 3.5, force: 2.8 },
    { type: 'periodic_explosion', interval: 0.5, radius: 1.5, damage: 2 },
    { type: 'zone_trail', interval: 0.5, minDistance: 0.25, radius: 1.1, duration: 1 },
  ]);
  const projectile = SpellEffectSystem.initializeProjectile({ x: 0, y: 0, dx: 1, dy: 0, damage: 8 }, instance);
  projectile.x = 0.4;
  SpellEffectSystem.applyEffects('onTick', { projectile, instance, system, dt: 0.5, x: projectile.x, y: projectile.y, damage: projectile.damage });
  assert.ok(enemy.targetX < 1);
  assert.equal(system.damageEvents.length, 1);
  assert.equal(system.activeSpellInstances.length, 1);
}

function run() {
  testPierceCountDecrements();
  testSplitDepthProtection();
  testChainAvoidsRehits();
  testBounceCountDecrements();
  testZoneOnHitSpawnsZone();
  testExplodeDamagesNearbyEnemies();
  testProjectileZoneOnHitAndPierceCoexist();
  testBeamContinuousDamageHonorsPerTargetCooldown();
  testBeamForkSpawnsDistinctBranches();
  testBeamZoneOnHitHooksThroughRuntime();
  testBeamEmitProjectilesAugmentsInsteadOfReplacing();
  testZoneZoneOnHitCanCascadeWithDepthCap();
  testExplicitUnsupportedCombosAreRejected();
  testOrbGravityPullAppliesContinuousForce();
  testOrbPeriodicExplosionUsesInterval();
  testOrbZoneTrailSpawnsWithIntervalAndDistance();
  testOrbAugmentationsStackTogether();
  console.log('Spell effect system tests passed.');
}

run();
