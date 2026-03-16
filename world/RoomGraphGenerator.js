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

function createRoomNode(id, seed, depth) {
  return {
    id,
    seed,
    depth,
    entrances: {},
    exits: {},
    connections: [],
    state: { visited: false },
  };
}

function pickUnusedDirection(rng, usedDirections, fallback = 'east') {
  const options = DIRECTIONS.filter((dir) => !usedDirections.has(dir));
  if (options.length > 0) return options[Math.floor(rng() * options.length)];
  return fallback;
}

function roomExitCount(room) {
  return room.connections.length;
}

function connectionId(edgeId, direction) {
  return `${edgeId}:${direction}`;
}

function connectBidirectional(rooms, roomGraph, sourceId, targetId, direction, edgeId) {
  const source = rooms.get(sourceId);
  const target = rooms.get(targetId);
  if (!source || !target) return;

  const reverseDirection = oppositeDirection(direction);
  roomGraph[sourceId] ||= {};
  roomGraph[targetId] ||= {};
  roomGraph[sourceId][direction] = targetId;
  roomGraph[targetId][reverseDirection] = sourceId;

  const forwardExitId = connectionId(edgeId, direction);
  const reverseExitId = connectionId(edgeId, reverseDirection);
  const forwardEntranceId = `${edgeId}:in:${reverseDirection}`;
  const reverseEntranceId = `${edgeId}:in:${direction}`;

  source.connections.push({
    edgeId,
    exitId: forwardExitId,
    targetRoomId: targetId,
    targetEntranceId: forwardEntranceId,
    direction,
    reverseDirection,
    corridorWidth: 3,
    clearanceRadius: 3,
  });

  target.connections.push({
    edgeId,
    exitId: reverseExitId,
    targetRoomId: sourceId,
    targetEntranceId: reverseEntranceId,
    direction: reverseDirection,
    reverseDirection: direction,
    corridorWidth: 3,
    clearanceRadius: 3,
  });

  target.entrances[forwardEntranceId] = { direction: reverseDirection, corridorWidth: 3, clearanceRadius: 3 };
  source.entrances[reverseEntranceId] = { direction, corridorWidth: 3, clearanceRadius: 3 };
}

function isConnected(rooms, sourceId, targetId) {
  return (rooms.get(sourceId)?.connections ?? []).some((connection) => connection.targetRoomId === targetId);
}

function validateGraph(rooms, roomGraph) {
  for (const room of rooms.values()) {
    for (const connection of room.connections) {
      const reverseRoom = rooms.get(connection.targetRoomId);
      if (!reverseRoom) throw new Error(`ROOM_GRAPH_INVALID missing target room ${connection.targetRoomId}`);
      const reverse = reverseRoom.connections.find((entry) => entry.targetRoomId === room.id && entry.direction === oppositeDirection(connection.direction));
      if (!reverse) {
        throw new Error(`ROOM_GRAPH_INVALID missing reverse connection ${room.id}:${connection.direction} -> ${connection.targetRoomId}`);
      }
      const graphTarget = roomGraph[room.id]?.[connection.direction];
      if (graphTarget !== connection.targetRoomId) {
        throw new Error(`ROOM_GRAPH_INVALID map mismatch for ${room.id}:${connection.direction}`);
      }
    }
  }
}

export function generateRoomGraph({ seed, biomeConfig = {} } = {}) {
  const rng = createRng(seed >>> 0);
  const rooms = new Map();
  const roomGraph = {};

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
    rooms.set(id, createRoomNode(id, randomInt(rng, 0, 0x7fffffff), i));
    roomGraph[id] = {};
    mainPathIds.push(id);
  }

  let edgeCounter = 0;
  for (let i = 0; i < mainPathIds.length - 1; i += 1) {
    const source = rooms.get(mainPathIds[i]);
    const used = new Set((source?.connections ?? []).map((entry) => entry.direction));
    const direction = pickUnusedDirection(rng, used, 'east');
    connectBidirectional(rooms, roomGraph, mainPathIds[i], mainPathIds[i + 1], direction, `main-${edgeCounter}`);
    edgeCounter += 1;
  }

  let sideCounter = 0;
  while (rooms.size < targetRooms) {
    const mustGrow = rooms.size < minRooms;
    if (!mustGrow && rng() > branchProbability) break;

    const parents = [...rooms.values()].filter((room) => roomExitCount(room) < maxExitsPerRoom);
    const parent = parents[Math.floor(rng() * parents.length)];
    if (!parent) break;

    sideCounter += 1;
    const childId = `side-${sideCounter}`;
    rooms.set(childId, createRoomNode(childId, randomInt(rng, 0, 0x7fffffff), parent.depth + 1));
    roomGraph[childId] = {};

    const used = new Set(parent.connections.map((entry) => entry.direction));
    const direction = pickUnusedDirection(rng, used);
    connectBidirectional(rooms, roomGraph, parent.id, childId, direction, `side-${edgeCounter}`);
    edgeCounter += 1;
  }

  const roomList = [...rooms.values()];
  for (const room of roomList) {
    while (roomExitCount(room) < minExitsPerRoom) {
      const partner = roomList.find((candidate) => (
        candidate.id !== room.id
        && roomExitCount(candidate) < maxExitsPerRoom
        && !isConnected(rooms, room.id, candidate.id)
      ));
      if (!partner) break;

      const used = new Set(room.connections.map((entry) => entry.direction));
      const direction = pickUnusedDirection(rng, used);
      connectBidirectional(rooms, roomGraph, room.id, partner.id, direction, `extra-${edgeCounter}`);
      edgeCounter += 1;
    }
  }

  validateGraph(rooms, roomGraph);

  return {
    rooms,
    roomGraph,
    startRoomId: 'start',
    debugEvents: [{ type: 'ROOM_GRAPH_CREATED', roomCount: rooms.size }],
  };
}
