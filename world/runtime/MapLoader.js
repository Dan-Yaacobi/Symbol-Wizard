function rafNextFrame() {
  if (typeof globalThis?.requestAnimationFrame === 'function') {
    return new Promise((resolve) => globalThis.requestAnimationFrame(() => resolve()));
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export class MapLoader {
  constructor({
    worldMapManager,
    maxCachedRooms = 10,
    frameBudgetMs = 8,
    buildBackgroundCache = null,
  } = {}) {
    this.worldMapManager = worldMapManager;
    this.maxCachedRooms = Math.max(3, maxCachedRooms);
    this.frameBudgetMs = Math.max(2, frameBudgetMs);
    this.buildBackgroundCache = typeof buildBackgroundCache === 'function' ? buildBackgroundCache : null;
    this.roomCache = new Map();
    this.generationQueue = [];
    this.pendingLoads = new Map();
    this.schedulerRunning = false;
    this.lastFrameAtMs = 0;
    this.currentRoomId = null;
    this.transitionTargetRoomId = null;
  }

  nextFrame() {
    return rafNextFrame();
  }

  nowMs() {
    return globalThis?.performance?.now?.() ?? Date.now();
  }

  isFrameOverBudget() {
    const now = this.nowMs();
    const delta = now - this.lastFrameAtMs;
    this.lastFrameAtMs = now;
    return Number.isFinite(delta) && delta > this.frameBudgetMs;
  }

  getQueueSnapshot() {
    const done = this.generationQueue.filter((task) => task.status === 'done').length;
    return {
      total: this.generationQueue.length,
      done,
      pending: this.generationQueue.length - done,
    };
  }

  startScheduler() {
    if (this.schedulerRunning) return;
    this.schedulerRunning = true;
    void this.runScheduler();
  }

  enqueueRoom(roomId, priority = 'MEDIUM', request = null) {
    const canonicalRoomId = this.resolveCanonicalRoomId(roomId, request);
    if (!canonicalRoomId) return;
    const existing = this.generationQueue.find((task) => task.roomId === canonicalRoomId && task.status !== 'done');
    if (existing) {
      if (this.priorityRank(priority) < this.priorityRank(existing.priority)) existing.priority = priority;
      return;
    }
    this.generationQueue.push({ roomId: canonicalRoomId, priority, status: 'pending', request });
  }

  priorityRank(priority) {
    if (priority === 'HIGH') return 0;
    if (priority === 'MEDIUM') return 1;
    return 2;
  }

  getNextTask() {
    const pending = this.generationQueue.filter((task) => task.status === 'pending');
    pending.sort((a, b) => this.priorityRank(a.priority) - this.priorityRank(b.priority));
    return pending[0] ?? null;
  }

  requestRoom(roomId, { priority = 'MEDIUM', request = null } = {}) {
    const canonicalRoomId = this.resolveCanonicalRoomId(roomId, request);
    if (!canonicalRoomId) return null;
    if (this.roomCache.has(canonicalRoomId)) {
      console.info('[MapLoader] cache hit', canonicalRoomId);
      return this.roomCache.get(canonicalRoomId);
    }
    console.info('[MapLoader] cache miss', canonicalRoomId);
    if (!this.pendingLoads.has(canonicalRoomId)) this.enqueueRoom(canonicalRoomId, priority, request);
    this.startScheduler();
    return null;
  }

  async loadRoom(roomId, options = {}) {
    return this.ensureRoomReady(roomId, options);
  }

  isRoomReady(roomId) {
    const canonicalRoomId = this.resolveCanonicalRoomId(roomId);
    return canonicalRoomId ? this.roomCache.has(canonicalRoomId) : false;
  }

  getRoom(roomId) {
    const canonicalRoomId = this.resolveCanonicalRoomId(roomId);
    return canonicalRoomId ? (this.roomCache.get(canonicalRoomId) ?? null) : null;
  }

  async ensureRoomReady(roomId, { priority = 'HIGH', request = null } = {}) {
    const canonicalRoomId = this.resolveCanonicalRoomId(roomId, request);
    if (!canonicalRoomId) return null;
    const cached = this.roomCache.get(canonicalRoomId);
    if (cached) return cached;
    this.requestRoom(canonicalRoomId, { priority, request });
    if (this.pendingLoads.has(canonicalRoomId)) return this.pendingLoads.get(canonicalRoomId);

    const waitPromise = new Promise((resolve, reject) => {
      const check = async () => {
        try {
          const loaded = this.roomCache.get(canonicalRoomId);
          if (loaded) {
            resolve(loaded);
            return;
          }
          await this.nextFrame();
          check();
        } catch (error) {
          reject(error);
        }
      };
      check();
    });
    this.pendingLoads.set(canonicalRoomId, waitPromise);
    try {
      return await waitPromise;
    } finally {
      this.pendingLoads.delete(canonicalRoomId);
    }
  }

  async processRoomGeneration(roomId, request = null) {
    const requestedRoomId = this.resolveCanonicalRoomId(roomId, request);
    if (!requestedRoomId) return null;
    await this.nextFrame();
    const room = this.worldMapManager.loadMap(request ?? this.worldMapManager.buildRequestFromRoomId(requestedRoomId), { fromMapLoader: true });
    await this.nextFrame();
    if (room) {
      this.ensureBackgroundCache(room);
      this.roomCache.set(requestedRoomId, room);
      this.evictIfNeeded(requestedRoomId);
      console.info('[MapLoader] ready:', requestedRoomId);
    }
    return room;
  }

  evictIfNeeded(activeRoomId, pendingRoomId = null) {
    if (this.roomCache.size <= this.maxCachedRooms) return;
    const protectedIds = this.buildProtectedRoomIds(
      activeRoomId ?? this.currentRoomId,
      pendingRoomId ?? this.transitionTargetRoomId,
    );
    const ids = [...this.roomCache.keys()];
    for (const roomId of ids) {
      if (this.roomCache.size <= this.maxCachedRooms) return;
      if (protectedIds.has(roomId)) continue;
      this.roomCache.delete(roomId);
      console.info('[MapLoader] evicted room', roomId);
    }
  }

  async runScheduler() {
    while (this.schedulerRunning) {
      if (this.isFrameOverBudget()) {
        await this.nextFrame();
        continue;
      }
      const task = this.getNextTask();
      if (task) {
        task.status = 'in_progress';
        await this.processRoomGeneration(task.roomId, task.request);
        task.status = 'done';
      }
      await this.nextFrame();
    }
  }

  async prepareExitTarget(currentMap, normalizedExit) {
    const request = this.worldMapManager.buildRequestFromExit(currentMap, normalizedExit);
    if (!request?.roomId) return { targetRoom: null, targetEntrance: null };
    const targetRoom = await this.ensureRoomReady(request.roomId, { priority: 'HIGH', request });
    const targetEntrance = this.worldMapManager.getEntrance(targetRoom, normalizedExit.targetEntryId ?? normalizedExit.targetEntranceId);
    if (currentMap?.id) {
      this.enqueueNeighbors(currentMap, { priority: 'MEDIUM', depth: 2 });
    }
    return { targetRoom, targetEntrance };
  }

  enqueueInitialRooms(startRoom) {
    if (!startRoom?.id) return;
    this.requestRoom(startRoom.id, { priority: 'HIGH', request: this.worldMapManager.buildRequestFromRoomId(startRoom.id) });
    this.enqueueNeighbors(startRoom, { priority: 'MEDIUM', depth: 1 });
  }

  enqueueNeighbors(room, { priority = 'MEDIUM', depth = 1 } = {}) {
    if (!room || depth <= 0) return;
    const exits = Array.isArray(room.exits)
      ? room.exits
      : Object.entries(room.exits ?? {}).map(([id, exit]) => ({ id, ...exit }));
    for (const exit of exits) {
      const request = this.worldMapManager.buildRequestFromExit(room, exit);
      if (!request?.roomId) continue;
      this.requestRoom(request.roomId, { priority, request });
      if (depth > 1) {
        this.requestRoom(request.roomId, { priority: 'LOW', request });
      }
    }
  }

  resolveCanonicalRoomId(roomId, request = null) {
    if (request?.roomId) return request.roomId;
    if (!roomId) return null;
    return this.worldMapManager.buildRequestFromRoomId(roomId)?.roomId ?? roomId;
  }

  ensureBackgroundCache(room) {
    if (!room || room.__backgroundCache) return;
    if (!this.buildBackgroundCache) return;
    room.__backgroundCache = this.buildBackgroundCache(room);
  }

  setCurrentRoom(roomId) {
    this.currentRoomId = this.resolveCanonicalRoomId(roomId);
  }

  setTransitionTargetRoom(roomId) {
    this.transitionTargetRoomId = this.resolveCanonicalRoomId(roomId);
  }

  buildProtectedRoomIds(activeRoomId, pendingRoomId = null) {
    const protectedIds = new Set();
    const canonicalActiveRoomId = this.resolveCanonicalRoomId(activeRoomId);
    const canonicalPendingRoomId = this.resolveCanonicalRoomId(pendingRoomId);
    if (canonicalActiveRoomId) protectedIds.add(canonicalActiveRoomId);
    if (canonicalPendingRoomId) protectedIds.add(canonicalPendingRoomId);
    if (canonicalActiveRoomId) this.collectNeighborIds(canonicalActiveRoomId, protectedIds);
    if (canonicalPendingRoomId) this.collectNeighborIds(canonicalPendingRoomId, protectedIds);
    return protectedIds;
  }

  collectNeighborIds(roomId, collector) {
    const room = this.roomCache.get(roomId);
    if (!room) return;
    const exits = Array.isArray(room.exits)
      ? room.exits
      : Object.entries(room.exits ?? {}).map(([id, exit]) => ({ id, ...exit }));
    for (const exit of exits) {
      const request = this.worldMapManager.buildRequestFromExit(room, exit);
      if (request?.roomId) collector.add(request.roomId);
    }
  }
}

export function nextFrame() {
  return rafNextFrame();
}
