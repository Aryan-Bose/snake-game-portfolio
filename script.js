const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("high-score");
const overlay = document.getElementById("overlay");
const difficultySelect = document.getElementById("difficulty");
const pauseBtn = document.getElementById("pause-btn");

const eatSound = document.getElementById("eat-sound");
const gameOverSound = document.getElementById("gameover-sound");

const box = 20;
const lerp = (a, b, t) => a + (b - a) * t;

// Mobile swipe support
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

const minSwipeDistance = 30; // px

canvas.addEventListener("touchstart", e => {
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}, { passive: true });

canvas.addEventListener("touchend", e => {
  const dx = touchEndX - touchStartX;
  const dy = touchEndY - touchStartY;

  if (Math.abs(dx) < minSwipeDistance && Math.abs(dy) < minSwipeDistance) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal swipe
    if (dx > 0 && direction !== "LEFT") nextDirection = "RIGHT";
    else if (dx < 0 && direction !== "RIGHT") nextDirection = "LEFT";
  } else {
    // Vertical swipe
    if (dy > 0 && direction !== "UP") nextDirection = "DOWN";
    else if (dy < 0 && direction !== "DOWN") nextDirection = "UP";
  }
}, { passive: true });

canvas.addEventListener("touchmove", e => {
  const touch = e.touches[0];
  touchEndX = touch.clientX;
  touchEndY = touch.clientY;
}, { passive: true });


let snake, direction, nextDirection, food;
let score, highScore, speed, minSpeed, speedStep;
let isGameOver = false;
let isPaused = false;
let lastMoveTime = 0;
let shakeTime = 0;
let deathSlowMo = 0;

highScore = localStorage.getItem("snakeHighScore") || 0;
highScoreEl.textContent = highScore;

document.addEventListener("keydown", handleKey);
pauseBtn.addEventListener("click", togglePause);

initGame();

function initGame() {
  snake = [{ x: 200, y: 200, px: 200, py: 200 }];
  direction = nextDirection = "RIGHT";
  score = 0;
  isGameOver = false;
  isPaused = false;
  shakeTime = deathSlowMo = 0;
  lastMoveTime = 0;

  pauseBtn.textContent = "⏸ Pause";
  scoreEl.textContent = score;
  overlay.style.display = "none";

  setupDifficulty();
  food = spawnFoodSafely();
  requestAnimationFrame(gameLoop);
}

function setupDifficulty() {
  const d = difficultySelect.value;
  if (d === "easy") [speed, minSpeed, speedStep] = [180, 130, 5];
  else if (d === "hard") [speed, minSpeed, speedStep] = [150, 60, 12];
  else [speed, minSpeed, speedStep] = [165, 80, 8];
}

function spawnFoodSafely() {
  let pos;
  do {
    pos = {
      x: Math.floor(Math.random() * 20) * box,
      y: Math.floor(Math.random() * 20) * box
    };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  return pos;
}

function handleKey(e) {
  if (isGameOver && e.key === "Enter") return initGame();
  if (e.key === " ") return togglePause();
  if (e.key === "t" || e.key === "T") document.body.classList.toggle("retro");
  if (isPaused) return;

  if (e.key === "ArrowUp" && direction !== "DOWN") nextDirection = "UP";
  if (e.key === "ArrowDown" && direction !== "UP") nextDirection = "DOWN";
  if (e.key === "ArrowLeft" && direction !== "RIGHT") nextDirection = "LEFT";
  if (e.key === "ArrowRight" && direction !== "LEFT") nextDirection = "RIGHT";
}

function togglePause() {
  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? "▶ Resume" : "⏸ Pause";
}

function updateSnake() {
  direction = nextDirection;
  let head = { ...snake[0] };

  if (direction === "UP") head.y -= box;
  if (direction === "DOWN") head.y += box;
  if (direction === "LEFT") head.x -= box;
  if (direction === "RIGHT") head.x += box;

  if (
    head.x < 0 || head.y < 0 ||
    head.x >= canvas.width || head.y >= canvas.height ||
    snake.some(s => s.x === head.x && s.y === head.y)
  ) return startDeath();

  head.px = head.x;
  head.py = head.y;
  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    eatSound.play();
    score++;
    scoreEl.textContent = score;
    if (speed > minSpeed) speed -= speedStep;
    food = spawnFoodSafely();
  } else snake.pop();
}

function drawSnake(p) {
  snake.forEach((s, i) => {
    const x = lerp(s.px, s.x, p);
    const y = lerp(s.py, s.y, p);
    ctx.fillStyle = i === 0
      ? getComputedStyle(document.body).getPropertyValue("--snake-head")
      : getComputedStyle(document.body).getPropertyValue("--snake-body");
    ctx.shadowBlur = document.body.classList.contains("retro") ? 0 : 10;
    ctx.shadowColor = ctx.fillStyle;
    ctx.fillRect(x, y, box, box);
    ctx.shadowBlur = 0;
    if (i === 0) drawEyes(x, y);
  });
}

function drawEyes(x, y) {
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(x + 6, y + 6, 2, 0, Math.PI * 2);
  ctx.arc(x + 14, y + 6, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawFood() {
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--food");
  ctx.fillRect(food.x, food.y, box, box);
}

function applyShake() {
  if (shakeTime-- > 0)
    ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
}

function gameLoop(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  applyShake();
  drawFood();

  const effSpeed = deathSlowMo > 0 ? speed * 2 : speed;
  const delta = t - lastMoveTime;
  const p = Math.min(delta / effSpeed, 1);
  drawSnake(p);

  if (!isPaused && !isGameOver && delta > effSpeed) {
    snake.forEach(s => { s.px = s.x; s.py = s.y; });
    updateSnake();
    lastMoveTime = t;
  }

  if (deathSlowMo-- > 0) {}
  if (!isGameOver) requestAnimationFrame(gameLoop);
}

function startDeath() {
  isGameOver = true;
  deathSlowMo = 10;
  shakeTime = 15;

  setTimeout(() => {
    gameOverSound.play();
    overlay.style.display = "flex";
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("snakeHighScore", highScore);
      highScoreEl.textContent = highScore;
    }
  }, 200);
}
