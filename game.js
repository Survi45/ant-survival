// game.js — FULL final version 

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let lastTime = performance.now();
let running = false;
let paused = false;
let keys = {};

let enemies = [];
let particles = [];
let spawnTimer = 0;
let spawnInterval = 1200;

let levelScore = 0;   // resets every level
let kills = 0;
let level = 1;
let totalShots = 0;
let totalHits = 0;
let combo = 0;
let lastKillAt = 0;
const comboWindow = 900;

let player = null;
let rafId = null;

const LEVEL_DURATION = 120 * 1000; // per-level duration
let levelStartAt = null;

let currentHighScore = Storage.loadHighScore() || 0;

// UI refs
const ui = {
  scoreBox: document.getElementById("scoreBox"),
  killsBox: document.getElementById("killsBox"),
  levelBox: document.getElementById("levelBox"),
  comboBox: document.getElementById("comboBox"),
  timeLeft: document.getElementById("timeLeft"),
  highScoreBox: document.getElementById("highScoreBox"),
  message: document.getElementById("message")
};

const levelPopup = document.getElementById("levelPopup");
const popupText = document.getElementById("popupText");
const highPopup = document.getElementById("highPopup");
const highPopupText = document.getElementById("highPopupText");

// popup buttons
document.getElementById("nextLevelBtn").onclick = () => {
  level = level + 1;
  Storage.saveLevel(level);
  levelScore = 0;
  spawnInterval = Math.max(420, spawnInterval * 0.85);
  enemies = [];
  particles = [];
  levelStartAt = Date.now();
  levelPopup.style.display = "none";
  paused = false;
  updateUI();
};

document.getElementById("backBtn").onclick = () => {
  enemies = [];
  particles = [];
  levelScore = 0;
  kills = 0;
  spawnInterval = 1200;
  running = false;
  paused = false;
  levelStartAt = null;
  levelPopup.style.display = "none";
  showMessage("Back to start. Press START to play");
  updateUI();
};

// scoring per enemy type
const scorePerType = { normal: 12, gold: 75 };

// keyboard (desktop)
window.addEventListener("keydown", e => { keys[e.key] = true; });
window.addEventListener("keyup", e => { keys[e.key] = false; });

// helpers
function randRange(a,b){ return a + Math.random() * (b - a); }

/* ---- spawn logic ---- */
function spawnEnemyByLevel(){
  const baseSpeed = 0.6 + Math.random() * 1.0;
  const y = randRange(40, canvas.height - 40);
  const x = canvas.width + 20;

  const goldChance = Math.min(0.05 + (level * 0.03), 0.40);
  const isGold = Math.random() < goldChance;

  const size = isGold ? 34 : 22 + Math.min(20, level * 2);
  const speed = baseSpeed * (isGold ? 1.2 : 1);

  enemies.push(new Ant({ x, y, type: isGold ? "gold" : "normal", size, speed }));
}

/* ---- start/pause/resume/stop/restart ---- */
function startGame(){
  if (running) return;
  const saved = Storage.loadLevel();
  level = saved ? saved : 1;

  running = true;
  paused = false;
  // create player RIGHT when game starts (ensures on-load nothing but logo is visible)
  try { player = new Player(canvas); } catch (e) { player = null; console.warn("Player ctor failed:", e); }

  spawnTimer = 0;
  lastTime = performance.now();

  levelScore = 0;
  kills = 0;
  spawnInterval = 1200;
  levelStartAt = Date.now();

  currentHighScore = Storage.loadHighScore() || 0;
  ui.highScoreBox.innerText = currentHighScore;

  if (!rafId) loop();
  showMessage("Game started — Good luck!");
  updateUI();
}

function pauseGame(){ if (!running) return; paused = true; showMessage("Paused"); }
function resumeGame(){ if (!running) return; paused = false; lastTime = performance.now(); showMessage("Resumed", 900); }
function stopGame(){
  running = false;
  paused = false;
  enemies = [];
  particles = [];
  levelScore = 0;
  kills = 0;
  level = Storage.loadLevel() || 1;
  levelStartAt = null;
  updateUI();
  showMessage("Game stopped");
  if (rafId){ cancelAnimationFrame(rafId); rafId = null; }
}
function restartGame(){ enemies = []; particles = []; levelScore = 0; kills = 0; level = Storage.loadLevel() || 1; spawnInterval = 1200; running = false; startGame(); }

