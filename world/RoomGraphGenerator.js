const DIRECTIONS = ['north', 'east', 'south', 'west'];

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function oppositeDirection(direction) {
  if (direction === 'north') return 'south';
  if (direction === 'south') return 'north';
  if (direction === 'east') return 'west';
  return 'east';
}

function slotAnchorPosition(direction, slotIndex, slotCount, roomWidth, roomHeight) {
  const minAxis = 4;
  const axisMax = direction === 'north' || direction === 'south' ? roomWidth - 5 : roomHeight - 5;
  const span = Math.max(minAxis, axisMax) - minAxis;
  const axis = slotCount <= 1
    ? Math.round((minAxis + Math.max(minAxis, axisMax)) / 2)
    : Math.round(minAxis + (span * ((slotIndex + 1) / (slotCount + 1))));

  if (direction === 'north') return { x: axis, y: 2, direction };
  if (direction === 'south') return { x: axis, y: roomHeight - 3, direction };
  if (direction === 'west') return { x: 2, y: axis, direction };
  return { x: roomWidth - 3, y: axis, direction };
}

function createRoomNode(id, seed, depth) {
  return {
    id,
    seed,
    depth,
    entrances: {},
    exits: {},
    connections: [],
    state: {
      visited: false,
    },
  };
}

function createConnection(sourceRoom, targetRoom, edgeId, direction) {
  return {
    exitId: `${edgeId}:out`,
    targetRoomId: targetRoom.id,
    targetEntranceId: `${edgeId}:in`,
    direction,
  };
}

function connectRooms(sourceRoom, targetRoom, edgeId, direction) {
  sourceRoom.connections.push(createConnection(sourceRoom, targetRoom, edgeId, direction));
  targetRoom.connections.push(createConnection(targetRoom, sourceRoom, `${edgeId}:return`, oppositeDirection(direction)));
}

function pickUnusedDirection(rng, usedDirections, fallback = null) {
  const options = DIRECTIONS.filter((dir) => !usedDirections.has(dir));
  if (options.length > 0) return options[Math.floor(rng() * options.length)];
  return fallback ?? DIRECTIONS[Math.floor(rng() * DIRECTIONS.length)];
}

function isConnected(source, targetId) {
  return source.connections.some((entry) => entry.targetRoomId === targetId);
}

function addSupplementalConnections(rooms, rng, minExitsPerRoom, maxExitsPerRoom, edgeCounterRef) {
  const roomList = [...rooms.values()];

  for (const room of roomList) {
    while (Math.ceil(room.connections.length / 2) < minExitsPerRoom) {
      const partner = roomList.find((candidate) => (
        candidate.id !== room.id
        && !isConnected(room, candidate.id)
        && Math.ceil(candidate.connections.length / 2) < maxExitsPerRoom
        && Math.ceil(room.connections.length / 2) < maxExitsPerRoom
      ));

      if (!partner) break;

      const used = new Set(room.connections.map((entry) => entry.direction).filter(Boolean));
      const direction = pickUnusedDirection(rng, used);
      connectRooms(room, partner, `extra-${edgeCounterRef.value}`, direction);
      edgeCounterRef.value += 1;
    }
  }
}

function assignAnchorsFromConnections(rooms, roomWidth, roomHeight) {
  for (const room of rooms.values()) {
    room.exits = {};
    const grouped = new Map();
    for (const direction of DIRECTIONS) grouped.set(direction, []);

    for (const connection of room.connections) {
      const direction = connection.direction ?? 'east';
      if (!grouped.has(direction)) grouped.set(direction, []);
      grouped.get(direction).push(connection);
    }

    for (const [direction, entries] of grouped.entries()) {
      entries.sort((a, b) => a.exitId.localeCompare(b.exitId));
      entries.forEach((connection, index) => {
        room.exits[connection.exitId] = slotAnchorPosition(direction, index, entries.length, roomWidth, roomHeight);
      });
    }
  }
}

