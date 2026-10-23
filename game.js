"use strict";

// ---------- 页面 ----------

const $ = id => document.getElementById(id);

const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

// ---------- 可调整数值 ----------

// 每 10 秒进入下一波
const STAGE_SECONDS = 10;

// 每秒发射 4 次
const SHOT_INTERVAL = 0.25;

// 补给间隔：12 秒，最多同时出现一组
const GATE_INTERVAL = 12;

const ENEMY_INTERVAL = 1.2;
const BULLET_SPEED = 480;

// ---------- 游戏状态 ----------

let state = "ready";
let elapsed = 0;
let lastFrame = null;

let score = 0;
let damage = 10;

let maxShield = 200;
let shield = 200;

let shotTimer = 0;
let enemyTimer = 0;
let gateTimer = 0;

let enemyCount = 0;
let pairId = 0;
let pointerId = null;

let shake = 0;
let damageFlash = 0;
let lastWardDamage = 0;
let banner = null;


let effectsEnabled = !window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const player = {
  x: W / 2,
  y: H - 60
};

const bullets = [];
const enemies = [];
const gates = [];
const particles = [];
const rings = [];
const labels = [];

// ---------- 数字和界面 ----------

function stage() {
  return Math.floor(elapsed / STAGE_SECONDS) + 1;
}

function format(value) {
  const units = [
    [1e15, "Q"],
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"]
  ];

  for (const [size, suffix] of units) {
    if (value >= size) {
      const number = value / size;

      return (
        number
          .toFixed(number < 10 ? 2 : 1)
          .replace(/\.?0+$/, "") + suffix
      );
    }
  }

  return String(Math.round(value));
}

function growth(base, rate, exponent) {
  return Math.min(
    1e15,
    Math.round(base * rate ** exponent)
  );
}

function updateStats() {
  $("score").textContent = format(score);
  $("damage").textContent = format(damage);

  $("shield").textContent =
    `${format(shield)} / ${format(maxShield)}`;

  $("stage").textContent = stage();
}

function message(value) {
  $("message").textContent = value;
}

// ---------- 音乐与音效 ----------

let audio = null;
let masterVolume = null;
let musicGain = null;
let sfxGain = null;

let musicEnabled = true;
let sfxEnabled = true;
let musicVolume = 0.4;

let nextMusicTime = 0;
let musicStep = 0;

const musicBpm = 150;
const musicStepDuration = 60 / musicBpm / 4;

const musicMelody = [
  440, 0, 440, 523.25,
  440, 0, 659.25, 523.25,
  392, 0, 392, 523.25,
  493.88, 0, 392, 329.63
];

// 暂停时关闭总输出。
// 音乐和音效分别通过各自的音量节点。
function syncVolume() {
  if (!audio || !masterVolume) {
    return;
  }

  const now = audio.currentTime;
  const isPlaying =
    state === "playing" && !document.hidden;

  masterVolume.gain.setValueAtTime(
    isPlaying ? 0.55 : 0,
    now
  );

  musicGain.gain.setValueAtTime(
    musicEnabled ? musicVolume : 0,
    now
  );

  sfxGain.gain.setValueAtTime(
    sfxEnabled ? 1 : 0,
    now
  );
}

function enableAudio() {
  try {
    const AudioClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioClass) {
      message("Audio unavailable. You can still play.");
      return;
    }

    if (!audio) {
      audio = new AudioClass();

      masterVolume = audio.createGain();
      musicGain = audio.createGain();
      sfxGain = audio.createGain();

      masterVolume.gain.value = 0;

      musicGain.connect(masterVolume);
      sfxGain.connect(masterVolume);
      masterVolume.connect(audio.destination);
    }

    syncVolume();

    audio.resume().catch(function () {
      message("Audio unavailable. You can still play.");
    });
  } catch {
    message("Audio unavailable. You can still play.");
  }
}