// UI updates
function updateUI(){
  ui.scoreBox.innerText = Math.floor(levelScore);
  ui.killsBox.innerText = kills;
  ui.levelBox.innerText = level;
  ui.comboBox.innerText = "x" + (combo > 1 ? combo : 1);
  ui.highScoreBox.innerText = currentHighScore;
}

// messages
function showMessage(text, ms = 1400){
  ui.message.innerText = text;
  ui.message.style.display = "block";
  ui.message.style.opacity = 1;
  setTimeout(()=> ui.message.style.opacity = 0, Math.max(600, ms - 200));
  setTimeout(()=> ui.message.style.display = "none", ms);
}

// high score popup
function showHighPopup(text){
  highPopupText.innerText = text;
  highPopup.style.display = "block";
  setTimeout(()=> { highPopup.style.display = "none"; }, 2000);
}

// click/touch kill handler
function onCanvasClick(e){
  if (!running || paused) return;
  totalShots++;
  const rect = canvas.getBoundingClientRect();
  const clientX = (e.clientX !== undefined) ? e.clientX : e.touches[0].clientX;
  const clientY = (e.clientY !== undefined) ? e.clientY : e.touches[0].clientY;
  const x = clientX - rect.left, y = clientY - rect.top;

  let hit = null;
  for (let i = enemies.length - 1; i >= 0; i--){
    const en = enemies[i]; const r = en.getRect();
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h){ hit = { enemy: en, index: i }; break; }
  }

  if (hit){
    const en = hit.enemy; enemies.splice(hit.index,1);
    totalHits++;
    const base = scorePerType[en.type] || 10;
    const now = Date.now();
    if (now - lastKillAt <= comboWindow) combo++; else combo = 1;
    lastKillAt = now;
    const comboMultiplier = 1 + Math.min(3, (combo - 1) * 0.22);
    const gained = Math.floor(base * comboMultiplier);
    levelScore += gained;
    kills++;
    for (let p = 0; p < 18; p++){
      const color = (en.type === "gold") ? "#ffd66b" : "#222";
      particles.push(new Particle(en.x + (Math.random() - 0.5) * en.size, en.y + (Math.random() - 0.5) * en.size, color));
    }
    updateUI();
  } else {
    combo = 0; updateUI();
  }
}

canvas.addEventListener("click", onCanvasClick);
canvas.addEventListener("touchstart", function(e){ e.preventDefault(); onCanvasClick(e); }, { passive:false });

/* ---------- JOYSTICK HANDLER (improved) ---------- */
// HTML elements
const joystickZone = document.getElementById("joystickZone");
const joystickBase = document.getElementById("joystickBase");
const joystickStick = document.getElementById("joystickStick");

// joystick state
let joystick = { active:false, startX:0, startY:0, dx:0, dy:0, normalizedX:0, normalizedY:0 };

// utility: set stick transform
function setStickTransform(x, y, instant=false){
  // instant: no transition (while dragging). When releasing, call with instant=false to use CSS transition
  joystickStick.style.transition = instant ? "none" : "120ms cubic-bezier(.2,.8,.2,1)";
  joystickStick.style.transform = `translate(${x}px, ${y}px)`;
}

// reset stick to center with smooth animation
function resetStickToCenter(){
  joystick.dx = 0; joystick.dy = 0; joystick.normalizedX = 0; joystick.normalizedY = 0;
  setStickTransform(0, 0, false);
}

// compute joystick values from event coordinates
function computeJoystickFromPos(clientX, clientY){
  const rect = joystickBase.getBoundingClientRect();
  const centerX = rect.left + rect.width/2;
  const centerY = rect.top + rect.height/2;
  let dx = clientX - centerX;
  let dy = clientY - centerY;
  // invert Y if needed (we'll keep natural coordinates where -Y is up)
  const dist = Math.sqrt(dx*dx + dy*dy);
  const maxRadius = rect.width/2;
  if (dist > maxRadius){
    dx = dx / dist * maxRadius;
    dy = dy / dist * maxRadius;
  }
  joystick.dx = dx;
  joystick.dy = dy;
  joystick.normalizedX = dx / maxRadius;
  joystick.normalizedY = dy / maxRadius;
  setStickTransform(dx, dy, true); // instant while dragging
}

