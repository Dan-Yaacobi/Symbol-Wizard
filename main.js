import { Renderer } from './engine/Renderer.js';
import { Camera } from './engine/Camera.js';
import { Input } from './engine/Input.js';
import { Viewport } from './engine/Viewport.js';
import { Player } from './entities/Player.js';
import { BiomeGenerator } from './world/BiomeGenerator.js';
import { RoomTransitionSystem } from './world/RoomTransitionSystem.js';
import { spawnEnemyGroup } from './world/EnemySpawnSystem.js';
import { updateEnemies } from './systems/AISystem.js';
import { updateEnemyPlayerInteractions, updateProjectiles } from './systems/CombatSystem.js';
import * as LootSystem from './systems/LootSystem.js';
import { CombatTextSystem } from './systems/CombatTextSystem.js';
import { renderWorld } from './systems/RenderSystem.js';
import { updateEntityAnimation, updateProjectileAnimation } from './systems/AnimationSystem.js';
import { ChatBox } from './ui/ChatBox.js';
import { drawHUD } from './ui/HUD.js';
import {
  EnemyTuningOverrides,
  applyEnemyTuningToEnemy,
  clearEnemyTuningOverrides,
  getEnemyTuningValue,
  setEnemyTuningOverride,
} from './entities/Enemy.js';
import { RuntimeConfigRegistry } from './devtools/RuntimeConfig.js';
import { DevToolsPanel } from './devtools/DevToolsPanel.js';
import { dialogueTree } from './systems/DialogueSystem.js';
import { DialogueManager } from './systems/DialogueManager.js';
import { SpellRegistry, defaultSpellSlots } from './data/spells.js';
import { AbilitySystem } from './systems/AbilitySystem.js';
import { SpellbookWindow } from './ui/SpellbookWindow.js';
import { SpellCraftingWindow } from './ui/SpellCraftingWindow.js';
import { PrefabEditorScreen } from './ui/PrefabEditorScreen.js';
import { palette } from './entities/SpriteLibrary.js';
import { visualTheme } from './data/VisualTheme.js';
import { rollObjectLoot, tryInteractInFront } from './systems/ObjectInteractionSystem.js';
import { loadObjectsFromFolder } from './world/ObjectLibrary.js';
import {
  cleanupDestroyedObjects,
  resolveObjectCollision,
  updateDestructibleAnimations,
  updateTownNpcs,
} from './systems/WorldObjectSystem.js';
import { resolveWallOverlap } from './systems/EnemyCollisionSystem.js';

const VIEW_W = 104;
const VIEW_H = 58;
const ROOM_W = 240;
const ROOM_H = 160;

const canvas = document.getElementById('gameCanvas');
const renderer = new Renderer(canvas, VIEW_W, VIEW_H, 8, 8);
canvas.style.width = canvas.width + "px";
canvas.style.height = canvas.height + "px";
const camera = new Camera(VIEW_W, VIEW_H, ROOM_W, ROOM_H);
const viewport = new Viewport(canvas);
const input = new Input(canvas, viewport, camera, renderer.cellW, renderer.cellH);
const chat = new ChatBox();
const runtimeConfig = new RuntimeConfigRegistry();
const devToolsPanel = new DevToolsPanel(runtimeConfig);
runtimeConfig.setLogger((message) => logDev(message));

await loadObjectsFromFolder('./assets/objects');

const biomeGenerator = new BiomeGenerator({ roomWidth: ROOM_W, roomHeight: ROOM_H, runtimeConfig });
const currentBiomeId = 'starting-biome';
const { biome, startRoom } = biomeGenerator.enterBiome(currentBiomeId);
let currentBiomeSeed = biome.seed;
let pendingDevSeed = String(currentBiomeSeed);
let activeRoom = startRoom;
let map = activeRoom.tiles;
const player = new Player(Math.floor(ROOM_W / 2), Math.floor(ROOM_H / 2));
player.facing = { x: 0, y: 1 };
const enemies = [];
let enemyAiEnabled = true;
let applyEnemyTuningToExistingEnemies = false;
const npcs = [];
let worldObjects = activeRoom.objects ?? [];
const roomTransitionSystem = new RoomTransitionSystem({ biomeGenerator, fadeDurationMs: 150 });

function randomSeed() {
  return Math.floor(Math.random() * 0x7fffffff);
}


