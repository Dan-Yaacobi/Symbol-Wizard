import { objectLibrary, spawnObject } from './ObjectLibrary.js';

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function collectRoadPoints(roadMask) {
  const points = [];
  for (const key of roadMask) {
    const [xString, yString] = key.split(',');
    points.push({ x: Number(xString), y: Number(yString) });
  }
  return points;
}

function isValidFootprint(footprint) {
  if (!Array.isArray(footprint) || footprint.length === 0) return false;

  const keySet = new Set();
  for (const cell of footprint) {
    if (!Array.isArray(cell) || cell.length !== 2) return false;
    const [x, y] = cell;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
    keySet.add(`${x},${y}`);
  }

  if (!keySet.has('0,0')) return false;
  if (keySet.size > 6) return false;

  const [first] = keySet;
  const queue = [first];
  const visited = new Set([first]);

  while (queue.length > 0) {
    const current = queue.shift();
    const [xString, yString] = current.split(',');
    const cx = Number(xString);
    const cy = Number(yString);
    const neighbors = [`${cx + 1},${cy}`, `${cx - 1},${cy}`, `${cx},${cy + 1}`, `${cx},${cy - 1}`];

    for (const neighbor of neighbors) {
      if (!keySet.has(neighbor) || visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return visited.size === keySet.size;
}

function buildPlacementTemplates() {
  const weightedIds = [
    'oak_tree', 'oak_tree', 'oak_tree',
    'pine_tree', 'pine_tree',
    'bush', 'bush', 'wildflowers',
    'stone_cluster', 'barrel', 'crate', 'chest', 'shrine',
  ];
  const templates = [];

  for (const id of weightedIds) {
    const definition = objectLibrary[id];
    if (!definition || !isValidFootprint(definition.footprint)) continue;
    const template = spawnObject(id, { x: 0, y: 0 });
    if (template) templates.push(template);
  }

  return templates;
}

function canPlaceObject(tiles, center, footprint, blockedMask) {
  for (const [dx, dy] of footprint) {
    const x = center.x + dx;
    const y = center.y + dy;
    if (!tiles[y]?.[x]?.walkable) return false;
    if (blockedMask.has(`${x},${y}`)) return false;
  }
  return true;
}

function markObject(mask, center, footprint, padding = 1) {
  for (const [dx, dy] of footprint) {
    const cx = center.x + dx;
    const cy = center.y + dy;
    for (let oy = -padding; oy <= padding; oy += 1) {
      for (let ox = -padding; ox <= padding; ox += 1) {
        mask.add(`${cx + ox},${cy + oy}`);
      }
    }
  }
}

function stampObjectTiles(tiles, object, rng) {
  const variants = object.tileVariants ?? [];
  if (variants.length === 0) return;

  for (const [dx, dy] of object.footprint ?? [[0, 0]]) {
    const x = Math.round(object.x + dx);
    const y = Math.round(object.y + dy);
    if (!tiles[y]?.[x]) continue;

    const variantIndex = Math.abs((dx * 13) + (dy * 7) + Math.floor(rng() * 1000)) % variants.length;
    const variant = variants[variantIndex];
    tiles[y][x] = {
      ...tiles[y][x],
      ...variant,
      type: `object-${object.type}`,
      walkable: object.collision ? false : tiles[y][x].walkable,
    };
  }
}

export class ObjectPlacementSystem {
  placeObjects({ tiles, rng, roadMask, blockedMask, roomId, biomeConfig = null }) {
    const roadPoints = collectRoadPoints(roadMask);
    const templates = buildPlacementTemplates();
    const density = Math.max(0, Math.min(1, biomeConfig?.objectDensity ?? 0.75));
    const minCount = Math.max(4, Math.floor(10 + (26 * density)));
    const maxCount = Math.max(minCount, Math.floor(14 + (34 * density)));
    const count = randomInt(rng, minCount, maxCount);
    const objects = [];

    for (let i = 0; i < count; i += 1) {
      const template = templates[randomInt(rng, 0, templates.length - 1)];
      if (!template) continue;

      for (let attempt = 0; attempt < 38; attempt += 1) {
        const road = roadPoints[randomInt(rng, 0, Math.max(0, roadPoints.length - 1))] ?? { x: Math.floor(tiles[0].length / 2), y: Math.floor(tiles.length / 2) };
        const angle = rng() * Math.PI * 2;
        const distance = randomInt(rng, 6, 18);
        const center = {
          x: Math.round(road.x + Math.cos(angle) * distance),
          y: Math.round(road.y + Math.sin(angle) * distance),
        };

        if (!canPlaceObject(tiles, center, template.footprint, blockedMask)) continue;

        const placed = spawnObject(template.type, center, {
          id: `${roomId}-object-${objects.length}`,
          footprint: structuredClone(template.footprint),
          state: { spawned: true },
        });

        if (!placed) break;

        objects.push(placed);
        stampObjectTiles(tiles, placed, rng);
        markObject(blockedMask, center, placed.footprint, placed.collision ? 1 : 0);
        break;
      }
    }

    return objects;
  }
}
