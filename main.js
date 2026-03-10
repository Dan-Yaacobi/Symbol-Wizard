import { Renderer } from './engine/Renderer.js';
import { Camera } from './engine/Camera.js';
import { Input } from './engine/Input.js';
import { Player } from './entities/Player.js';
import { Enemy } from './entities/Enemy.js';
import { NPC } from './entities/NPC.js';
import { Projectile } from './entities/Projectile.js';
import { generateDungeon } from './world/MapGenerator.js';
import { resolveMapCollision } from './systems/CollisionSystem.js';
import { updateEnemies } from './systems/AISystem.js';
import { updateProjectiles } from './systems/CombatSystem.js';
import { spawnGold, collectGold } from './systems/LootSystem.js';
import { CombatTextSystem } from './systems/CombatTextSystem.js';
import { renderWorld } from './systems/RenderSystem.js';
import { updateEntityAnimation, updateProjectileAnimation } from './systems/AnimationSystem.js';
import { ChatBox } from './ui/ChatBox.js';
import { drawHUD } from './ui/HUD.js';
import { dialogueTree } from './systems/DialogueSystem.js';

const VIEW_W = 160;
const VIEW_H = 100;
const WORLD_W = 220;
const WORLD_H = 140;

const canvas = document.getElementById('gameCanvas');
const renderer = new Renderer(canvas, VIEW_W, VIEW_H, 8, 8);
const camera = new Camera(VIEW_W, VIEW_H, WORLD_W, WORLD_H);
const input = new Input(canvas, 8, 8);
const chat = new ChatBox();

const map = generateDungeon(WORLD_W, WORLD_H);
const player = new Player(20, 20);
const npc = new NPC(28, 20);
const enemies = [new Enemy('slime', 90, 64), new Enemy('skeleton', 110, 78), new Enemy('slime', 130, 85)];
let projectiles = [];
let goldPiles = [];
const combatTextSystem = new CombatTextSystem();

let dialogueOpen = false;
let dialogueNode = 'start';
let interactLatch = false;

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
  player.y += player.vy * dt;
  if (!isWalkable(player.x, player.y)) resolveMapCollision(player, map);

  player.castCooldown -= dt;
  if (input.mouse.clicked && player.castCooldown <= 0 && !dialogueOpen) {
    const target = camera.screenToWorld(input.mouse.x, input.mouse.y);
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const len = Math.hypot(dx, dy) || 1;
    projectiles.push(new Projectile(player.x + 1.8, player.y, dx / len, dy / len));
    player.castCooldown = 0.22;
  }
}

function handleDialogue() {
  const nearNpc = Math.hypot(player.x - npc.x, player.y - npc.y) <= npc.interactRadius;
  const pressedInteract = input.isDown('e');

  if (pressedInteract && !interactLatch && nearNpc) {
    dialogueOpen = !dialogueOpen;
    dialogueNode = 'start';
  }
  interactLatch = pressedInteract;

  if (!dialogueOpen) {
    chat.setMessage('System', nearNpc ? 'Press E to talk to Gate Wizard.' : 'Explore the dungeon. Left click casts Magic Bolt.');
    return;
  }

  const node = dialogueTree[dialogueNode];
  chat.setMessage(node.speaker, node.line, node.options);

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

  if (!dialogueOpen) {
    handlePlayer(dt);
    updateEnemies(enemies, player, dt);
    for (const enemy of enemies) {
      if (isWalkable(enemy.x, enemy.y)) continue;
      resolveMapCollision(enemy, map);
    }

    updateProjectileAnimation(projectiles, dt);
    const combat = updateProjectiles(projectiles, map, enemies, dt, combatTextSystem);
    projectiles = combat.projectiles;
    for (const dead of combat.slain) goldPiles.push(spawnGold(dead));
    goldPiles = collectGold(player, goldPiles, combatTextSystem);
  } else {
    player.vx = 0;
    player.vy = 0;
  }

  combatTextSystem.update(dt);

  updateEntityAnimation(player, dt, Math.hypot(player.vx, player.vy) > 0.1);

  handleDialogue();
  camera.follow(player);

  renderer.beginFrame();
  renderWorld(renderer, camera, map, player, enemies, npc, projectiles, goldPiles, combatTextSystem);
  drawHUD(renderer, player);
  renderer.composite();

  input.endFrame();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
