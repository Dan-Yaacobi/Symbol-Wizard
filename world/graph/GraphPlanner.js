import { generateRoomGraph } from '../RoomGraphGenerator.js';

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

function isConnected(rooms, sourceId, targetId) {
  return (rooms.get(sourceId)?.connections ?? []).some((connection) => connection.targetRoomId === targetId);
}

function inferEdgeType(edgeId = '') {
  if (edgeId.startsWith('main-')) {
    return { edgeType: 'critical', importance: 'high' };
  }
  if (edgeId.startsWith('return-')) {
    return { edgeType: 'return', importance: 'low' };
  }
  return { edgeType: 'optional', importance: 'low' };
}

function inferNodeType(room) {
  if (room.id === 'start') return 'start';
  if (room.id === 'exit') return 'main';
  if (room.isCriticalPath) return 'main';
  if ((room.connections?.length ?? 0) <= 1) return 'leaf';
  return 'branch';
}

function annotateNodeMetadata(rooms) {
  const criticalIds = new Set();
  for (const room of rooms.values()) {
    if (room.id === 'start' || room.id === 'exit' || room.id.startsWith('main-')) {
      criticalIds.add(room.id);
    }
  }

  const queue = [];
  const branchDepth = new Map();
  for (const id of criticalIds) {
    queue.push(id);
    branchDepth.set(id, 0);
  }

  while (queue.length > 0) {
    const currentId = queue.shift();
    const current = rooms.get(currentId);
    const currentDepth = branchDepth.get(currentId) ?? 0;
    for (const connection of current?.connections ?? []) {
      const nextId = connection.targetRoomId;
      if (branchDepth.has(nextId)) continue;
      branchDepth.set(nextId, currentDepth + 1);
      queue.push(nextId);
    }
  }

  for (const room of rooms.values()) {
    room.isCriticalPath = criticalIds.has(room.id);
    room.branchDepth = branchDepth.get(room.id) ?? 0;
    room.roomRole = room.isCriticalPath
      ? (room.id === 'start' ? 'start' : room.id === 'exit' ? 'exit' : 'main')
      : (room.connections.length <= 1 ? 'leaf' : 'branch');
    room.nodeType = inferNodeType(room);

    for (const connection of room.connections ?? []) {
      const { edgeType, importance } = inferEdgeType(connection.edgeId);
      connection.edgeType = edgeType;
      connection.importance = importance;
    }
  }
}

function listUniqueEdges(rooms) {
  const edges = [];
  const seen = new Set();
  for (const room of rooms.values()) {
    for (const connection of room.connections ?? []) {
      const key = `${room.id}=>${connection.targetRoomId}:${connection.edgeId}`;
      const reverseKey = `${connection.targetRoomId}=>${room.id}:${connection.edgeId}`;
      if (seen.has(key) || seen.has(reverseKey)) continue;
      seen.add(key);
      seen.add(reverseKey);
      edges.push({
        edgeId: connection.edgeId,
        from: room.id,
        to: connection.targetRoomId,
        direction: connection.direction,
        edgeType: connection.edgeType,
        importance: connection.importance,
      });
    }
  }
  return edges;
}

function findCompatibleDirections(source, target) {
  const sourceUsed = new Set((source.connections ?? []).map((connection) => connection.direction));
  const targetUsed = new Set((target.connections ?? []).map((connection) => connection.direction));
  const pairs = [];
  for (const direction of DIRECTIONS) {
    const reverse = oppositeDirection(direction);
    if (!sourceUsed.has(direction) && !targetUsed.has(reverse)) {
      pairs.push({ sourceDirection: direction, targetDirection: reverse });
    }
  }
  return pairs;
}

