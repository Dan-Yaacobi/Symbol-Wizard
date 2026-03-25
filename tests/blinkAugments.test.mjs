import assert from 'node:assert/strict';
import { AbilitySystem } from '../systems/AbilitySystem.js';
import { castSpell, updateSpellInstances } from '../systems/spells/SpellCaster.js';
import { SpellRegistry } from '../data/spells.js';

function createWalkableMap(size = 40) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => ({ walkable: true })));
}

function createSystemHarness() {
  const player = { x: 10, y: 10, mana: 100, maxMana: 100, castCooldown: 0.1 };
  const enemies = [{ x: 13, y: 10, alive: true, radius: 0.8, hp: 40, statusEffects: new Map() }];
  const map = createWalkableMap();
  const system = new AbilitySystem({
    definitions: [SpellRegistry.blink],
    player,
    enemies,
    map,
    camera: { x: 0, y: 0, viewW: 40, viewH: 40 },
    spawnProjectile() {},
    reportDamage() {},
    onEnemySlain() {},
  });
  system.assignAbilityToSlot(0, 'blink');
  return { player, enemies, system };
}

function testBlinkRangeAndMinimumDistance() {
  const spell = {
    ...SpellRegistry.blink,
    parameters: {
      ...SpellRegistry.blink.parameters,
      range: 12,
      minimumRange: 6,
    },
  };
  const system = {
    enemies: [],
    activeSpellInstances: [],
    isWalkable: () => true,
    spawnEffect() {},
  };
  const player = { x: 5, y: 5 };
  const result = castSpell(spell, {
    player,
    origin: player,
    system,
    activeSpellInstances: system.activeSpellInstances,
    targetPosition: { x: 6, y: 5 },
  });

  assert.equal(result.ok, true);
  const movedDistance = Math.hypot(player.x - 5, player.y - 5);
  assert.ok(movedDistance >= 5.95);
}

function testThunderAndShadowBlinkApplyEffects() {
  const spell = {
    ...SpellRegistry.blink,
    components: ['thunder_blink', 'shadow_blink'],
    parameters: {
      ...SpellRegistry.blink.parameters,
      range: 8,
      minimumRange: 6,
      shadowZoneRadius: 3,
      shadowZoneDuration: 2,
      shadowZoneTickInterval: 0.2,
      shadowZoneDamage: 2,
      thunderStunDuration: 1,
    },
  };

  const player = { x: 10, y: 10, facingX: 1, facingY: 0 };
  const enemy = { x: 13, y: 10, alive: true, radius: 0.9, hp: 20, statusEffects: new Map() };
  const system = {
    enemies: [enemy],
    activeSpellInstances: [],
    effects: [],
    isWalkable: () => true,
    spawnEffect(effect) {
      this.effects.push(effect);
    },
    getEntitiesInRadius(x, y, radius) {
      return this.enemies.filter((entry) => Math.hypot(entry.x - x, entry.y - y) <= radius + (entry.radius ?? 0));
    },
    applySpellDamage(target, amount) {
      target.hp -= amount;
      target.hitCount = (target.hitCount ?? 0) + 1;
      return { damageApplied: true, resolution: { triggeredRules: [] } };
    },
    applyStatus(target, type, duration) {
      target.statusEffects.set(type, { type, duration, tickTimer: 0, pulseTimer: 0 });
      return true;
    },
  };

  const result = castSpell(spell, {
    player,
    origin: player,
    system,
    activeSpellInstances: system.activeSpellInstances,
    targetPosition: { x: 18, y: 10 },
  });

  assert.equal(result.ok, true);
  assert.equal(enemy.statusEffects.has('stun'), true);
  assert.ok(system.activeSpellInstances.length >= 1);

  updateSpellInstances(system.activeSpellInstances, 1, { player, system, activeSpellInstances: system.activeSpellInstances });
  assert.ok((enemy.hitCount ?? 0) >= 1);
}


