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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
  if (edgeId.startsWith('shortcut-')) {
    return { edgeType: 'shortcut', importance: 'medium' };
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
    edgeType: edgeId.startsWith('shortcut-') ? 'shortcut' : 'optional',
    importance: edgeId.startsWith('shortcut-') ? 'medium' : 'low',
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
    edgeType: edgeId.startsWith('shortcut-') ? 'shortcut' : 'optional',
    importance: edgeId.startsWith('shortcut-') ? 'medium' : 'low',
  });

  target.entrances[forwardEntranceId] = { direction: reverseDirection, corridorWidth: 3, clearanceRadius: 3 };
  source.entrances[reverseEntranceId] = { direction, corridorWidth: 3, clearanceRadius: 3 };

  return true;
}

function annotateNodeMetadata(rooms, { mainPathIds = [], branchDepthMap = new Map() } = {}) {
  const criticalIds = new Set(mainPathIds);
  for (const room of rooms.values()) {
    room.isCriticalPath = criticalIds.has(room.id);
    room.branchDepth = room.isCriticalPath ? 0 : (branchDepthMap.get(room.id) ?? 1);
    room.roomRole = room.id === 'start'
      ? 'start'
      : room.id === 'exit'
        ? 'exit'
        : room.isCriticalPath
          ? 'main'
          : 'branch';
    room.nodeType = inferNodeType(room);
  }

  for (const room of rooms.values()) {
    const hasChild = (room.connections ?? []).some((connection) => {
      const target = rooms.get(connection.targetRoomId);
      return (target?.depth ?? 0) > (room.depth ?? 0);
    });
    if (!room.isCriticalPath && !hasChild) {
      room.nodeType = 'leaf';
      room.roomRole = 'leaf';
    }

    for (const connection of room.connections ?? []) {
      const { edgeType, importance } = inferEdgeType(connection.edgeId);
      connection.edgeType = edgeType;
      connection.importance = importance;
    }
  }
}

export class GraphPlanner {
  plan({ seed, biomeConfig = {} } = {}) {
    const graph = generateRoomGraph({ seed, biomeConfig });
    const structure = this.rebuildTopology(graph, seed);
    this.addLoopEdges(graph, seed, structure);
    annotateNodeMetadata(graph.rooms, structure);
    graph.graphEdges = listUniqueEdges(graph.rooms);
    const metrics = this.analyzeGraph(graph);
    console.info('[GraphPlanner] Graph metrics:', metrics);
    console.info('[GraphPlanner] Structure:', {
      mainPathLength: structure.mainPathLength,
      branchNodeCount: metrics.branchNodeCount,
      branchChainCount: metrics.branchChainCount,
      loopCount: metrics.loopCount,
    });
    graph.debugEvents = [...(graph.debugEvents ?? []), { type: 'GRAPH_PLANNER_METRICS', metrics }];
    return graph;
  }

