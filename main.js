/* global performance */
import { Renderer } from './engine/Renderer.js';
import { Camera } from './engine/Camera.js';
import { Input } from './engine/Input.js';
import { Viewport } from './engine/Viewport.js';
import { Player } from './entities/Player.js';
import { BiomeGenerator } from './world/BiomeGenerator.js';
import { WorldMapManager } from './world/WorldMapManager.js';
import { RoomTransitionSystem } from './world/RoomTransitionSystem.js';
import { spawnEnemyGroup } from './world/EnemySpawnSystem.js';
import { updateEnemies } from './systems/AISystem.js';
import { updateEnemyPlayerInteractions, updateProjectiles } from './systems/CombatSystem.js';
import * as LootSystem from './systems/LootSystem.js';
import { CombatTextSystem } from './systems/CombatTextSystem.js';
import { renderWorld } from './systems/RenderSystem.js';
import { updateEntityAnimation, updateProjectileAnimation } from './systems/AnimationSystem.js';
import { setEntityState, syncEntityMovementState, updateEntityFacingFromVelocity, updateEntityState } from './systems/EntityStateSystem.js';
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
import { InventoryWindow } from './ui/InventoryWindow.js';
import { AbilityBar } from './ui/AbilityBar.js';
import { PrefabEditorScreen } from './ui/PrefabEditorScreen.js';
import { SpriteEditorScreen } from './ui/SpriteEditorScreen.js';
import { palette } from './data/SpritePalette.js';
import { visualTheme } from './data/VisualTheme.js';
import { rollObjectLoot } from './systems/ObjectInteractionSystem.js';
import { tryInteract } from './systems/InteractionSystem.js';
import { loadObjectsFromFolder } from './world/ObjectLibrary.js';
import { loadAllSpriteAssets } from './data/SpriteAssetLoader.js';
import {
  collidesWithBlockingObjectAt,
  cleanupDestroyedObjects,
  updateDestructibleAnimations,
  updateTownNpcs,
} from './systems/WorldObjectSystem.js';
import { resolveWallOverlap } from './systems/EnemyCollisionSystem.js';
import { attemptSlideMove } from './systems/CollisionSystem.js';

const VIEW_W = 104;
const VIEW_H = 58;
const ROOM_W = 240;
const ROOM_H = 160;

const canvas = document.getElementById('gameCanvas');
const canvasFrame = canvas?.parentElement;
const renderer = new Renderer(canvas, VIEW_W, VIEW_H, 8, 8);
const camera = new Camera(VIEW_W, VIEW_H, ROOM_W, ROOM_H);
const viewport = new Viewport(canvas);
const input = new Input(canvas, viewport, camera, renderer.cellW, renderer.cellH);
const chat = new ChatBox();
const runtimeConfig = new RuntimeConfigRegistry();
const devToolsPanel = new DevToolsPanel(runtimeConfig);
runtimeConfig.setLogger((message) => logDev(message));

await loadObjectsFromFolder('./assets/objects');
await loadAllSpriteAssets('./assets');

const biomeGenerator = new BiomeGenerator({ roomWidth: ROOM_W, roomHeight: ROOM_H, runtimeConfig });
const worldMapManager = new WorldMapManager({ biomeGenerator, roomWidth: ROOM_W, roomHeight: ROOM_H, runtimeConfig });
let currentBiomeSeed = randomSeed();
let pendingDevSeed = String(currentBiomeSeed);
let activeRoom = worldMapManager.enterStartingWorld(currentBiomeSeed);
let map = activeRoom.tiles;
const player = new Player(Math.floor(ROOM_W / 2), Math.floor(ROOM_H / 2));
player.facingVector = { x: 0, y: 1 };
['fire_bolt', 'frost_beam', 'lightning_beam'].forEach((recipeId) => player.unlockRecipe(recipeId));
player.addItem('essence', 20);
player.addItem('stone', 20);
player.addItem('frost_core', 2);
player.addItem('fire_core', 2);
player.addItem('lightning_core', 1);
const enemies = [];
let enemyAiEnabled = true;
let applyEnemyTuningToExistingEnemies = false;
const npcs = [];
let worldObjects = activeRoom.objects ?? [];
const roomTransitionSystem = new RoomTransitionSystem({
  biomeGenerator,
  worldMapManager,
  fadeDurationMs: 150,
  debug: false,
});

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