function testBlinkStopsAtLastValidPositionWhenBlocked() {
  const map = createWalkableMap();
  for (let y = 0; y < map.length; y += 1) {
    for (let x = 16; x < map[y].length; x += 1) {
      map[y][x] = { walkable: false };
    }
  }

  const spell = {
    ...SpellRegistry.blink,
    parameters: {
      ...SpellRegistry.blink.parameters,
      range: 12,
      minimumRange: 6,
      blinkStepDistance: 0.25,
    },
  };

  const system = {
    enemies: [],
    activeSpellInstances: [],
    map,
    isWalkable(x, y) {
      return Boolean(this.map?.[Math.round(y)]?.[Math.round(x)]?.walkable);
    },
    spawnEffect() {},
  };
  const player = { x: 10, y: 10, radius: 1.8 };

  const result = castSpell(spell, {
    player,
    origin: player,
    system,
    activeSpellInstances: system.activeSpellInstances,
    targetPosition: { x: 25, y: 10 },
  });

  assert.equal(result.ok, true);
  assert.ok(player.x < 14.6, `expected to stop before wall, got ${player.x}`);
  assert.ok(player.x > 13.2, `expected to advance near obstacle, got ${player.x}`);
}

function testBlinkCanBypassThinObstacleWhenSpaceExists() {
  const map = createWalkableMap();
  map[10][14] = { walkable: false };

  const spell = {
    ...SpellRegistry.blink,
    parameters: {
      ...SpellRegistry.blink.parameters,
      range: 12,
      minimumRange: 6,
      blinkStepDistance: 0.25,
    },
  };

  const system = {
    enemies: [],
    activeSpellInstances: [],
    map,
    isWalkable(x, y) {
      return Boolean(this.map?.[Math.round(y)]?.[Math.round(x)]?.walkable);
    },
    spawnEffect() {},
  };
  const player = { x: 10, y: 10, radius: 0 };

  const result = castSpell(spell, {
    player,
    origin: player,
    system,
    activeSpellInstances: system.activeSpellInstances,
    targetPosition: { x: 22, y: 10 },
  });

  assert.equal(result.ok, true);
  assert.ok(player.x > 20.5, `expected to pass thin obstacle, got ${player.x}`);
}

function testBlinkCanBypassWiderObstacleWithinScaledGap() {
  const map = createWalkableMap();
  for (let x = 14; x <= 18; x += 1) {
    map[10][x] = { walkable: false };
  }

  const spell = {
    ...SpellRegistry.blink,
    parameters: {
      ...SpellRegistry.blink.parameters,
      range: 12,
      minimumRange: 6,
      blinkStepDistance: 0.25,
    },
  };

  const system = {
    enemies: [],
    activeSpellInstances: [],
    map,
    isWalkable(x, y) {
      return Boolean(this.map?.[Math.round(y)]?.[Math.round(x)]?.walkable);
    },
    spawnEffect() {},
  };
  const player = { x: 10, y: 10, radius: 0 };

  const result = castSpell(spell, {
    player,
    origin: player,
    system,
    activeSpellInstances: system.activeSpellInstances,
    targetPosition: { x: 22, y: 10 },
  });

  assert.equal(result.ok, true);
  assert.ok(player.x > 20.5, `expected to pass wider obstacle, got ${player.x}`);
}

function testBlinkUsesUnifiedOccupancyChecksForBlockingObjects() {
  const spell = {
    ...SpellRegistry.blink,
    parameters: {
      ...SpellRegistry.blink.parameters,
      range: 12,
      minimumRange: 6,
      blinkStepDistance: 0.1,
    },
  };

  const house = { x: 16, y: 10, radius: 1.8 };
  const system = {
    enemies: [],
    activeSpellInstances: [],
    isWalkable: () => true,
    canOccupyPosition(entity, x, y) {
      if (!Number.isFinite(entity?.radius)) return true;
      const minDistance = entity.radius + house.radius;
      return Math.hypot(x - house.x, y - house.y) >= minDistance;
    },
    spawnEffect() {},
  };
  const player = { x: 10, y: 10, radius: 0.8 };

  const result = castSpell(spell, {
    player,
    origin: player,
    system,
    activeSpellInstances: system.activeSpellInstances,
    targetPosition: { x: 25, y: 10 },
  });

  assert.equal(result.ok, true);
  const distanceToHouse = Math.hypot(player.x - house.x, player.y - house.y);
  assert.ok(distanceToHouse >= player.radius + house.radius, `expected no overlap with house, got distance ${distanceToHouse}`);
  assert.ok(player.x > 13, `expected to advance close to house, got ${player.x}`);
}