function resolveValidRoomSpawn(room, preferred) {
  const startX = Math.round(preferred.x);
  const startY = Math.round(preferred.y);

  const isOpen = (x, y) => {
    const tile = room?.tiles?.[y]?.[x];
    if (!tile?.walkable) return false;
    if (room?.collisionMap?.[y]?.[x]) return false;
    return true;
  };

  if (isOpen(startX, startY)) return { x: startX, y: startY };

  for (let radius = 1; radius <= 8; radius += 1) {
    for (let y = startY - radius; y <= startY + radius; y += 1) {
      for (let x = startX - radius; x <= startX + radius; x += 1) {
        if (Math.max(Math.abs(x - startX), Math.abs(y - startY)) !== radius) continue;
        if (isOpen(x, y)) return { x, y };
      }
    }
  }

  return { x: Math.floor(ROOM_W / 2), y: Math.floor(ROOM_H / 2) };
}


function syncRoomEnemies(room) {
  enemies.length = 0;
  for (const enemy of room?.entities ?? []) {
    enemy.alive = enemy.alive ?? true;
    resolveWallOverlap(enemy, room?.tiles);
    enemies.push(enemy);
  }
}

function applyEnemyTuningToAllCurrentEnemies() {
  for (const enemy of enemies) applyEnemyTuningToEnemy(enemy);
}

function resolveInitialSpawn(room) {
  const startEntrance = room?.entrances?.['initial-spawn'];
  const spawnBase = {
    x: startEntrance?.spawn?.x ?? startEntrance?.roadAnchor?.x ?? startEntrance?.x ?? Math.floor(ROOM_W / 2),
    y: startEntrance?.spawn?.y ?? startEntrance?.roadAnchor?.y ?? startEntrance?.y ?? Math.floor(ROOM_H / 2),
  };
  return resolveValidRoomSpawn(room, spawnBase);
}

syncRoomEnemies(activeRoom);
if (applyEnemyTuningToExistingEnemies) applyEnemyTuningToAllCurrentEnemies();
const initialSpawn = resolveInitialSpawn(activeRoom);
player.x = initialSpawn.x;
player.y = initialSpawn.y;
camera.follow(player);
let projectiles = [];
let goldPiles = [];
const combatTextSystem = new CombatTextSystem(runtimeConfig);

const abilitySystem = new AbilitySystem({
  definitions: Object.values(SpellRegistry),
  player,
  enemies,
  map,
  camera,
  spawnProjectile: (projectile) => projectiles.push(projectile),
  reportDamage: (enemy, damage, isCritical) => combatTextSystem.spawnDamageText(enemy, damage, isCritical),
  onEnemySlain: (enemy) => {
    const drop = LootSystem.spawnGold(enemy);
    if (drop) goldPiles.push(drop);
  },
});

defaultSpellSlots.forEach((spellId, slotIndex) => {
  abilitySystem.assignAbilityToSlot(slotIndex, spellId);
});

const uiRoot = document.getElementById('uiPanels') ?? (() => {
  const fallback = document.createElement('section');
  fallback.id = 'uiPanels';
  fallback.className = 'ui-panels';
  document.body.appendChild(fallback);
  console.warn('BOOT: #uiPanels missing in startup scene. Created fallback root to prevent startup crash.');
  return fallback;
})();
const spellbook = new SpellbookWindow({ root: uiRoot, abilitySystem, input });
new SpellCraftingWindow({
  root: uiRoot,
  spellbook,
  onCrafted: (spell) => {
    if (!spell?.id || abilitySystem.definitions.has(spell.id)) return false;
    abilitySystem.definitions.set(spell.id, spell);
    abilitySystem.cooldowns.set(spell.id, 0);
    return true;
  },
});

const prefabEditor = new PrefabEditorScreen();
await prefabEditor.initialize();
let prefabEditorToggleLatch = false;
let f1Latch = false;
let f2Latch = false;
let f3Latch = false;
let f4Latch = false;
let f5Latch = false;
let f6Latch = false;
let f7Latch = false;
let f8Latch = false;
let f9Latch = false;

const objectEditorButton = document.createElement('button');
objectEditorButton.type = 'button';
objectEditorButton.className = 'object-editor-button';
objectEditorButton.textContent = 'Object Editor';
objectEditorButton.addEventListener('click', () => {
  if (prefabEditor.isOpen) return;
  prefabEditor.open();
});
document.body.appendChild(objectEditorButton);

const BOOT_DEBUG_PREFIX = 'BOOT:';
const DIAG_PREFIX = 'DIAG:';
let startupCompleteLogged = false;
let cameraCheckpointLogged = false;
let firstProcessLogged = false;
let firstPhysicsLogged = false;

const query = new URLSearchParams(window.location.search);
const diagMode = query.get('diag') === '1';
const diagMinimalMode = query.get('diag_minimal') === '1';
const dialogueDebugMode = query.get('dialogue_debug') === '1';
DialogueManager.DEBUG = dialogueDebugMode;

function logBoot(message, details = undefined) {
  if (details === undefined) {
    console.info(`${BOOT_DEBUG_PREFIX} ${message}`);
    return;
  }
  console.info(`${BOOT_DEBUG_PREFIX} ${message}`, details);
}

