export const SPAWN_CATEGORY = Object.freeze({
  NPC: 'npc',
  ENEMY: 'enemy',
  ENVIRONMENT: 'environment',
  LOOT: 'loot',
  INTERACTABLE: 'interactable',
  PROP: 'prop',
});

export function createDefinition(definition = {}) {
  return Object.freeze({
    id: String(definition.id ?? '').trim(),
    category: String(definition.category ?? '').trim(),
    assetId: String(definition.assetId ?? definition.spriteId ?? definition.id ?? '').trim(),
    biomeTags: Array.isArray(definition.biomeTags)
      ? [...new Set(definition.biomeTags.map((tag) => String(tag ?? '').trim().toLowerCase()).filter(Boolean))]
      : [],
    spawnWeight: Number.isFinite(Number(definition.spawnWeight)) ? Number(definition.spawnWeight) : 1,
    clusterMin: Number.isFinite(Number(definition.clusterMin)) ? Math.max(1, Math.floor(Number(definition.clusterMin))) : undefined,
    clusterMax: Number.isFinite(Number(definition.clusterMax)) ? Math.max(1, Math.floor(Number(definition.clusterMax))) : undefined,
    clusterRadius: Number.isFinite(Number(definition.clusterRadius)) ? Math.max(1, Number(definition.clusterRadius)) : undefined,
    clearanceRadius: Number.isFinite(Number(definition.clearanceRadius)) ? Math.max(0, Number(definition.clearanceRadius)) : 0,
    isCollidable: Boolean(definition.isCollidable ?? definition.blocksMovement ?? definition.collision),
    isInteractable: Boolean(definition.isInteractable ?? definition.interactable),
    ...definition,
  });
}