function testBlinkScansPastLongInvalidSegmentToReachLaterValidSpace() {
  const spell = {
    ...SpellRegistry.blink,
    parameters: {
      ...SpellRegistry.blink.parameters,
      range: 12,
      minimumRange: 6,
      blinkStepDistance: 0.1,
    },
  };

  const house = { x: 16, y: 10, radius: 4 };
  const system = {
    enemies: [],
    activeSpellInstances: [],
    isWalkable: () => true,
    canOccupyPosition(entity, x, y) {
      if (!Number.isFinite(entity?.radius)) return true;
      const minDistance = entity.radius + house.radius;
      return Math.hypot(x - house.x, y - house.y) >= minDistance;
    },
    spawnEffect() {},
  };
  const player = { x: 10, y: 10, radius: 0.8 };

  const result = castSpell(spell, {
    player,
    origin: player,
    system,
    activeSpellInstances: system.activeSpellInstances,
    targetPosition: { x: 22, y: 10 },
  });

  assert.equal(result.ok, true);
  const distanceToHouse = Math.hypot(player.x - house.x, player.y - house.y);
  assert.ok(distanceToHouse >= player.radius + house.radius, `expected no overlap with house, got distance ${distanceToHouse}`);
  assert.ok(player.x > 21, `expected to recover beyond long invalid gap, got ${player.x}`);
}

function testDoubleBlinkDefersCooldownUntilSecondCast() {
  const { system, player } = createSystemHarness();
  const blinkWithDouble = {
    ...SpellRegistry.blink,
    components: ['double_blink'],
    parameters: {
      ...SpellRegistry.blink.parameters,
      doubleBlinkWindow: 2,
    },
  };
  system.definitions.set('blink', blinkWithDouble);

  const first = system.castSlot(0, { targetPosition: { x: 20, y: 10 } });
  assert.equal(first.ok, true);
  assert.equal(system.getCooldownRemaining('blink'), 0);

  const second = system.castSlot(0, { targetPosition: { x: 24, y: 10 } });
  assert.equal(second.ok, true);
  assert.ok(system.getCooldownRemaining('blink') > 0);

  const third = system.castSlot(0, { targetPosition: { x: 26, y: 10 } });
  assert.equal(third.ok, false);
  assert.equal(third.reason, 'cooldown');

  player.mana = 100;
  system.cooldowns.set('blink', 0);
  const freshFirst = system.castSlot(0, { targetPosition: { x: 30, y: 10 } });
  assert.equal(freshFirst.ok, true);
  assert.equal(system.getCooldownRemaining('blink'), 0);
  system.tick(2.1, {});
  assert.ok(system.getCooldownRemaining('blink') > 0);
}

function testBlinkSupportsStackedAugmentsTogether() {
  const { system, enemies } = createSystemHarness();
  const blinkStacked = {
    ...SpellRegistry.blink,
    components: ['double_blink', 'thunder_blink', 'shadow_blink'],
    parameters: {
      ...SpellRegistry.blink.parameters,
      range: 12,
      minimumRange: 6,
      thunderStunDuration: 1,
    },
  };
  system.definitions.set('blink', blinkStacked);

  const first = system.castSlot(0, { targetPosition: { x: 20, y: 10 } });
  assert.equal(first.ok, true);
  assert.equal(system.getCooldownRemaining('blink'), 0);
  assert.equal(enemies[0].statusEffects.has('stun'), true);
  assert.ok(system.activeSpellInstances.length > 0);

  const lightningTrailEffect = system.effects.find((effect) => effect?.type === 'lightning');
  assert.ok(Array.isArray(lightningTrailEffect?.points));
  assert.ok(lightningTrailEffect.points.length >= 2);

  const second = system.castSlot(0, { targetPosition: { x: 24, y: 10 } });
  assert.equal(second.ok, true);
  assert.ok(system.getCooldownRemaining('blink') > 0);
}

function run() {
  testBlinkRangeAndMinimumDistance();
  testThunderAndShadowBlinkApplyEffects();
  testBlinkStopsAtLastValidPositionWhenBlocked();
  testBlinkCanBypassThinObstacleWhenSpaceExists();
  testBlinkCanBypassWiderObstacleWithinScaledGap();
  testBlinkUsesUnifiedOccupancyChecksForBlockingObjects();
  testBlinkScansPastLongInvalidSegmentToReachLaterValidSpace();
  testDoubleBlinkDefersCooldownUntilSecondCast();
  testBlinkSupportsStackedAugmentsTogether();
  console.log('blinkAugments.test: ok');
}

run();
