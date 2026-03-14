function isInside(width, height, x, y) {
  return x >= 0 && y >= 0 && x < width && y < height;
}

export function buildCollisionMap(tiles, objects = []) {
  const height = tiles.length;
  const width = tiles[0]?.length ?? 0;
  const collision = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => !tiles[y]?.[x]?.walkable));

  for (const object of objects) {
    if (!object?.collision) continue;
    const footprint = object.footprint ?? [[0, 0]];
    for (const [dx, dy] of footprint) {
      const x = Math.round(object.x + dx);
      const y = Math.round(object.y + dy);
      if (!isInside(width, height, x, y)) continue;
      collision[y][x] = true;
    }
  }

  return collision;
}

export function scanExitCorridors(tileMap, resolvedExits, roomWidth, roomHeight) {
  const corridors = [];

  for (const [exitId, passage] of Object.entries(resolvedExits)) {
    const edgeTiles = [];
    if (passage.direction === 'north' || passage.direction === 'south') {
      const y = passage.direction === 'north' ? 0 : roomHeight - 1;
      for (let x = passage.edgeStart.x; x <= passage.edgeEnd.x; x += 1) {
        if (tileMap?.[y]?.[x]?.walkable) edgeTiles.push({ x, y });
      }
    } else {
      const x = passage.direction === 'west' ? 0 : roomWidth - 1;
      for (let y = passage.edgeStart.y; y <= passage.edgeEnd.y; y += 1) {
        if (tileMap?.[y]?.[x]?.walkable) edgeTiles.push({ x, y });
      }
    }

    if (edgeTiles.length > 0) {
      corridors.push({ exitId, direction: passage.direction, edgeTiles });
    }
  }

  return corridors;
}
