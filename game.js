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

// hook popup buttons
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

// detect mobile/tablet for joystick
const isMobile = /Mobi|Android/i.test(navigator.userAgent);

// joystick setup
if(isMobile){
  const joyZone = document.getElementById("joystickZone");
  joyZone.style.display="block";
  const stick = document.getElementById("joystickStick");
  const radius = 50;
  let dragging=false, startX, startY;

  stick.addEventListener("touchstart", e=>{
    e.preventDefault(); dragging=true;
    const t=e.touches[0];
    startX=t.clientX; startY=t.clientY;
  });

  document.addEventListener("touchmove", e=>{
    if(!dragging) return;
    const t=e.touches[0];
    let dx = t.clientX - startX;
    let dy = t.clientY - startY;

    const dist = Math.sqrt(dx*dx + dy*dy);
    if(dist>radius){ dx=(dx/dist)*radius; dy=(dy/dist)*radius; }

    stick.style.transform = `translate(${dx}px,${dy}px)`;

    if(player){ player.moveX = dx/radius; player.moveY = dy/radius; }
  }, { passive:false });

  document.addEventListener("touchend", e=>{
    dragging=false;
    stick.style.transform = "translate(0px,0px)";
    if(player){ player.moveX=0; player.moveY=0; }
  });
}else{
  document.getElementById("joystickZone").style.display="none";
}

// keyboard
window.addEventListener("keydown", e=>keys[e.key]=true);
window.addEventListener("keyup", e=>keys[e.key]=false);

// helpers
function randRange(a,b){ return a + Math.random() * (b - a); }

function spawnEnemyByLevel(){
  const baseSpeed = 0.6 + Math.random() * 1.0;
  const y = randRange(40, canvas.height - 40);
  const x = canvas.width + 20;

  const goldChance = Math.min(0.05 + (level * 0.03), 0.40);
  const isGold = Math.random() < goldChance;

  const size = isGold ? 34 : 22 + Math.min(20, level*2);
  const speed = baseSpeed * (isGold ? 1.2 : 1);

  enemies.push(new Ant({ x, y, type: isGold?"gold":"normal", size, speed }));
}

// click/touch kill
function onCanvasClick(e){
  if(!running || paused) return;
  totalShots++;
  const rect = canvas.getBoundingClientRect();
  const clientX = e.clientX!==undefined ? e.clientX : e.touches[0].clientX;
  const clientY = e.clientY!==undefined ? e.clientY : e.touches[0].clientY;
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  let hit = null;
  for(let i=enemies.length-1;i>=0;i--){
    const en=enemies[i]; const r=en.getRect();
    if(x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h){ hit={enemy:en,index:i}; break; }
  }

  if(hit){
    const en = hit.enemy; enemies.splice(hit.index,1);
    totalHits++;
    const base = scorePerType[en.type]||10;
    const now = Date.now();
    if(now-lastKillAt<=comboWindow) combo++; else combo=1;
    lastKillAt=now;
    const comboMultiplier = 1+Math.min(3,(combo-1)*0.22);
    const gained = Math.floor(base*comboMultiplier);
    levelScore += gained;
    kills++;
    for(let p=0;p<18;p++){
      const color = en.type==="gold" ? "#ffd66b" : "#222";
      particles.push(new Particle(en.x+(Math.random()-0.5)*en.size,en.y+(Math.random()-0.5)*en.size,color));
    }
    updateUI();
  } else { combo=0; updateUI(); }
}

canvas.addEventListener("click", onCanvasClick);
canvas.addEventListener("touchstart", e=>{ e.preventDefault(); onCanvasClick(e); },{passive:false});

// start/pause/resume/stop/restart
function startGame(){
  if(running) return;
  const saved = Storage.loadLevel();
  level = saved ? saved : 1;

  running = true; paused=false;
  player = new Player(canvas);
  spawnTimer=0; lastTime = performance.now();
  levelScore=0; kills=0; spawnInterval=1200;
  levelStartAt = Date.now();

  currentHighScore = Storage.loadHighScore()||0;
  ui.highScoreBox.innerText=currentHighScore;

  if(!rafId) loop();
  showMessage("Game started — Good luck!");
  updateUI();
}

