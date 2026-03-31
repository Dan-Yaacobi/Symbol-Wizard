const STORAGE_KEY = 'symbolWizard.devtools.runtimeConfig.v1';
const PRESETS_KEY = 'symbolWizard.devtools.runtimePresets.v1';
const PINNED_KEY = 'symbolWizard.devtools.pinnedFields.v1';

export const DEFAULT_CONFIG = {
  gameplay: {
    compactMode: false,
    showOnlyDirty: false,
  },
  player: {
    speed: 20,
    acceleration: 90,
    deceleration: 110,
    collisionSlide: true,
    castDuration: 0.2,
    animationSpeedMultiplier: 1,
    spriteBobAmount: 0,
    glyphOffsetX: 0,
    glyphOffsetY: 0,
  },
  enemies: {
    aggroRange: 26,
    disengageRange: 40,
    detectRadius: 8,
    chaseRadius: 18,
    aggroMemory: 2.5,
    aggroChainRadius: 8,
    swarmAggroRadius: 10,
    swarmAggroChainDepth: 2,
    moveSpeedMultiplier: 1,
    attackRangeMultiplier: 1,
    attackCooldownMultiplier: 1,
    rangedAttackRange: 10,
    rangedCooldown: 1.2,
    rangedOrbitRadius: 8,
    rangedOrbitArrivalThreshold: 0.75,
    rangedOrbitPlayerDriftThreshold: 1.5,
    rangedOrbitWaitDuration: 0.35,
    tankSpeedMultiplier: 0.6,
    flankerOffsetDistance: 5,
    chaseStopDistance: 0.1,
    hitFlashDuration: 0.12,
    animationSpeedMultiplier: 1,
  },
  combat: {
    projectileSpeedMultiplier: 1,
    projectileLifetimeMultiplier: 1,
    projectileCollisionRadius: 1.1,
    damageTextSpeed: 0.5,
    damageTextLifetimeMin: 1.6,
    damageTextLifetimeMax: 1.8,
    damageTextVerticalDrift: 3.8,
    critTextScale: 3.05,
    critPopDuration: 0.14,
  },
  camera: {
    smoothing: 0.14,
    zoom: 1,
    pixelSnapping: true,
    lookAhead: 0,
    deadzone: 0,
    shakeIntensityMultiplier: 1,
  },
  visual: {
    uiScale: 1,
    effectDurationMultiplier: 1,
    hitFlashDuration: 0.12,
    globalGlyphOffsetX: 0,
    globalGlyphOffsetY: 0,
    layerOpacityEntities: 1,
    layerOpacityEffects: 1,
  },
  palette: {
    playerPrimary: '#e6d6ff',
    playerAccent: '#ffd67a',
    enemySlime: '#8ee2a8',
    enemySkeleton: '#dbe6f6',
    worldFloorFg: '#516078',
    worldWallFg: '#8f9bb0',
    damageColor: '#ff7f87',
    critColor: '#ff8ef0',
    healColor: '#84d79a',
    uiText: '#d6e6ff',
    worldBackground: '#0b1016',
  },
  sprites: {
    playerWalkFrameDuration: 0.12,
    playerIdleFrameDuration: 0.45,
    enemyWalkFrameDuration: 0.14,
    enemyIdleFrameDuration: 0.32,
    projectileFrameDuration: 0.06,
    animationPlaybackSpeed: 1,
    previewState: 'none',
    pauseOnFrame: -1,
    manualFrame: 0,
  },
  debug: {
    overlaysEnabled: false,
    showStatsHud: false,
    collisionBounds: false,
    entityFootprints: false,
    attackRanges: false,
    aggroRanges: false,
    projectileCollision: false,
    chaseLines: false,
    cameraCenter: false,
    grid: false,
    selectedEntity: false,
    selectedTile: false,
    layerLabels: false,
    facingMarker: false,
    facingLabels: false,
    logEnemyFacing: false,
    showExitAnchors: false,
    showReservedCorridors: false,
    showLandingTiles: false,
    showEnemySpawnZones: false,
    showEnemySpawnRejections: false,
    showAntDenTriggerRadius: false,
    showAntDenSpawnDebug: false,
    showObjectClearanceRadius: false,
    logAntDenSpawns: false,
    logTransitionPerf: false,
    logBackgroundPrewarmPerf: false,
  },
  pathGeneration: {
    baseTrailRadius: 2,
    turnTrailRadius: 3,
    exitTrailRadius: 3,
    wanderChance: 0.25,
    exitClearingRadius: 3,
    minDistanceFromPath: 2,
    minDistanceFromExit: 3,
  },
  worldGeneration: {
    forestRoomWidth: 120,
    forestRoomHeight: 120,
  },
  objectGeneration: {
    objectDensity: 1,
    clusterDensity: 1,
    minDistanceFromPath: 2,
    minDistanceFromExit: 3,
    minDistanceFromMapEdge: 2,
    clusterRadiusMultiplier: 1,
    maxAttemptsPerObjectType: 100,
  },
  enemyGeneration: {
    enemyDensityFactor: 0.0035,
    minEnemies: 3,
    maxEnemies: 25,
    groupSpawnChance: 0.25,
    swarmGroupMin: 4,
    swarmGroupMax: 7,
    minDistanceFromEntrance: 6,
    minDistanceFromExit: 5,
    minDistanceFromPath: 2,
    minDistanceBetweenEnemyGroups: 10,
    minDistanceBetweenEnemies: 2,
    maxSpawnAttempts: 100,
  },
};