// 最后一个参数决定这段声音属于音乐还是音效。
// 原有射击和升级代码不用改，默认都是音效。
function tone(
  frequency,
  duration,
  volume,
  endFrequency = frequency,
  delay = 0,
  type = "sine",
  channel = "sfx"
) {
  if (
    state !== "playing" ||
    document.hidden ||
    !audio ||
    audio.state !== "running"
  ) {
    return;
  }

  const isMusic = channel === "music";

  if (
    (isMusic && !musicEnabled) ||
    (!isMusic && !sfxEnabled)
  ) {
    return;
  }

  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  const start = audio.currentTime + delay;

  oscillator.type = type;

  oscillator.frequency.setValueAtTime(
    frequency,
    start
  );

  oscillator.frequency.exponentialRampToValueAtTime(
    endFrequency,
    start + duration
  );

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(
    volume,
    start + 0.005
  );

  gain.gain.exponentialRampToValueAtTime(
    0.001,
    start + duration
  );

  oscillator.connect(gain);
  gain.connect(isMusic ? musicGain : sfxGain);

  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);

  oscillator.onended = function () {
    oscillator.disconnect();
    gain.disconnect();
  };
}

function playBruteSound() {
  tone(160, 0.38, 0.23, 38, 0, "triangle");
  tone(90, 0.26, 0.18, 32);

  const notes = [523.25, 659.25, 783.99, 1046.5];

  notes.forEach(function (frequency, index) {
    tone(
      frequency,
      0.23,
      0.08,
      frequency,
      0.07 + index * 0.065
    );
  });
}

function playUpgradeSound() {
  const notes = [523.25, 659.25, 783.99];

  notes.forEach(function (frequency, index) {
    tone(
      frequency,
      0.2,
      0.07,
      frequency,
      index * 0.09
    );
  });
}

// BGM 中的声音统一进入 music 通道。
function musicTone(
  frequency,
  duration,
  volume,
  endFrequency,
  delay,
  type
) {
  tone(
    frequency,
    duration,
    volume,
    endFrequency,
    delay,
    type,
    "music"
  );
}

function scheduleMusicStep(step, delay) {
  if (step % 4 === 0) {
    musicTone(
      140, 0.16, 0.20, 42, delay, "sine"
    );
  }

  if (step === 4 || step === 12) {
    musicTone(
      230, 0.09, 0.045, 95, delay, "triangle"
    );

    musicTone(
      1800, 0.035, 0.018, 600, delay, "square"
    );
  }

  if (step % 2 === 0) {
    musicTone(
      7200, 0.025, 0.009, 4300, delay, "square"
    );
  }

  if ([0, 3, 6, 8, 11, 14].includes(step)) {
    const bass = step < 8 ? 110 : 98;

    musicTone(
      bass, 0.13, 0.065,
      bass * 0.99, delay, "triangle"
    );
  }

  const frequency = musicMelody[step];

  if (frequency > 0) {
    musicTone(
      frequency, 0.11, 0.023,
      frequency, delay, "square"
    );

    musicTone(
      frequency, 0.09, 0.008,
      frequency,
      delay + musicStepDuration * 1.5,
      "triangle"
    );
  }
}

function updateMusic() {
  if (
    state !== "playing" ||
    !musicEnabled ||
    document.hidden ||
    !audio ||
    audio.state !== "running"
  ) {
    nextMusicTime = 0;
    musicStep = 0;
    return;
  }

  const now = audio.currentTime;

  if (nextMusicTime === 0 || nextMusicTime < now) {
    nextMusicTime = now + 0.03;
  }

  while (nextMusicTime < now + 0.12) {
    scheduleMusicStep(
      musicStep,
      nextMusicTime - now
    );

    nextMusicTime += musicStepDuration;
    musicStep = (musicStep + 1) % 16;
  }
}

// 音乐开关
$("musicButton").onclick = function () {
  musicEnabled = !musicEnabled;

  $("musicButton").textContent =
    musicEnabled ? "Music: On" : "Music: Off";

  $("musicButton").setAttribute(
    "aria-pressed",
    String(!musicEnabled)
  );

  nextMusicTime = 0;
  musicStep = 0;

  syncVolume();

  if (musicEnabled) {
    enableAudio();
  }
};

// 音效开关
$("sfxButton").onclick = function () {
  sfxEnabled = !sfxEnabled;

  $("sfxButton").textContent =
    sfxEnabled ? "SFX: On" : "SFX: Off";

  $("sfxButton").setAttribute(
    "aria-pressed",
    String(!sfxEnabled)
  );

  syncVolume();

  if (sfxEnabled) {
    enableAudio();
  }
};

