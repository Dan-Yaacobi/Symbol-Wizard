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

  return {
    rooms,
    startRoomId: 'start',
  };
}
