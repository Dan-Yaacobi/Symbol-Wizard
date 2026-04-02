function rafNextFrame() {
  if (typeof globalThis?.requestAnimationFrame === 'function') {
    return new Promise((resolve) => globalThis.requestAnimationFrame(() => resolve()));
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export class MapLoader {
  constructor({ worldMapManager, maxCachedRooms = 5, frameBudgetMs = 8 } = {}) {
    this.worldMapManager = worldMapManager;
    this.maxCachedRooms = Math.max(3, maxCachedRooms);
    this.frameBudgetMs = Math.max(2, frameBudgetMs);
    this.roomCache = new Map();
    this.generationQueue = [];
    this.pendingLoads = new Map();
    this.schedulerRunning = false;
    this.lastFrameAtMs = 0;
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
    if (!roomId) return;
    const existing = this.generationQueue.find((task) => task.roomId === roomId && task.status !== 'done');
    if (existing) {
      if (this.priorityRank(priority) < this.priorityRank(existing.priority)) existing.priority = priority;
      return;
    }
    this.generationQueue.push({ roomId, priority, status: 'pending', request });
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
    if (this.roomCache.has(roomId)) return this.roomCache.get(roomId);
    this.enqueueRoom(roomId, priority, request);
    this.startScheduler();
    return null;
  }

  async loadRoom(roomId, options = {}) {
    return this.ensureRoomReady(roomId, options);
  }

  async ensureRoomReady(roomId, { priority = 'HIGH', request = null } = {}) {
    const cached = this.roomCache.get(roomId);
    if (cached) return cached;
    this.requestRoom(roomId, { priority, request });
    if (this.pendingLoads.has(roomId)) return this.pendingLoads.get(roomId);

    const waitPromise = new Promise((resolve, reject) => {
      const check = async () => {
        try {
          const loaded = this.roomCache.get(roomId);
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
    this.pendingLoads.set(roomId, waitPromise);
    try {
      return await waitPromise;
    } finally {
      this.pendingLoads.delete(roomId);
    }
  }

  async processRoomGeneration(roomId, request = null) {
    const room = this.worldMapManager.loadMap(request ?? this.worldMapManager.buildRequestFromRoomId(roomId), { fromMapLoader: true });
    await this.nextFrame();
    await this.nextFrame();
    await this.nextFrame();
    await this.nextFrame();
    if (room?.id) {
      this.roomCache.set(room.id, room);
      this.evictIfNeeded(room.id);
    }
    return room;
  }

  evictIfNeeded(activeRoomId) {
    if (this.roomCache.size <= this.maxCachedRooms) return;
    const ids = [...this.roomCache.keys()];
    for (const roomId of ids) {
      if (this.roomCache.size <= this.maxCachedRooms) return;
      if (roomId === activeRoomId) continue;
      this.roomCache.delete(roomId);
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
}

export function nextFrame() {
  return rafNextFrame();
}