function logDiag(message, details = undefined) {
  if (!diagMode) return;
  if (details === undefined) {
    console.info(`${DIAG_PREFIX} ${message}`);
    return;
  }
  console.info(`${DIAG_PREFIX} ${message}`, details);
}


function logDev(message, details = undefined) {
  if (details === undefined) {
    console.info(`[DEV] ${message}`);
    return;
  }
  console.info(`[DEV] ${message}`, details);
}

function toggleOverlayFlag(path) {
  const next = !runtimeConfig.get(path);
  runtimeConfig.set(path, next);
  if (next && !runtimeConfig.get('debug.overlaysEnabled')) {
    runtimeConfig.set('debug.overlaysEnabled', true);
  }
}

function resetEncounterState() {
  enemies.length = 0;
  projectiles = [];
  goldPiles = [];
  combatTextSystem.combatTexts.length = 0;
  player.hp = player.maxHp;
  const spawn = resolveValidRoomSpawn(activeRoom, { x: player.x, y: player.y });
  player.x = spawn.x;
  player.y = spawn.y;
  player.vx = 0;
  player.vy = 0;
  logDev('Encounter reset');
}

function regenerateWorld(seed = null) {
  const nextSeed = seed === null ? randomSeed() : (Number(seed) >>> 0);
  const nextBiomeResult = biomeGenerator.regenerateBiome(currentBiomeId, nextSeed);
  const nextActiveRoom = nextBiomeResult.startRoom;
  if (!nextActiveRoom) return;

  currentBiomeSeed = nextBiomeResult.biome.seed;
  pendingDevSeed = String(currentBiomeSeed);
  roomTransitionSystem.reset();

  activeRoom = nextActiveRoom;
  map = activeRoom.tiles;
  worldObjects = activeRoom.objects ?? [];

  syncRoomEnemies(activeRoom);
  if (applyEnemyTuningToExistingEnemies) applyEnemyTuningToAllCurrentEnemies();
  npcs.length = 0;
  projectiles = [];
  goldPiles = [];
  combatTextSystem.combatTexts.length = 0;
  abilitySystem.effects.length = 0;
  abilitySystem.activeFreeze = null;

  const spawn = resolveInitialSpawn(activeRoom);
  player.x = spawn.x;
  player.y = spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.castTimer = 0;

  abilitySystem.map = map;
  camera.worldW = map[0]?.length ?? ROOM_W;
  camera.worldH = map.length ?? ROOM_H;
  camera.hasFollowTarget = false;
  camera.follow(player);
  renderer.lastCameraX = Number.NaN;
  renderer.lastCameraY = Number.NaN;

  devToolsPanel.render();
  logDev('Map regenerated', { seed: currentBiomeSeed, biomeId: currentBiomeId });
}

devToolsPanel.setEnemyTuningTools({
  getValue: (type, parameter) => getEnemyTuningValue(type, parameter),
  isOverridden: (type, parameter) => Number.isFinite(EnemyTuningOverrides[type]?.[parameter]),
  setOverride: (type, parameter, value) => {
    setEnemyTuningOverride(type, parameter, value);
    if (applyEnemyTuningToExistingEnemies) applyEnemyTuningToAllCurrentEnemies();
    devToolsPanel.render();
  },
  clearAllOverrides: () => {
    clearEnemyTuningOverrides();
    if (applyEnemyTuningToExistingEnemies) applyEnemyTuningToAllCurrentEnemies();
    devToolsPanel.render();
    logDev('Enemy tuning overrides reset');
  },
  getApplyToExistingEnemies: () => applyEnemyTuningToExistingEnemies,
  setApplyToExistingEnemies: (enabled) => {
    applyEnemyTuningToExistingEnemies = Boolean(enabled);
    if (applyEnemyTuningToExistingEnemies) applyEnemyTuningToAllCurrentEnemies();
    devToolsPanel.render();
  },
});

devToolsPanel.setMapTools({
  getSeed: () => pendingDevSeed,
  setSeed: (seedValue) => {
    pendingDevSeed = `${seedValue ?? ''}`;
  },
  regenerate: () => {
    const trimmed = pendingDevSeed.trim();
    const parsedSeed = trimmed.length > 0 && Number.isFinite(Number(trimmed)) ? Number(trimmed) : null;
    regenerateWorld(parsedSeed);
  },
  spawnEnemyGroup: () => {
    const center = { x: Math.round(player.x + player.facing.x * 5), y: Math.round(player.y + player.facing.y * 5) };
    const group = spawnEnemyGroup('swarm_bug', center.x, center.y, {
      room: activeRoom,
      groupSize: 4,
    });
    if (applyEnemyTuningToExistingEnemies) {
      for (const enemy of group.enemies) applyEnemyTuningToEnemy(enemy);
    }
    for (const enemy of group.enemies) resolveWallOverlap(enemy, activeRoom?.tiles);
    enemies.push(...group.enemies);
    activeRoom.entities = [...enemies];
    logDev('Spawned enemy group', { count: group.enemies.length, center });
  },
  killAllEnemies: () => {
    for (const enemy of enemies) enemy.alive = false;
    logDev('All enemies killed');
  },
  toggleEnemyAi: () => {
    enemyAiEnabled = !enemyAiEnabled;
    logDev('Enemy AI toggled', { enabled: enemyAiEnabled });
    return enemyAiEnabled;
  },
});