// 音乐音量，不影响射击和升级音效
$("musicVolume").addEventListener(
  "input",
  function () {
    musicVolume = Number(this.value) / 100;

    $("musicVolumeValue").textContent =
      this.value + "%";

    syncVolume();
  }
);
// ---------- 特效开关 ----------

function updateEffectsButton() {
  $("effectsButton").textContent =
    effectsEnabled ? "Effects: On" : "Effects: Off";

  $("effectsButton").setAttribute(
    "aria-pressed",
    String(!effectsEnabled)
  );
}

$("effectsButton").onclick = function () {
  effectsEnabled = !effectsEnabled;

  updateEffectsButton();

  if (!effectsEnabled) {
    particles.length = 0;
    rings.length = 0;
    shake = 0;
  }
};

// ---------- 开始、暂停和结束 ----------

function releasePointer() {
  const oldPointer = pointerId;
  pointerId = null;

  if (
    oldPointer !== null &&
    canvas.hasPointerCapture(oldPointer)
  ) {
    canvas.releasePointerCapture(oldPointer);
  }
}

function startGame() {
  if (state === "playing" || state === "paused") {
    return;
  }

  releasePointer();

  state = "playing";
  elapsed = 0;
  lastFrame = null;

  score = 0;
  damage = 10;
  maxShield = 200;
  shield = 200;

  shotTimer = 0;
  enemyTimer = 0;
  gateTimer = 0;

  enemyCount = 0;
  pairId = 0;
  shake = 0;
  damageFlash = 0;
  lastWardDamage = 0;  
  banner = null;

  [
    bullets,
    enemies,
    gates,
    particles,
    rings,
    labels
  ].forEach(function (list) {
    list.length = 0;
  });

  player.x = W / 2;

  $("startButton").disabled = true;
  $("startButton").textContent = "Watch in Progress";

  $("pauseButton").disabled = false;
  $("pauseButton").textContent = "Pause";

  message(
    "Choose a crate: POWER for damage, WARD for protection."
  );

  updateStats();
  enableAudio();
}

function pauseGame() {
  if (state !== "playing") {
    return;
  }

  state = "paused";
  releasePointer();

  $("pauseButton").textContent = "Resume";

  message("Paused. Press Resume when ready.");
  syncVolume();
}

function endGame() {
  state = "over";
  releasePointer();

  $("startButton").disabled = false;
  $("startButton").textContent = "Try Again ↗";

  $("pauseButton").disabled = true;
  $("pauseButton").textContent = "Pause";

  message(
    `Safehouse ward depleted. Score: ${format(score)} · Wave ${stage()}.`
  );

  syncVolume();
}

$("startButton").onclick = startGame;

$("pauseButton").onclick = function () {
  if (state === "playing") {
    pauseGame();
  } else if (state === "paused" && !document.hidden) {
    state = "playing";
    lastFrame = null;

    $("pauseButton").textContent = "Pause";

    message("Back on watch. Hold the line!");
    enableAudio();
  }
};

document.addEventListener(
  "visibilitychange",
  function () {
    if (document.hidden) {
      pauseGame();
    }
  }
);

window.addEventListener("blur", pauseGame);

// ---------- 鼠标和触摸 ----------

function movePlayer(event) {
  const rect = canvas.getBoundingClientRect();

  const pointerX =
    (event.clientX - rect.left) * W / rect.width;

  player.x = Math.max(
    34,
    Math.min(W - 34, pointerX)
  );
}