export const CONFIG_FIELDS = [
  { path: 'gameplay.compactMode', label: 'Compact Panel Mode', section: 'Gameplay', type: 'boolean', tooltip: 'Reduce spacing in the dev panel.' },
  { path: 'gameplay.showOnlyDirty', label: 'Show only changed values', section: 'Gameplay', type: 'boolean' },
  { path: 'player.speed', label: 'Move Speed', section: 'Player', type: 'number', min: 1, max: 60, step: 0.5 },
  { path: 'player.acceleration', label: 'Acceleration', section: 'Player', type: 'number', min: 10, max: 300, step: 1 },
  { path: 'player.deceleration', label: 'Deceleration', section: 'Player', type: 'number', min: 10, max: 300, step: 1 },
  { path: 'player.castDuration', label: 'Cast Duration', section: 'Player', type: 'number', min: 0.05, max: 2, step: 0.01 },
  { path: 'player.animationSpeedMultiplier', label: 'Animation Speed Mult', section: 'Player', type: 'number', min: 0.25, max: 4, step: 0.05 },
  { path: 'enemies.aggroRange', label: 'Aggro Range', section: 'Enemies', type: 'number', min: 2, max: 160, step: 0.5 },
  { path: 'enemies.disengageRange', label: 'Disengage Range', section: 'Enemies', type: 'number', min: 2, max: 120, step: 0.5 },
  { path: 'enemies.moveSpeedMultiplier', label: 'Move Speed Mult', section: 'Enemies', type: 'number', min: 0.2, max: 3, step: 0.05 },
  { path: 'enemies.attackRangeMultiplier', label: 'Attack Range Mult', section: 'Enemies', type: 'number', min: 0.3, max: 3, step: 0.05 },
  { path: 'enemies.attackCooldownMultiplier', label: 'Attack Cooldown Mult', section: 'Enemies', type: 'number', min: 0.2, max: 3, step: 0.05 },
  { path: 'enemies.detectRadius', label: 'Detect Radius', section: 'Enemy Behavior', type: 'number', min: 2, max: 160, step: 0.5 },
  { path: 'enemies.chaseRadius', label: 'Chase Radius', section: 'Enemy Behavior', type: 'number', min: 2, max: 120, step: 0.5 },
  { path: 'enemies.aggroMemory', label: 'Aggro Memory (s)', section: 'Enemy Behavior', type: 'number', min: 0, max: 10, step: 0.1 },
  { path: 'enemies.aggroChainRadius', label: 'Aggro Chain Radius', section: 'Enemy Behavior', type: 'number', min: 1, max: 24, step: 0.5 },
  { path: 'enemies.swarmAggroRadius', label: 'Swarm Aggro Radius', section: 'Enemy Behavior', type: 'number', min: 1, max: 24, step: 0.5 },
  { path: 'enemies.swarmAggroChainDepth', label: 'Swarm Aggro Chain Depth', section: 'Enemy Behavior', type: 'number', min: 0, max: 6, step: 1 },
  { path: 'enemies.rangedAttackRange', label: 'Ranged Attack Range', section: 'Enemy Behavior', type: 'number', min: 2, max: 30, step: 0.5 },
  { path: 'enemies.rangedCooldown', label: 'Ranged Cooldown (s)', section: 'Enemy Behavior', type: 'number', min: 0.1, max: 5, step: 0.1 },
  { path: 'enemies.rangedOrbitRadius', label: 'Ranged Orbit Radius', section: 'Enemy Behavior', type: 'number', min: 1, max: 20, step: 0.5 },
  { path: 'enemies.rangedOrbitArrivalThreshold', label: 'Ranged Orbit Arrival Threshold', section: 'Enemy Behavior', type: 'number', min: 0.1, max: 5, step: 0.05 },
  { path: 'enemies.rangedOrbitPlayerDriftThreshold', label: 'Ranged Orbit Drift Threshold', section: 'Enemy Behavior', type: 'number', min: 0.1, max: 10, step: 0.1 },
  { path: 'enemies.rangedOrbitWaitDuration', label: 'Ranged Orbit Wait (s)', section: 'Enemy Behavior', type: 'number', min: 0, max: 3, step: 0.05 },
  { path: 'enemyGeneration.swarmGroupMin', label: 'Swarm Group Min', section: 'Enemy Behavior', type: 'number', min: 1, max: 12, step: 1 },
  { path: 'enemyGeneration.swarmGroupMax', label: 'Swarm Group Max', section: 'Enemy Behavior', type: 'number', min: 1, max: 16, step: 1 },
  { path: 'enemies.tankSpeedMultiplier', label: 'Tank Speed Multiplier', section: 'Enemy Behavior', type: 'number', min: 0.2, max: 1.5, step: 0.05 },
  { path: 'enemies.flankerOffsetDistance', label: 'Flanker Offset Distance', section: 'Enemy Behavior', type: 'number', min: 1, max: 16, step: 0.5 },
  { path: 'enemies.hitFlashDuration', label: 'Hit Flash Duration', section: 'Enemies', type: 'number', min: 0.01, max: 1, step: 0.01 },
  { path: 'combat.projectileSpeedMultiplier', label: 'Projectile Speed Mult', section: 'Combat', type: 'number', min: 0.2, max: 4, step: 0.05 },
  { path: 'combat.projectileLifetimeMultiplier', label: 'Projectile Lifetime Mult', section: 'Combat', type: 'number', min: 0.2, max: 4, step: 0.05 },
  { path: 'combat.projectileCollisionRadius', label: 'Projectile Collision Radius', section: 'Combat', type: 'number', min: 0.2, max: 4, step: 0.05 },
  { path: 'combat.damageTextSpeed', label: 'Damage Text Speed', section: 'Combat', type: 'number', min: 0.1, max: 40, step: 0.1 },
  { path: 'combat.damageTextLifetimeMin', label: 'Damage Text Lifetime Min', section: 'Combat', type: 'number', min: 0.1, max: 5, step: 0.05 },
  { path: 'combat.damageTextLifetimeMax', label: 'Damage Text Lifetime Max', section: 'Combat', type: 'number', min: 0.1, max: 5, step: 0.05 },
  { path: 'combat.damageTextVerticalDrift', label: 'Damage Text Vertical Offset', section: 'Combat', type: 'number', min: 0, max: 20, step: 0.1 },
  { path: 'combat.critTextScale', label: 'Crit Text Scale', section: 'Combat', type: 'number', min: 1, max: 6, step: 0.05 },
  { path: 'combat.critPopDuration', label: 'Crit Pop Duration', section: 'Combat', type: 'number', min: 0.01, max: 1, step: 0.01 },
  { path: 'camera.smoothing', label: 'Smoothing', section: 'Camera', type: 'number', min: 0, max: 1, step: 0.01 },
  { path: 'camera.zoom', label: 'Zoom', section: 'Camera', type: 'number', min: 0.5, max: 3, step: 0.05 },
  { path: 'camera.pixelSnapping', label: 'Pixel Snapping', section: 'Camera', type: 'boolean' },
  { path: 'camera.shakeIntensityMultiplier', label: 'Shake Intensity Mult', section: 'Camera', type: 'number', min: 0, max: 4, step: 0.05 },
  { path: 'visual.uiScale', label: 'UI Scale', section: 'Visual', type: 'number', min: 0.7, max: 1.8, step: 0.05 },
  { path: 'visual.effectDurationMultiplier', label: 'Effect Duration Mult', section: 'Visual', type: 'number', min: 0.25, max: 3, step: 0.05 },
  { path: 'visual.globalGlyphOffsetX', label: 'Glyph Offset X', section: 'Visual', type: 'number', min: -4, max: 4, step: 0.25 },
  { path: 'visual.globalGlyphOffsetY', label: 'Glyph Offset Y', section: 'Visual', type: 'number', min: -4, max: 4, step: 0.25 },
  { path: 'palette.playerPrimary', label: 'Player Primary', section: 'Palette / Colors', type: 'color' },
  { path: 'palette.playerAccent', label: 'Player Accent', section: 'Palette / Colors', type: 'color' },
  { path: 'palette.enemySlime', label: 'Enemy Slime', section: 'Palette / Colors', type: 'color' },
  { path: 'palette.enemySkeleton', label: 'Enemy Skeleton', section: 'Palette / Colors', type: 'color' },
  { path: 'palette.worldFloorFg', label: 'Floor FG', section: 'Palette / Colors', type: 'color' },
  { path: 'palette.worldWallFg', label: 'Wall FG', section: 'Palette / Colors', type: 'color' },
  { path: 'palette.damageColor', label: 'Damage Color', section: 'Palette / Colors', type: 'color' },
  { path: 'palette.critColor', label: 'Crit Color', section: 'Palette / Colors', type: 'color' },
  { path: 'palette.healColor', label: 'Heal Color', section: 'Palette / Colors', type: 'color' },
  { path: 'palette.uiText', label: 'UI Text', section: 'Palette / Colors', type: 'color' },
  { path: 'palette.worldBackground', label: 'World Background', section: 'Palette / Colors', type: 'color' },
  { path: 'sprites.playerWalkFrameDuration', label: 'Player Walk Frame Duration', section: 'Sprites / Animation', type: 'number', min: 0.01, max: 1, step: 0.01 },
  { path: 'sprites.playerIdleFrameDuration', label: 'Player Idle Frame Duration', section: 'Sprites / Animation', type: 'number', min: 0.01, max: 2, step: 0.01 },
  { path: 'sprites.enemyWalkFrameDuration', label: 'Enemy Walk Frame Duration', section: 'Sprites / Animation', type: 'number', min: 0.01, max: 1, step: 0.01 },
  { path: 'sprites.enemyIdleFrameDuration', label: 'Enemy Idle Frame Duration', section: 'Sprites / Animation', type: 'number', min: 0.01, max: 2, step: 0.01 },
  { path: 'sprites.projectileFrameDuration', label: 'Projectile Frame Duration', section: 'Sprites / Animation', type: 'number', min: 0.01, max: 1, step: 0.01 },
  { path: 'sprites.animationPlaybackSpeed', label: 'Animation Playback Speed', section: 'Sprites / Animation', type: 'number', min: 0.1, max: 4, step: 0.05 },
  { path: 'sprites.previewState', label: 'Preview State', section: 'Sprites / Animation', type: 'enum', options: ['none', 'idle', 'walk', 'cast', 'attack'] },
  { path: 'sprites.pauseOnFrame', label: 'Pause on Frame', section: 'Sprites / Animation', type: 'number', min: -1, max: 10, step: 1, tooltip: '-1 disables frame lock.' },
  { path: 'debug.collisionBounds', label: 'Collision Bounds', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.entityFootprints', label: 'Entity Footprints', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.attackRanges', label: 'Attack Ranges', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.aggroRanges', label: 'Aggro Ranges', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.projectileCollision', label: 'Projectile Collision', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.chaseLines', label: 'Chase Lines', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.cameraCenter', label: 'Camera Center / Deadzone', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.grid', label: 'Grid Overlay', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.selectedEntity', label: 'Selected Entity Highlight', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.selectedTile', label: 'Selected Tile Highlight', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.layerLabels', label: 'Render Layer Labels', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.facingMarker', label: 'Facing Marker', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.facingLabels', label: 'Facing Labels', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.logEnemyFacing', label: 'Log Enemy Facing', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.showExitAnchors', label: 'Show Exit Anchors', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.showReservedCorridors', label: 'Show Reserved Corridors', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.showLandingTiles', label: 'Show Landing Tiles', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.showAntDenTriggerRadius', label: 'Show Ant Den Trigger Radius', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.showAntDenSpawnDebug', label: 'Show Ant Den Spawn Debug', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.showObjectClearanceRadius', label: 'Show Object Clearance Radius', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.logAntDenSpawns', label: 'Log Ant Den Spawn Count', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.logTransitionPerf', label: 'Log Transition Perf', section: 'Performance', type: 'boolean' },
  { path: 'debug.logBackgroundPrewarmPerf', label: 'Log Background Prewarm Perf', section: 'Performance', type: 'boolean' },
  { path: 'debug.overlaysEnabled', label: 'Master Overlay Toggle', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.showStatsHud', label: 'Compact Stats HUD', section: 'Performance', type: 'boolean' },
  { path: 'pathGeneration.baseTrailRadius', label: 'Base Trail Radius', section: 'Path Generation', type: 'number', min: 1, max: 8, step: 1 },
  { path: 'pathGeneration.turnTrailRadius', label: 'Turn Trail Radius', section: 'Path Generation', type: 'number', min: 1, max: 10, step: 1 },
  { path: 'pathGeneration.exitTrailRadius', label: 'Exit Trail Radius', section: 'Path Generation', type: 'number', min: 1, max: 12, step: 1 },
  { path: 'pathGeneration.wanderChance', label: 'Wander Chance', section: 'Path Generation', type: 'number', min: 0, max: 0.9, step: 0.01 },
  { path: 'pathGeneration.exitClearingRadius', label: 'Exit Clearing Radius', section: 'Path Generation', type: 'number', min: 1, max: 12, step: 1 },
  { path: 'pathGeneration.minDistanceFromPath', label: 'Min Distance From Path', section: 'Path Generation', type: 'number', min: 0, max: 12, step: 1 },
  { path: 'pathGeneration.minDistanceFromExit', label: 'Min Distance From Exit', section: 'Path Generation', type: 'number', min: 0, max: 16, step: 1 },
  { path: 'worldGeneration.forestRoomWidth', label: 'Forest Room Min Width', section: 'World / Generation', type: 'number', min: 40, max: 320, step: 1 },
  { path: 'worldGeneration.forestRoomHeight', label: 'Forest Room Min Height', section: 'World / Generation', type: 'number', min: 40, max: 320, step: 1 },
  { path: 'objectGeneration.objectDensity', label: 'Object Density', section: 'Object Generation', type: 'number', min: 0.1, max: 3, step: 0.05 },
  { path: 'objectGeneration.clusterDensity', label: 'Cluster Density', section: 'Object Generation', type: 'number', min: 0.1, max: 3, step: 0.05 },
  { path: 'objectGeneration.minDistanceFromPath', label: 'Min Distance From Path', section: 'Object Generation', type: 'number', min: 0, max: 12, step: 1 },
  { path: 'objectGeneration.minDistanceFromExit', label: 'Min Distance From Exit', section: 'Object Generation', type: 'number', min: 0, max: 16, step: 1 },
  { path: 'objectGeneration.minDistanceFromMapEdge', label: 'Min Distance From Map Edge', section: 'Object Generation', type: 'number', min: 0, max: 16, step: 1 },
  { path: 'objectGeneration.clusterRadiusMultiplier', label: 'Cluster Radius Multiplier', section: 'Object Generation', type: 'number', min: 0.25, max: 4, step: 0.05 },
  { path: 'objectGeneration.maxAttemptsPerObjectType', label: 'Max Attempts Per Type', section: 'Object Generation', type: 'number', min: 10, max: 1000, step: 10 },
  { path: 'enemyGeneration.enemyDensityFactor', label: 'Enemy Density Factor', section: 'Enemy Generation', type: 'number', min: 0.0005, max: 0.05, step: 0.0005 },
  { path: 'enemyGeneration.minEnemies', label: 'Min Enemies', section: 'Enemy Generation', type: 'number', min: 0, max: 60, step: 1 },
  { path: 'enemyGeneration.maxEnemies', label: 'Max Enemies', section: 'Enemy Generation', type: 'number', min: 1, max: 100, step: 1 },
  { path: 'enemyGeneration.groupSpawnChance', label: 'Group Spawn Chance', section: 'Enemy Generation', type: 'number', min: 0, max: 1, step: 0.01 },
  { path: 'enemyGeneration.minDistanceFromEntrance', label: 'Min Distance From Entrance', section: 'Enemy Generation', type: 'number', min: 0, max: 24, step: 1 },
  { path: 'enemyGeneration.minDistanceFromExit', label: 'Min Distance From Exit', section: 'Enemy Generation', type: 'number', min: 0, max: 24, step: 1 },
  { path: 'enemyGeneration.minDistanceFromPath', label: 'Min Distance From Path', section: 'Enemy Generation', type: 'number', min: 0, max: 16, step: 1 },
  { path: 'enemyGeneration.minDistanceBetweenEnemyGroups', label: 'Min Distance Between Groups', section: 'Enemy Generation', type: 'number', min: 0, max: 40, step: 1 },
  { path: 'enemyGeneration.minDistanceBetweenEnemies', label: 'Min Distance Between Enemies', section: 'Enemy Generation', type: 'number', min: 0, max: 12, step: 1 },
  { path: 'enemyGeneration.maxSpawnAttempts', label: 'Max Spawn Attempts', section: 'Enemy Generation', type: 'number', min: 10, max: 500, step: 5 },
  { path: 'debug.showEnemySpawnZones', label: 'Show Enemy Spawn Zones', section: 'Debug / Overlays', type: 'boolean' },
  { path: 'debug.showEnemySpawnRejections', label: 'Show Enemy Spawn Rejections', section: 'Debug / Overlays', type: 'boolean' },
];

function deepClone(v) { return JSON.parse(JSON.stringify(v)); }
function getByPath(obj, path) { return path.split('.').reduce((acc, key) => acc?.[key], obj); }
function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function deepMerge(base, patch) {
  if (!isPlainObject(base)) return deepClone(patch ?? base);
  const merged = deepClone(base);
  if (!isPlainObject(patch)) return merged;
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = deepMerge(merged[key], value);
      continue;
    }
    merged[key] = deepClone(value);
  }
  return merged;
}
function setByPath(obj, path, value) {
  const keys = path.split('.');
  let ptr = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    ptr[keys[i]] ??= {};
    ptr = ptr[keys[i]];
  }
  ptr[keys[keys.length - 1]] = value;
}

