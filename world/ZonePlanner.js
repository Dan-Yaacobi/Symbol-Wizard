function tileKey(x, y) {
  return `${x},${y}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function averageAnchor(anchors, fallback) {
  if (!Array.isArray(anchors) || anchors.length === 0) return fallback;
  const sum = anchors.reduce((acc, anchor) => ({ x: acc.x + anchor.x, y: acc.y + anchor.y }), { x: 0, y: 0 });
  return { x: Math.round(sum.x / anchors.length), y: Math.round(sum.y / anchors.length) };
}

function depthProjection(tile, entrance, roomCenter) {
  const axis = { x: roomCenter.x - entrance.x, y: roomCenter.y - entrance.y };
  const mag = Math.max(0.001, Math.hypot(axis.x, axis.y));
  const normalized = { x: axis.x / mag, y: axis.y / mag };
  const local = { x: tile.x - entrance.x, y: tile.y - entrance.y };
  return (local.x * normalized.x) + (local.y * normalized.y);
}

export class ZonePlanner {
  plan({ room, entranceAnchors = [], exitAnchors = [], pathMask = new Set() }) {
    const width = room.tiles[0]?.length ?? 0;
    const height = room.tiles.length;
    const center = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
    const primaryEntrance = averageAnchor(entranceAnchors, { x: 2, y: center.y });

    const candidates = [];
    let minDepth = Number.POSITIVE_INFINITY;
    let maxDepth = Number.NEGATIVE_INFINITY;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const tile = room.tiles[y]?.[x];
        if (!tile?.walkable) continue;
        if (room.collisionMap?.[y]?.[x]) continue;
        const key = tileKey(x, y);
        const depth = depthProjection({ x, y }, primaryEntrance, center);
        minDepth = Math.min(minDepth, depth);
        maxDepth = Math.max(maxDepth, depth);
        candidates.push({ x, y, key, depth, blockedByPath: pathMask.has(key) });
      }
    }

    const span = Math.max(1, maxDepth - minDepth);
    const normalized = candidates.map((candidate) => ({ ...candidate, progress: clamp((candidate.depth - minDepth) / span, 0, 1) }));
    const zoneBuckets = {
      rest_intro: [],
      skirmish: [],
      peak: [],
      rest_release: [],
    };

    for (const tile of normalized) {
      if (tile.progress < 0.24) zoneBuckets.rest_intro.push(tile);
      else if (tile.progress < 0.57) zoneBuckets.skirmish.push(tile);
      else if (tile.progress < 0.83) zoneBuckets.peak.push(tile);
      else zoneBuckets.rest_release.push(tile);
    }

    return [
      { id: 'zone-rest-intro', type: 'rest', density: 'low', tiles: zoneBuckets.rest_intro, debugColor: '#3bcf6f', minThreat: 0, maxThreat: 3 },
      { id: 'zone-skirmish', type: 'skirmish', density: 'medium', tiles: zoneBuckets.skirmish, debugColor: '#f0cf4a', minThreat: 4, maxThreat: 9 },
      { id: 'zone-peak', type: 'peak', density: 'high', tiles: zoneBuckets.peak, debugColor: '#db4d4d', minThreat: 10, maxThreat: 18 },
      { id: 'zone-rest-release', type: 'rest', density: 'low', tiles: zoneBuckets.rest_release, debugColor: '#3bcf6f', minThreat: 0, maxThreat: 5 },
    ].map((zone) => ({
      ...zone,
      tileSet: new Set(zone.tiles.map((tile) => tile.key)),
      exits: exitAnchors,
      entrances: entranceAnchors,
    }));
  }
}