canvas.addEventListener(
  "pointerdown",
  function (event) {
    if (
      state !== "playing" ||
      pointerId !== null ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();

    pointerId = event.pointerId;
    canvas.setPointerCapture(pointerId);

    movePlayer(event);
  }
);

canvas.addEventListener(
  "pointermove",
  function (event) {
    if (
      state === "playing" &&
      pointerId === event.pointerId
    ) {
      movePlayer(event);
    }
  }
);

for (const eventName of [
  "pointerup",
  "pointercancel",
  "lostpointercapture"
]) {
  canvas.addEventListener(
    eventName,
    function (event) {
      if (pointerId === event.pointerId) {
        releasePointer();
      }
    }
  );
}

// ---------- 生成僵尸和补给 ----------

function spawnEnemy() {
  const currentStage = stage();

  enemyCount++;

    // 越到后期，大型僵尸出现得越频繁
  let bruteInterval;

  if (currentStage < 4) {
    bruteInterval = 5;
  } else if (currentStage < 7) {
    bruteInterval = 4;
  } else if (currentStage < 10) {
    bruteInterval = 3;
  } else if (currentStage < 15) {
    bruteInterval = 2;
  } else {
    bruteInterval = 1;
  }

  const elite = enemyCount % bruteInterval === 0;

  const health = growth(
    elite ? 40 : 10,
    1.5,
    currentStage - 1
  );

  const size = Math.min(
    (elite ? 68 : 36) + (currentStage - 1) * 2,
    elite ? 100 : 64
  );

  const attack = growth(
    elite ? 30 : 10,
    1.25,
    currentStage - 1
  );

  enemies.push({
    x: Math.random() * (W - size),
    y: -size - 22,
    width: size,
    height: size,
    health: health,
    maxHealth: health,
    attack: attack,
    elite: elite,
    speed: elite ? 55 : 78,
    flash: 0
  });
}

function spawnGates() {
  const currentStage = stage();
  const id = ++pairId;

  const powerBonus = growth(
    12,
    1.5,
    currentStage - 1
  );

  const shieldBonus = growth(
    50,
    1.5,
    currentStage - 1
  );

  // 随波次增长，但始终限制在当前伤害的 6～10 倍。
  // 因此集中射击约 1.5～2.5 秒即可打碎。
  const expectedHealth = growth(
    100,
    1.35,
    currentStage - 1
  );

  const health = Math.round(
    Math.max(
      damage * 6,
      Math.min(expectedHealth, damage * 10)
    )
  );

    // 每次生成时，随机决定攻击门在哪一边
  const powerOnLeft = Math.random() < 0.5;

  const leftX = 12;
  const rightX = W / 2 + 8;

  const options = [
    [
      "power",
      powerOnLeft ? leftX : rightX,
      powerBonus
    ],
    [
      "shield",
      powerOnLeft ? rightX : leftX,
      shieldBonus
    ]
  ];

  for (const [type, x, bonus] of options) {
    gates.push({
      id: id,
      type: type,
      x: x,
      y: -64,
      width: W / 2 - 20,
      height: 58,
      health: health,
      maxHealth: health,
      bonus: bonus,
      flash: 0
    });
  }

  message(
    "Cursed crates incoming. Break one to claim its reward."
  );
}

// ---------- 粒子和文字 ----------

function burst(x, y, elite, color) {
  if (!effectsEnabled) {
    return;
  }

  const count = elite ? 42 : 10;
  const lifetime = elite ? 0.8 : 0.4;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;

    const speed =
      40 + Math.random() * (elite ? 220 : 100);

    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: lifetime,
      maxLife: lifetime,
      size: 2 + Math.random() * 5,
      color: i % 2 ? color : "#ffffff"
    });
  }

  if (elite) {
    rings.push({
      x: x,
      y: y,
      radius: 12,
      life: 0.55
    });

    shake = 0.22;
  }
}

function floatText(
  value,
  x,
  y,
  color = "#edf5dc"
) {
  labels.push({
    text: value,
    x: x,
    y: y,
    life: 0.8,
    color: color
  });

  if (labels.length > 45) {
    labels.shift();
  }
}

// ---------- 命中判断 ----------

function bulletHits(bullet, target) {
  return (
    bullet.x + 3 > target.x &&
    bullet.x - 3 < target.x + target.width &&
    bullet.y + 14 > target.y &&
    bullet.y < target.y + target.height
  );
}

