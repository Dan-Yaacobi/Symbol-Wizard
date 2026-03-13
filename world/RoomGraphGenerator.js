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

function oppositeDirection(direction) {
  if (direction === 'north') return 'south';
  if (direction === 'south') return 'north';
  if (direction === 'east') return 'west';
  return 'east';
}

function pickDirection(rng, previousDirection = null) {
  const blocked = previousDirection ? oppositeDirection(previousDirection) : null;
  const options = blocked ? DIRECTIONS.filter((dir) => dir !== blocked) : DIRECTIONS;
  return options[Math.floor(rng() * options.length)];
}

function anchorForDirection(direction, roomWidth, roomHeight) {
  const centerX = Math.floor(roomWidth / 2);
  const centerY = Math.floor(roomHeight / 2);
  if (direction === 'north') return { x: centerX, y: 0, direction };
  if (direction === 'south') return { x: centerX, y: roomHeight - 1, direction };
  if (direction === 'west') return { x: 0, y: centerY, direction };
  return { x: roomWidth - 1, y: centerY, direction };
}

function directionFromAnchor(anchor, roomWidth, roomHeight) {
  if (!anchor) return null;
  if (anchor.y === 0) return 'north';
  if (anchor.y === roomHeight - 1) return 'south';
  if (anchor.x === 0) return 'west';
  if (anchor.x === roomWidth - 1) return 'east';
  if (anchor.direction) return anchor.direction;
  return null;
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

function connectRooms(sourceRoom, targetRoom, exitId, entranceId, direction, roomWidth, roomHeight) {
  const targetDirection = oppositeDirection(direction);
  sourceRoom.exits[exitId] = anchorForDirection(direction, roomWidth, roomHeight);
  targetRoom.entrances[entranceId] = anchorForDirection(targetDirection, roomWidth, roomHeight);
  sourceRoom.connections.push({
    exitId,
    targetRoomId: targetRoom.id,
    targetEntranceId: entranceId,
  });

  const returnExitId = `${targetRoom.id}-to-${sourceRoom.id}`;
  const returnEntranceId = `${sourceRoom.id}-from-${targetRoom.id}`;
  targetRoom.exits[returnExitId] = anchorForDirection(targetDirection, roomWidth, roomHeight);
  sourceRoom.entrances[returnEntranceId] = anchorForDirection(direction, roomWidth, roomHeight);
  targetRoom.connections.push({
    exitId: returnExitId,
    targetRoomId: sourceRoom.id,
    targetEntranceId: returnEntranceId,
  });
}

function ensureConnectionAnchors(rooms, roomWidth, roomHeight) {
  for (const room of rooms.values()) {
    for (const connection of room.connections) {
      const targetRoom = rooms.get(connection.targetRoomId);
      if (!targetRoom) continue;

      const existingExit = room.exits[connection.exitId];
      const targetEntrance = targetRoom.entrances[connection.targetEntranceId];

      const inferredDirection =
        directionFromAnchor(existingExit, roomWidth, roomHeight)
        ?? (targetEntrance?.direction ? oppositeDirection(targetEntrance.direction) : null)
        ?? 'east';

      if (!existingExit) {
        room.exits[connection.exitId] = anchorForDirection(inferredDirection, roomWidth, roomHeight);
      }

      if (!targetEntrance) {
        targetRoom.entrances[connection.targetEntranceId] = anchorForDirection(
          oppositeDirection(inferredDirection),
          roomWidth,
          roomHeight,
        );
      }
    }
  }
}

function sameAnchorPosition(left, right) {
  return left?.x === right?.x && left?.y === right?.y;
}

function ensureStartMainPathExit(rooms, mainPathIds, roomWidth, roomHeight) {
  if (mainPathIds.length < 2) return;

  const startRoom = rooms.get(mainPathIds[0]);
  const firstMainRoom = rooms.get(mainPathIds[1]);
  if (!startRoom || !firstMainRoom) return;

  let mainConnection = startRoom.connections.find((entry) => entry.targetRoomId === firstMainRoom.id);
  if (!mainConnection) {
    connectRooms(startRoom, firstMainRoom, 'main-exit-0', 'main-entrance-1', 'east', roomWidth, roomHeight);
    mainConnection = startRoom.connections.find((entry) => entry.targetRoomId === firstMainRoom.id);
  }

  if (!mainConnection) return;

  if (!startRoom.exits[mainConnection.exitId]) {
    startRoom.exits[mainConnection.exitId] = anchorForDirection('east', roomWidth, roomHeight);
  }

  const mainExitAnchor = startRoom.exits[mainConnection.exitId];
  const hasOverlap = Object.entries(startRoom.exits)
    .some(([exitId, anchor]) => exitId !== mainConnection.exitId && sameAnchorPosition(anchor, mainExitAnchor));

  if (!hasOverlap) return;

  const preferredDirection = directionFromAnchor(mainExitAnchor, roomWidth, roomHeight) ?? 'east';
  const orderedDirections = [preferredDirection, ...DIRECTIONS.filter((direction) => direction !== preferredDirection)];
  const occupiedPositions = new Set(
    Object.entries(startRoom.exits)
      .filter(([exitId]) => exitId !== mainConnection.exitId)
      .map(([, anchor]) => `${anchor.x},${anchor.y}`),
  );

  for (const direction of orderedDirections) {
    const candidate = anchorForDirection(direction, roomWidth, roomHeight);
    if (occupiedPositions.has(`${candidate.x},${candidate.y}`)) continue;
    startRoom.exits[mainConnection.exitId] = candidate;
    return;
  }
}

export function generateRoomGraph({
  seed,
  roomWidth = 64,
  roomHeight = 40,
  mainPathMinRooms = 4,
  mainPathMaxRooms = 6,
  sideBranchChance = 0.4,
  sideBranchMinRooms = 1,
  sideBranchMaxRooms = 2,
} = {}) {
  const rng = createRng(seed >>> 0);
  const rooms = new Map();

  const mainPathLength = randomInt(rng, mainPathMinRooms, mainPathMaxRooms);
  const mainPathIds = [];

  for (let i = 0; i < mainPathLength; i += 1) {
    const id = i === 0 ? 'start' : i === mainPathLength - 1 ? 'exit' : `main-${i}`;
    const room = createRoomNode(id, randomInt(rng, 0, 0x7fffffff), i);
    rooms.set(id, room);
    mainPathIds.push(id);
  }

  let forwardDirection = null;
  for (let i = 0; i < mainPathIds.length - 1; i += 1) {
    const sourceRoom = rooms.get(mainPathIds[i]);
    const targetRoom = rooms.get(mainPathIds[i + 1]);
    forwardDirection = pickDirection(rng, forwardDirection);
    connectRooms(sourceRoom, targetRoom, `main-exit-${i}`, `main-entrance-${i + 1}`, forwardDirection, roomWidth, roomHeight);
  }

  let sideRoomCounter = 0;
  for (let i = 0; i < mainPathIds.length - 1; i += 1) {
    if (rng() > sideBranchChance) continue;

    const branchLength = randomInt(rng, sideBranchMinRooms, sideBranchMaxRooms);
    let parentRoom = rooms.get(mainPathIds[i]);
    let branchDirection = pickDirection(rng, null);

    for (let branchIndex = 0; branchIndex < branchLength; branchIndex += 1) {
      sideRoomCounter += 1;
      const branchRoomId = `side-${sideRoomCounter}`;
      const branchRoom = createRoomNode(
        branchRoomId,
        randomInt(rng, 0, 0x7fffffff),
        parentRoom.depth + branchIndex + 1,
      );
      rooms.set(branchRoomId, branchRoom);

      connectRooms(
        parentRoom,
        branchRoom,
        `side-exit-${parentRoom.id}-${branchIndex}`,
        `side-entrance-${branchRoomId}`,
        branchDirection,
        roomWidth,
        roomHeight,
      );

      parentRoom = branchRoom;
      branchDirection = pickDirection(rng, branchDirection);
    }
  }

  ensureConnectionAnchors(rooms, roomWidth, roomHeight);
  ensureStartMainPathExit(rooms, mainPathIds, roomWidth, roomHeight);
  ensureConnectionAnchors(rooms, roomWidth, roomHeight);

  return {
    rooms,
    startRoomId: 'start',
  };
}
