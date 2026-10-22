const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreDisplay = document.getElementById("score");

let score = 0;
const messageDisplay = document.getElementById("message");

const maxLives = 200;
let lives = maxLives;

let bulletDamage = 10;
const enemyDamage = 10;
let isGameOver = false;
// 玩家位置和尺寸
const player = {
  x: canvas.width / 2,
  y: canvas.height - 60,
  width: 30,
  height: 40
};

let activePointerId = null;
const bullets = [];
const enemies = [];

let lastEnemyTime = 0;
const enemyInterval = 1200;

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
     // 玩家脚下的血条
  const barWidth = 64;
  const barHeight = 16;
  const barX = player.x - barWidth / 2;
  const barY = player.y + 28;

  // 血条底色
  ctx.fillStyle = "#dce3eb";
  ctx.fillRect(barX, barY, barWidth, barHeight);

  // 剩余生命
  ctx.fillStyle = "#e889a8";
  ctx.fillRect(
    barX,
    barY,
    barWidth * (lives / maxLives),
    barHeight
  );

  // 血量数字
  ctx.fillStyle = "#29465b";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    `${lives}/${maxLives}`,
    player.x,
    barY + barHeight / 2
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
    // 绘制敌人
  ctx.fillStyle = "#e889a8";

    for (const enemy of enemies) {
    // 敌人身体
    ctx.fillStyle = "#e889a8";
    ctx.fillRect(
      enemy.x,
      enemy.y,
      enemy.width,
      enemy.height
    );

    // 血条底色
    ctx.fillStyle = "#dce3eb";
    ctx.fillRect(
      enemy.x,
      enemy.y - 18,
      enemy.width,
      14
    );

    // 剩余生命
    ctx.fillStyle = "#83c7e2";
    ctx.fillRect(
      enemy.x,
      enemy.y - 18,
      enemy.width * (enemy.health / enemy.maxHealth),
      14
    );

    // 血量数字
    ctx.fillStyle = "#29465b";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      enemy.health,
      enemy.x + enemy.width / 2,
      enemy.y - 11
    );
  }
}
function movePlayer(event) {
  if (isGameOver) {
    return;
  }

  const rect = canvas.getBoundingClientRect();

  // 把屏幕上的位置换算成画布里的位置
  const pointerX =
    (event.clientX - rect.left) * (canvas.width / rect.width);

  // 限制角色，避免移出画布
  const halfWidth = Math.max(player.width / 2, 32);

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
  if (isGameOver) {
    return;
  }

    if (lastFrameTime === null) {
    lastFrameTime = time;
  }

  // 距离上一帧过去了多少秒
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
  // 定时生成敌人
  if (time - lastEnemyTime >= enemyInterval) {
    const size = 36;
    enemies.push({
  x: Math.random() * (canvas.width - size),
  y: -size,
  width: size,
  height: size,
  health: 10,
  maxHealth: 10
});


    lastEnemyTime = time;
  }

  // 敌人向下移动，离开画面后移除
  for (let i = enemies.length - 1; i >= 0; i--) {
    enemies[i].y += 90 * deltaTime;

    if (enemies[i].y > canvas.height) {
  enemies.splice(i, 1);

  lives = Math.max(0, lives - enemyDamage);

  if (lives <= 0) {
    isGameOver = true;
    messageDisplay.textContent = "Game Over! Refresh to try again.";
    break;
  }
}
  }
    // 检查子弹有没有击中敌人
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];

    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];

      const isHit =
        bullet.x + 3 > enemy.x &&
        bullet.x - 3 < enemy.x + enemy.width &&
        bullet.y + 14 > enemy.y &&
        bullet.y < enemy.y + enemy.height;
      if (isHit) {
        enemy.health = Math.max(
          0,
          enemy.health - bulletDamage
        );

        // 命中后，子弹消失
        bullets.splice(i, 1);

        // 生命归零后，敌人才消失并加分
        if (enemy.health <= 0) {
          enemies.splice(j, 1);

          score += 10;
          scoreDisplay.textContent = score;
        }

        break;
      }
    }
  }
  draw();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);