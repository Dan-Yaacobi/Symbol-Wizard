export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getCanvasPosition(event, canvas) {
  return screenToCanvas(event.clientX, event.clientY, canvas);
}

export function screenToCanvas(screenX, screenY, canvas) {
  const rect = canvas.getBoundingClientRect();
  const safeWidth = Math.max(1, rect.width);
  const safeHeight = Math.max(1, rect.height);

  return {
    x: (screenX - rect.left) * (canvas.width / safeWidth),
    y: (screenY - rect.top) * (canvas.height / safeHeight),
  };
}

export function canvasToWorld(canvasX, canvasY, camera, cellW = 8, cellH = 8) {
  return {
    x: canvasX / cellW + camera.x,
    y: canvasY / cellH + camera.y,
  };
}

export function worldToCanvas(worldX, worldY, camera, cellW = 8, cellH = 8) {
  return {
    x: (worldX - camera.x) * cellW,
    y: (worldY - camera.y) * cellH,
  };
}

export function screenToWorld(event, camera, canvas, cellW = 8, cellH = 8) {
  const canvasPos = getCanvasPosition(event, canvas);
  return canvasToWorld(canvasPos.x, canvasPos.y, camera, cellW, cellH);
}