function pauseGame(){ if(!running) return; paused=true; showMessage("Paused"); }
function resumeGame(){ if(!running) return; paused=false; lastTime=performance.now(); showMessage("Resumed",900); }
function stopGame(){ running=false; paused=false; enemies=[]; particles=[]; levelScore=0; kills=0; level=Storage.loadLevel()||1; levelStartAt=null; updateUI(); showMessage("Game stopped"); if(rafId){ cancelAnimationFrame(rafId); rafId=null; } }
function restartGame(){ enemies=[]; particles=[]; levelScore=0; kills=0; level=Storage.loadLevel()||1; spawnInterval=1200; running=false; startGame(); }

// UI updates
function updateUI(){
  ui.scoreBox.innerText=Math.floor(levelScore);
  ui.killsBox.innerText=kills;
  ui.levelBox.innerText=level;
  ui.comboBox.innerText="x"+(combo>1?combo:1);
  ui.highScoreBox.innerText=currentHighScore;
}

// messages
function showMessage(text,ms=1400){
  ui.message.innerText=text;
  ui.message.style.display="block";
  ui.message.style.opacity=1;
  setTimeout(()=> ui.message.style.opacity=0, Math.max(600,ms-200));
  setTimeout(()=> ui.message.style.display="none", ms);
}

function showHighPopup(text){
  highPopupText.innerText=text;
  highPopup.style.display="block";
  setTimeout(()=>{ highPopup.style.display="none"; },2000);
}

// main loop
function loop(){
  rafId=requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.max(0.1, now-lastTime);
  lastTime=now;
  if(!running) return;

  if(paused){
    ctx.globalAlpha=0.5; ctx.fillStyle="rgba(0,0,0,0.35)"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.globalAlpha=1;
    ctx.fillStyle="#fff"; ctx.font="28px Inter"; ctx.fillText("PAUSED", canvas.width/2-60, canvas.height/2);
    return;
  }

  if(levelStartAt){
    const elapsed = Date.now()-levelStartAt;
    const left = Math.max(0, LEVEL_DURATION - elapsed);
    const mm = Math.floor(left/60000).toString().padStart(2,"0");
    const ss = Math.floor((left%60000)/1000).toString().padStart(2,"0");
    ui.timeLeft.innerText = `${mm}:${ss}`;
    if(left<=0){
      const nextLevel = level+1; Storage.saveLevel(nextLevel);
      const storedHigh = Storage.loadHighScore()||0;
      if(levelScore>storedHigh){ Storage.saveHighScore(levelScore); currentHighScore=levelScore; showHighPopup("New High Score! "+levelScore); }
      paused=true;
      popupText.innerText=`Level ${level} completed!`;
      levelPopup.style.display="block";
    }
  } else ui.timeLeft.innerText="00:00";

  ctx.clearRect(0,0,canvas.width,canvas.height);

  if(player){ player.update(keys,dt); player.draw(ctx); }

  spawnTimer += dt;
  if(spawnTimer>=spawnInterval){ spawnTimer=0; spawnEnemyByLevel(); }

  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    e.update(dt,level);
    e.draw(ctx);
    const pRect = player.getRect();
    const r = e.getRect();
    if(pRect.x<r.x+r.w && pRect.x+pRect.w>r.x && pRect.y<r.y+r.h && pRect.y+pRect.h>r.y){
      enemies.splice(i,1); kills++; totalHits++; const gained=scorePerType[e.type]||10; levelScore+=gained;
      for(let p=0;p<12;p++){ const color = e.type==="gold" ? "#ffd66b" : "#222"; particles.push(new Particle(e.x+(Math.random()-0.5)*e.size,e.y+(Math.random()-0.5)*e.size,color)); }
    } else if(e.isOffScreen(canvas.width)) enemies.splice(i,1);
  }

  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i]; p.update(dt); p.draw(ctx); if(Date.now()-p.start>p.life) particles.splice(i,1);
  }

  updateUI();
}

// hook UI buttons
document.getElementById("startBtn").onclick = ()=>{ if(!running) startGame(); };
document.getElementById("pauseBtn").onclick = pauseGame;
document.getElementById("resumeBtn").onclick = resumeGame;
document.getElementById("stopBtn").onclick = stopGame;
document.getElementById("restartBtn").onclick = restartGame;

// initial UI set
window.onload=()=>{
  currentHighScore = Storage.loadHighScore()||0;
  ui.highScoreBox.innerText=currentHighScore;
  const savedLevel = Storage.loadLevel()||1;
  ui.levelBox.innerText=savedLevel;
  updateUI();
  showMessage("Press START to play",1500);
};
