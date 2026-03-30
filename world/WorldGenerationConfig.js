export const DEFAULT_WORLD_GENERATION_CONFIG = {
  forestRoomWidth: 240,
  forestRoomHeight: 240,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeWorldGenerationConfig(config = {}) {
  return {
    forestRoomWidth: clamp(Math.round(config.forestRoomWidth ?? DEFAULT_WORLD_GENERATION_CONFIG.forestRoomWidth), 80, 420),
    forestRoomHeight: clamp(Math.round(config.forestRoomHeight ?? DEFAULT_WORLD_GENERATION_CONFIG.forestRoomHeight), 80, 420),
  };
}

export function resolveWorldGenerationConfig(runtimeConfig = null) {
  if (!runtimeConfig || typeof runtimeConfig.get !== 'function') {
    return normalizeWorldGenerationConfig(DEFAULT_WORLD_GENERATION_CONFIG);
  }

  return normalizeWorldGenerationConfig({
    forestRoomWidth: runtimeConfig.get('worldGeneration.forestRoomWidth'),
    forestRoomHeight: runtimeConfig.get('worldGeneration.forestRoomHeight'),
  });
}
