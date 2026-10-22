const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// 玩家位置和尺寸
const player = {
  x: canvas.width / 2,
  y: canvas.height - 60,
  width: 30,
  height: 40
};

let activePointerId = null;
const bullets = [];

let lastShotTime = 0;
const shotInterval = 250;
let lastFrameTime = null;

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 头部
  ctx.fillStyle = "#29465b";
  ctx.beginPath();
  ctx.arc(player.x, player.y - 12, 10, 0, Math.PI * 2);
  ctx.fill();

  // 身体
  ctx.fillStyle = "#83c7e2";
  ctx.fillRect(
    player.x - player.width / 2,
    player.y,
    player.width,
    player.height - 20
  );
    // 绘制所有子弹
  ctx.fillStyle = "#efacc8";

  for (const bullet of bullets) {
    ctx.fillRect(
      bullet.x - 3,
      bullet.y,
      6,
      14
    );
  }
}

function movePlayer(event) {
  const rect = canvas.getBoundingClientRect();

  // 把屏幕上的位置换算成画布里的位置
  const pointerX =
    (event.clientX - rect.left) * (canvas.width / rect.width);

  // 限制角色，避免移出画布
  const halfWidth = player.width / 2;

  player.x = Math.max(
    halfWidth,
    Math.min(canvas.width - halfWidth, pointerX)
  );

}

// 按下鼠标或手指，开始控制
canvas.addEventListener("pointerdown", function (event) {
  if (activePointerId !== null || event.button !== 0) {
    return;
  }

  activePointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  movePlayer(event);
});

// 拖动时更新位置
canvas.addEventListener("pointermove", function (event) {
  if (event.pointerId === activePointerId) {
    movePlayer(event);
  }
});

// 松开、触摸被打断时，停止控制
function stopDragging(event) {
  if (event.pointerId === activePointerId) {
    activePointerId = null;
  }
}

canvas.addEventListener("pointerup", stopDragging);
canvas.addEventListener("pointercancel", stopDragging);
canvas.addEventListener("lostpointercapture", stopDragging);

function animate(time) {
  if (lastFrameTime === null) {
    lastFrameTime = time;
  }

  // 距离上一帧过去了多少秒
  const deltaTime = Math.min(
    (time - lastFrameTime) / 1000,
    0.05
  );

  lastFrameTime = time;

  // 到达发射间隔，生成一颗子弹
  if (time - lastShotTime >= shotInterval) {
    bullets.push({
      x: player.x,
      y: player.y - 28
    });

    lastShotTime = time;
  }

  // 更新子弹位置，并移除飞出画布的子弹
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].y -= 400 * deltaTime;

    if (bullets[i].y < -14) {
      bullets.splice(i, 1);
    }
  }

  draw();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);