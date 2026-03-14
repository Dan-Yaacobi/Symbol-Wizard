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
  if (keySet.size > 9) return false;

  let maxDistanceSquared = 0;
  for (const key of keySet) {
    const [xString, yString] = key.split(',');
    const x = Number(xString);
    const y = Number(yString);
    maxDistanceSquared = Math.max(maxDistanceSquared, (x * x) + (y * y));
  }
  if (maxDistanceSquared > 8) return false;

  const [first] = keySet;
  const queue = [first];
  const visited = new Set([first]);

  while (queue.length > 0) {
    const current = queue.shift();
    const [xString, yString] = current.split(',');
    const cx = Number(xString);
    const cy = Number(yString);
    const neighbors = [
      `${cx + 1},${cy}`,
      `${cx - 1},${cy}`,
      `${cx},${cy + 1}`,
      `${cx},${cy - 1}`,
    ];

    for (const neighbor of neighbors) {
      if (!keySet.has(neighbor) || visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return visited.size === keySet.size;
}

function buildPlacementTemplates() {
  const preferred = new Set(['forest_grove', 'rock_formation', 'small_pond', 'fallen_tree', 'ruins']);
  const templates = [];

  for (const [id, definition] of Object.entries(objectLibrary)) {
    if (!preferred.has(id)) continue;
    if (!isValidFootprint(definition.footprint)) continue;
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

export class ObjectPlacementSystem {
  placeObjects({ tiles, rng, roadMask, blockedMask, roomId }) {
    const roadPoints = collectRoadPoints(roadMask);
    const templates = buildPlacementTemplates();
    const count = randomInt(rng, 8, 12);
    const objects = [];

    for (let i = 0; i < count; i += 1) {
      const template = templates[randomInt(rng, 0, templates.length - 1)];
      if (!template) continue;

      for (let attempt = 0; attempt < 32; attempt += 1) {
        const road = roadPoints[randomInt(rng, 0, Math.max(0, roadPoints.length - 1))] ?? { x: Math.floor(tiles[0].length / 2), y: Math.floor(tiles.length / 2) };
        const angle = rng() * Math.PI * 2;
        const distance = randomInt(rng, 5, 14);
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
        markObject(blockedMask, center, placed.footprint, 1);
        break;
      }
    }

    return objects;
  }
}
