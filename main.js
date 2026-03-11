import { Renderer } from './engine/Renderer.js';
import { Camera } from './engine/Camera.js';
import { Input } from './engine/Input.js';
import { Player } from './entities/Player.js';
import { generateMainTown } from './world/MapGenerator.js';
import { resolveMapCollision } from './systems/CollisionSystem.js';
import { updateEnemies } from './systems/AISystem.js';
import { updateEnemyPlayerInteractions, updateProjectiles } from './systems/CombatSystem.js';
import { spawnGold, collectGold } from './systems/LootSystem.js';
import { CombatTextSystem } from './systems/CombatTextSystem.js';
import { renderWorld } from './systems/RenderSystem.js';
import { updateEntityAnimation, updateProjectileAnimation } from './systems/AnimationSystem.js';
import { ChatBox } from './ui/ChatBox.js';
import { drawHUD } from './ui/HUD.js';
import { dialogueTree } from './systems/DialogueSystem.js';
import { abilityDefinitions, defaultAbilitySlots } from './data/abilities.js';
import { AbilitySystem } from './systems/AbilitySystem.js';
import { AbilityBar } from './ui/AbilityBar.js';
import { SkillTreeWindow } from './ui/SkillTreeWindow.js';
import { resolveObjectCollision, updateDestructibleAnimations, updateTownNpcs } from './systems/WorldObjectSystem.js';

const VIEW_W = 160;
const VIEW_H = 90;
const WORLD_W = 220;
const WORLD_H = 140;

const canvas = document.getElementById('gameCanvas');
const renderer = new Renderer(canvas, VIEW_W, VIEW_H, 8, 8);
const camera = new Camera(VIEW_W, VIEW_H, WORLD_W, WORLD_H);
const input = new Input(canvas, VIEW_W, VIEW_H);
const chat = new ChatBox();

const town = generateMainTown(WORLD_W, WORLD_H);
const map = town.map;
const player = new Player(town.playerSpawn.x, town.playerSpawn.y);
const enemies = [];
const npcs = town.npcs;
const worldObjects = town.worldObjects;
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
    goldPiles.push(spawnGold(enemy));
  },
});

defaultAbilitySlots.forEach((abilityId, slotIndex) => {
  abilitySystem.assignAbilityToSlot(slotIndex, abilityId);
});

const uiRoot = document.getElementById('uiPanels');
const abilityBar = new AbilityBar({ root: uiRoot, abilitySystem });
const skillTree = new SkillTreeWindow({ root: uiRoot, abilitySystem, player });

const BASE_CANVAS_WIDTH = 1280;
const BASE_CANVAS_HEIGHT = 720;

function resizeLayout() {
  const shell = document.querySelector('.game-shell');
  const stage = document.querySelector('.game-stage');
  const panels = document.getElementById('uiPanels');
  if (!shell || !stage || !panels) return;

  const maxCanvasWidth = stage.clientWidth;
  const maxCanvasHeight = Math.max(120, stage.clientHeight);
  const rawScale = Math.min(maxCanvasWidth / BASE_CANVAS_WIDTH, maxCanvasHeight / BASE_CANVAS_HEIGHT);
  const scale = rawScale >= 1 ? Math.floor(rawScale) : rawScale;

  canvas.style.width = `${BASE_CANVAS_WIDTH * scale}px`;
  canvas.style.height = `${BASE_CANVAS_HEIGHT * scale}px`;
}

window.addEventListener('resize', resizeLayout);
resizeLayout();

let dialogueOpen = false;
let activeNpc = null;
let dialogueNode = 'start';
let interactLatch = false;
let slotPressLatch = [false, false, false, false];
let debugCursorWorld = { x: 0, y: 0 };

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

  const target = {
    x: input.mouse.x + camera.x,
    y: input.mouse.y + camera.y,
  };
  debugCursorWorld = target;

  for (let i = 0; i < 4; i += 1) {
    const hotkey = String(i + 1);
    const down = input.isDown(hotkey);
    if (down && !slotPressLatch[i]) {
      abilitySystem.castSlot(i, { player, target });
    }
    slotPressLatch[i] = down;
  }
}

function handleDialogue() {
  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const npc of npcs) {
    const d = Math.hypot(player.x - npc.x, player.y - npc.y);
    if (d < nearestDistance) {
      nearest = npc;
      nearestDistance = d;
    }
  }

  const nearNpc = nearest && nearestDistance <= nearest.interactRadius;
  const pressedInteract = input.isDown('e');

  if (pressedInteract && !interactLatch && nearNpc) {
    dialogueOpen = !dialogueOpen;
    activeNpc = nearest;
    dialogueNode = 'start';
  }
  interactLatch = pressedInteract;

  if (!dialogueOpen || !activeNpc) {
    const exitText = `${town.exits.north.label} | ${town.exits.east.label} | ${town.exits.west.label}`;
    chat.setMessage('Town Crier', nearNpc ? `Press E to talk to ${nearest.name}. ${exitText}` : `Welcome to Sunmeadow Town. ${exitText}`);
    return;
  }

  const node = dialogueTree[dialogueNode];
  chat.setMessage(node.speaker.replace('Gate Wizard', activeNpc.name), node.line.replace('dungeon', 'town').replace('threshold', 'crossroads'), node.options);

  for (let i = 1; i <= 9; i += 1) {
    if (input.isDown(String(i))) {
      const opt = node.options[i - 1];
      if (opt) dialogueNode = opt.next;
    }
  }
}

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  updateTownNpcs(npcs, map, dt);
  for (const npc of npcs) {
    updateEntityAnimation(npc, dt, Math.hypot(npc.vx, npc.vy) > 0.1);
  }

  if (!dialogueOpen) {
    handlePlayer(dt);
    updateEnemies(enemies, player, dt);

    updateEnemyPlayerInteractions(enemies, player, dt, combatTextSystem);

    updateProjectileAnimation(projectiles, dt);
    const combat = updateProjectiles(projectiles, map, enemies, dt, combatTextSystem, abilitySystem, worldObjects);
    projectiles = combat.projectiles;
    for (const dead of combat.slain) goldPiles.push(spawnGold(dead));
    goldPiles = collectGold(player, goldPiles, combatTextSystem);
  } else {
    player.vx = 0;
    player.vy = 0;
  }

  updateDestructibleAnimations(worldObjects, dt);
  combatTextSystem.update(dt);

  updateEntityAnimation(player, dt, Math.hypot(player.vx, player.vy) > 0.1);

  handleDialogue();
  camera.follow(player);

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
    debugCursorWorld,
  );
  drawHUD(renderer, player, abilitySystem);
  renderer.composite();

  abilityBar.render();
  input.endFrame();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
