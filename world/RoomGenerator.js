import { TerrainGenerator } from './TerrainGenerator.js';
import { ObjectPlacementSystem } from './ObjectPlacementSystem.js';
import { buildCollisionMap } from './RuntimeSystems.js';
import { RoomPlanner } from './RoomPlanner.js';
import { ExitAnchorSystem } from './ExitAnchorSystem.js';
import { PathGenerator } from './PathGenerator.js';
import { ExitTriggerSystem } from './ExitTriggerSystem.js';
import { RoomRepairSystem } from './RoomRepairSystem.js';
import { GenerationValidator } from './validation/GenerationValidator.js';
import { resolvePathGenerationConfig } from './PathGenerationConfig.js';
import { resolveWorldGenerationConfig } from './WorldGenerationConfig.js';
import { resolveObjectGenerationConfig } from './ObjectGenerationConfig.js';
import { spawnEnemiesForRoom } from './EnemySpawnSystem.js';
import { buildRoomTransitionCache } from './TransitionCache.js';
import { RoomPlanCompiler } from './room/RoomPlanCompiler.js';

function nowMs() {
  return globalThis?.performance?.now?.() ?? Date.now();
}

function logGenerationPhase(roomId, phase, startMs, endMs, details = {}) {
  console.info('[GenerationTiming]', {
    roomId,
    phase,
    startTimestamp: new Date().toISOString(),
    startMs: Number(startMs.toFixed(3)),
    endMs: Number(endMs.toFixed(3)),
    durationMs: Number((endMs - startMs).toFixed(3)),
    ...details,
  });
}

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mergeMask(target, source) {
  for (const key of source) target.add(key);
}

function expandCircularMask(targetMask, points, radius) {
  if (!Array.isArray(points) || radius <= 0) return;
  for (const point of points) {
    for (let oy = -radius; oy <= radius; oy += 1) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        if ((ox * ox) + (oy * oy) > radius * radius) continue;
        targetMask.add(`${point.x + ox},${point.y + oy}`);
      }
    }
  }
}

function buildPathAnchors(pathMask) {
  const anchors = [];
  for (const key of pathMask) {
    const [x, y] = key.split(',').map(Number);
    anchors.push({ x, y });
  }
  return anchors;
}

function buildPathIntersections(pathMask) {
  const intersections = [];
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const key of pathMask) {
    const [x, y] = key.split(',').map(Number);
    let connected = 0;
    for (const [dx, dy] of neighbors) {
      if (pathMask.has(`${x + dx},${y + dy}`)) connected += 1;
    }
    if (connected >= 3) intersections.push({ x, y });
  }
  return intersections;
}

export class RoomGenerator {
  constructor({ roomWidth = 240, roomHeight = 160, biomeConfig = null, runtimeConfig = null } = {}) {
    this.roomWidth = roomWidth;
    this.roomHeight = roomHeight;
    this.biomeConfig = biomeConfig;
    this.runtimeConfig = runtimeConfig;
    this.objectPlacementSystem = new ObjectPlacementSystem();
    this.roomPlanner = new RoomPlanner();
    this.exitAnchorSystem = new ExitAnchorSystem();
    this.pathGenerator = new PathGenerator();
    this.exitTriggerSystem = new ExitTriggerSystem();
    this.roomRepairSystem = new RoomRepairSystem();
  }