export class RuntimeConfigRegistry {
  constructor() {
    this.defaults = deepClone(DEFAULT_CONFIG);
    this.current = deepClone(DEFAULT_CONFIG);
    this.fields = CONFIG_FIELDS;
    this.fieldMap = new Map(this.fields.map((field) => [field.path, field]));
    this.listeners = new Set();
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 120;
    this.pinned = this.#readStorage(PINNED_KEY, []);
    this.presets = this.#readStorage(PRESETS_KEY, {});
    this.lastPresetName = null;
    this.logger = null;
    this.loadSavedConfig();
  }

  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  get(path) { return getByPath(this.current, path); }
  getDefault(path) { return getByPath(this.defaults, path); }
  isDirty(path) { return JSON.stringify(this.get(path)) !== JSON.stringify(this.getDefault(path)); }
  setLogger(logger) { this.logger = typeof logger === 'function' ? logger : null; }

  set(path, value, options = {}) {
    const field = this.fieldMap.get(path);
    if (!field) return;
    const previous = this.get(path);
    const next = this.#coerce(field, value);
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    setByPath(this.current, path, next);

    if (!options.skipHistory) {
      this.undoStack.push({ path, previous, next });
      if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
      this.redoStack.length = 0;
    }
    this.#emit(path, previous, next);
    this.#log(`Config changed: ${path} = ${JSON.stringify(next)}`);
  }

