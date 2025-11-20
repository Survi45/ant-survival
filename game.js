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

/* ---------- JOYSTICK HANDLER ---------- */


// Elements (must match your HTML)
const joystickZone = document.getElementById("joystickZone");
const joystickBase = document.getElementById("joystickBase");
const joystickStick = document.getElementById("joystickStick");

// Joystick configuration
const JOY_BASE_DIAMETER = 140; // px — larger base (you asked for bigger). Adjust if needed.
const JOY_STICK_DIAMETER = 70; // px inner knob
let JOY_MAX_RADIUS = Math.round(JOY_BASE_DIAMETER / 2) - 6; // px

// State
let joystickActive = false;
let joyNormX = 0; // -1..1
let joyNormY = 0; // -1..1

// Utility: detect touch devices (mobile/tablet)
function isTouchDevice() {
  try {
    return (('ontouchstart' in window) || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0);
  } catch (e) { return false; }
}

// Ensure joystick DOM sizing and visibility (we only modify inline styles so CSS stays same)
function configureJoystickDisplay() {
  // Show only for touch devices
  if (isTouchDevice()) {
    joystickZone.style.display = "flex";
    // ensure base/stick sizes are set to our desired values
    joystickZone.style.width = JOY_BASE_DIAMETER + "px";
    joystickZone.style.height = JOY_BASE_DIAMETER + "px";
    joystickBase.style.width = JOY_BASE_DIAMETER + "px";
    joystickBase.style.height = JOY_BASE_DIAMETER + "px";
    joystickStick.style.width = JOY_STICK_DIAMETER + "px";
    joystickStick.style.height = JOY_STICK_DIAMETER + "px";
    joystickStick.style.left = "50%";
    joystickStick.style.top = "50%";
    joystickStick.style.transform = "translate(-50%, -50%)";
    JOY_MAX_RADIUS = Math.round(JOY_BASE_DIAMETER / 2) - 6;
  } else {
    // hide on desktop/laptop
    joystickZone.style.display = "none";
  }
}

// Set stick transform with optional instant mode (no CSS transition)
function joystickSetTransform(x, y, instant) {
  if (instant) {
    joystickStick.style.transition = "none";
  } else {
    joystickStick.style.transition = "120ms cubic-bezier(.2,.8,.2,1)";
  }
  // Use translate to move relative to center
  joystickStick.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
}

// Reset to center smoothly
function joystickResetToCenter() {
  joystickActive = false;
  joyNormX = 0; joyNormY = 0;
  joystickSetTransform(0, 0, false);
}

// Compute normalized vector from client coords
function joystickComputeFromClient(clientX, clientY) {
  const rect = joystickBase.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  let dx = clientX - centerX;
  let dy = clientY - centerY;
  // clamp to max radius
  const dist = Math.sqrt(dx*dx + dy*dy);
  const maxR = JOY_MAX_RADIUS;
  if (dist > maxR) {
    dx = (dx / dist) * maxR;
    dy = (dy / dist) * maxR;
  }
  // set transform instantly for finger-move responsiveness
  joystickSetTransform(dx, dy, true);
  // normalized values -X = left, -Y = up
  joyNormX = dx / maxR;
  joyNormY = dy / maxR;
}

// Touch / Mouse handlers for joystick
function handleJoyStart(e) {
  joystickActive = true;
  joystickStick.style.transition = "none";
  if (e.touches) {
    joystickComputeFromClient(e.touches[0].clientX, e.touches[0].clientY);
    e.preventDefault();
  } else {
    joystickComputeFromClient(e.clientX, e.clientY);
  }
}
function handleJoyMove(e) {
  if (!joystickActive) return;
  if (e.touches) {
    joystickComputeFromClient(e.touches[0].clientX, e.touches[0].clientY);
    e.preventDefault();
  } else {
    joystickComputeFromClient(e.clientX, e.clientY);
  }
}
function handleJoyEnd(e) {
  // smooth snap back
  joystickActive = false;
  joystickResetToCenter();
}

// Add listeners (touch first)
joystickBase.addEventListener("touchstart", handleJoyStart, { passive: false });
joystickBase.addEventListener("touchmove", handleJoyMove, { passive: false });
joystickBase.addEventListener("touchend", handleJoyEnd, { passive: false });
joystickBase.addEventListener("touchcancel", handleJoyEnd, { passive: false });
// Mouse support for testing on devices that show joystick (optional)
joystickBase.addEventListener("mousedown", function(e){
  if (e.button !== 0) return;
  handleJoyStart(e);
});
document.addEventListener("mousemove", function(e){ if (joystickActive) handleJoyMove(e); });
document.addEventListener("mouseup", function(){ if (joystickActive) handleJoyEnd(); });

// Provide vector to update loop
function getJoystickNormalized() {
  return { x: joyNormX, y: joyNormY };
}

/* ---------- JOYSTICK -> PLAYER MOVEMENT (smooth) ---------- */
function updateJoystickMovement(dt) {
  if (!player) return;
  const v = getJoystickNormalized();
  // If tiny input and not active, skip
  if (!joystickActive && Math.abs(v.x) < 0.001 && Math.abs(v.y) < 0.001) return;

  // Frame factor so movement feels consistent across frame rates
  const baselineMs = 16.6667;
  const factor = dt / baselineMs;

  const moveX = v.x * player.speed * factor;
  const moveY = v.y * player.speed * factor;

  player.x += moveX;
  player.y += moveY;

  // clamp
  const half = player.size / 2;
  player.x = Math.max(half, Math.min(canvas.width - half, player.x));
  player.y = Math.max(half, Math.min(canvas.height - half, player.y));

  if (Math.abs(v.x) > 0.1) {
    player.facing = (v.x < 0) ? "left" : "right";
  }
}

/* ---------- MAIN LOOP ---------- */
function loop(){
  rafId = requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.max(0.1, now - lastTime);
  lastTime = now;

  // clear every frame
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // If not running (before start): show only watermark via CSS, no canvas draws
  if (!running){
    // no canvas drawing pre-start (user requested logo only)
    return;
  }

  if (paused){
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
    // joystick movement with dt
    updateJoystickMovement(dt);

    // keyboard movement (desktop)
    if (typeof player.update === "function") player.update(keys, dt);

    // draw player
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

  
  // Configure joystick display & sizing for mobile (hide on desktop)
  configureJoystickDisplay();

  // safety: ensure joystick resets when user lifts finger anywhere
  document.addEventListener("touchend", handleJoyEnd);
  document.addEventListener("touchcancel", handleJoyEnd);

  // start the render loop so UI message timing works (we still early-return when !running)
  loop();
};
