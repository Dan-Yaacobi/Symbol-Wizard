export const DEFAULT_OBJECT_GENERATION_CONFIG = {
  objectDensity: 1,
  clusterDensity: 1,
  minDistanceFromPath: 3,
  minDistanceFromExit: 5,
  minDistanceFromMapEdge: 3,
  clusterRadiusMultiplier: 1,
  maxAttemptsPerObjectType: 100,
  landmarkClearingRadius: 8,
  intersectionClearingRadius: 6,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeObjectGenerationConfig(config = {}) {
  return {
    objectDensity: clamp(Number(config.objectDensity ?? DEFAULT_OBJECT_GENERATION_CONFIG.objectDensity), 0.1, 3),
    clusterDensity: clamp(Number(config.clusterDensity ?? DEFAULT_OBJECT_GENERATION_CONFIG.clusterDensity), 0.1, 3),
    minDistanceFromPath: clamp(Math.round(config.minDistanceFromPath ?? DEFAULT_OBJECT_GENERATION_CONFIG.minDistanceFromPath), 0, 12),
    minDistanceFromExit: clamp(Math.round(config.minDistanceFromExit ?? DEFAULT_OBJECT_GENERATION_CONFIG.minDistanceFromExit), 0, 16),
    minDistanceFromMapEdge: clamp(Math.round(config.minDistanceFromMapEdge ?? DEFAULT_OBJECT_GENERATION_CONFIG.minDistanceFromMapEdge), 0, 16),
    clusterRadiusMultiplier: clamp(Number(config.clusterRadiusMultiplier ?? DEFAULT_OBJECT_GENERATION_CONFIG.clusterRadiusMultiplier), 0.25, 4),
    maxAttemptsPerObjectType: clamp(Math.round(config.maxAttemptsPerObjectType ?? DEFAULT_OBJECT_GENERATION_CONFIG.maxAttemptsPerObjectType), 10, 1000),
    landmarkClearingRadius: clamp(Math.round(config.landmarkClearingRadius ?? DEFAULT_OBJECT_GENERATION_CONFIG.landmarkClearingRadius), 2, 20),
    intersectionClearingRadius: clamp(Math.round(config.intersectionClearingRadius ?? DEFAULT_OBJECT_GENERATION_CONFIG.intersectionClearingRadius), 1, 20),
  };
}

export function resolveObjectGenerationConfig(runtimeConfig = null) {
  if (!runtimeConfig || typeof runtimeConfig.get !== 'function') {
    return normalizeObjectGenerationConfig(DEFAULT_OBJECT_GENERATION_CONFIG);
  }

  return normalizeObjectGenerationConfig({
    objectDensity: runtimeConfig.get('objectGeneration.objectDensity'),
    clusterDensity: runtimeConfig.get('objectGeneration.clusterDensity'),
    minDistanceFromPath: runtimeConfig.get('objectGeneration.minDistanceFromPath'),
    minDistanceFromExit: runtimeConfig.get('objectGeneration.minDistanceFromExit'),
    minDistanceFromMapEdge: runtimeConfig.get('objectGeneration.minDistanceFromMapEdge'),
    clusterRadiusMultiplier: runtimeConfig.get('objectGeneration.clusterRadiusMultiplier'),
    maxAttemptsPerObjectType: runtimeConfig.get('objectGeneration.maxAttemptsPerObjectType'),
    landmarkClearingRadius: runtimeConfig.get('objectGeneration.landmarkClearingRadius'),
    intersectionClearingRadius: runtimeConfig.get('objectGeneration.intersectionClearingRadius'),
  });
}
