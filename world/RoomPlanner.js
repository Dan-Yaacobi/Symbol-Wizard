const DIRS = ['north', 'east', 'south', 'west'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function slotAnchorPosition(direction, slotIndex, slotCount, width, height, edgeInset = 2) {
  const minAxis = 6;
  const axisMax = direction === 'north' || direction === 'south' ? width - 7 : height - 7;
  const span = Math.max(minAxis, axisMax) - minAxis;
  const axis = slotCount <= 1
    ? Math.round((minAxis + Math.max(minAxis, axisMax)) / 2)
    : Math.round(minAxis + (span * ((slotIndex + 1) / (slotCount + 1))));

  if (direction === 'north') return { x: axis, y: edgeInset, direction };
  if (direction === 'south') return { x: axis, y: height - 1 - edgeInset, direction };
  if (direction === 'west') return { x: edgeInset, y: axis, direction };
  return { x: width - 1 - edgeInset, y: axis, direction };
}

function defaultSpawnArea(width, height) {
  const center = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  return {
    center,
    radius: Math.max(4, Math.round(Math.min(width, height) * 0.05)),
  };
}

function directionForConnection(connection, fallback = 'east') {
  return DIRS.includes(connection?.direction) ? connection.direction : fallback;
}

export class RoomPlanner {
  createPlan({ roomNode, width, height, biomeType = 'forest' }) {
    const spawnArea = defaultSpawnArea(width, height);
    const grouped = new Map(DIRS.map((direction) => [direction, []]));

    for (const connection of roomNode.connections ?? []) {
      const direction = directionForConnection(connection);
      grouped.get(direction).push(connection);
    }

    const exitAnchors = {};
    for (const [direction, entries] of grouped.entries()) {
      entries.sort((a, b) => a.exitId.localeCompare(b.exitId));
      entries.forEach((connection, index) => {
        const anchor = slotAnchorPosition(direction, index, entries.length, width, height);
        exitAnchors[connection.exitId] = {
          id: connection.exitId,
          x: clamp(anchor.x, 0, width - 1),
          y: clamp(anchor.y, 0, height - 1),
          direction,
          targetRoomId: connection.targetRoomId,
          targetEntranceId: connection.targetEntranceId,
          reverseDirection: connection.reverseDirection,
          corridorWidth: connection.corridorWidth ?? 3,
          clearanceRadius: connection.clearanceRadius ?? 3,
          isEntryAnchor: false,
        };
      });
    }

    const entranceAnchors = {};
    for (const [entranceId, entrance] of Object.entries(roomNode.entrances ?? {})) {
      entranceAnchors[entranceId] = {
        id: entranceId,
        x: clamp(Math.round(entrance.x ?? spawnArea.center.x), 0, width - 1),
        y: clamp(Math.round(entrance.y ?? spawnArea.center.y), 0, height - 1),
        direction: entrance.direction ?? 'west',
        corridorWidth: entrance.corridorWidth ?? 3,
        clearanceRadius: entrance.clearanceRadius ?? 3,
        isEntryAnchor: true,
      };
    }

    return {
      roomId: roomNode.id,
      dimensions: { width, height },
      biome: biomeType,
      spawnArea,
      entryFocusArea: { ...spawnArea },
      exitAnchors,
      entranceAnchors,
      reservedCorridors: {},
      noBuildZones: [],
      densityTargets: {
        obstacleDensity: biomeType === 'forest' ? 0.62 : 0.45,
      },
      debugEvents: [{ type: 'ROOM_PLAN_CREATED', roomId: roomNode.id }],
    };
  }
}