logBoot('main scene entered');
logDiag('app entered main scene');
logDiag('running startup path', { href: window.location.href, pathname: window.location.pathname });
logBoot('world node found', { width: map?.[0]?.length ?? 0, height: map?.length ?? 0, biomeId: biome.biomeId, roomId: activeRoom.id });
logBoot('camera node found', { zoom: 1, current: true, position: { x: camera.x, y: camera.y } });
logBoot('player spawned', { x: player.x, y: player.y });
logBoot('map generated');
logBoot('HUD initialized');

setTimeout(() => {
  logDiag('app still alive after 1 second');
}, 1000);

if (diagMode) {
  const diagBanner = document.createElement('div');
  diagBanner.textContent = 'RENDER TEST';
  diagBanner.style.position = 'fixed';
  diagBanner.style.left = '16px';
  diagBanner.style.top = '16px';
  diagBanner.style.zIndex = '99999';
  diagBanner.style.padding = '8px 12px';
  diagBanner.style.background = '#ff00ff';
  diagBanner.style.color = '#000';
  diagBanner.style.font = 'bold 20px monospace';
  diagBanner.style.border = '2px solid #fff';
  diagBanner.style.pointerEvents = 'none';
  document.body.appendChild(diagBanner);
  logDiag('render test overlay injected');

  const viewportArea = window.innerWidth * window.innerHeight;
  const coveringNodes = Array.from(document.querySelectorAll('body *')).filter((el) => {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (Number(style.opacity) <= 0) return false;
    const rect = el.getBoundingClientRect();
    const area = Math.max(0, rect.width) * Math.max(0, rect.height);
    if (area <= 0) return false;
    const coversMostViewport = viewportArea > 0 && area / viewportArea > 0.8;
    const isDark = style.backgroundColor.includes('rgb(0, 0, 0)') || style.backgroundColor.includes('rgba(0, 0, 0');
    return coversMostViewport && isDark;
  }).map((el) => ({
    tag: el.tagName,
    id: el.id,
    className: el.className,
    zIndex: getComputedStyle(el).zIndex,
    backgroundColor: getComputedStyle(el).backgroundColor,
  }));
  logDiag('fullscreen dark overlay candidates', coveringNodes);
}

function resizeLayout() {
  const shell = document.querySelector('.game-shell');
  const stage = document.querySelector('.game-stage');
  const panels = document.getElementById('uiPanels');
  if (!shell || !stage || !panels) return;

  const stageRect = stage.getBoundingClientRect();
  const maxCanvasWidth = Math.max(1, Math.floor(stageRect.width));
  const maxCanvasHeight = Math.max(120, Math.floor(stageRect.height));

  const worldVisible = shell.offsetParent !== null && getComputedStyle(shell).visibility !== 'hidden';
  const rootTransform = getComputedStyle(shell).transform;

  if (maxCanvasWidth <= 0 || maxCanvasHeight <= 0) {
    logBoot('viewport sizing pending', {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      stage: { width: stageRect.width, height: stageRect.height },
      rootScale: rootTransform,
      mainWorldVisible: worldVisible,
    });
    requestAnimationFrame(resizeLayout);
    return;
  }

  const rawScale = Math.min(maxCanvasWidth / canvas.width, maxCanvasHeight / canvas.height);
  const safeRawScale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
  const scale = safeRawScale >= 1 ? Math.floor(safeRawScale) : Math.max(safeRawScale, 0.1);

  canvas.style.width = `${canvas.width * scale}px`;
  canvas.style.height = `${canvas.height * scale}px`;

  logBoot('viewport ready', {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    stage: { width: maxCanvasWidth, height: maxCanvasHeight },
    canvas: { width: canvas.width, height: canvas.height, cssWidth: canvas.style.width, cssHeight: canvas.style.height },
    rootScale: rootTransform,
    mainWorldVisible: worldVisible,
  });
}

window.addEventListener('resize', resizeLayout);
resizeLayout();

