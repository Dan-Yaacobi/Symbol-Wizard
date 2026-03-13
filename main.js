import { Renderer } from './engine/Renderer.js';
import { Camera } from './engine/Camera.js';
import { Input } from './engine/Input.js';
import { Viewport } from './engine/Viewport.js';
import { Player } from './entities/Player.js';
import { BiomeGenerator } from './world/BiomeGenerator.js';
import { RoomTransitionSystem } from './world/RoomTransitionSystem.js';
import { resolveMapCollision } from './systems/CollisionSystem.js';
import { updateEnemies } from './systems/AISystem.js';
import { updateEnemyPlayerInteractions, updateProjectiles } from './systems/CombatSystem.js';
import * as LootSystem from './systems/LootSystem.js';
import { CombatTextSystem } from './systems/CombatTextSystem.js';
import { renderWorld } from './systems/RenderSystem.js';
import { updateEntityAnimation, updateProjectileAnimation } from './systems/AnimationSystem.js';
import { ChatBox } from './ui/ChatBox.js';
import { drawHUD } from './ui/HUD.js';
import { dialogueTree } from './systems/DialogueSystem.js';
import { DialogueManager } from './systems/DialogueManager.js';
import { abilityDefinitions, defaultAbilitySlots } from './data/abilities.js';
import { AbilitySystem } from './systems/AbilitySystem.js';
import { AbilityBar } from './ui/AbilityBar.js';
import { SkillTreeWindow } from './ui/SkillTreeWindow.js';
import {
  cleanupDestroyedObjects,
  resolveObjectCollision,
  updateDestructibleAnimations,
  updateTownNpcs,
} from './systems/WorldObjectSystem.js';

const VIEW_W = 104;
const VIEW_H = 58;
const ROOM_W = 64;
const ROOM_H = 40;

const canvas = document.getElementById('gameCanvas');
const renderer = new Renderer(canvas, VIEW_W, VIEW_H, 8, 8);
canvas.style.width = canvas.width + "px";
canvas.style.height = canvas.height + "px";
const camera = new Camera(VIEW_W, VIEW_H, ROOM_W, ROOM_H);
const viewport = new Viewport(canvas);
const input = new Input(canvas, viewport, camera, renderer.cellW, renderer.cellH);
const chat = new ChatBox();

const biomeGenerator = new BiomeGenerator({ roomWidth: ROOM_W, roomHeight: ROOM_H });
const { biome, startRoom } = biomeGenerator.enterBiome('starting-biome');
let activeRoom = startRoom;
let map = activeRoom.tiles;
const player = new Player(Math.floor(ROOM_W / 2), Math.floor(ROOM_H / 2));
const enemies = [];
const npcs = [];
const worldObjects = [];
const roomTransitionSystem = new RoomTransitionSystem({ biomeGenerator, fadeDurationMs: 150 });

if (activeRoom.entrances['initial-spawn']) {
  const startEntrance = activeRoom.entrances['initial-spawn'];
  player.x = startEntrance.x;
  player.y = startEntrance.y;
}
let projectiles = [];
let goldPiles = [];
const combatTextSystem = new CombatTextSystem();

const abilitySystem = new AbilitySystem({
  definitions: abilityDefinitions,
  player,
  enemies,
  map,
  camera,
  spawnProjectile: (projectile) => projectiles.push(projectile),
  spendGold: (cost) => {
    if (player.gold < cost) return false;
    player.gold -= cost;
    return true;
  },
  reportDamage: (enemy, damage, isCritical) => combatTextSystem.spawnDamageText(enemy, damage, isCritical),
  onEnemySlain: (enemy) => {
    const drop = LootSystem.spawnGold(enemy);
    if (drop) goldPiles.push(drop);
  },
});

defaultAbilitySlots.forEach((abilityId, slotIndex) => {
  abilitySystem.assignAbilityToSlot(slotIndex, abilityId);
});

const uiRoot = document.getElementById('uiPanels') ?? (() => {
  const fallback = document.createElement('section');
  fallback.id = 'uiPanels';
  fallback.className = 'ui-panels';
  document.body.appendChild(fallback);
  console.warn('BOOT: #uiPanels missing in startup scene. Created fallback root to prevent startup crash.');
  return fallback;
})();
const abilityBar = new AbilityBar({ root: uiRoot, abilitySystem });
const skillTree = new SkillTreeWindow({ root: uiRoot, abilitySystem, player });

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

function isWalkable(x, y) {
  const tx = Math.round(x);
  const ty = Math.round(y);
  return map[ty]?.[tx]?.walkable;
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

  player.vx = moveX * player.speed;
  player.vy = moveY * player.speed;

  player.x += player.vx * dt;
  if (!isWalkable(player.x, player.y)) resolveMapCollision(player, map);
  resolveObjectCollision(player, worldObjects);

  player.y += player.vy * dt;
  if (!isWalkable(player.x, player.y)) resolveMapCollision(player, map);
  resolveObjectCollision(player, worldObjects);

  player.mana = Math.min(player.maxMana, player.mana + player.manaRegen * dt);
  abilitySystem.tick(dt);

  if (!dialogueManager.isOpen) {
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
  worldObjects.length = 0;
  npcs.length = 0;
  enemies.length = 0;
  projectiles = [];
  goldPiles = [];
  player.x = Math.floor(ROOM_W / 2);
  player.y = Math.floor(ROOM_H / 2);
  camera.x = Math.floor(player.x - VIEW_W / 2);
  camera.y = Math.floor(player.y - VIEW_H / 2);
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

  if (!diagMinimalMode) {
    updateTownNpcs(npcs, map, dt);
    for (const npc of npcs) {
      updateEntityAnimation(npc, dt, Math.hypot(npc.vx, npc.vy) > 0.1);
    }
  }

  if (!dialogueManager.isOpen && !diagMinimalMode) {
    handlePlayer(dt);
    updateEnemies(enemies, player, dt);

    updateEnemyPlayerInteractions(enemies, player, dt, combatTextSystem);

    updateProjectileAnimation(projectiles, dt);
    const combat = updateProjectiles(
      projectiles,
      map,
      enemies,
      dt,
      combatTextSystem,
      abilitySystem,
      worldObjects,
      (object) => {
        spawnDestructionEffects(object);
        triggerDestructionSound(object.kind);

        if (Math.random() <= object.dropChance) {
          const drop = LootSystem.spawnDestructibleDrop(object);
          if (!drop) return;
          if (drop.type === 'gold' && drop.amount <= 0) return;
          goldPiles.push(drop);
        }
      },
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
    abilitySystem.map = map;
    camera.worldW = map[0]?.length ?? ROOM_W;
    camera.worldH = map.length ?? ROOM_H;
    renderer.lastCameraX = Number.NaN;
    renderer.lastCameraY = Number.NaN;
  }

  updateEntityAnimation(player, dt, Math.hypot(player.vx, player.vy) > 0.1);

  if (!diagMinimalMode) {
    dialogueManager.update(dt);
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

  input.endFrame();

  if (!startupCompleteLogged) {
    startupCompleteLogged = true;
    logBoot('startup complete');
  }

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
