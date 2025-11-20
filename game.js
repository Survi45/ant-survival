// game.js - final integrated logic per Surabhi's spec (updated golden spawn rate)
// Joystick + responsive canvas helpers added, core game logic preserved.

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

let currentHighScore = (typeof Storage !== "undefined" && Storage.loadHighScore) ? Storage.loadHighScore() || 0 : 0;

// UI refs
const ui = {
  scoreBox: document.getElementById("scoreBox"),       // level score
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

// hook popup buttons (keep behavior same)
if (document.getElementById("nextLevelBtn")) {
  document.getElementById("nextLevelBtn").onclick = () => {
    level = level + 1;
    if (typeof Storage !== "undefined" && Storage.saveLevel) Storage.saveLevel(level);
    levelScore = 0;
    spawnInterval = Math.max(420, spawnInterval * 0.85);
    enemies = [];
    particles = [];
    levelStartAt = Date.now();
    levelPopup.style.display = "none";
    paused = false;
    updateUI();
  };
}
if (document.getElementById("backBtn")) {
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
}

// scoring per enemy type
const scorePerType = { normal: 12, gold: 75 };

// keyboard (preserve)
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

// helpers
function randRange(a,b){ return a + Math.random() * (b - a); }

/* ---- UPDATED spawn logic: level-based golden spawn chance, gold size & speed tweak ---- */
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
/* -------------------------------------------------------------------------------------- */

/* -----------------------------
   Responsive canvas helpers
   ----------------------------- */
function syncCanvasSizeWithCSS(){
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(300, Math.floor(rect.width * dpr));
  const h = Math.max(200, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h){
    canvas.width = w;
    canvas.height = h;
    // if player uses onResize hook, call it
    if (player && typeof player.onResize === "function") player.onResize(canvas);
  }
}

/* -----------------------------
   Joystick (left) init
   - updates keys["ArrowUp"/"ArrowDown"/"ArrowLeft"/"ArrowRight"]
   - Option 2 behaviour: keyboard still works on touch devices
   ----------------------------- */
(function initJoystickLeft(){
  const joyOuter = document.getElementById("joystickLeft");
  const joyInner = document.getElementById("joyLeftKnob");
  if (!joyOuter || !joyInner) return;

  function showIfTouchCapable(){
    try {
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
        joyOuter.style.display = "flex";
      } else if (window.innerWidth <= 820) {
        joyOuter.style.display = "flex";
      } else {
        joyOuter.style.display = "none";
      }
    } catch (err) {
      if (window.innerWidth <= 820) joyOuter.style.display = "flex";
    }
  }
  showIfTouchCapable();
  window.addEventListener("resize", showIfTouchCapable);
  window.addEventListener("orientationchange", showIfTouchCapable);

  let active = false;
  let center = { x: 0, y: 0 };
  let maxRadius = 40;

  function setCenter(){
    const rect = joyOuter.getBoundingClientRect();
    center.x = rect.left + rect.width / 2;
    center.y = rect.top + rect.height / 2;
    maxRadius = Math.min(rect.width, rect.height) * 0.35;
  }
  setCenter();

  function clearDirections(){
    keys["ArrowUp"] = false;
    keys["ArrowDown"] = false;
    keys["ArrowLeft"] = false;
    keys["ArrowRight"] = false;
  }

  function setDirection(dx, dy){
    clearDirections();
    const dead = 8;
    if (Math.abs(dx) < dead && Math.abs(dy) < dead){
      joyInner.style.transform = `translate(0px,0px)`;
      return;
    }
    const nx = dx / maxRadius;
    const ny = dy / maxRadius;
    const cx = Math.max(-1, Math.min(1, nx));
    const cy = Math.max(-1, Math.min(1, ny));

    const visX = Math.max(-maxRadius, Math.min(maxRadius, dx));
    const visY = Math.max(-maxRadius, Math.min(maxRadius, dy));
    joyInner.style.transform = `translate(${visX}px, ${visY}px)`;

    const thresh = 0.35;
    if (cy < -thresh) keys["ArrowUp"] = true;
    if (cy > thresh) keys["ArrowDown"] = true;
    if (cx < -thresh) keys["ArrowLeft"] = true;
    if (cx > thresh) keys["ArrowRight"] = true;
  }

  function onStart(e){
    active = true;
    setCenter();
    const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    const dx = p.clientX - center.x;
    const dy = p.clientY - center.y;
    setDirection(dx, dy);
  }
  function onMove(e){
    if (!active) return;
    e.preventDefault();
    const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    const dx = p.clientX - center.x;
    const dy = p.clientY - center.y;
    setDirection(dx, dy);
  }
  function onEnd(e){
    active = false;
    clearDirections();
    joyInner.style.transform = `translate(0px,0px)`;
  }

  joyOuter.addEventListener("touchstart", onStart, { passive:false });
  joyOuter.addEventListener("touchmove", onMove, { passive:false });
  joyOuter.addEventListener("touchend", onEnd, { passive:false });
  joyOuter.addEventListener("touchcancel", onEnd, { passive:false });

  joyOuter.addEventListener("pointerdown", function(e){ if (e.pointerType === "mouse") return; onStart(e); }, { passive:false });
  window.addEventListener("pointermove", function(e){ if (!active) return onMove(e); }, { passive:false });
  window.addEventListener("pointerup", function(e){ if (!active) return; onEnd(e); }, { passive:false });

})();

