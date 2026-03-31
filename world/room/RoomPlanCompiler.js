function buildAnchor(connection) {
  const isCritical = connection.edgeType === 'critical';
  return {
    id: connection.exitId,
    direction: connection.direction,
    edgeType: connection.edgeType ?? 'optional',
    required: isCritical,
  };
}

function buildReservedZones(roomNode) {
  const corridorZones = (roomNode.connections ?? []).map((connection) => ({
    type: 'corridor',
    anchorId: connection.exitId,
    direction: connection.direction,
    width: connection.corridorWidth ?? 3,
    clearanceRadius: connection.clearanceRadius ?? 3,
  }));

  return [
    ...corridorZones,
    {
      type: 'spawnSafety',
      center: 'spawn',
      radius: 6,
    },
  ];
}

function buildPlacementBudgets(roomNode) {
  const depth = roomNode.depth ?? 0;
  const branchDepth = roomNode.branchDepth ?? 0;
  const scale = Math.max(0, depth + branchDepth);
  return {
    objects: Math.max(12, 24 + scale),
    enemies: Math.max(2, 3 + Math.floor(depth / 2)),
    landmarks: roomNode.isCriticalPath ? 2 : 1,
  };
}

export class RoomPlanCompiler {
  static compile(roomNode, roomConnections = roomNode?.connections ?? []) {
    const anchors = roomConnections.map(buildAnchor);
    const requiredAnchors = anchors.filter((anchor) => anchor.required);
    const optionalAnchors = anchors.filter((anchor) => !anchor.required);

    const requiredRoutes = requiredAnchors.map((anchor) => ({ from: 'spawn', to: anchor.id }));

    const optionalRoutes = [];
    for (let i = 0; i < optionalAnchors.length; i += 1) {
      for (let j = i + 1; j < optionalAnchors.length; j += 1) {
        optionalRoutes.push({ from: optionalAnchors[i].id, to: optionalAnchors[j].id });
      }
    }

    if (optionalRoutes.length === 0 && optionalAnchors.length === 1 && requiredAnchors.length > 0) {
      optionalRoutes.push({ from: optionalAnchors[0].id, to: requiredAnchors[0].id });
    }

    const plan = {
      roomId: roomNode.id,
      roomRole: roomNode.roomRole ?? 'main',
      spawnZone: {
        id: 'spawn',
        type: 'center-safe-zone',
      },
      anchors,
      requiredRoutes,
      optionalRoutes,
      reservedZones: buildReservedZones(roomNode),
      placementBudgets: buildPlacementBudgets(roomNode),
    };

    console.info('[RoomPlanCompiler] Plan created:', {
      roomId: plan.roomId,
      role: plan.roomRole,
      requiredRoutes: plan.requiredRoutes.length,
      optionalRoutes: plan.optionalRoutes.length,
    });

    return plan;
  }
}
