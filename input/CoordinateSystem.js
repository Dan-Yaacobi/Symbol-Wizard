export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function worldToCanvas(worldX, worldY, camera, cellW = 8, cellH = 8) {
  return {
    x: (worldX - camera.x) * cellW,
    y: (worldY - camera.y) * cellH,
  };
}

export function screenToCanvas(viewport, screenX, screenY) {
  return viewport.screenToCanvas(screenX, screenY);
}

export function canvasToWorld(viewport, canvasX, canvasY, camera, cellW = 8, cellH = 8) {
  return viewport.canvasToWorld(canvasX, canvasY, camera, cellW, cellH);
}

export function screenToWorld(viewport, screenX, screenY, camera, cellW = 8, cellH = 8) {
  return viewport.screenToWorld(screenX, screenY, camera, cellW, cellH);
}
