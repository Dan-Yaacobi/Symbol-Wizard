import { EXIT_CORRIDOR_LENGTH, LANDING_INSET, PATH_CORRIDOR_WIDTH } from './GenerationConstants.js';

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
    radius: Math.max(8, Math.round(Math.min(width, height) * 0.08)),
  };
}

function directionForConnection(connection, fallback = 'east') {
  return DIRS.includes(connection?.direction) ? connection.direction : fallback;
}

function inwardOffset(direction) {
  if (direction === 'north') return { x: 0, y: 1 };
  if (direction === 'south') return { x: 0, y: -1 };
  if (direction === 'west') return { x: 1, y: 0 };
  return { x: -1, y: 0 };
}

function buildLanding(anchor, width, height, inset = LANDING_INSET) {
  const delta = inwardOffset(anchor.direction);
  return {
    x: clamp(anchor.x + (delta.x * inset), 0, width - 1),
    y: clamp(anchor.y + (delta.y * inset), 0, height - 1),
  };
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
          corridorWidth: Math.max(PATH_CORRIDOR_WIDTH, connection.corridorWidth ?? PATH_CORRIDOR_WIDTH),
          corridorLength: Math.max(4, connection.corridorLength ?? EXIT_CORRIDOR_LENGTH),
          clearanceRadius: connection.clearanceRadius ?? 3,
          isEntryAnchor: false,
        };
        const landing = buildLanding(exitAnchors[connection.exitId], width, height);
        exitAnchors[connection.exitId].landingX = landing.x;
        exitAnchors[connection.exitId].landingY = landing.y;
      });
    }

    const entranceAnchors = {};
    const entranceGrouped = new Map(DIRS.map((direction) => [direction, []]));
    for (const [entranceId, entrance] of Object.entries(roomNode.entrances ?? {})) {
      const direction = DIRS.includes(entrance.direction) ? entrance.direction : 'west';
      entranceGrouped.get(direction).push({ entranceId, entrance });
    }

    for (const [direction, entries] of entranceGrouped.entries()) {
      entries.sort((a, b) => a.entranceId.localeCompare(b.entranceId));
      entries.forEach(({ entranceId, entrance }, index) => {
        const edgeAnchor = slotAnchorPosition(direction, index, entries.length, width, height);
        entranceAnchors[entranceId] = {
          id: entranceId,
          x: clamp(Math.round(entrance.x ?? edgeAnchor.x), 0, width - 1),
          y: clamp(Math.round(entrance.y ?? edgeAnchor.y), 0, height - 1),
          direction,
          corridorWidth: Math.max(PATH_CORRIDOR_WIDTH, entrance.corridorWidth ?? PATH_CORRIDOR_WIDTH),
          corridorLength: Math.max(4, entrance.corridorLength ?? EXIT_CORRIDOR_LENGTH),
          clearanceRadius: entrance.clearanceRadius ?? 3,
          isEntryAnchor: true,
        };
        const landing = buildLanding(entranceAnchors[entranceId], width, height);
        entranceAnchors[entranceId].landingX = landing.x;
        entranceAnchors[entranceId].landingY = landing.y;
      });
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