  rebuildTopology(graph, seed = 0) {
    const rng = createRng((seed ^ 0xA24BAED4) >>> 0);
    const roomList = [...graph.rooms.values()];
    const totalRooms = roomList.length;
    if (totalRooms < 2) {
      return { mainPathIds: ['start', 'exit'], branchDepthMap: new Map(), branchRoots: new Set(), mainPathLength: totalRooms };
    }

    const startRoom = graph.rooms.get('start');
    const exitRoom = graph.rooms.get('exit');
    if (!startRoom || !exitRoom) {
      return { mainPathIds: [], branchDepthMap: new Map(), branchRoots: new Set(), mainPathLength: 0 };
    }

    const nonCriticalRooms = roomList.filter((room) => room.id !== 'start' && room.id !== 'exit');
    for (const room of roomList) {
      room.connections = [];
      room.entrances = {};
      room.exits = {};
      graph.roomGraph[room.id] = {};
    }

    const sampledMainLength = Math.round(totalRooms * (0.4 + (rng() * 0.2)));
    const mainPathLength = clamp(sampledMainLength, 2, Math.max(2, totalRooms - 2));
    const mainInteriorCount = Math.max(0, mainPathLength - 2);

    const shuffledCandidates = [...nonCriticalRooms];
    for (let i = shuffledCandidates.length - 1; i > 0; i -= 1) {
      const j = randomInt(rng, 0, i);
      [shuffledCandidates[i], shuffledCandidates[j]] = [shuffledCandidates[j], shuffledCandidates[i]];
    }

    const mainInterior = shuffledCandidates.slice(0, mainInteriorCount);
    const branchPool = shuffledCandidates.slice(mainInteriorCount);
    const mainPathIds = ['start', ...mainInterior.map((room) => room.id), 'exit'];
    const mainIndex = new Map(mainPathIds.map((id, index) => [id, index]));

    let edgeCounter = 0;
    for (let i = 0; i < mainPathIds.length - 1; i += 1) {
      const source = graph.rooms.get(mainPathIds[i]);
      const target = graph.rooms.get(mainPathIds[i + 1]);
      const compatible = findCompatibleDirections(source, target);
      if (compatible.length === 0) continue;
      const pair = compatible[randomInt(rng, 0, compatible.length - 1)];
      addLoopConnection({
        rooms: graph.rooms,
        roomGraph: graph.roomGraph,
        sourceId: source.id,
        targetId: target.id,
        direction: pair.sourceDirection,
        edgeId: `main-${edgeCounter}`,
      });
      source.depth = i;
      target.depth = i + 1;
      edgeCounter += 1;
    }

    const branchDepthMap = new Map();
    const branchRoots = new Set();
    const branchParents = mainPathIds.slice(1, Math.max(2, mainPathIds.length - 1));
    const requestedParents = clamp(
      Math.ceil(totalRooms * (0.3 + (rng() * 0.3))),
      1,
      Math.max(1, Math.min(branchParents.length, branchPool.length)),
    );

    const shuffledParents = [...branchParents];
    for (let i = shuffledParents.length - 1; i > 0; i -= 1) {
      const j = randomInt(rng, 0, i);
      [shuffledParents[i], shuffledParents[j]] = [shuffledParents[j], shuffledParents[i]];
    }
    const selectedParents = shuffledParents.slice(0, requestedParents);

    let branchCursor = 0;
    for (const parentId of selectedParents) {
      if (branchCursor >= branchPool.length) break;
      const branchLength = randomInt(rng, 1, 3);
      let previousId = parentId;
      let currentDepth = 1;
      let nodesAdded = 0;
      while (nodesAdded < branchLength && branchCursor < branchPool.length) {
        const child = branchPool[branchCursor];
        const parentNode = graph.rooms.get(previousId);
        const compatible = findCompatibleDirections(parentNode, child);
        if (compatible.length === 0) break;
        const pair = compatible[randomInt(rng, 0, compatible.length - 1)];
        const linked = addLoopConnection({
          rooms: graph.rooms,
          roomGraph: graph.roomGraph,
          sourceId: previousId,
          targetId: child.id,
          direction: pair.sourceDirection,
          edgeId: `branch-${edgeCounter}`,
        });
        if (!linked) break;
        branchCursor += 1;
        branchDepthMap.set(child.id, currentDepth);
        child.depth = (graph.rooms.get(parentId)?.depth ?? 0) + currentDepth;
        if (currentDepth === 1) branchRoots.add(child.id);
        previousId = child.id;
        currentDepth += 1;
        edgeCounter += 1;
        nodesAdded += 1;
      }
    }

    while (branchCursor < branchPool.length) {
      const child = branchPool[branchCursor];
      const branchCandidates = roomList
        .filter((room) => room.id !== child.id && (branchDepthMap.get(room.id) ?? 0) > 0)
        .map((room) => room.id);
      if (branchCandidates.length === 0) break;
      const parentId = branchCandidates[randomInt(rng, 0, branchCandidates.length - 1)];
      const parentNode = graph.rooms.get(parentId);
      const compatible = findCompatibleDirections(parentNode, child);
      if (compatible.length === 0) {
        branchCursor += 1;
        continue;
      }
      const pair = compatible[randomInt(rng, 0, compatible.length - 1)];
      const linked = addLoopConnection({
        rooms: graph.rooms,
        roomGraph: graph.roomGraph,
        sourceId: parentId,
        targetId: child.id,
        direction: pair.sourceDirection,
        edgeId: `branch-${edgeCounter}`,
      });
      branchCursor += 1;
      if (!linked) continue;
      const childBranchDepth = (branchDepthMap.get(parentId) ?? 1) + 1;
      branchDepthMap.set(child.id, childBranchDepth);
      child.depth = (parentNode?.depth ?? 0) + 1;
      edgeCounter += 1;
    }

    const connected = new Set(['start']);
    const queue = ['start'];
    while (queue.length > 0) {
      const currentId = queue.shift();
      const currentRoom = graph.rooms.get(currentId);
      for (const connection of currentRoom?.connections ?? []) {
        if (connected.has(connection.targetRoomId)) continue;
        connected.add(connection.targetRoomId);
        queue.push(connection.targetRoomId);
      }
    }

    const disconnected = roomList.filter((room) => !connected.has(room.id));
    for (const room of disconnected) {
      const attachmentCandidates = roomList.filter((candidate) => connected.has(candidate.id) && candidate.id !== room.id);
      let linked = false;
      for (const candidate of attachmentCandidates) {
        const compatible = findCompatibleDirections(candidate, room);
        if (compatible.length === 0) continue;
        const pair = compatible[randomInt(rng, 0, compatible.length - 1)];
        linked = addLoopConnection({
          rooms: graph.rooms,
          roomGraph: graph.roomGraph,
          sourceId: candidate.id,
          targetId: room.id,
          direction: pair.sourceDirection,
          edgeId: `branch-${edgeCounter}`,
        });
        if (!linked) continue;
        const candidateBranchDepth = branchDepthMap.get(candidate.id) ?? 0;
        const roomBranchDepth = candidateBranchDepth > 0 ? candidateBranchDepth + 1 : 1;
        branchDepthMap.set(room.id, roomBranchDepth);
        if (roomBranchDepth === 1) branchRoots.add(room.id);
        room.depth = (candidate.depth ?? 0) + 1;
        edgeCounter += 1;
        connected.add(room.id);
        linked = true;
        break;
      }
      if (!linked) {
        room.depth = room.depth ?? mainPathIds.length;
      }
    }

    const branchIds = roomList
      .filter((room) => (branchDepthMap.get(room.id) ?? 0) > 0)
      .map((room) => room.id);
    const extraBranchLinksTarget = clamp(Math.floor(totalRooms * 0.35), 1, Math.max(1, branchIds.length));
    let extraBranchLinks = 0;
    let meshAttempts = 0;
    const meshMaxAttempts = Math.max(12, branchIds.length * branchIds.length);
    while (extraBranchLinks < extraBranchLinksTarget && meshAttempts < meshMaxAttempts) {
      meshAttempts += 1;
      if (branchIds.length < 2) break;
      const sourceId = branchIds[randomInt(rng, 0, branchIds.length - 1)];
      const targetId = branchIds[randomInt(rng, 0, branchIds.length - 1)];
      if (!sourceId || !targetId || sourceId === targetId) continue;
      if (isConnected(graph.rooms, sourceId, targetId)) continue;
      const source = graph.rooms.get(sourceId);
      const target = graph.rooms.get(targetId);
      if (Math.abs((branchDepthMap.get(sourceId) ?? 0) - (branchDepthMap.get(targetId) ?? 0)) > 2) continue;
      const compatible = findCompatibleDirections(source, target);
      if (compatible.length === 0) continue;
      const pair = compatible[randomInt(rng, 0, compatible.length - 1)];
      const linked = addLoopConnection({
        rooms: graph.rooms,
        roomGraph: graph.roomGraph,
        sourceId,
        targetId,
        direction: pair.sourceDirection,
        edgeId: `branch-link-${edgeCounter}`,
      });
      if (!linked) continue;
      edgeCounter += 1;
      extraBranchLinks += 1;
    }

    for (const [id, index] of mainIndex.entries()) {
      const room = graph.rooms.get(id);
      if (room) room.depth = index;
    }

    graph.mainPathIds = mainPathIds;
    graph.branchRoots = [...branchRoots];

    return {
      mainPathIds,
      branchDepthMap,
      branchRoots,
      mainPathLength: mainPathIds.length,
    };
  }