function assignEntrancesFromIncomingConnections(rooms, roomWidth, roomHeight) {
  for (const room of rooms.values()) room.entrances = {};

  for (const sourceRoom of rooms.values()) {
    for (const connection of sourceRoom.connections) {
      const targetRoom = rooms.get(connection.targetRoomId);
      if (!targetRoom) continue;
      const exitAnchor = sourceRoom.exits[connection.exitId];
      if (!exitAnchor) continue;
      const direction = oppositeDirection(exitAnchor.direction ?? connection.direction ?? 'east');
      if (!targetRoom.entrances[connection.targetEntranceId]) {
        targetRoom.entrances[connection.targetEntranceId] = { direction };
      }
    }
  }

  for (const room of rooms.values()) {
    const grouped = new Map();
    for (const direction of DIRECTIONS) grouped.set(direction, []);

    for (const [entranceId, anchor] of Object.entries(room.entrances)) {
      const direction = anchor.direction ?? 'east';
      grouped.get(direction).push(entranceId);
    }

    for (const [direction, entranceIds] of grouped.entries()) {
      entranceIds.sort();
      entranceIds.forEach((entranceId, index) => {
        room.entrances[entranceId] = slotAnchorPosition(direction, index, entranceIds.length, roomWidth, roomHeight);
      });
    }
  }
}

function sanitizeGraph(rooms) {
  for (const room of rooms.values()) {
    room.connections = room.connections.filter((entry) => rooms.has(entry.targetRoomId));
  }

  for (const room of rooms.values()) {
    const validExitIds = new Set(room.connections.map((entry) => entry.exitId));
    room.exits = Object.fromEntries(Object.entries(room.exits).filter(([exitId]) => validExitIds.has(exitId)));

    const incomingEntranceIds = new Set();
    for (const source of rooms.values()) {
      for (const connection of source.connections) {
        if (connection.targetRoomId !== room.id) continue;
        incomingEntranceIds.add(connection.targetEntranceId);
      }
    }
    room.entrances = Object.fromEntries(Object.entries(room.entrances).filter(([entranceId]) => incomingEntranceIds.has(entranceId)));
  }
}

export function generateRoomGraph({
  seed,
  roomWidth = 240,
  roomHeight = 160,
  biomeConfig = {},
} = {}) {
  const rng = createRng(seed >>> 0);
  const rooms = new Map();

  const minRooms = Math.max(2, biomeConfig.minRooms ?? 6);
  const maxRooms = Math.max(minRooms, biomeConfig.maxRooms ?? 12);
  const minExitsPerRoom = Math.max(1, biomeConfig.minExitsPerRoom ?? 1);
  const maxExitsPerRoom = Math.max(minExitsPerRoom, biomeConfig.maxExitsPerRoom ?? 4);
  const branchProbability = clamp(biomeConfig.branchProbability ?? 0.5, 0, 1);

  const targetRooms = randomInt(rng, minRooms, maxRooms);
  const mainPathLength = clamp(randomInt(rng, Math.max(2, minRooms - 1), maxRooms), 2, targetRooms);
  const mainPathIds = [];

  for (let i = 0; i < mainPathLength; i += 1) {
    const id = i === 0 ? 'start' : i === mainPathLength - 1 ? 'exit' : `main-${i}`;
    const room = createRoomNode(id, randomInt(rng, 0, 0x7fffffff), i);
    rooms.set(id, room);
    mainPathIds.push(id);
  }

  let edgeCounter = 0;
  for (let i = 0; i < mainPathIds.length - 1; i += 1) {
    const source = rooms.get(mainPathIds[i]);
    const target = rooms.get(mainPathIds[i + 1]);
    const used = new Set(source.connections.map((entry) => entry.direction).filter(Boolean));
    const direction = pickUnusedDirection(rng, used, 'east');
    connectRooms(source, target, `main-${edgeCounter}`, direction);
    edgeCounter += 1;
  }

  let sideCounter = 0;
  while (rooms.size < targetRooms) {
    const mustGrow = rooms.size < minRooms;
    if (!mustGrow && rng() > branchProbability) break;

    const parents = [...rooms.values()].filter((room) => Math.ceil(room.connections.length / 2) < maxExitsPerRoom);
    const parent = parents[Math.floor(rng() * parents.length)];
    if (!parent) break;

    sideCounter += 1;
    const child = createRoomNode(`side-${sideCounter}`, randomInt(rng, 0, 0x7fffffff), parent.depth + 1);
    rooms.set(child.id, child);

    const used = new Set(parent.connections.map((entry) => entry.direction).filter(Boolean));
    const direction = pickUnusedDirection(rng, used);
    connectRooms(parent, child, `side-${edgeCounter}`, direction);
    edgeCounter += 1;
  }

  const edgeCounterRef = { value: edgeCounter };
  addSupplementalConnections(rooms, rng, minExitsPerRoom, maxExitsPerRoom, edgeCounterRef);

  assignAnchorsFromConnections(rooms, roomWidth, roomHeight);
  assignEntrancesFromIncomingConnections(rooms, roomWidth, roomHeight);
  sanitizeGraph(rooms);

  return {
    rooms,
    startRoomId: 'start',
  };
}