  resetField(path) { this.set(path, this.getDefault(path)); }
  resetSection(sectionName) {
    for (const field of this.fields) {
      if (field.section === sectionName) this.resetField(field.path);
    }
  }
  resetAll() {
    this.current = deepClone(this.defaults);
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.#emit('*', null, null);
    this.#log('Config reset to defaults');
  }

  undo() {
    const change = this.undoStack.pop();
    if (!change) return;
    setByPath(this.current, change.path, change.previous);
    this.redoStack.push(change);
    this.#emit(change.path, change.next, change.previous);
  }

  redo() {
    const change = this.redoStack.pop();
    if (!change) return;
    setByPath(this.current, change.path, change.next);
    this.undoStack.push(change);
    this.#emit(change.path, change.previous, change.next);
  }

  saveCurrentConfig() {
    const saved = this.#writeStorage(STORAGE_KEY, this.current);
    if (saved) this.#log('Saved runtime config');
    return saved;
  }

  loadSavedConfig() {
    const saved = this.#readStorage(STORAGE_KEY, null);
    if (!saved) return false;
    this.current = this.#sanitizeConfig(deepMerge(this.defaults, saved));
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.#emit('*', null, null);
    this.#log('Loaded saved runtime config');
    return true;
  }

  savePreset(name) {
    if (!name) return false;
    this.presets[name] = deepClone(this.current);
    this.lastPresetName = name;
    const saved = this.#writeStorage(PRESETS_KEY, this.presets);
    if (saved) this.#log(`Saved preset: ${name}`);
    return saved;
  }