const dialogueManager = new DialogueManager({
  chatBox: chat,
  npcs,
  player,
  input,
  baseDialogueTree: dialogueTree,
});
let slotPressLatch = [false, false, false, false];

const forcedBlockingTiles = new Set(['denseTree', 'rockCliff', 'deepWater', 'stoneWall']);
let interactLatch = false;


function triggerDestructionSound(kind) {
  const soundSystem = globalThis?.soundSystem;
  if (!soundSystem || typeof soundSystem.play !== 'function') return;
  soundSystem.play('destructible-break', { kind });
}

function spawnDestructionEffects(object) {
  const debrisPieces = Array.from({ length: 8 + Math.floor(Math.random() * 5) }, () => ({
    angle: Math.random() * Math.PI * 2,
    speed: 1.6 + Math.random() * 2.4,
  }));

  abilitySystem.spawnEffect({
    type: 'debris',
    x: object.x,
    y: object.y,
    ttl: 0.22,
    color: object.kind === 'vase' ? '#c6b2e6' : '#cfab7f',
    pieces: debrisPieces,
  });

  abilitySystem.spawnEffect({
    type: 'destruct-burst',
    x: object.x,
    y: object.y,
    radius: 1.5,
    ttl: 0.16,
    color: '#ffd2aa',
  });
}

const playerCollisionBox = {
  width: 3,
  height: 3,
};

function getPlayerCollisionTilesAt(x, y) {
  const centerX = Math.round(x);
  const centerY = Math.round(y);
  const minX = centerX - Math.floor(playerCollisionBox.width / 2);
  const minY = centerY - Math.floor(playerCollisionBox.height / 2);

  const tiles = [];
  for (let dy = 0; dy < playerCollisionBox.height; dy += 1) {
    for (let dx = 0; dx < playerCollisionBox.width; dx += 1) {
      tiles.push({
        x: minX + dx,
        y: minY + dy,
      });
    }
  }

  return {
    centerX,
    centerY,
    tiles,
  };
}

function getMapDimensions() {
  return {
    width: map?.[0]?.length ?? 0,
    height: map?.length ?? 0,
  };
}

function isWithinMapBounds(x, y) {
  const { width, height } = getMapDimensions();
  return x >= 0 && y >= 0 && x < width && y < height;
}

function getTileSafe(x, y) {
  if (!isWithinMapBounds(x, y)) return null;
  return map[y]?.[x] ?? null;
}

function logPlayerBoundsState(reason, details) {
  logDiag(`[PlayerBounds] ${reason}`, {
    playerPosition: { x: player.x, y: player.y },
    ...details,
  });
}

function isWalkable(x, y) {
  const collisionProbe = getPlayerCollisionTilesAt(x, y);
  const { width, height } = getMapDimensions();

  for (const tilePos of collisionProbe.tiles) {
    const tx = tilePos.x;
    const ty = tilePos.y;
    if (!isWithinMapBounds(tx, ty)) {
      logPlayerBoundsState('movement blocked by map boundary', {
        attemptedOrigin: { x: collisionProbe.centerX, y: collisionProbe.centerY },
        attemptedCollisionTile: { x: tx, y: ty },
        playerCollisionBox,
        mapSize: { width, height },
      });
      return false;
    }

    const tile = getTileSafe(tx, ty);
    if (!tile) {
      logPlayerBoundsState('movement blocked by missing tile', {
        attemptedOrigin: { x: collisionProbe.centerX, y: collisionProbe.centerY },
        attemptedCollisionTile: { x: tx, y: ty },
        playerCollisionBox,
      });
      return false;
    }
    if (!tile.walkable) return false;
    if (forcedBlockingTiles.has(tile.type) || forcedBlockingTiles.has(tile.char)) return false;
  }

  if (
    collisionProbe.centerX <= 0
    || collisionProbe.centerY <= 0
    || collisionProbe.centerX >= width - 1
    || collisionProbe.centerY >= height - 1
  ) {
    logPlayerBoundsState('player reached map edge', {
      attemptedOrigin: { x: collisionProbe.centerX, y: collisionProbe.centerY },
      mapSize: { width, height },
    });
  }

  return true;
}

function movePlayerAxis(dx, dy) {
  const prevX = player.x;
  const prevY = player.y;
  const nextX = prevX + dx;
  const nextY = prevY + dy;

  if (!isWalkable(nextX, nextY)) {
    player.vx = 0;
    player.vy = 0;
    logPlayerBoundsState('collision check failed; movement blocked', {
      from: { x: prevX, y: prevY },
      attempted: { x: nextX, y: nextY },
      delta: { dx, dy },
    });
    return;
  }

  player.x = nextX;
  player.y = nextY;
}

