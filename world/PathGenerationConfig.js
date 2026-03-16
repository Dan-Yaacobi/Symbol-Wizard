export const DEFAULT_PATH_GENERATION_CONFIG = {
  baseTrailRadius: 2,
  turnTrailRadius: 3,
  exitTrailRadius: 3,
  wanderChance: 0.25,
  exitClearingRadius: 3,
  minDistanceFromPath: 2,
  minDistanceFromExit: 3,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizePathGenerationConfig(config = {}) {
  return {
    baseTrailRadius: clamp(Math.round(config.baseTrailRadius ?? DEFAULT_PATH_GENERATION_CONFIG.baseTrailRadius), 1, 8),
    turnTrailRadius: clamp(Math.round(config.turnTrailRadius ?? DEFAULT_PATH_GENERATION_CONFIG.turnTrailRadius), 1, 10),
    exitTrailRadius: clamp(Math.round(config.exitTrailRadius ?? DEFAULT_PATH_GENERATION_CONFIG.exitTrailRadius), 1, 12),
    wanderChance: clamp(Number(config.wanderChance ?? DEFAULT_PATH_GENERATION_CONFIG.wanderChance), 0, 0.9),
    exitClearingRadius: clamp(Math.round(config.exitClearingRadius ?? DEFAULT_PATH_GENERATION_CONFIG.exitClearingRadius), 1, 12),
    minDistanceFromPath: clamp(Math.round(config.minDistanceFromPath ?? DEFAULT_PATH_GENERATION_CONFIG.minDistanceFromPath), 0, 12),
    minDistanceFromExit: clamp(Math.round(config.minDistanceFromExit ?? DEFAULT_PATH_GENERATION_CONFIG.minDistanceFromExit), 0, 16),
  };
}

export function resolvePathGenerationConfig(runtimeConfig = null) {
  if (!runtimeConfig || typeof runtimeConfig.get !== 'function') {
    return normalizePathGenerationConfig(DEFAULT_PATH_GENERATION_CONFIG);
  }

  return normalizePathGenerationConfig({
    baseTrailRadius: runtimeConfig.get('pathGeneration.baseTrailRadius'),
    turnTrailRadius: runtimeConfig.get('pathGeneration.turnTrailRadius'),
    exitTrailRadius: runtimeConfig.get('pathGeneration.exitTrailRadius'),
    wanderChance: runtimeConfig.get('pathGeneration.wanderChance'),
    exitClearingRadius: runtimeConfig.get('pathGeneration.exitClearingRadius'),
    minDistanceFromPath: runtimeConfig.get('pathGeneration.minDistanceFromPath'),
    minDistanceFromExit: runtimeConfig.get('pathGeneration.minDistanceFromExit'),
  });
}