function checkCollisions() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];

    let target = null;
    let targetType = "";

    // 同时接触多个物体时，命中最靠下的那个。
    const groups = [
      [enemies, "enemy"],
      [gates, "gate"]
    ];

    for (const [list, type] of groups) {
      for (const item of list) {
        if (
          bulletHits(bullet, item) &&
          (
            target === null ||
            item.y + item.height >
              target.y + target.height
          )
        ) {
          target = item;
          targetType = type;
        }
      }
    }

    if (target === null) {
      continue;
    }

    bullets.splice(i, 1);

    target.health = Math.max(
      0,
      target.health - bullet.damage
    );

    target.flash = 0.07;

    floatText(
      "−" + format(bullet.damage),
      bullet.x,
      target.y
    );

    if (target.health > 0) {
      continue;
    }

    const x = target.x + target.width / 2;
    const y = target.y + target.height / 2;

    if (targetType === "enemy") {
      enemies.splice(enemies.indexOf(target), 1);

      const reward = Math.round(
        target.maxHealth * (target.elite ? 5 : 1)
      );

      score += reward;

      burst(x, y, target.elite, "#a8d86c");

      if (target.elite) {
        playBruteSound();

        banner = {
          text: "BRUTE DOWN!",
          sub: "+" + format(reward) + " SCORE",
          life: 1.2
        };

        message(
          `Brute defeated! +${format(reward)} score.`
        );
      } else {
        tone(210, 0.07, 0.025, 85);
      }
    } else {
      // 领取一个奖励后，移除这一组的两道门。
      for (let j = gates.length - 1; j >= 0; j--) {
        if (gates[j].id === target.id) {
          gates.splice(j, 1);
        }
      }

      if (target.type === "power") {
        damage = Math.min(
          1e15,
          damage + target.bonus
        );

        message(
          `POWER +${format(target.bonus)} · Damage: ${format(damage)}`
        );

        floatText(
          "POWER +" + format(target.bonus),
          x,
          y,
          "#c4f18b"
        );
      } else {
        const gain = Math.min(
          target.bonus,
          1e15 - maxShield
        );

        maxShield += gain;
        shield = Math.min(
          maxShield,
          shield + gain
        );

        message(
          `WARD +${format(gain)} · Capacity increased and ward restored.`
        );

        floatText(
          "WARD +" + format(gain),
          x,
          y,
          "#ff9caa"
        );
      }

      burst(
        x,
        y,
        false,
        target.type === "power"
          ? "#a8d86c"
          : "#f18b98"
      );

      playUpgradeSound();
    }

    updateStats();
  }
}

// ---------- 更新游戏 ----------

function update(deltaTime) {
  const previousStage = stage();

  elapsed += deltaTime;

  if (stage() !== previousStage) {
    updateStats();

    message(
      `Wave ${stage()} · Stronger zombies and richer supplies.`
    );
  }

  shotTimer += deltaTime;
  enemyTimer += deltaTime;
  gateTimer += deltaTime;

  if (shotTimer >= SHOT_INTERVAL) {
    shotTimer -= SHOT_INTERVAL;

    bullets.push({
      x: player.x,
      y: player.y - 38,
      damage: damage
    });

    tone(680, 0.06, 0.018, 260);
  }

  if (enemyTimer >= ENEMY_INTERVAL) {
    enemyTimer -= ENEMY_INTERVAL;
    spawnEnemy();
  }

  if (
    gateTimer >= GATE_INTERVAL &&
    gates.length === 0
  ) {
    gateTimer = 0;
    spawnGates();
  }

  // 子弹
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].y -= BULLET_SPEED * deltaTime;

    if (bullets[i].y < -14) {
      bullets.splice(i, 1);
    }
  }

  // 僵尸
  for (const enemy of enemies) {
    enemy.y += enemy.speed * deltaTime;
    enemy.flash = Math.max(
      0,
      enemy.flash - deltaTime
    );
  }

  // 补给门移动较慢，给玩家留出选择时间。
  for (const gate of gates) {
    gate.y += 44 * deltaTime;
    gate.flash = Math.max(
      0,
      gate.flash - deltaTime
    );
  }

  checkCollisions();

  // 僵尸突破底线
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].y > H) {
      const enemy = enemies[i];

      enemies.splice(i, 1);
      shield = Math.max(
        0,
        shield - enemy.attack
      );
      damageFlash = 0.6;
      lastWardDamage = enemy.attack;

      floatText(
        "−" + format(enemy.attack) + " WARD",
        player.x,
        player.y - 25,
        "#ff9caa"
      );

      tone(120, 0.15, 0.06, 45);

      if (effectsEnabled) {
        shake = 0.12;
      }

      updateStats();

      if (shield <= 0) {
        endGame();
        return;
      }
    }
  }

  // 没打碎的门离开，不造成伤害。
  for (let i = gates.length - 1; i >= 0; i--) {
    if (gates[i].y > H) {
      gates.splice(i, 1);
    }
  }

  // 粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];

    particle.life -= deltaTime;
    particle.x += particle.vx * deltaTime;
    particle.y += particle.vy * deltaTime;
    particle.vy += 110 * deltaTime;

    if (particle.life <= 0) {
      particles.splice(i, 1);
    }
  }

  // 光圈
  for (let i = rings.length - 1; i >= 0; i--) {
    rings[i].life -= deltaTime;
    rings[i].radius += 260 * deltaTime;

    if (rings[i].life <= 0) {
      rings.splice(i, 1);
    }
  }

  // 飘字
  for (let i = labels.length - 1; i >= 0; i--) {
    labels[i].life -= deltaTime;
    labels[i].y -= 32 * deltaTime;

    if (labels[i].life <= 0) {
      labels.splice(i, 1);
    }
  }

  shake = Math.max(0, shake - deltaTime);
  damageFlash = Math.max(
  0,
  damageFlash - deltaTime
);

  if (banner) {
    banner.life -= deltaTime;

    if (banner.life <= 0) {
      banner = null;
    }
  }
}

