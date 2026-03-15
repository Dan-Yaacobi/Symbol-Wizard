function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const DEFAULT_BIOME_CONFIG = {
  minRooms: 6,
  maxRooms: 12,
  minExitsPerRoom: 1,
  maxExitsPerRoom: 4,
  branchProbability: 0.5,
  roadBranchDensity: 0.6,
  landmarkFrequency: 0.65,
  objectDensity: 0.75,
  roomSizeRange: [0.58, 0.9],
  shapeIrregularity: 0.7,
};

const BIOME_CONFIGS = {
  forest: {
    minRooms: 6,
    maxRooms: 12,
    minExitsPerRoom: 1,
    maxExitsPerRoom: 4,
    branchProbability: 0.6,
    roadBranchDensity: 0.7,
    landmarkFrequency: 0.75,
    objectDensity: 0.8,
    roomSizeRange: [0.78, 0.98],
    shapeIrregularity: 0.9,
  },
  cave: {
    minRooms: 4,
    maxRooms: 6,
    minExitsPerRoom: 1,
    maxExitsPerRoom: 2,
    branchProbability: 0.3,
    roadBranchDensity: 0.2,
    landmarkFrequency: 0.35,
    objectDensity: 0.3,
    roomSizeRange: [0.52, 0.78],
    shapeIrregularity: 0.25,
  },
  mountain: {
    minRooms: 5,
    maxRooms: 8,
    minExitsPerRoom: 1,
    maxExitsPerRoom: 3,
    branchProbability: 0.4,
    roadBranchDensity: 0.35,
    landmarkFrequency: 0.45,
    objectDensity: 0.45,
    roomSizeRange: [0.5, 0.8],
    shapeIrregularity: 0.5,
  },
  river: {
    minRooms: 5,
    maxRooms: 9,
    minExitsPerRoom: 1,
    maxExitsPerRoom: 3,
    branchProbability: 0.5,
    roadBranchDensity: 0.55,
    landmarkFrequency: 0.6,
    objectDensity: 0.6,
    roomSizeRange: [0.56, 0.86],
    shapeIrregularity: 0.8,
  },
};

export function resolveBiomeConfig(biomeType) {
  const preset = BIOME_CONFIGS[biomeType] ?? {};
  const merged = {
    ...DEFAULT_BIOME_CONFIG,
    ...preset,
  };

  const minRooms = Math.max(2, Math.floor(merged.minRooms));
  const maxRooms = Math.max(minRooms, Math.floor(merged.maxRooms));
  const minExitsPerRoom = Math.max(1, Math.floor(merged.minExitsPerRoom));
  const maxExitsPerRoom = Math.max(minExitsPerRoom, Math.floor(merged.maxExitsPerRoom));
  const roomSizeRange = Array.isArray(merged.roomSizeRange) ? merged.roomSizeRange : DEFAULT_BIOME_CONFIG.roomSizeRange;

  return {
    ...merged,
    minRooms,
    maxRooms,
    minExitsPerRoom,
    maxExitsPerRoom,
    branchProbability: clamp(merged.branchProbability, 0, 1),
    roadBranchDensity: clamp(merged.roadBranchDensity, 0, 1),
    landmarkFrequency: clamp(merged.landmarkFrequency, 0, 1),
    objectDensity: clamp(merged.objectDensity, 0, 1),
    roomSizeRange: [
      clamp(Math.min(roomSizeRange[0], roomSizeRange[1]), 0.35, 0.98),
      clamp(Math.max(roomSizeRange[0], roomSizeRange[1]), 0.35, 0.98),
    ],
    shapeIrregularity: clamp(merged.shapeIrregularity, 0, 1),
  };
}