/* -----------------------------
   click/touch kill handler (player tap)
   (keep your existing logic)
   ----------------------------- */
function onCanvasClick(e){
  if (!running || paused) return;
  totalShots++;
  const rect = canvas.getBoundingClientRect();
  const clientX = (e.clientX !== undefined) ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX);
  const clientY = (e.clientY !== undefined) ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY);
  if (clientX === undefined || clientY === undefined) return;
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
    // particles
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

/* -----------------------------
   main loop
   (keeps your original logic, with syncCanvas call)
   ----------------------------- */
function loop(){
  rafId = requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.max(0.1, now - lastTime);
  lastTime = now;

  if (!running) return;
  if (paused) {
    // dim and show paused text
    ctx.globalAlpha = 0.5; ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff"; ctx.font = "28px Inter"; ctx.fillText("PAUSED", canvas.width/2 - 60, canvas.height/2);
    return;
  }

  // ensure canvas resolution matches CSS size (prevents misaligned touches/popups)
  syncCanvasSizeWithCSS();

  // level timer
  if (levelStartAt){
    const elapsed = Date.now() - levelStartAt;
    const left = Math.max(0, LEVEL_DURATION - elapsed);
    const mm = Math.floor(left / 60000).toString().padStart(2, "0");
    const ss = Math.floor((left % 60000) / 1000).toString().padStart(2, "0");
    ui.timeLeft.innerText = `${mm}:${ss}`;
    if (left <= 0){
      const nextLevel = level + 1;
      if (typeof Storage !== "undefined" && Storage.saveLevel) Storage.saveLevel(nextLevel);

      const storedHigh = (typeof Storage !== "undefined" && Storage.loadHighScore) ? Storage.loadHighScore() || 0 : 0;
      if (levelScore > storedHigh){
        if (typeof Storage !== "undefined" && Storage.saveHighScore) Storage.saveHighScore(levelScore);
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

  // clear
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // player update & draw
  if (player) { player.update(keys, dt); player.draw(ctx); }

  // spawn
  spawnTimer += dt;
  if (spawnTimer >= spawnInterval){
    spawnTimer = 0;
    spawnEnemyByLevel();
  }

  // update enemies
  for (let i = enemies.length - 1; i >= 0; i--){
    const e = enemies[i];
    e.update(dt, level);
    e.draw(ctx);

    // collision with player (touch kill)
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
        particles.push(new Particle(e.x + (Math.random() - 0.5) * e.size, e.y + (Math.random() - 0.5) * e.size, color));
      }
    } else if (e.isOffScreen(canvas.width)) {
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

  updateUI();
}

/* -----------------------------
   UI updates + popup centering tweak
   ----------------------------- */
function updateUI(){
  ui.scoreBox.innerText = Math.floor(levelScore);
  ui.killsBox.innerText = kills;
  ui.levelBox.innerText = level;
  ui.comboBox.innerText = "x" + (combo > 1 ? combo : 1);
  ui.highScoreBox.innerText = currentHighScore;

  // adjust popup vertical position for small devices (avoid being too low)
  if (levelPopup){
    levelPopup.style.left = "50%";
    levelPopup.style.top = (window.innerWidth <= 420 ? "44%" : "50%");
  }
  if (highPopup){
    highPopup.style.left = "50%";
    highPopup.style.top = (window.innerWidth <= 420 ? "44%" : "50%");
  }
}

/* -----------------------------
   messages & high popup helpers
   ----------------------------- */
function showMessage(text, ms = 1400){
  ui.message.innerText = text;
  ui.message.style.display = "block";
  ui.message.style.opacity = 1;
  setTimeout(()=> ui.message.style.opacity = 0, Math.max(600, ms - 200));
  setTimeout(()=> ui.message.style.display = "none", ms);
}
function showHighPopup(text){
  if (highPopupText) highPopupText.innerText = text;
  if (highPopup) highPopup.style.display = "block";
  setTimeout(()=> { if (highPopup) highPopup.style.display = "none"; }, 2000);
}

/* -----------------------------
   game controls
   ----------------------------- */
function startGame(){
  if (running) return;
  const saved = (typeof Storage !== "undefined" && Storage.loadLevel) ? Storage.loadLevel() : 1;
  level = saved ? saved : 1;

  running = true;
  paused = false;
  player = new Player(canvas);
  spawnTimer = 0;
  lastTime = performance.now();

  levelScore = 0;
  kills = 0;
  spawnInterval = 1200;
  levelStartAt = Date.now();

  currentHighScore = (typeof Storage !== "undefined" && Storage.loadHighScore) ? Storage.loadHighScore() || 0 : 0;
  if (ui.highScoreBox) ui.highScoreBox.innerText = currentHighScore;

  if (!rafId) loop();
  showMessage("Game started — Good luck!");
  updateUI();
}
function pauseGame(){ if (!running) return; paused = true; showMessage("Paused"); }
function resumeGame(){ if (!running) return; paused = false; lastTime = performance.now(); showMessage("Resumed", 900); }
function stopGame(){ running = false; paused = false; enemies = []; particles = []; levelScore = 0; kills = 0; level = (typeof Storage !== "undefined" && Storage.loadLevel) ? Storage.loadLevel() || 1 : 1; levelStartAt = null; updateUI(); showMessage("Game stopped"); if (rafId){ cancelAnimationFrame(rafId); rafId = null; } }
function restartGame(){ enemies = []; particles = []; levelScore = 0; kills = 0; level = (typeof Storage !== "undefined" && Storage.loadLevel) ? Storage.loadLevel() || 1 : 1; spawnInterval = 1200; running = false; startGame(); }

/* -----------------------------
   UI button hooks
   ----------------------------- */
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resumeBtn = document.getElementById("resumeBtn");
const stopBtn = document.getElementById("stopBtn");
const restartBtn = document.getElementById("restartBtn");

if (startBtn) startBtn.onclick = () => { if (!running) startGame(); };
if (pauseBtn) pauseBtn.onclick = pauseGame;
if (resumeBtn) resumeBtn.onclick = resumeGame;
if (stopBtn) stopBtn.onclick = stopGame;
if (restartBtn) restartBtn.onclick = restartGame;

/* -----------------------------
   initial UI set and load saved data
   ----------------------------- */
window.addEventListener("load", () => {
  currentHighScore = (typeof Storage !== "undefined" && Storage.loadHighScore) ? Storage.loadHighScore() || 0 : 0;
  if (ui.highScoreBox) ui.highScoreBox.innerText = currentHighScore;
  const savedLevel = (typeof Storage !== "undefined" && Storage.loadLevel) ? Storage.loadLevel() || 1 : 1;
  if (ui.levelBox) ui.levelBox.innerText = savedLevel;
  updateUI();

  // ensure canvas size matches CSS initially
  syncCanvasSizeWithCSS();

  // ensure joystick visibility on load
  const joyOuter = document.getElementById("joystickLeft");
  if (joyOuter){
    try {
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) joyOuter.style.display = "flex";
      else if (window.innerWidth <= 820) joyOuter.style.display = "flex";
    } catch (e) {
      if (window.innerWidth <= 820) joyOuter.style.display = "flex";
    }
  }

  showMessage("Press START to play", 1500);
});
