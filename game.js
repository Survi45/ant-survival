const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let player;
let enemies = [];
let bullets = [];
let running = false;
let lastTime = 0;

let score = 0;
let kills = 0;
let level = Storage.loadLevel();
let combo = 1;
let timeLeft = 30;

document.getElementById("levelBox").textContent = level;

// ---------------------------------------------------
// INITIALIZATION
// ---------------------------------------------------
function init() {
  player = new Player(canvas.width / 2, canvas.height / 2);
  enemies = [];
  bullets = [];
  score = 0;
  kills = 0;
  combo = 1;
  timeLeft = 30;

  document.getElementById("scoreBox").textContent = 0;
  document.getElementById("killsBox").textContent = 0;
  document.getElementById("comboBox").textContent = "x1";
  document.getElementById("timeLeft").textContent = "00:30";

  spawnEnemies();
}

function spawnEnemies() {
  for (let i = 0; i < level * 4; i++) {
    enemies.push(new Enemy(canvas.width, canvas.height));
  }
}

// ---------------------------------------------------
// GAME LOOP
// ---------------------------------------------------
function gameLoop(timestamp) {
  if (!running) return;

  const delta = timestamp - lastTime;
  lastTime = timestamp;

  update(delta);
  draw();

  requestAnimationFrame(gameLoop);
}

function update(delta) {
  player.update();

  enemies.forEach(e => e.update(player.x, player.y));
  bullets.forEach(b => b.update());

  // Collision + scoring
  bullets.forEach((b, i) => {
    enemies.forEach((e, j) => {
      if (b.collides(e)) {
        enemies.splice(j, 1);
        bullets.splice(i, 1);

        kills++;
        score += 10 * combo;
        combo++;

        document.getElementById("killsBox").textContent = kills;
        document.getElementById("scoreBox").textContent = score;
        document.getElementById("comboBox").textContent = "x" + combo;
      }
    });
  });

  // Timer
  if (timeLeft > 0) {
    timeLeft -= delta / 1000;
    if (timeLeft < 0) timeLeft = 0;

    let t = Math.floor(timeLeft);
    document.getElementById("timeLeft").textContent =
      "00:" + (t < 10 ? "0" + t : t);

    if (t === 0) endLevel();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  player.draw(ctx);
  enemies.forEach(e => e.draw(ctx));
  bullets.forEach(b => b.draw(ctx));
}

// ---------------------------------------------------
// LEVEL END + POPUPS
// ---------------------------------------------------
function endLevel() {
  running = false;

  const popup = document.getElementById("levelPopup");
  popup.style.display = "block";
  document.getElementById("popupText").textContent = "Level Complete!";

  let totalScore = score + kills * 5;
  if (totalScore > Storage.loadHighScore()) {
    Storage.saveHighScore(totalScore);
    showHighPopup();
  }

  document.getElementById("highScoreBox").textContent =
    Storage.loadHighScore();
}

document.getElementById("nextLevelBtn").onclick = () => {
  document.getElementById("levelPopup").style.display = "none";
  level++;
  Storage.saveLevel(level);
  init();
  running = true;
  lastTime = performance.now();
  gameLoop(lastTime);
};

document.getElementById("backBtn").onclick = () => {
  location.reload();
};

// ---------------------------------------------------
// HIGH SCORE POPUP
// ---------------------------------------------------
function showHighPopup() {
  const hp = document.getElementById("highPopup");
  hp.style.display = "block";
  setTimeout(() => hp.style.display = "none", 1600);
}

// ---------------------------------------------------
// BUTTON CONTROLS
// ---------------------------------------------------
document.getElementById("startBtn").onclick = () => {
  init();
  running = true;
  lastTime = performance.now();
  gameLoop(lastTime);
};

document.getElementById("pauseBtn").onclick = () => running = false;
document.getElementById("resumeBtn").onclick = () => {
  running = true;
  lastTime = performance.now();
  gameLoop(lastTime);
};

document.getElementById("restartBtn").onclick = () => {
  init();
  running = true;
};

// ---------------------------------------------------
// KEYBOARD MOVEMENT
// ---------------------------------------------------
const keys = {};
document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);

// ---------------------------------------------------
// PUB-G JOYSTICK (TOUCH CONTROLS)
// ---------------------------------------------------
const joyZone = document.getElementById("joystickZone");
const joyBase = document.getElementById("joystickBase");
const joyStick = document.getElementById("joystickStick");

let joyActive = false;
let joyX = 0, joyY = 0;
let baseRect = joyBase.getBoundingClientRect();

joyBase.addEventListener("touchstart", e => {
  joyActive = true;
});

joyBase.addEventListener("touchmove", e => {
  const t = e.touches[0];
  const x = t.clientX - baseRect.left - baseRect.width / 2;
  const y = t.clientY - baseRect.top - baseRect.height / 2;

  const dist = Math.sqrt(x*x + y*y);
  const maxDist = 55;

  let nx = x, ny = y;

  if (dist > maxDist) {
    nx = (x / dist) * maxDist;
    ny = (y / dist) * maxDist;
  }

  joyStick.style.transform = `translate(${nx}px, ${ny}px)`;

  joyX = nx / maxDist;
  joyY = ny / maxDist;

  e.preventDefault();
});

joyBase.addEventListener("touchend", () => {
  joyActive = false;
  joyStick.style.transform = "translate(-50%, -50%)";
  joyX = 0;
  joyY = 0;
});

// Override player movement update
const originalUpdate = Player.prototype.update;
Player.prototype.update = function () {
  if (joyActive) {
    this.x += joyX * this.speed;
    this.y += joyY * this.speed;
  }

  originalUpdate.call(this);
};
