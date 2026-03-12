import { tiles } from './TilePalette.js';
import { House, BreakableProp, TownNPC, NatureObject, StaticObject } from '../entities/WorldObjects.js';

function cloneTile(tile) {
  return { ...tile };
}

function carvePath(map, start, end, halfWidth = 2) {
  let x = start.x;
  let y = start.y;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));

  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    x = Math.round(start.x + dx * t + Math.sin(t * Math.PI * 4 + start.x * 0.3) * 0.8);
    y = Math.round(start.y + dy * t + Math.cos(t * Math.PI * 3 + end.y * 0.2) * 0.7);

    for (let oy = -halfWidth; oy <= halfWidth; oy += 1) {
      for (let ox = -halfWidth; ox <= halfWidth; ox += 1) {
        const tx = x + ox;
        const ty = y + oy;
        if (!map[ty]?.[tx]) continue;
        const isEdge = Math.abs(ox) === halfWidth || Math.abs(oy) === halfWidth;
        const pebble = Math.random() < 0.08;
        map[ty][tx] = cloneTile(isEdge ? tiles.dirtEdge : pebble ? tiles.pathPebble : tiles.dirt);
      }
    }
  }
}

function paintGrass(map) {
  for (let y = 0; y < map.length; y += 1) {
    for (let x = 0; x < map[0].length; x += 1) {
      map[y][x] = cloneTile(Math.random() < 0.12 ? tiles.grassDark : tiles.grass);
    }
  }
}

function stampHouseBlocking(map, house) {
  const left = Math.round(house.x - 4);
  const right = Math.round(house.x + 4);
  const top = Math.round(house.y - 2);
  const bottom = Math.round(house.y + 2);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (!map[y]?.[x]) continue;
      map[y][x] = cloneTile(tiles.wall);
    }
  }
  for (let x = Math.round(house.x - 1); x <= Math.round(house.x + 1); x += 1) {
    if (map[bottom]?.[x]) map[bottom][x] = cloneTile(tiles.dirt);
  }
}

function hasNearbyDecoration(occupiedDecorations, x, y, radius = 2) {
  for (let oy = -radius; oy <= radius; oy += 1) {
    for (let ox = -radius; ox <= radius; ox += 1) {
      if (ox === 0 && oy === 0) continue;
      if (!occupiedDecorations.has(`${x + ox},${y + oy}`)) continue;
      return true;
    }
  }
  return false;
}

function placeNature(width, height, occupied) {
  const nature = [];
  const candidates = [
    { key: 'tree-bright', block: true, radius: 2.2 },
    { key: 'tree-dark', block: true, radius: 2.2 },
    { key: 'bush', block: true, radius: 1.2 },
    { key: 'flower-red', block: false, radius: 0.8 },
    { key: 'flower-yellow', block: false, radius: 0.8 },
    { key: 'flower-blue', block: false, radius: 0.8 },
    { key: 'stone', block: false, radius: 1 },
    { key: 'grass-patch', block: false, radius: 0.6 },
  ];

  for (let i = 0; i < 140; i += 1) {
    const x = 8 + Math.floor(Math.random() * (width - 16));
    const y = 8 + Math.floor(Math.random() * (height - 16));
    const hash = `${x},${y}`;
    if (occupied.has(hash) || hasNearbyDecoration(occupied, x, y, 2) || Math.random() < 0.58) continue;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const object = new NatureObject({
      x,
      y,
      radius: pick.radius,
      spriteKey: pick.key,
      blocksMovement: pick.block,
    });

    nature.push(object);
    occupied.add(hash);

    if (pick.block) {
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) occupied.add(`${x + ox},${y + oy}`);
      }
    }
  }

  return nature;
}

function findOpenSpot(map, occupied, preferredX, preferredY, minDistance = 3) {
  const maxRadius = 8;

  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let oy = -radius; oy <= radius; oy += 1) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        const x = Math.round(preferredX + ox);
        const y = Math.round(preferredY + oy);
        if (!map[y]?.[x]?.walkable) continue;

        let tooClose = false;
        for (let dy = -minDistance; dy <= minDistance && !tooClose; dy += 1) {
          for (let dx = -minDistance; dx <= minDistance; dx += 1) {
            if (!occupied.has(`${x + dx},${y + dy}`)) continue;
            tooClose = true;
            break;
          }
        }

        if (!tooClose) return { x, y };
      }
    }
  }

  return { x: preferredX, y: preferredY };
}