  loadPreset(name) {
    if (!name || !this.presets[name]) return false;
    this.current = this.#sanitizeConfig(deepMerge(this.defaults, this.presets[name]));
    this.lastPresetName = name;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.#emit('*', null, null);
    this.#log(`Loaded preset: ${name}`);
    return true;
  }

  togglePin(path) {
    if (this.pinned.includes(path)) {
      this.pinned = this.pinned.filter((entry) => entry !== path);
    } else {
      this.pinned.push(path);
    }
    this.#writeStorage(PINNED_KEY, this.pinned);
  }

  serialize() { return deepClone(this.current); }

  #coerce(field, value) {
    if (field.type === 'number') {
      const raw = Number(value);
      const safe = Number.isFinite(raw) ? raw : this.get(field.path);
      const min = Number.isFinite(field.min) ? field.min : -Infinity;
      const max = Number.isFinite(field.max) ? field.max : Infinity;
      return Math.max(min, Math.min(max, safe));
    }
    if (field.type === 'boolean') return Boolean(value);
    if (field.type === 'enum') return field.options.includes(value) ? value : field.options[0];
    if (field.type === 'color') return /^#([\da-fA-F]{6}|[\da-fA-F]{3})$/.test(String(value)) ? String(value) : this.get(field.path);
    return value;
  }

  #emit(path, previous, value) {
    for (const listener of this.listeners) listener({ path, previous, value, current: this.current });
  }

  #sanitizeConfig(config) {
    const safe = deepClone(this.defaults);
    for (const field of this.fields) {
      const raw = getByPath(config, field.path);
      const fallback = this.getDefault(field.path);
      const candidate = raw === undefined ? fallback : raw;
      setByPath(safe, field.path, this.#coerce(field, candidate));
    }
    return safe;
  }

  #writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  #log(message) {
    this.logger?.(message);
  }

  #readStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
}