  generate(roomNode, { rooms, roomGraph } = {}) {
    const generationStart = nowMs();
    const rng = createRng(roomNode.seed >>> 0);
    const biomeType = roomNode.biomeType ?? 'forest';
    const useForestSizing = biomeType === 'forest';
    const worldGenConfig = resolveWorldGenerationConfig(this.runtimeConfig);
    const roomWidth = useForestSizing ? Math.max(this.roomWidth, worldGenConfig.forestRoomWidth) : this.roomWidth;
    const roomHeight = useForestSizing ? Math.max(this.roomHeight, worldGenConfig.forestRoomHeight) : this.roomHeight;

    const effectiveBiomeConfig = roomNode.biomeConfig ?? this.biomeConfig;
    const terrainGenerator = new TerrainGenerator({ roomWidth, roomHeight });
    const graphNode = roomNode;
    const roomPlan = RoomPlanCompiler.compile(graphNode, graphNode.connections ?? []);
    const plan = this.roomPlanner.createPlan({ roomNode, width: roomWidth, height: roomHeight, biomeType });
    const reservations = this.exitAnchorSystem.reserve(plan);
    const pathConfig = resolvePathGenerationConfig(this.runtimeConfig);
    const objectConfig = resolveObjectGenerationConfig(this.runtimeConfig);

    const mapGenerationStart = nowMs();
    const { grid } = terrainGenerator.initializeTiles(roomNode, rng, effectiveBiomeConfig);

    const { roadMask, debugEvents: pathEvents } = this.pathGenerator.carveRequiredPaths({
      grid,
      plan,
      reservations,
      rng,
      pathConfig,
    });

    const clearingMask = terrainGenerator.carveForestClearings(grid, rng, biomeType, roadMask);
    logGenerationPhase(roomNode.id, 'map_generation', mapGenerationStart, nowMs(), {
      width: roomWidth,
      height: roomHeight,
      pathTiles: roadMask.size,
      clearingTiles: clearingMask.size,
    });

    const protectedMask = new Set();
    mergeMask(protectedMask, roadMask);
    mergeMask(protectedMask, reservations.noDecorMask);
    mergeMask(protectedMask, clearingMask);

    const allAnchors = [...Object.values(plan.exitAnchors), ...Object.values(plan.entranceAnchors)];
    const pathIntersections = buildPathIntersections(roadMask);
    expandCircularMask(protectedMask, allAnchors.map((anchor) => ({ x: anchor.x, y: anchor.y })), objectConfig.minDistanceFromExit);
    expandCircularMask(protectedMask, pathIntersections, objectConfig.intersectionClearingRadius);

    const safetyConfig = {
      pathTiles: roadMask,
      pathAnchors: buildPathAnchors(roadMask),
      exitAnchors: Object.values(plan.exitAnchors),
      entranceAnchors: Object.values(plan.entranceAnchors),
      minDistanceFromPath: objectConfig.minDistanceFromPath ?? pathConfig.minDistanceFromPath,
      minDistanceFromExit: objectConfig.minDistanceFromExit ?? pathConfig.minDistanceFromExit,
      minDistanceFromMapEdge: objectConfig.minDistanceFromMapEdge,
      objectDensity: objectConfig.objectDensity,
      clusterDensity: objectConfig.clusterDensity,
      clusterRadiusMultiplier: objectConfig.clusterRadiusMultiplier,
      maxAttemptsPerObjectType: objectConfig.maxAttemptsPerObjectType,
    };

    const occupiedTiles = new Set();
    const objectBlockedMask = new Set(protectedMask);
    const objectPlacementStart = nowMs();
    const landmarks = this.objectPlacementSystem.placeLandmarks({
      tiles: grid,
      rng,
      occupiedTiles,
      blockedMask: objectBlockedMask,
      roomId: roomNode.id,
      biomeType,
      mapType: biomeType,
      safetyConfig,
    });

    expandCircularMask(
      objectBlockedMask,
      landmarks.map((landmark) => ({ x: landmark.x, y: landmark.y })),
      objectConfig.landmarkClearingRadius,
    );

    const objects = this.objectPlacementSystem.placeObjects({
      tiles: grid,
      rng,
      occupiedTiles,
      blockedMask: objectBlockedMask,
      roomId: roomNode.id,
      biomeType,
      mapType: biomeType,
      safetyConfig,
    });

    terrainGenerator.decorate(grid, rng, objectBlockedMask);
    const objectDebug = this.objectPlacementSystem.getDebugInfo();
    logGenerationPhase(roomNode.id, 'object_placement', objectPlacementStart, nowMs(), {
      landmarkCount: landmarks.length,
      objectCount: objects.length,
      placementProfile: objectDebug.profiling ?? null,
    });

    const triggers = this.exitTriggerSystem.build({ plan });

    const validationContext = {
      roomNode,
      rooms,
      roomGraph,
      plan,
      grid,
      triggers,
      objects: [...objects, ...landmarks],
      requiredAnchors: [...Object.values(plan.exitAnchors), ...Object.values(plan.entranceAnchors)],
    };
    let validatorResult = GenerationValidator.validateRoom({
      id: roomNode.id,
      tiles: grid,
      exits: triggers.exits,
      entrances: plan.entranceAnchors,
    }, validationContext);
    let validation = {
      valid: validatorResult.valid,
      errors: validatorResult.issues.map((issue) => ({ type: issue.type, ...(issue.data ?? {}), severity: issue.severity })),
      debugEvents: validatorResult.issues.length ? [{ type: 'VALIDATION_FAILED', roomId: roomNode.id, issues: validatorResult.issues }] : [],
    };
    const logValidatorSummary = (result) => {
      const fatalCount = result.issues.filter((issue) => issue.severity === 'fatal').length;
      const repairableCount = result.issues.filter((issue) => issue.severity === 'repairable').length;
      console.info('[Validator]', {
        roomId: roomNode.id,
        valid: result.valid,
        fatalCount,
        repairableCount,
      });
      if (fatalCount > 0) console.error('[Validator] FATAL room invalid', { roomId: roomNode.id, fatalCount });
      return { fatalCount, repairableCount };
    };
    const counts = logValidatorSummary(validatorResult);

    let repairEvents = [];
    if (counts.repairableCount > 0 && counts.fatalCount === 0) {
      const repair = this.roomRepairSystem.repair({
        grid,
        plan,
        errors: validation.errors,
        roadMask,
        validationResult: validatorResult,
      });
      repairEvents = repair.debugEvents;
      if (repair.applied) {
        validatorResult = GenerationValidator.validateRoom({
          id: roomNode.id,
          tiles: grid,
          exits: triggers.exits,
          entrances: plan.entranceAnchors,
        }, validationContext);
        validation = {
          valid: validatorResult.valid,
          errors: validatorResult.issues.map((issue) => ({ type: issue.type, ...(issue.data ?? {}), severity: issue.severity })),
          debugEvents: validatorResult.issues.length ? [{ type: 'VALIDATION_FAILED', roomId: roomNode.id, issues: validatorResult.issues }] : [],
        };
        logValidatorSummary(validatorResult);
      }
    }

    const placedObjects = [...objects, ...landmarks];
    const collisionMap = buildCollisionMap(grid, placedObjects);

    const roomBase = {
      id: roomNode.id,
      tiles: grid,
      collisionMap,
      objects: placedObjects,
      entrances: structuredClone(plan.entranceAnchors),
      exits: structuredClone(triggers.exits),
    };

    const enemySpawnStart = nowMs();
    const spawnedEnemies = spawnEnemiesForRoom(roomBase, {
      biomeType,
      runtimeConfig: this.runtimeConfig,
      rng,
      pathMask: roadMask,
      entranceAnchors: Object.values(plan.entranceAnchors),
      exitAnchors: Object.values(plan.exitAnchors),
      spawnPoint: plan.spawnArea.center,
      roomDepth: roomNode.depth ?? 0,
    });
    logGenerationPhase(roomNode.id, 'enemy_spawning', enemySpawnStart, nowMs(), {
      enemyCount: spawnedEnemies.enemies?.length ?? 0,
    });
    logGenerationPhase(roomNode.id, 'room_generation_total', generationStart, nowMs());

    const room = {
      id: roomNode.id,
      tiles: grid,
      collisionMap,
      entities: spawnedEnemies.enemies,
      objects: placedObjects,
      entrances: structuredClone(plan.entranceAnchors),
      exits: structuredClone(triggers.exits),
      exitCorridors: structuredClone(triggers.exitCorridors),
      debugOverlay: {
        exitAnchors: Object.values(plan.exitAnchors).map((anchor) => ({ x: anchor.x, y: anchor.y })),
        landingTiles: [...Object.values(plan.exitAnchors), ...Object.values(plan.entranceAnchors)].map((anchor) => ({ x: anchor.landingX, y: anchor.landingY })),
        reservedCorridorTiles: Object.values(plan.reservedCorridors).flat(),
        objectClusterCenters: objectDebug.clusterCenters,
        objectBlockedPlacementTiles: objectDebug.blockedPlacementTiles,
        objectOccupiedFootprintTiles: objectDebug.occupiedFootprintTiles,
        objectClearanceZones: objectDebug.objectClearanceZones,
        enemySpawnPoints: spawnedEnemies.debug.enemySpawnPoints,
        enemyGroupCenters: spawnedEnemies.debug.enemyGroupCenters,
        enemySpawnRejections: spawnedEnemies.debug.enemySpawnRejections ?? [],
        enemyEncounterZones: spawnedEnemies.debug.encounterZones ?? [],
        enemyEncounterSummaries: spawnedEnemies.debug.encounterZoneSummaries ?? [],
        enemySpawnSummary: spawnedEnemies.debug.enemySpawnSummary ?? [],
        entranceSafetyAnchors: spawnedEnemies.debug.entranceSafetyAnchors,
        exitSafetyAnchors: spawnedEnemies.debug.exitSafetyAnchors,
        pathSafetyTiles: spawnedEnemies.debug.pathSafetyTiles,
        enemySafetySettings: spawnedEnemies.debug.safetySettings,
      },
      generationDebug: {
        roomGraph: roomGraph?.[roomNode.id] ?? {},
        events: [
          ...plan.debugEvents,
          ...reservations.debugEvents,
          ...pathEvents,
          ...triggers.debugEvents,
          ...validation.debugEvents,
          ...repairEvents,
        ],
        validationErrors: validation.errors,
        validatorIssues: validatorResult.issues,
      },
      state: {
        visited: roomNode.state?.visited ?? false,
      },
      __roomPlan: roomPlan,
      isGenerationValid: validatorResult.valid,
    };

    const postRealizationValidation = GenerationValidator.validateRoom(room, validationContext);
    console.info('[Validator]', {
      roomId: roomNode.id,
      valid: postRealizationValidation.valid,
      fatalCount: postRealizationValidation.issues.filter((issue) => issue.severity === 'fatal').length,
      repairableCount: postRealizationValidation.issues.filter((issue) => issue.severity === 'repairable').length,
    });
    if (postRealizationValidation.issues.some((issue) => issue.severity === 'fatal')) {
      console.error('[Validator] FATAL room invalid', { roomId: roomNode.id, phase: 'post_realizer' });
      room.isGenerationValid = false;
    }

    buildRoomTransitionCache(room, { pathMask: roadMask, blockedMask: objectBlockedMask });
    return room;
  }
}