// handlers
function handleJoystickStart(e){
  joystick.active = true;
  // stop transition while dragging for snappy follow
  setStickTransform(joystick.dx, joystick.dy, true);
  if (e.touches){
    // use first touch for joystick
    computeJoystickFromPos(e.touches[0].clientX, e.touches[0].clientY);
    e.preventDefault();
  } else {
    computeJoystickFromPos(e.clientX, e.clientY);
  }
}

function handleJoystickMove(e){
  if (!joystick.active) return;
  if (e.touches){
    computeJoystickFromPos(e.touches[0].clientX, e.touches[0].clientY);
    e.preventDefault();
  } else {
    computeJoystickFromPos(e.clientX, e.clientY);
  }
}

function handleJoystickEnd(){
  // release: smooth center
  joystick.active = false;
  resetStickToCenter();
}

// show joystick only on touch devices, but also allow CSS media query to show for testing
function ensureJoystickVisibility(){
  try{
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (isTouch) joystickZone.style.display = "block";
  }catch(e){}
}

// wire events: touch and mouse
joystickBase.addEventListener("touchstart", handleJoystickStart, { passive:false });
joystickBase.addEventListener("touchmove", handleJoystickMove, { passive:false });
joystickBase.addEventListener("touchend", handleJoystickEnd, { passive:false });
joystickBase.addEventListener("touchcancel", handleJoystickEnd, { passive:false });

joystickBase.addEventListener("mousedown", function(e){
  // only react to left button
  if (e.button !== 0) return;
  handleJoystickStart(e);
});
document.addEventListener("mousemove", function(e){
  if (joystick.active) handleJoystickMove(e);
});
document.addEventListener("mouseup", function(e){
  if (joystick.active) handleJoystickEnd();
});
document.addEventListener("touchend", handleJoystickEnd);
document.addEventListener("touchcancel", handleJoystickEnd);

/* ---------- JOYSTICK -> PLAYER MOVEMENT (smooth) ---------- */
/*
  Movement approach:
  - We convert joystick.normalizedX/Y (-1..1) to movement vector.
  - Multiply by player.speed and scale by dt so movement is framerate independent.
  - Factor uses 60fps baseline: multiplier = dt / 16.67 (approx 16.67 ms per frame).
*/
function updateJoystickMovement(dt){
  if(!player) return;
  const normX = joystick.normalizedX || 0;
  const normY = joystick.normalizedY || 0;

  // if joystick is almost zero and not active, nothing to do
  if (!joystick.active && Math.abs(normX) < 0.001 && Math.abs(normY) < 0.001) return;

  // speed scaling
  const baselineFrameMs = 16.6667; // 60fps baseline
  const frameFactor = dt / baselineFrameMs;

  // apply movement
  const moveX = normX * player.speed * frameFactor;
  const moveY = normY * player.speed * frameFactor;

  player.x += moveX;
  player.y += moveY;

  // clamp inside canvas
  const half = player.size / 2;
  player.x = Math.max(half, Math.min(canvas.width - half, player.x));
  player.y = Math.max(half, Math.min(canvas.height - half, player.y));

  // set facing based on horizontal input (for nice direction)
  if (Math.abs(normX) > 0.1){
    player.facing = (normX < 0) ? "left" : "right";
  }
}