function syncActiveRoomCollections(room) {
  worldObjects = room?.objects ?? [];
  npcs.length = 0;
  for (const npc of room?.npcs ?? []) npcs.push(npc);
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

syncActiveRoomCollections(activeRoom);
syncRoomEnemies(activeRoom);
if (applyEnemyTuningToExistingEnemies) applyEnemyTuningToAllCurrentEnemies();
const initialSpawn = resolveInitialSpawn(activeRoom);
player.x = initialSpawn.x;
player.y = initialSpawn.y;
camera.follow(player);
let projectiles = [];
let goldPiles = [];
let worldDrops = [];
const combatTextSystem = new CombatTextSystem(runtimeConfig);

function triggerItemPickupFeedback(itemId, quantity) {
  const soundSystem = globalThis?.soundSystem;
  if (!soundSystem || typeof soundSystem.play !== 'function') return;
  soundSystem.play('item-pickup', { itemId, quantity });
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function createWorldDrop(drop) {
  const angle = randomRange(0, Math.PI * 2);
  const speed = randomRange(2, 4);
  const duration = randomRange(0.15, 0.25);

  return {
    ...drop,
    x: drop?.x ?? 0,
    y: drop?.y ?? 0,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0,
    duration,
  };
}

function updateWorldDrops(dt) {
  const kept = [];

  for (const drop of worldDrops) {
    drop.life = (drop.life ?? 0) + dt;
    const duration = Math.max(0.0001, drop.duration ?? 0.2);
    const t = drop.life / duration;

    if (t < 1) {
      drop.x += (drop.vx ?? 0) * dt;
      drop.y += (drop.vy ?? 0) * dt;
    } else {
      drop.vx = 0;
      drop.vy = 0;
    }

    kept.push(drop);
  }

  worldDrops = kept;
}

function collectWorldDrops() {
  const kept = [];

  for (const drop of worldDrops) {
    const dx = drop.x - player.x;
    const dy = drop.y - player.y;
    if ((dx * dx + dy * dy) >= (2.5 * 2.5)) {
      kept.push(drop);
      continue;
    }

    const pickupResult = player.addItem(drop.itemId, drop.quantity);
    const added = pickupResult?.added ?? 0;
    const remaining = pickupResult?.remaining ?? 0;

    if (added > 0) {
      triggerItemPickupFeedback(drop.itemId, added);
      combatTextSystem.spawnPickupText(player, drop.itemId, added);
      inventoryWindow.markDirty();
    }

    if (remaining > 0) {
      kept.push({
        ...drop,
        quantity: remaining,
      });
      combatTextSystem.spawnInfoText(player, 'Inventory Full');
    }
  }

  worldDrops = kept;
}

function handleEnemyDefeat(enemy) {
  const result = LootSystem.awardEnemyDrops(player, enemy, combatTextSystem);
  for (const drop of result.drops) worldDrops.push(createWorldDrop(drop));
  return result;
}

const abilitySystem = new AbilitySystem({
  definitions: Object.values(SpellRegistry),
  player,
  enemies,
  map,
  camera,
  spawnProjectile: (projectile) => projectiles.push(projectile),
  reportDamage: (enemy, damage, isCritical) => combatTextSystem.spawnDamageText(enemy, damage, isCritical),
  onEnemySlain: handleEnemyDefeat,
});

defaultSpellSlots.forEach((spellId, slotIndex) => {
  abilitySystem.assignAbilityToSlot(slotIndex, spellId);
});

const uiRoot = document.getElementById('uiPanels') ?? (() => {
  const stage = document.querySelector('.game-canvas-frame') ?? document.body;
  const fallback = document.createElement('section');
  fallback.id = 'uiPanels';
  fallback.className = 'ui-overlay';
  fallback.innerHTML = `
    <section id="chatBox" class="chat-box hidden" aria-live="polite">
      <div class="chat-box__header">
        <div id="chatSpeaker" class="chat-speaker">System</div>
        <button id="chatCloseButton" class="chat-close-button" type="button" aria-label="Close chat">×</button>
      </div>
      <div id="chatLine" class="chat-line">Speak with nearby townsfolk (press E nearby). Use 1-9 or click responses.</div>
      <ul id="chatOptions" class="chat-options"></ul>
    </section>
    <section id="combatHudPanel" class="bottom-ui-container" aria-label="Combat interface"></section>
  `;
  stage.appendChild(fallback);
  console.warn('BOOT: #uiPanels missing in startup scene. Created fallback root to prevent startup crash.');
  return fallback;
})();
const combatHudRoot = document.getElementById('combatHudPanel') ?? uiRoot;
const combatHud = new AbilityBar({ root: combatHudRoot, abilitySystem, player });
const spellbook = new SpellbookWindow({ root: uiRoot, abilitySystem, input });
const spellCraftingWindow = new SpellCraftingWindow({
  root: uiRoot,
  spellbook,
  player,
  onCrafted: (spell) => {
    if (!spell?.id || abilitySystem.definitions.has(spell.id)) return false;
    abilitySystem.definitions.set(spell.id, spell);
    abilitySystem.cooldowns.set(spell.id, 0);
    inventoryWindow.markDirty();
    return true;
  },
});
const inventoryWindow = new InventoryWindow({ root: uiRoot, player });
let isCraftingUIOpen = false;

const prefabEditor = new PrefabEditorScreen();
await prefabEditor.initialize();
const spriteEditor = new SpriteEditorScreen();
await spriteEditor.initialize();
let prefabEditorToggleLatch = false;
let f1Latch = false;
let f2Latch = false;
let f3Latch = false;
let f4Latch = false;
let f5Latch = false;
let f6Latch = false;
let f7Latch = false;
let gridToggleLatch = false;
let f8Latch = false;
let f9Latch = false;
let craftingToggleLatch = false;
let inventoryToggleLatch = false;

const objectEditorButton = document.createElement('button');
objectEditorButton.type = 'button';
objectEditorButton.className = 'object-editor-button';
objectEditorButton.textContent = 'Object Editor';
objectEditorButton.addEventListener('click', () => {
  if (prefabEditor.isOpen) return;
  prefabEditor.open();
});
document.body.appendChild(objectEditorButton);

const spriteEditorButton = document.createElement('button');
spriteEditorButton.type = 'button';
spriteEditorButton.className = 'object-editor-button object-editor-button--secondary';
spriteEditorButton.textContent = 'Sprite Editor';
spriteEditorButton.addEventListener('click', () => {
  if (spriteEditor.isOpen) return;
  spriteEditor.open();
});
document.body.appendChild(spriteEditorButton);

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
const exitDebugMode = query.get('exit_debug') === '1';
DialogueManager.DEBUG = dialogueDebugMode;
roomTransitionSystem.debug = exitDebugMode;

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

function buildDevStatsText(dt) {
  return `FPS ${Math.round(1 / Math.max(0.001, dt))} | Frame ${(dt * 1000).toFixed(1)}ms | E:${enemies.length + npcs.length + 1} P:${projectiles.length} FX:${abilitySystem.getActiveEffects().length} | Cam ${camera.x.toFixed(1)},${camera.y.toFixed(1)} | Player ${player.x.toFixed(1)},${player.y.toFixed(1)} | Preset ${runtimeConfig.lastPresetName ?? 'default'}`;
}

function updateDevStatsHud(dt) {
  const now = Date.now();
  if (!devToolsPanel.shouldUpdateStats(now)) return;
  devToolsPanel.updateStats(buildDevStatsText(dt), now);
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
  worldDrops = [];
  combatTextSystem.combatTexts.length = 0;
  combatTextSystem.pickupStack.length = 0;
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
  const nextActiveRoom = worldMapManager.regenerate(nextSeed);
  if (!nextActiveRoom) return;

  currentBiomeSeed = nextSeed;
  pendingDevSeed = String(currentBiomeSeed);
  roomTransitionSystem.reset();

  activeRoom = nextActiveRoom;
  map = activeRoom.tiles;
  syncActiveRoomCollections(activeRoom);

  syncRoomEnemies(activeRoom);
  if (applyEnemyTuningToExistingEnemies) applyEnemyTuningToAllCurrentEnemies();
  projectiles = [];
  goldPiles = [];
  worldDrops = [];
  combatTextSystem.combatTexts.length = 0;
  combatTextSystem.pickupStack.length = 0;
  abilitySystem.effects.length = 0;
  abilitySystem.activeFreeze = null;

  const spawn = resolveInitialSpawn(activeRoom);
  player.x = spawn.x;
  player.y = spawn.y;
  player.vx = 0;
  player.vy = 0;
  setEntityState(player, 'idle');

  abilitySystem.map = map;
  camera.worldW = map[0]?.length ?? ROOM_W;
  camera.worldH = map.length ?? ROOM_H;
  camera.hasFollowTarget = false;
  camera.follow(player);
  renderer.lastCameraX = Number.NaN;
  renderer.lastCameraY = Number.NaN;

  devToolsPanel.render();
  logDev('Map regenerated', { seed: currentBiomeSeed, mapId: activeRoom?.id });
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
    const center = { x: Math.round(player.x + player.facingVector.x * 5), y: Math.round(player.y + player.facingVector.y * 5) };
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
logBoot('world node found', { width: map?.[0]?.length ?? 0, height: map?.length ?? 0, mapType: activeRoom?.type, roomId: activeRoom.id });
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
  const shell = document.getElementById('app-root');
  const stage = document.querySelector('.game-area');
  if (!shell || !stage || !canvasFrame) return;

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

  logBoot('viewport ready', {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    stage: { width: maxCanvasWidth, height: maxCanvasHeight },
    frame: { width: maxCanvasWidth, height: maxCanvasHeight },
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

function canOccupyPlayerPosition(x, y) {
  return isWalkable(x, y) && !collidesWithBlockingObjectAt(player, x, y, worldObjects);
}

function movePlayer(dx, dy) {
  const prevX = player.x;
  const prevY = player.y;
  const { movedX, movedY, blocked } = attemptSlideMove(player, dx, dy, canOccupyPlayerPosition);

  if (blocked) {
    logPlayerBoundsState('collision check failed; movement blocked', {
      from: { x: prevX, y: prevY },
      attempted: { x: prevX + dx, y: prevY + dy },
      delta: { dx, dy },
    });
  }

  if (dx !== 0 && !movedX) player.vx = 0;
  if (dy !== 0 && !movedY) player.vy = 0;
}


function clampMagnitude(x, y, maxMagnitude) {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= maxMagnitude || magnitude === 0) return { x, y };
  const scale = maxMagnitude / magnitude;
  return { x: x * scale, y: y * scale };
}

function applyPlayerDamageImpact({ sourceX, sourceY, knockbackForce = 5.5, knockbackDuration = 0.15, flashDuration = 0.1, shakeDuration = 0.1, shakeIntensity = 0.62 } = {}) {
  const dx = player.x - (Number.isFinite(sourceX) ? sourceX : player.x);
  const dy = player.y - (Number.isFinite(sourceY) ? sourceY : player.y);
  const length = Math.hypot(dx, dy) || 1;
  const safeDuration = Math.max(0.08, knockbackDuration);
  const impulseVx = (dx / length) * (knockbackForce / safeDuration);
  const impulseVy = (dy / length) * (knockbackForce / safeDuration);
  const nextImpact = clampMagnitude(
    player.hitImpact.vx + impulseVx,
    player.hitImpact.vy + impulseVy,
    18,
  );

  player.hitImpact.vx = nextImpact.x;
  player.hitImpact.vy = nextImpact.y;
  player.hitImpact.timer = Math.max(player.hitImpact.timer, safeDuration);
  player.hitImpact.duration = Math.max(player.hitImpact.duration, safeDuration);
  player.hitFlashDuration = Math.max(player.hitFlashDuration ?? 0, flashDuration);
  player.hitFlashTimer = Math.max(player.hitFlashTimer ?? 0, flashDuration);
  camera.startShake(shakeDuration, shakeIntensity);
}

function updatePlayerDamageFeedback(dt) {
  player.hitFlashTimer = Math.max(0, (player.hitFlashTimer ?? 0) - dt);

  if ((player.hitImpact.timer ?? 0) <= 0) {
    player.hitImpact.vx = 0;
    player.hitImpact.vy = 0;
    player.hitImpact.timer = 0;
    return { x: 0, y: 0 };
  }

  player.hitImpact.timer = Math.max(0, player.hitImpact.timer - dt);
  const progress = player.hitImpact.duration > 0 ? player.hitImpact.timer / player.hitImpact.duration : 0;
  const intensity = Math.max(0, Math.min(1, progress));
  const impulse = {
    x: player.hitImpact.vx * intensity,
    y: player.hitImpact.vy * intensity,
  };

  player.hitImpact.vx *= 0.82;
  player.hitImpact.vy *= 0.82;
  if (player.hitImpact.timer === 0) {
    player.hitImpact.vx = 0;
    player.hitImpact.vy = 0;
    player.hitImpact.duration = 0;
  }

  return impulse;
}

function renderPlayerDamageFlash(rendererRef, flashTimer = 0, flashDuration = 0) {
  if (flashTimer <= 0 || flashDuration <= 0) return;
  const normalized = Math.max(0, Math.min(1, flashTimer / flashDuration));
  const alpha = 0.18 * normalized * normalized;
  if (alpha <= 0.001) return;

  rendererRef.ui.ctx.save();
  rendererRef.ui.ctx.globalAlpha = alpha;
  rendererRef.ui.ctx.fillStyle = '#ff3b30';
  rendererRef.ui.ctx.fillRect(0, 0, rendererRef.ui.canvas.width, rendererRef.ui.canvas.height);
  rendererRef.ui.ctx.restore();
}

function getPlayerMoveDirection(gameplayInputBlocked) {
  const dx = Number(!gameplayInputBlocked && input.isDown('d')) - Number(!gameplayInputBlocked && input.isDown('a'));
  const dy = Number(!gameplayInputBlocked && input.isDown('s')) - Number(!gameplayInputBlocked && input.isDown('w'));

  if (dx === 0 && dy === 0) return { x: 0, y: 0 };

  const length = Math.hypot(dx, dy) || 1;
  return {
    x: dx / length,
    y: dy / length,
  };
}

function handlePlayer(dt) {
  const gameplayInputBlocked = dialogueManager.isOpen || isCraftingUIOpen || inventoryWindow.isOpen();
  const moveDirection = getPlayerMoveDirection(gameplayInputBlocked);
  const moveX = moveDirection.x;
  const moveY = moveDirection.y;

  const damageImpulse = updatePlayerDamageFeedback(dt);
  const targetSpeed = runtimeConfig.get('player.speed');
  const accel = runtimeConfig.get('player.acceleration');
  const decel = runtimeConfig.get('player.deceleration');
  const movementPolicy = player.activeAction?.movementPolicy;
  const movementMultiplier = movementPolicy === 'slow' ? 0.15 : 1;
  const targetVx = movementPolicy === 'blocked' ? 0 : moveX * targetSpeed * movementMultiplier;
  const targetVy = movementPolicy === 'blocked' ? 0 : moveY * targetSpeed * movementMultiplier;
  const blend = Math.min(1, ((Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01) ? accel : decel) * dt);
  player.vx += (targetVx - player.vx) * blend;
  player.vy += (targetVy - player.vy) * blend;
  if (Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01) {
    player.facingVector = { x: Math.sign(moveX), y: Math.sign(moveY) };
  }

  movePlayer((player.vx + damageImpulse.x) * dt, (player.vy + damageImpulse.y) * dt);

  const { width, height } = getMapDimensions();
  if (player.x < 0 || player.y < 0 || player.x >= width || player.y >= height) {
    logPlayerBoundsState('player coordinates exceeded map bounds after movement', {
      mapSize: { width, height },
      coordinates: { x: player.x, y: player.y },
    });
  }

  player.mana = Math.min(player.maxMana, player.mana + player.manaRegen * dt);
  abilitySystem.tick(dt);
  combatHud.updateOrbs();
  updateEntityState(player, dt);
  updateEntityFacingFromVelocity(player);
  syncEntityMovementState(player);
  player.castCooldown = runtimeConfig.get('player.castDuration');

  if (!isCraftingUIOpen && !inventoryWindow.isOpen()) {
    const interactDown = input.isDown('e');
    if (interactDown && !interactLatch) {
      if (dialogueManager.isOpen) {
        dialogueManager.closeDialogue();
      } else {
        const facing = player.facingVector ?? { x: 0, y: 1 };
        tryInteract({
          actor: player,
          room: activeRoom,
          positions: [
            { x: Math.round(player.x), y: Math.round(player.y) },
            { x: Math.round(player.x + facing.x), y: Math.round(player.y + facing.y) },
          ],
          triggerMode: 'button',
          context: {
            transitionSystem: roomTransitionSystem,
            activeRoom,
            dialogueManager,
          },
          debug: exitDebugMode ? { enabled: true, prefix: '[Interaction]' } : null,
        });
      }
    }
    interactLatch = interactDown;

    const target = input.getMouseWorldPosition();
    const abilityMouseButtons = ['left', 'right', 'middle'];
    for (let i = 0; i < abilityMouseButtons.length; i += 1) {
      if (input.consumeMouseButtonPress(abilityMouseButtons[i])) {
        abilitySystem.castSlot(i, { player, target });
      }
    }
  } else {
    interactLatch = false;
    input.clearMouseButtonPresses();
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
  enemies.length = 0;
  projectiles = [];
  goldPiles = [];
  worldDrops = [];
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

  const craftingToggleDown = input.isDown('c');
  if (craftingToggleDown && !craftingToggleLatch) {
    isCraftingUIOpen = !isCraftingUIOpen;
    spellCraftingWindow.toggle();
  }
  craftingToggleLatch = craftingToggleDown;

  const inventoryDown = input.isDown('i');
  if (inventoryDown && !inventoryToggleLatch) {
    inventoryWindow.toggle();
  }
  inventoryToggleLatch = inventoryDown;
  spriteEditor.tick(dt);
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

  const spriteEditorToggleDown = input.isDown('f7') && !input.isDown('control') && !input.isDown('meta') && !input.isDown('shift');
  if (spriteEditorToggleDown && !f7Latch) spriteEditor.toggle();
  f7Latch = spriteEditorToggleDown;

  const gridToggleDown = input.isDown('f7') && input.isDown('shift') && !input.isDown('control') && !input.isDown('meta');
  if (gridToggleDown && !gridToggleLatch) toggleOverlayFlag('debug.grid');
  gridToggleLatch = gridToggleDown;

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
      worldDrops,
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

    updateDevStatsHud(dt);

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
      updateEntityFacingFromVelocity(npc);
    }
  }

  const devCapturing = devToolsPanel.isCapturingInput();
  const spellbookOpen = spellbook.isOpen();

  if (!dialogueManager.isOpen && !diagMinimalMode && !devCapturing && !spellbookOpen) {
    handlePlayer(dt);
    if (enemyAiEnabled) {
      updateEnemies(enemies, player, dt, projectiles, runtimeConfig, { map, tileSize: 1, system: abilitySystem });
      updateEnemyPlayerInteractions(enemies, player, dt, combatTextSystem, runtimeConfig, applyPlayerDamageImpact);
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
      applyPlayerDamageImpact,
    );
    projectiles = combat.projectiles;
    for (const dead of combat.slain) handleEnemyDefeat(dead);
    goldPiles = LootSystem.collectGold(player, goldPiles, combatTextSystem);
    updateWorldDrops(dt);
    collectWorldDrops();
  } else {
    player.vx = 0;
    player.vy = 0;
    input.clearMouseButtonPresses();
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
    syncActiveRoomCollections(activeRoom);
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
  for (const enemy of enemies) {
    updateEntityAnimation(enemy, dt, Math.hypot(enemy.vx, enemy.vy) > 0.1, runtimeConfig);
    updateEntityFacingFromVelocity(enemy);
  }

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
    worldDrops,
    combatTextSystem,
    abilitySystem.getActiveEffects(),
    input.mouse,
    devToolsPanel.getRenderDebugOptions(),
    activeRoom,
  );
  drawHUD(renderer, player, abilitySystem);
  renderPlayerDamageFlash(renderer, player.hitFlashTimer, player.hitFlashDuration);
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

  updateDevStatsHud(dt);

  input.endFrame();

  if (!startupCompleteLogged) {
    startupCompleteLogged = true;
    logBoot('startup complete');
  }

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