export function generateMainTown(width, height) {
  const map = Array.from({ length: height }, () => Array.from({ length: width }, () => cloneTile(tiles.grass)));
  paintGrass(map);

  const center = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const exits = {
    north: { x: center.x - 5, y: 5, label: 'North Exit → Forest' },
    east: { x: width - 8, y: center.y + 6, label: 'East Exit → Dungeon' },
    west: { x: 7, y: center.y - 8, label: 'West Exit → Outskirts' },
  };

  carvePath(map, { x: center.x - 36, y: center.y + 4 }, { x: center.x + 40, y: center.y - 2 }, 3);
  carvePath(map, center, exits.north, 2);
  carvePath(map, center, exits.east, 2);
  carvePath(map, center, exits.west, 2);

  const houses = [
    new House(center.x - 26, center.y - 16, 'red'),
    new House(center.x - 8, center.y - 12, 'blue'),
    new House(center.x + 14, center.y - 15, 'brown'),
    new House(center.x + 28, center.y + 10, 'red-chimney'),
    new House(center.x - 16, center.y + 18, 'blue-chimney'),
  ];

  const occupied = new Set();
  for (const house of houses) {
    stampHouseBlocking(map, house);
    carvePath(map, { x: house.x, y: house.y + 4 }, { x: center.x + Math.floor((Math.random() - 0.5) * 18), y: center.y + Math.floor((Math.random() - 0.5) * 12) }, 1);
    for (let oy = -3; oy <= 3; oy += 1) {
      for (let ox = -5; ox <= 5; ox += 1) occupied.add(`${Math.round(house.x + ox)},${Math.round(house.y + oy)}`);
    }
  }

  const npcs = [
    new TownNPC({ x: center.x - 3, y: center.y - 3, name: 'Lina', role: 'villager', dialogue: 'Lovely day! The flowers are brighter after rain.', wanderRadius: 5 }),
    new TownNPC({ x: center.x + 15, y: center.y - 1, name: 'Brom', role: 'merchant', dialogue: 'I buy strange relics and sell useful trinkets.', wanderRadius: 3 }),
    new TownNPC({ x: center.x - 20, y: center.y + 5, name: 'Captain Ro', role: 'guard', dialogue: 'Roads are clear. Forest to the north, danger to the east.', wanderRadius: 2 }),
  ];

  const destructibleSeeds = [
    { kind: 'barrel', x: center.x - 23, y: center.y - 12 },
    { kind: 'crate', x: center.x - 22, y: center.y - 10 },
    { kind: 'vase', x: center.x + 16, y: center.y - 12 },
    { kind: 'barrel', x: center.x + 26, y: center.y + 13 },
    { kind: 'crate', x: center.x - 13, y: center.y + 20 },
    { kind: 'vase', x: center.x + 4, y: center.y + 2 },
  ];
  const destructibles = [];
  for (const seed of destructibleSeeds) {
    const spot = findOpenSpot(map, occupied, seed.x, seed.y, 2);
    destructibles.push(new BreakableProp(seed.kind, spot.x, spot.y));
    occupied.add(`${spot.x},${spot.y}`);
  }

  const fences = [
    new StaticObject({ type: 'fence', x: center.x - 28, y: center.y - 10, radius: 1, spriteKey: 'fence', blocksMovement: true }),
    new StaticObject({ type: 'fence', x: center.x - 27, y: center.y - 10, radius: 1, spriteKey: 'fence', blocksMovement: true }),
    new StaticObject({ type: 'fence', x: center.x - 26, y: center.y - 10, radius: 1, spriteKey: 'fence', blocksMovement: true }),
    new StaticObject({ type: 'fence', x: center.x + 12, y: center.y + 13, radius: 1, spriteKey: 'fence', blocksMovement: true }),
    new StaticObject({ type: 'fence', x: center.x + 13, y: center.y + 13, radius: 1, spriteKey: 'fence', blocksMovement: true }),
  ];

  for (const object of fences) {
    occupied.add(`${Math.round(object.x)},${Math.round(object.y)}`);
    if (object.blocksMovement) {
      const tx = Math.round(object.x);
      const ty = Math.round(object.y);
      if (map[ty]?.[tx]) map[ty][tx] = cloneTile(tiles.wall);
    }
  }

  const nature = placeNature(width, height, occupied);
  for (const object of nature) {
    if (!object.blocksMovement) continue;
    const tx = Math.round(object.x);
    const ty = Math.round(object.y);
    if (map[ty]?.[tx]?.walkable) map[ty][tx] = cloneTile(tiles.wall);
  }

  const worldObjects = [...houses, ...fences, ...destructibles, ...nature];

  return {
    map,
    playerSpawn: { x: center.x, y: center.y + 1 },
    exits,
    worldObjects,
    npcs,
  };
}