function handlePlayer(dt) {
  let moveX = 0;
  let moveY = 0;

  if (input.isDown('w')) moveY -= 1;
  if (input.isDown('s')) moveY += 1;
  if (input.isDown('a')) moveX -= 1;
  if (input.isDown('d')) moveX += 1;

  const magnitude = Math.hypot(moveX, moveY) || 1;
  moveX /= magnitude;
  moveY /= magnitude;

  const targetSpeed = runtimeConfig.get('player.speed');
  const accel = runtimeConfig.get('player.acceleration');
  const decel = runtimeConfig.get('player.deceleration');
  const targetVx = moveX * targetSpeed;
  const targetVy = moveY * targetSpeed;
  const blend = Math.min(1, ((Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01) ? accel : decel) * dt);
  player.vx += (targetVx - player.vx) * blend;
  player.vy += (targetVy - player.vy) * blend;
  if (Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01) {
    player.facing = { x: Math.round(moveX), y: Math.round(moveY) };
  }

  movePlayerAxis(player.vx * dt, 0);
  resolveObjectCollision(player, worldObjects);

  movePlayerAxis(0, player.vy * dt);
  resolveObjectCollision(player, worldObjects);

  const { width, height } = getMapDimensions();
  if (player.x < 0 || player.y < 0 || player.x >= width || player.y >= height) {
    logPlayerBoundsState('player coordinates exceeded map bounds after movement', {
      mapSize: { width, height },
      coordinates: { x: player.x, y: player.y },
    });
  }

  player.mana = Math.min(player.maxMana, player.mana + player.manaRegen * dt);
  abilitySystem.tick(dt);
  player.castTimer = Math.max(0, (player.castTimer ?? 0) - dt);
  player.castCooldown = runtimeConfig.get('player.castDuration');

  if (!dialogueManager.isOpen) {
    const interactDown = input.isDown('e');
    if (interactDown && !interactLatch) {
      tryInteractInFront(player, worldObjects);
    }
    interactLatch = interactDown;

    const target = input.getMouseWorldPosition();
    for (let i = 0; i < 4; i += 1) {
      const hotkey = String(i + 1);
      const down = input.isDown(hotkey);
      if (down && !slotPressLatch[i]) {
        abilitySystem.castSlot(i, { player, target });
      }
      slotPressLatch[i] = down;
    }
  }
}

let last = performance.now();

if (diagMinimalMode) {
  for (let y = 0; y < map.length; y += 1) {
    for (let x = 0; x < map[0].length; x += 1) {
      map[y][x] = { char: ' ', fg: '#2a5f3a', bg: '#173823', walkable: true };
    }
  }
  worldObjects = [];
  npcs.length = 0;
  enemies.length = 0;
  projectiles = [];
  goldPiles = [];
  player.x = Math.floor(ROOM_W / 2);
  player.y = Math.floor(ROOM_H / 2);
  camera.x = Math.floor(player.x - VIEW_W / 2);
  camera.y = Math.floor(player.y - VIEW_H / 2);
  camera.baseX = camera.x;
  camera.baseY = camera.y;
  camera.hasFollowTarget = true;
  logDiag('minimal startup mode enabled: generation, spawns, and camera follow disabled');
}

