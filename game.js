const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const enemyImage = new Image();
let enemyImageReady = false;

enemyImage.onload = function () {
  enemyImageReady = true;
};

enemyImage.onerror = function () {
  console.warn("Enemy image could not be loaded.");
};

enemyImage.src = "assets/enemy-walk.png";
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
const gates = [];

let lastGateTime = 0;
const gateInterval = 6000;

let lastEnemyTime = 0;
const enemyInterval = 1200;

let lastShotTime = 0;
const shotInterval = 250;
let lastFrameTime = null;
let elapsedTime = 0;

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
        if (enemyImageReady) {
      const frameWidth = enemyImage.naturalWidth / 3;
      const frameHeight = enemyImage.naturalHeight;
      const frame = Math.floor(elapsedTime / 0.15) % 3;

      ctx.drawImage(
        enemyImage,
        frame * frameWidth,
        0,
        frameWidth,
        frameHeight,
        enemy.x,
        enemy.y,
        enemy.width,
        enemy.height
      );
    } else {
      ctx.fillStyle = "#e889a8";
      ctx.fillRect(
        enemy.x,
        enemy.y,
        enemy.width,
        enemy.height
      );
    }

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
      // 绘制可以攻击的数字门
  for (const gate of gates) {
    // 门的背景
    ctx.fillStyle = "#d9eef8";
    ctx.fillRect(
      gate.x,
      gate.y,
      gate.width,
      gate.height
    );

    // 门的边框
    ctx.strokeStyle = "#589fc2";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      gate.x,
      gate.y,
      gate.width,
      gate.height
    );

    // 升级奖励
    ctx.fillStyle = "#29465b";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `DMG +${gate.bonus}`,
      gate.x + gate.width / 2,
      gate.y + 16
    );

    // 血条底色
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(
      gate.x + 10,
      gate.y + 30,
      gate.width - 20,
      14
    );

    // 剩余血量
    ctx.fillStyle = "#efacc8";
    ctx.fillRect(
      gate.x + 10,
      gate.y + 30,
      (gate.width - 20) * (gate.health / gate.maxHealth),
      14
    );

    // 血量数字
    ctx.fillStyle = "#29465b";
    ctx.font = "bold 11px Arial";
    ctx.fillText(
      gate.health,
      gate.x + gate.width / 2,
      gate.y + 37
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

  // 先计算这一帧经过了多少秒
  const deltaTime = Math.min(
    (time - lastFrameTime) / 1000,
    0.05
  );

  lastFrameTime = time;

  // 再累计游戏时间
  elapsedTime += deltaTime;

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
    const difficulty = Math.floor(elapsedTime / 10);

    const size = Math.min(36 + difficulty * 4, 80);
    const health = 10 + difficulty * 10;

    enemies.push({
      x: Math.random() * (canvas.width - size),
      y: -size,
      width: size,
      height: size,
      health: health,
      maxHealth: health
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
      // 逐颗检查子弹
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    let hasHit = false;

    // 先检查敌人
    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];

      const isHit =
        bullet.x + 3 > enemy.x &&
        bullet.x - 3 < enemy.x + enemy.width &&
        bullet.y + 14 > enemy.y &&
        bullet.y < enemy.y + enemy.height;

      if (isHit) {
        hasHit = true;

        enemy.health = Math.max(
          0,
          enemy.health - bulletDamage
        );

        bullets.splice(i, 1);

        if (enemy.health <= 0) {
          enemies.splice(j, 1);

          score += 10;
          scoreDisplay.textContent = score;
        }

        break;
      }
    }

    // 子弹已经命中敌人，不再检查门
    if (hasHit) {
      continue;
    }

    // 再检查数字门
    for (let j = gates.length - 1; j >= 0; j--) {
      const gate = gates[j];

      const hitGate =
        bullet.x + 3 > gate.x &&
        bullet.x - 3 < gate.x + gate.width &&
        bullet.y + 14 > gate.y &&
        bullet.y < gate.y + gate.height;

      if (hitGate) {
        gate.health = Math.max(
          0,
          gate.health - bulletDamage
        );

        bullets.splice(i, 1);

        if (gate.health <= 0) {
          bulletDamage += gate.bonus;

          messageDisplay.textContent =
            `Upgrade! Bullet damage: ${bulletDamage}`;

          gates.splice(j, 1);
        }

        break;
      }
    }
  }

    // 定时生成数字门
  if (time - lastGateTime >= gateInterval) {
    const gateWidth = 150;

    gates.push({
  x: Math.random() * (canvas.width - gateWidth),
  y: -50,
  width: gateWidth,
  height: 50,
  bonus: 5,
  health: 200,
  maxHealth: 200
});

    lastGateTime = time;
  }

  // 数字门向下移动
  for (let i = gates.length - 1; i >= 0; i--) {
    gates[i].y += 70 * deltaTime;

    if (gates[i].y > canvas.height) {
      gates.splice(i, 1);
    }
  }
  draw();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);