// ---------- 绘图辅助 ----------

function drawText(
  value,
  x,
  y,
  size = 12,
  color = "#edf5dc"
) {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}

function drawBar(
  x,
  y,
  width,
  height,
  health,
  maxHealth,
  color,
  label
) {
  ctx.fillStyle = "#333d2c";
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = color;
  ctx.fillRect(
    x,
    y,
    width * Math.max(0, health / maxHealth),
    height
  );

  drawText(
    label,
    x + width / 2,
    y + height / 2,
    height < 15 ? 10 : 11,
    "#ffffff"
  );
}

// ---------- 僵尸形象 ----------

function drawZombie(enemy) {
  ctx.save();

  ctx.translate(enemy.x, enemy.y);
  ctx.scale(
    enemy.width / 50,
    enemy.height / 50
  );

  const walk =
    Math.sin(elapsed * 9 + enemy.x) * 4;

  // 地面影子
  ctx.fillStyle = "#080d09";
  ctx.beginPath();
  ctx.ellipse(25, 47, 21, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 交替迈步
  ctx.fillStyle = "#263b2b";
  ctx.fillRect(14, 35 + walk * 0.25, 9, 13);
  ctx.fillRect(28, 35 - walk * 0.25, 9, 13);

  // 衣服
  ctx.fillStyle =
    enemy.elite ? "#6b2734" : "#5c3b36";

  ctx.fillRect(10, 23, 30, 16);

  // 摆动的手臂
  ctx.fillStyle =
    enemy.elite ? "#9eb75b" : "#84ad6b";

  ctx.fillRect(4, 22 + walk * 0.4, 8, 17);
  ctx.fillRect(38, 22 - walk * 0.4, 8, 17);

  // 头发和头
  ctx.fillStyle = "#324a2e";
  ctx.fillRect(9, 1, 33, 11);

  ctx.fillStyle =
    enemy.elite ? "#c0c46d" : "#a2c77a";

  ctx.fillRect(11, 6, 29, 22);

  // 眼睛
  ctx.fillStyle = "#1b2116";
  ctx.fillRect(15, 12, 7, 6);
  ctx.fillRect(29, 12, 7, 6);

  ctx.fillStyle = "#ee6d6a";
  ctx.fillRect(18, 13, 3, 3);
  ctx.fillRect(30, 13, 3, 3);

  // 嘴和牙齿
  ctx.fillStyle = "#3b3025";
  ctx.fillRect(21, 22, 12, 3);

  ctx.fillStyle = "#f5e6b9";
  ctx.fillRect(24, 22, 3, 3);

  // 大型僵尸的红色头带
  if (enemy.elite) {
    ctx.fillStyle = "#a43b48";
    ctx.fillRect(10, 5, 31, 4);

    ctx.fillStyle = "#d07b68";
    ctx.fillRect(32, 5, 7, 3);
  }

  ctx.restore();
}

// ---------- 主角形象 ----------

function drawWarden() {
  ctx.save();
  ctx.translate(player.x, player.y);

  // 影子
  ctx.fillStyle = "#060b07";
  ctx.beginPath();
  ctx.ellipse(0, 22, 25, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 靴子
  ctx.fillStyle = "#29372b";
  ctx.fillRect(-13, 9, 10, 13);
  ctx.fillRect(4, 9, 10, 13);

  // 红披风
  ctx.fillStyle = "#721f32";
  ctx.beginPath();
  ctx.moveTo(-14, -8);
  ctx.lineTo(14, -8);
  ctx.lineTo(23, 16);
  ctx.lineTo(-23, 16);
  ctx.closePath();
  ctx.fill();

  // 面部
  ctx.fillStyle = "#afd477";
  ctx.fillRect(-13, -16, 26, 22);

  // 眼罩
  ctx.fillStyle = "#111d13";
  ctx.fillRect(-10, -9, 20, 8);

  ctx.fillStyle = "#d8f5a1";
  ctx.fillRect(-7, -8, 4, 3);
  ctx.fillRect(4, -8, 4, 3);

  // 尖帽
  ctx.fillStyle = "#263823";
  ctx.beginPath();
  ctx.moveTo(-19, -18);
  ctx.lineTo(-4, -47);
  ctx.lineTo(11, -20);
  ctx.closePath();
  ctx.fill();

  // 帽带
  ctx.fillStyle = "#b74650";
  ctx.fillRect(-14, -23, 26, 6);

  // 帽檐
  ctx.fillStyle = "#142216";
  ctx.fillRect(-25, -19, 49, 6);

  // 南瓜发射器
  ctx.fillStyle = "#9ccc65";
  ctx.fillRect(-4, -37, 8, 15);

  ctx.fillStyle = "#d77137";
  ctx.beginPath();
  ctx.ellipse(0, -23, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#8b3e22";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -31);
  ctx.lineTo(0, -15);
  ctx.stroke();

  ctx.restore();
}

// ---------- 完整画面 ----------

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();

  if (shake > 0 && effectsEnabled) {
    ctx.translate(
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 8
    );
  }

  // 安全屋防线
  ctx.strokeStyle = "#bc4f5f";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);

  ctx.beginPath();
  ctx.moveTo(0, H - 8);
  ctx.lineTo(W, H - 8);
  ctx.stroke();

  ctx.setLineDash([]);

  // 补给门
  for (const gate of gates) {
    const isWard = gate.type === "shield";

    ctx.fillStyle = gate.flash > 0
      ? "#ffffff"
      : isWard ? "#3b1e26" : "#25381d";

    ctx.fillRect(
      gate.x,
      gate.y,
      gate.width,
      gate.height
    );

    ctx.strokeStyle =
      isWard ? "#d66c76" : "#97c85e";

    ctx.lineWidth = 2;

    ctx.strokeRect(
      gate.x,
      gate.y,
      gate.width,
      gate.height
    );

    drawText(
      `${isWard ? "WARD" : "POWER"} +${format(gate.bonus)}`,
      gate.x + gate.width / 2,
      gate.y + 17,
      14
    );

    drawBar(
      gate.x + 10,
      gate.y + 33,
      gate.width - 20,
      15,
      gate.health,
      gate.maxHealth,
      isWard ? "#a64255" : "#537b31",
      format(gate.health)
    );
  }

  // 僵尸
  for (const enemy of enemies) {
    if (enemy.elite) {
      ctx.strokeStyle = "#d75664";
      ctx.lineWidth = 3;

      ctx.strokeRect(
        enemy.x - 3,
        enemy.y - 3,
        enemy.width + 6,
        enemy.height + 6
      );

      drawText(
        "BRUTE · ATK " + format(enemy.attack),
        enemy.x + enemy.width / 2,
        enemy.y - 32,
        10,
        "#ff969a"
      );
    }

    drawZombie(enemy);

    if (enemy.flash > 0 && effectsEnabled) {
      ctx.fillStyle = "#ffffff70";

      ctx.fillRect(
        enemy.x,
        enemy.y,
        enemy.width,
        enemy.height
      );
    }

    drawBar(
      enemy.x,
      enemy.y - 20,
      enemy.width,
      15,
      enemy.health,
      enemy.maxHealth,
      enemy.elite ? "#ad4053" : "#537b31",
      format(enemy.health)
    );
  }

  // 子弹
  ctx.fillStyle = "#d5f990";

  for (const bullet of bullets) {
    ctx.fillRect(
      bullet.x - 3,
      bullet.y,
      6,
      14
    );
  }

  drawWarden();

  // 玩家护盾
  drawBar(
    player.x - 34,
    player.y + 28,
    68,
    16,
    shield,
    maxShield,
    "#a64255",
    format(shield) + "/" + format(maxShield)
  );

  // 粒子
  for (const particle of particles) {
    ctx.globalAlpha =
      particle.life / particle.maxLife;

    ctx.fillStyle = particle.color;

    ctx.fillRect(
      particle.x,
      particle.y,
      particle.size,
      particle.size
    );
  }

  ctx.globalAlpha = 1;

  // 击杀光圈
  for (const ring of rings) {
    ctx.globalAlpha = ring.life / 0.55;
    ctx.strokeStyle = "#afd872";
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.arc(
      ring.x,
      ring.y,
      ring.radius,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }

  ctx.globalAlpha = 1;

  // 伤害与奖励飘字
  for (const label of labels) {
    ctx.globalAlpha = Math.min(
      1,
      label.life * 3
    );

    drawText(
      label.text,
      label.x,
      label.y,
      12,
      label.color
    );
  }

  ctx.globalAlpha = 1;
  ctx.restore();
    // 低护盾提示：使用比例判断，适配升级后的护盾上限
  const isLowWard = shield / maxShield <= 0.25;

  if (isLowWard && state === "playing") {
    ctx.save();

    ctx.fillStyle = "#381b24";
    ctx.fillRect(W / 2 - 76, 12, 152, 30);

    ctx.strokeStyle = "#e56b7c";
    ctx.lineWidth = 1;
    ctx.strokeRect(W / 2 - 76, 12, 152, 30);

    drawText(
      "! LOW WARD",
      W / 2,
      27,
      14,
      "#ffb0b9"
    );

    ctx.restore();
  }
    // 护盾受损：关闭特效时仍保留文字提示
  if (damageFlash > 0 && state === "playing") {
    if (effectsEnabled) {
      ctx.save();

      ctx.globalAlpha = damageFlash / 0.6;
      ctx.strokeStyle = "#ef596b";
      ctx.lineWidth = 6;

      // 只画左右下方和底边，不覆盖整个画面
      ctx.beginPath();
      ctx.moveTo(3, H - 100);
      ctx.lineTo(3, H - 3);
      ctx.lineTo(W - 3, H - 3);
      ctx.lineTo(W - 3, H - 100);
      ctx.stroke();

      ctx.restore();
    }

    drawText(
      "WARD −" + format(lastWardDamage),
      W / 2,
      H - 112,
      18,
      "#ff9caa"
    );
  }

  // 大型僵尸击杀提示
  if (banner) {
    ctx.fillStyle = "#142016ed";
    ctx.fillRect(75, 115, W - 150, 68);

    drawText(
      banner.text,
      W / 2,
      140,
      26,
      "#ff9caa"
    );

    drawText(
      banner.sub,
      W / 2,
      167,
      13
    );
  }

  // 开始、暂停、结束覆盖层
  if (state !== "playing") {
    ctx.fillStyle = "#0b140de8";
    ctx.fillRect(0, 0, W, 480);

    let title = "MIDNIGHT WATCH";
    let subtitle = "Press Guard the Safehouse to begin.";

    if (state === "paused") {
      title = "PAUSED";
      subtitle = "Press Resume to continue.";
    } else if (state === "over") {
      title = "WARD BROKEN";
      subtitle =
        `Wave ${stage()} · Score ${format(score)}`;
    }

    drawText(title, W / 2, 230, 29);
    drawText(subtitle, W / 2, 270, 14);
  }
}

// ---------- 唯一动画循环 ----------

// 开始和重玩只重置游戏状态，避免创建重复动画循环。
function animate(time) {
  if (lastFrame === null) {
    lastFrame = time;
  }

  const deltaTime = Math.min(
    (time - lastFrame) / 1000,
    0.05
  );

  lastFrame = time;

  if (state === "playing") {
    update(deltaTime);
  }

    updateMusic();

  draw();
  requestAnimationFrame(animate);
}

updateEffectsButton();
updateStats();
requestAnimationFrame(animate);