/* ---------- MAIN LOOP ---------- */
function loop(){
  rafId = requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.max(0.1, now - lastTime);
  lastTime = now;

  // clear every frame and draw
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // If not running (before start): show nothing but logo (watermark is CSS background) => do nothing
  if (!running){
    // Keep UI (score/time) not changed; do not instantiate/draw player/enemies.
    return;
  }

  if (paused){
    // draw paused overlay but keep normal alpha for sprites (we don't modify globalAlpha permanently)
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.restore();
    ctx.fillStyle = "#fff";
    ctx.font = "28px Inter, Arial";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", canvas.width/2, canvas.height/2 + 10);
    return;
  }

  // update player: joystick + keyboard
  if (player){
    // joystick movement first (touch)
    updateJoystickMovement(dt);

    // keyboard movement (desktop). Player.update expects dt as param in some implementations — we pass dt to be safe
    if (typeof player.update === "function") player.update(keys, dt);

    // ensure player.draw respects drawing alpha and image smoothing (Player.draw handles fallback)
    if (typeof player.draw === "function") player.draw(ctx);
  }

  // spawn enemies
  spawnTimer += dt;
  if (spawnTimer >= spawnInterval){
    spawnTimer = 0;
    spawnEnemyByLevel();
  }

  // update & draw enemies (explicitly reset alpha so no accidental fading)
  for (let i = enemies.length - 1; i >= 0; i--){
    const e = enemies[i];
    ctx.save();
    ctx.globalAlpha = 1;
    e.update(dt, level);
    e.draw(ctx);
    ctx.restore();

    // collision (player touch)
    if (player){
      const pRect = player.getRect();
      const r = e.getRect();
      if (pRect.x < r.x + r.w && pRect.x + pRect.w > r.x && pRect.y < r.y + r.h && pRect.y + pRect.h > r.y){
        enemies.splice(i, 1);
        kills++;
        totalHits++;
        const gained = scorePerType[e.type] || 10;
        levelScore += gained;
        for (let p = 0; p < 12; p++){
          const color = (e.type === "gold") ? "#ffd66b" : "#222";
          particles.push(new Particle(e.x + (Math.random()-0.5)*e.size, e.y + (Math.random()-0.5)*e.size, color));
        }
        continue;
      }
    }

    if (e.isOffScreen && e.isOffScreen(canvas.width)) {
      enemies.splice(i, 1);
    }
  }

  // particles
  for (let i = particles.length - 1; i >= 0; i--){
    const p = particles[i];
    p.update(dt);
    p.draw(ctx);
    if (Date.now() - p.start > p.life) particles.splice(i, 1);
  }

  // level timer + ui
  if (levelStartAt){
    const elapsed = Date.now() - levelStartAt;
    const left = Math.max(0, LEVEL_DURATION - elapsed);
    const mm = Math.floor(left / 60000).toString().padStart(2, "0");
    const ss = Math.floor((left % 60000) / 1000).toString().padStart(2, "0");
    ui.timeLeft.innerText = `${mm}:${ss}`;
    if (left <= 0){
      const nextLevel = level + 1;
      Storage.saveLevel(nextLevel);
      const storedHigh = Storage.loadHighScore() || 0;
      if (levelScore > storedHigh){
        Storage.saveHighScore(levelScore);
        currentHighScore = levelScore;
        showHighPopup("New High Score! " + levelScore);
      }
      paused = true;
      popupText.innerText = `Level ${level} completed!`;
      levelPopup.style.display = "block";
    }
  } else {
    ui.timeLeft.innerText = "00:00";
  }

  updateUI();
}

// hook UI buttons
document.getElementById("startBtn").onclick = () => { if(!running) startGame(); };
document.getElementById("pauseBtn").onclick = pauseGame;
document.getElementById("resumeBtn").onclick = resumeGame;
document.getElementById("stopBtn").onclick = stopGame;
document.getElementById("restartBtn").onclick = restartGame;

// initial UI set
window.onload = () => {
  currentHighScore = Storage.loadHighScore() || 0;
  ui.highScoreBox.innerText = currentHighScore;
  const savedLevel = Storage.loadLevel() || 1;
  ui.levelBox.innerText = savedLevel;
  updateUI();
  showMessage("Press START to play", 1500);

  // IMPORTANT: Do NOT create player here (so the canvas shows only watermark/logo on load).
  // Player will be created at startGame() so there's no blurry placeholder at page load.

  // show joystick on touch devices
  ensureJoystickVisibility();

  // safety: ensure joystick resets when user lifts finger anywhere
  document.addEventListener("touchend", handleJoystickEnd);
  document.addEventListener("touchcancel", handleJoystickEnd);

  // start the render loop so UI message timing works (we still early-return when !running)
  loop();
};