function tick(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (!firstProcessLogged) {
    firstProcessLogged = true;
    logDiag('first _process tick');
  }

  if (!firstPhysicsLogged) {
    firstPhysicsLogged = true;
    logDiag('first _physics_process tick');
  }

  if (!startupCompleteLogged) {
    logDiag('game root _ready');
  }

  player.speed = runtimeConfig.get('player.speed');
  player.frameDurations.walk = runtimeConfig.get('sprites.playerWalkFrameDuration');
  player.frameDurations.idle = runtimeConfig.get('sprites.playerIdleFrameDuration');
  palette.player = runtimeConfig.get('palette.playerPrimary');
  palette.playerAccent = runtimeConfig.get('palette.playerAccent');
  palette.slime = runtimeConfig.get('palette.enemySlime');
  palette.skeleton = runtimeConfig.get('palette.enemySkeleton');
  palette.floorFg = runtimeConfig.get('palette.worldFloorFg');
  palette.wallFg = runtimeConfig.get('palette.worldWallFg');
  visualTheme.colors.text = runtimeConfig.get('palette.uiText');
  visualTheme.colors.worldBackground = runtimeConfig.get('palette.worldBackground');

  const prefabToggleDown = input.isDown('f7') && (input.isDown('control') || input.isDown('meta'));
  if (prefabToggleDown && !prefabEditorToggleLatch) prefabEditor.toggle();
  prefabEditorToggleLatch = prefabToggleDown;

  const f1Down = input.isDown('f1');
  if (f1Down && !f1Latch) devToolsPanel.toggleOpen();
  f1Latch = f1Down;

  const f2Down = input.isDown('f2');
  if (f2Down && !f2Latch) runtimeConfig.set('debug.overlaysEnabled', !runtimeConfig.get('debug.overlaysEnabled'));
  f2Latch = f2Down;

  const f3Down = input.isDown('f3');
  if (f3Down && !f3Latch) runtimeConfig.set('debug.showStatsHud', !runtimeConfig.get('debug.showStatsHud'));
  f3Latch = f3Down;

  const f4Down = input.isDown('f4');
  if (f4Down && !f4Latch) toggleOverlayFlag('debug.collisionBounds');
  f4Latch = f4Down;

  const f5Down = input.isDown('f5');
  if (f5Down && !f5Latch) runtimeConfig.saveCurrentConfig();
  f5Latch = f5Down;

  const f6Down = input.isDown('f6');
  if (f6Down && !f6Latch) runtimeConfig.savePreset(`quick-${new Date().toISOString().slice(11, 19)}`);
  f6Latch = f6Down;

  const f7Down = input.isDown('f7') && !input.isDown('control') && !input.isDown('meta');
  if (f7Down && !f7Latch) toggleOverlayFlag('debug.grid');
  f7Latch = f7Down;

  const f8Down = input.isDown('f8');
  if (f8Down && !f8Latch && !devToolsPanel.isCapturingInput()) resetEncounterState();
  f8Latch = f8Down;

  const f9Down = input.isDown('f9');
  if (f9Down && !f9Latch) {
    if (input.isDown('shift')) runtimeConfig.resetAll();
    else runtimeConfig.loadSavedConfig();
  }
  f9Latch = f9Down;

  if (prefabEditor.isOpen) {
    renderer.beginFrame();
    renderWorld(
      renderer,
      camera,
      map,
      player,
      enemies,
      npcs,
      worldObjects,
      projectiles,
      goldPiles,
      combatTextSystem,
      abilitySystem.getActiveEffects(),
      input.mouse,
      devToolsPanel.getRenderDebugOptions(),
      activeRoom,
    );
    drawHUD(renderer, player, abilitySystem);
    renderer.composite();
    if (devToolsPanel.open && input.mouse.clicked) {
    const wx = Math.round(input.mouse.worldX);
    const wy = Math.round(input.mouse.worldY);
    const selectedEntity = [player, ...enemies, ...npcs, ...worldObjects].find((entity) => Math.round(entity.x) === wx && Math.round(entity.y) === wy) ?? null;
    const tile = map?.[wy]?.[wx] ? { x: wx, y: wy, ...map[wy][wx] } : null;
    devToolsPanel.setInspectorData({ selectedEntity, selectedTile: tile });
  }

  devToolsPanel.updateStats(`FPS ${Math.round(1 / Math.max(0.001, dt))} | Frame ${(dt * 1000).toFixed(1)}ms | E:${enemies.length + npcs.length + 1} P:${projectiles.length} FX:${abilitySystem.getActiveEffects().length} | Cam ${camera.x.toFixed(1)},${camera.y.toFixed(1)} | Player ${player.x.toFixed(1)},${player.y.toFixed(1)} | Preset ${runtimeConfig.lastPresetName ?? 'default'}`);

  input.endFrame();
    requestAnimationFrame(tick);
    return;
  }

  for (const enemy of enemies) {
    enemy.frameDurations.walk = runtimeConfig.get('sprites.enemyWalkFrameDuration');
    enemy.frameDurations.idle = runtimeConfig.get('sprites.enemyIdleFrameDuration');
    enemy.hitFlashDuration = runtimeConfig.get('enemies.hitFlashDuration');
  }

  if (!diagMinimalMode) {
    updateTownNpcs(npcs, map, dt);
    for (const npc of npcs) {
      updateEntityAnimation(npc, dt, Math.hypot(npc.vx, npc.vy) > 0.1, runtimeConfig);
    }
  }

  const devCapturing = devToolsPanel.isCapturingInput();
  const spellbookOpen = spellbook.isOpen();

  if (!dialogueManager.isOpen && !diagMinimalMode && !devCapturing && !spellbookOpen) {
    handlePlayer(dt);
    if (enemyAiEnabled) {
      updateEnemies(enemies, player, dt, projectiles, runtimeConfig, { map, tileSize: 1 });
      updateEnemyPlayerInteractions(enemies, player, dt, combatTextSystem, runtimeConfig);
    } else {
      for (const enemy of enemies) {
        enemy.vx = 0;
        enemy.vy = 0;
      }
    }

    updateProjectileAnimation(projectiles, dt, runtimeConfig);
    const combat = updateProjectiles(
      projectiles,
      map,
      enemies,
      player,
      dt,
      combatTextSystem,
      abilitySystem,
      worldObjects,
      (object) => {
        spawnDestructionEffects(object);
        triggerDestructionSound(object.type);
        const drop = rollObjectLoot(object);
        if (!drop) return;
        if (drop.type === 'gold' && drop.amount <= 0) return;
        goldPiles.push(drop);
      },
      runtimeConfig,
    );
    projectiles = combat.projectiles;
    for (const dead of combat.slain) {
      const drop = LootSystem.spawnGold(dead);
      if (drop) goldPiles.push(drop);
    }
    goldPiles = LootSystem.collectGold(player, goldPiles, combatTextSystem);
  } else {
    player.vx = 0;
    player.vy = 0;
    slotPressLatch.fill(false);
  }

  if (!diagMinimalMode) {
    updateDestructibleAnimations(worldObjects, dt);
    cleanupDestroyedObjects(worldObjects);
  }
  combatTextSystem.update(dt);

  const transitionResult = roomTransitionSystem.update(dt, { activeRoom, player });
  if (transitionResult?.room) {
    activeRoom = transitionResult.room;
    map = activeRoom.tiles;
    worldObjects = activeRoom.objects ?? [];
    abilitySystem.map = map;
    camera.worldW = map[0]?.length ?? ROOM_W;
    camera.worldH = map.length ?? ROOM_H;
    camera.hasFollowTarget = false;
    renderer.lastCameraX = Number.NaN;
    renderer.lastCameraY = Number.NaN;
    syncRoomEnemies(activeRoom);
    if (applyEnemyTuningToExistingEnemies) applyEnemyTuningToAllCurrentEnemies();
  }

  updateEntityAnimation(player, dt, Math.hypot(player.vx, player.vy) > 0.1, runtimeConfig);

  if (!diagMinimalMode) {
    dialogueManager.update(dt);
    camera.smoothingFactor = runtimeConfig.get('camera.smoothing');
    camera.pixelSnapping = runtimeConfig.get('camera.pixelSnapping');
    camera.zoom = runtimeConfig.get('camera.zoom');
    camera.update(dt);
    camera.follow(player);
  }

  if (!Number.isFinite(camera.x) || !Number.isFinite(camera.y)) {
    console.warn(`${BOOT_DEBUG_PREFIX} camera produced invalid coordinates, resetting to origin`, { x: camera.x, y: camera.y });
    camera.x = 0;
    camera.y = 0;
  }

  if (!cameraCheckpointLogged) {
    cameraCheckpointLogged = true;
    logBoot('camera checkpoint', {
      zoom: 1,
      current: true,
      position: { x: camera.x, y: camera.y },
      playerPosition: { x: player.x, y: player.y },
    });
  }

  renderer.beginFrame();
  renderWorld(
    renderer,
    camera,
    map,
    player,
    enemies,
    npcs,
    worldObjects,
    projectiles,
    goldPiles,
    combatTextSystem,
    abilitySystem.getActiveEffects(),
    input.mouse,
    devToolsPanel.getRenderDebugOptions(),
    activeRoom,
  );
  drawHUD(renderer, player, abilitySystem);
  if (roomTransitionSystem.fadeAlpha > 0) {
    renderer.ui.ctx.save();
    renderer.ui.ctx.globalAlpha = roomTransitionSystem.fadeAlpha;
    renderer.ui.ctx.fillStyle = '#000000';
    renderer.ui.ctx.fillRect(0, 0, renderer.ui.canvas.width, renderer.ui.canvas.height);
    renderer.ui.ctx.restore();
  }
  renderer.composite();

  if (devToolsPanel.open && input.mouse.clicked) {
    const wx = Math.round(input.mouse.worldX);
    const wy = Math.round(input.mouse.worldY);
    const selectedEntity = [player, ...enemies, ...npcs, ...worldObjects].find((entity) => Math.round(entity.x) === wx && Math.round(entity.y) === wy) ?? null;
    const tile = map?.[wy]?.[wx] ? { x: wx, y: wy, ...map[wy][wx] } : null;
    devToolsPanel.setInspectorData({ selectedEntity, selectedTile: tile });
  }

  devToolsPanel.updateStats(`FPS ${Math.round(1 / Math.max(0.001, dt))} | Frame ${(dt * 1000).toFixed(1)}ms | E:${enemies.length + npcs.length + 1} P:${projectiles.length} FX:${abilitySystem.getActiveEffects().length} | Cam ${camera.x.toFixed(1)},${camera.y.toFixed(1)} | Player ${player.x.toFixed(1)},${player.y.toFixed(1)} | Preset ${runtimeConfig.lastPresetName ?? 'default'}`);

  input.endFrame();

  if (!startupCompleteLogged) {
    startupCompleteLogged = true;
    logBoot('startup complete');
  }

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