  addLoopEdges(graph, seed = 0, structure = {}) {
    const rng = createRng((seed ^ 0x9E3779B9) >>> 0);
    const roomList = [...graph.rooms.values()];
    if (roomList.length < 3) return;

    const branchSet = new Set(structure.branchRoots ?? []);
    const branchDepthMap = structure.branchDepthMap instanceof Map ? structure.branchDepthMap : new Map();
    const loopTarget = randomInt(rng, 2, 3);
    let loopsAdded = 0;
    let attempts = 0;
    const maxAttempts = Math.max(10, roomList.length * roomList.length);

    while (loopsAdded < loopTarget && attempts < maxAttempts) {
      attempts += 1;
      const preferredSources = roomList.filter((room) => room.id !== 'start' && room.id !== 'exit');
      const pool = preferredSources.length > 0 ? preferredSources : roomList;
      const source = pool[randomInt(rng, 0, pool.length - 1)];
      const target = pool[randomInt(rng, 0, pool.length - 1)];
      if (!source || !target || source.id === target.id) continue;
      if (source.id === 'start' && target.id === 'exit') continue;
      if (Math.abs((source.depth ?? 0) - (target.depth ?? 0)) > 3) continue;
      if (isConnected(graph.rooms, source.id, target.id)) continue;
      if ((source.connections ?? []).some((connection) => connection.targetRoomId === target.id)) continue;
      const isNeighborDepth = Math.abs((source.depth ?? 0) - (target.depth ?? 0)) <= 1;
      if (isNeighborDepth) continue;
      const sourceIsBranch = branchSet.has(source.id) || (branchDepthMap.get(source.id) ?? 0) > 0;
      const targetIsBranch = branchSet.has(target.id) || (branchDepthMap.get(target.id) ?? 0) > 0;
      if (!sourceIsBranch && !targetIsBranch) continue;

      const compatible = findCompatibleDirections(source, target);
      if (compatible.length === 0) continue;
      const pair = compatible[randomInt(rng, 0, compatible.length - 1)];

      const success = addLoopConnection({
        rooms: graph.rooms,
        roomGraph: graph.roomGraph,
        sourceId: source.id,
        targetId: target.id,
        direction: pair.sourceDirection,
        edgeId: `shortcut-${loopsAdded}-${source.id}-${target.id}`,
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
    const branchNodeCount = roomList.filter((room) => room.nodeType === 'branch' || room.nodeType === 'leaf').length;
    const leafCount = roomList.filter((room) => room.nodeType === 'leaf').length;
    const loopCount = Math.max(0, totalEdges - Math.max(0, totalRooms - 1));
    const maxDepth = roomList.reduce((max, room) => Math.max(max, room.depth ?? 0), 0);
    const branchNodes = roomList.filter((room) => room.nodeType === 'branch' || room.nodeType === 'leaf');
    const branchDepths = branchNodes.map((room) => room.branchDepth ?? 0).filter((depth) => depth > 0);
    const branchRoots = new Set();
    for (const room of branchNodes) {
      if ((room.branchDepth ?? 0) !== 1) continue;
      const hasMainParent = (room.connections ?? []).some((connection) => graph.rooms.get(connection.targetRoomId)?.isCriticalPath);
      if (hasMainParent) branchRoots.add(room.id);
    }
    const maxBranchDepth = branchDepths.length > 0 ? Math.max(...branchDepths) : 0;
    const avgBranchDepth = branchDepths.length > 0
      ? Number((branchDepths.reduce((sum, depth) => sum + depth, 0) / branchDepths.length).toFixed(2))
      : 0;

    return {
      totalRooms,
      totalEdges,
      avgDegree,
      branchNodeCount,
      leafCount,
      loopCount,
      maxDepth,
      branchChainCount: branchRoots.size,
      maxBranchDepth,
      avgBranchDepth,
    };
  }
}