function addLoopConnection({ rooms, roomGraph, sourceId, targetId, direction, edgeId }) {
  const source = rooms.get(sourceId);
  const target = rooms.get(targetId);
  if (!source || !target) return false;
  if (isConnected(rooms, sourceId, targetId)) return false;

  const reverseDirection = oppositeDirection(direction);
  roomGraph[sourceId] ||= {};
  roomGraph[targetId] ||= {};
  if (roomGraph[sourceId][direction] || roomGraph[targetId][reverseDirection]) return false;

  roomGraph[sourceId][direction] = targetId;
  roomGraph[targetId][reverseDirection] = sourceId;

  const forwardExitId = `${edgeId}:${direction}`;
  const reverseExitId = `${edgeId}:${reverseDirection}`;
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
    edgeType: 'optional',
    importance: 'low',
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
    edgeType: 'optional',
    importance: 'low',
  });

  target.entrances[forwardEntranceId] = { direction: reverseDirection, corridorWidth: 3, clearanceRadius: 3 };
  source.entrances[reverseEntranceId] = { direction, corridorWidth: 3, clearanceRadius: 3 };

  return true;
}

export class GraphPlanner {
  plan({ seed, biomeConfig = {} } = {}) {
    const graph = generateRoomGraph({ seed, biomeConfig });
    this.addLoopEdges(graph, seed);
    annotateNodeMetadata(graph.rooms);
    graph.graphEdges = listUniqueEdges(graph.rooms);
    const metrics = this.analyzeGraph(graph);
    console.info('[GraphPlanner] Graph metrics:', metrics);
    graph.debugEvents = [...(graph.debugEvents ?? []), { type: 'GRAPH_PLANNER_METRICS', metrics }];
    return graph;
  }

  addLoopEdges(graph, seed = 0) {
    const rng = createRng((seed ^ 0x9E3779B9) >>> 0);
    const roomList = [...graph.rooms.values()];
    if (roomList.length < 3) return;

    const loopTarget = randomInt(rng, 0, 2);
    let loopsAdded = 0;
    let attempts = 0;
    const maxAttempts = Math.max(10, roomList.length * roomList.length);

    while (loopsAdded < loopTarget && attempts < maxAttempts) {
      attempts += 1;
      const source = roomList[randomInt(rng, 0, roomList.length - 1)];
      const target = roomList[randomInt(rng, 0, roomList.length - 1)];
      if (!source || !target || source.id === target.id) continue;
      if (Math.abs((source.depth ?? 0) - (target.depth ?? 0)) > 3) continue;
      if (isConnected(graph.rooms, source.id, target.id)) continue;

      const compatible = findCompatibleDirections(source, target);
      if (compatible.length === 0) continue;
      const pair = compatible[randomInt(rng, 0, compatible.length - 1)];

      const success = addLoopConnection({
        rooms: graph.rooms,
        roomGraph: graph.roomGraph,
        sourceId: source.id,
        targetId: target.id,
        direction: pair.sourceDirection,
        edgeId: `loop-${loopsAdded}-${source.id}-${target.id}`,
      });

      if (success) loopsAdded += 1;
    }

    if (loopsAdded > 0) {
      graph.debugEvents = [...(graph.debugEvents ?? []), { type: 'GRAPH_LOOPS_ADDED', loopCount: loopsAdded }];
    }
  }

  analyzeGraph(graph) {
    const roomList = [...(graph.rooms?.values() ?? [])];
    const totalRooms = roomList.length;
    const uniqueEdges = listUniqueEdges(graph.rooms ?? new Map());
    const totalEdges = uniqueEdges.length;
    const avgDegree = totalRooms > 0 ? Number(((totalEdges * 2) / totalRooms).toFixed(2)) : 0;
    const branchNodeCount = roomList.filter((room) => room.nodeType === 'branch').length;
    const leafCount = roomList.filter((room) => room.nodeType === 'leaf').length;
    const loopCount = Math.max(0, totalEdges - Math.max(0, totalRooms - 1));
    const maxDepth = roomList.reduce((max, room) => Math.max(max, room.depth ?? 0), 0);

    return {
      totalRooms,
      totalEdges,
      avgDegree,
      branchNodeCount,
      leafCount,
      loopCount,
      maxDepth,
    };
  }
}
