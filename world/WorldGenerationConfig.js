export const DEFAULT_WORLD_GENERATION_CONFIG = {
  forestRoomWidth: 120,
  forestRoomHeight: 120,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeWorldGenerationConfig(config = {}) {
  return {
    forestRoomWidth: clamp(Math.round(config.forestRoomWidth ?? DEFAULT_WORLD_GENERATION_CONFIG.forestRoomWidth), 40, 320),
    forestRoomHeight: clamp(Math.round(config.forestRoomHeight ?? DEFAULT_WORLD_GENERATION_CONFIG.forestRoomHeight), 40, 320),
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
