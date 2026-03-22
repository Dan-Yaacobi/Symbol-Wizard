function buildEdgeSpan(anchor, width, height) {
  const halfWidth = Math.max(1, Math.floor((anchor.corridorWidth ?? 3) / 2));
  if (anchor.direction === 'north' || anchor.direction === 'south') {
    const y = anchor.direction === 'north' ? 0 : height - 1;
    return {
      edgeStart: { x: Math.max(0, anchor.x - halfWidth), y },
      edgeEnd: { x: Math.min(width - 1, anchor.x + halfWidth), y },
    };
  }

  const x = anchor.direction === 'west' ? 0 : width - 1;
  return {
    edgeStart: { x, y: Math.max(0, anchor.y - halfWidth) },
    edgeEnd: { x, y: Math.min(height - 1, anchor.y + halfWidth) },
  };
}

function makeTriggerTiles(anchor, width, height, depth = 4) {
  const tiles = [];
  const halfWidth = Math.max(1, Math.floor((anchor.corridorWidth ?? 3) / 2));
  for (let d = 0; d < depth; d += 1) {
    for (let w = -halfWidth; w <= halfWidth; w += 1) {
      if (anchor.direction === 'north') tiles.push({ x: anchor.x + w, y: Math.min(height - 1, d) });
      if (anchor.direction === 'south') tiles.push({ x: anchor.x + w, y: Math.max(0, height - 1 - d) });
      if (anchor.direction === 'west') tiles.push({ x: Math.min(width - 1, d), y: anchor.y + w });
      if (anchor.direction === 'east') tiles.push({ x: Math.max(0, width - 1 - d), y: anchor.y + w });
    }
  }
  return tiles;
}

export class ExitTriggerSystem {
  build({ plan }) {
    const { width, height } = plan.dimensions;
    const exits = {};
    const corridors = [];
    const debugEvents = [];

    for (const anchor of Object.values(plan.exitAnchors)) {
      const span = buildEdgeSpan(anchor, width, height);
      exits[anchor.id] = {
        id: anchor.id,
        category: 'interactable',
        isInteractable: true,
        targetMap: null,
        targetBiome: anchor.targetRoomId ?? null,
        direction: anchor.direction,
        edgeStart: span.edgeStart,
        edgeEnd: span.edgeEnd,
        roadAnchor: { x: anchor.x, y: anchor.y },
        spawn: { x: anchor.landingX, y: anchor.landingY },
        landing: { x: anchor.landingX, y: anchor.landingY },
        targetRoomId: anchor.targetRoomId,
        targetEntranceId: anchor.targetEntranceId,
        entryDirection: anchor.reverseDirection,
        triggerDepth: 4,
      };
      corridors.push({
        exitId: anchor.id,
        direction: anchor.direction,
        edgeTiles: [span.edgeStart, span.edgeEnd],
        triggerTiles: makeTriggerTiles(anchor, width, height),
      });
      debugEvents.push({ type: 'EXIT_TRIGGER_REGISTERED', roomId: plan.roomId, exitId: anchor.id, targetRoomId: anchor.targetRoomId });
    }

    return { exits, exitCorridors: corridors, debugEvents };
  }
}
