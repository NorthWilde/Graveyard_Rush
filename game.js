"use strict";
const $ = id => document.getElementById(id);
const canvas = $("gameCanvas"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;
const image = new Image();
let imageReady = false;
image.onload = () => { imageReady = true; };
image.onerror = () => console.warn("Enemy image unavailable; using fallback artwork.");
image.src = "assets/enemy-walk.png";

// These are the main balancing controls. Timers use seconds.
const STAGE_SECONDS = 10, SHOT_INTERVAL = .25, GATE_INTERVAL = 6;
const ENEMY_INTERVAL = 1.2, BULLET_SPEED = 480;
let state = "ready", elapsed = 0, lastFrame = null;
let score = 0, damage = 10, maxShield = 200, shield = 200;
let shotTimer = 0, enemyTimer = 0, gateTimer = 0, enemyCount = 0, pairId = 0;
let pointerId = null, shake = 0, banner = null, soundEnabled = true;
let effectsEnabled = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const player = {x: W/2, y: H-60};
const bullets = [], enemies = [], gates = [], particles = [], rings = [], labels = [];

function stage() { return Math.floor(elapsed / STAGE_SECONDS) + 1; }
function format(value) {
  const units = [[1e15,"Q"],[1e12,"T"],[1e9,"B"],[1e6,"M"],[1e3,"K"]];
  for (const [size, suffix] of units) {
    if (value >= size) return (value/size).toFixed(value/size < 10 ? 2 : 1).replace(/\.?0+$/, "") + suffix;
  }
  return String(Math.round(value));
}
// Cap numbers below the safe integer range for very long sessions.
function growth(base, rate, exponent) { return Math.min(1e15, Math.round(base * rate ** exponent)); }
function stats() {
  $("score").textContent = format(score);
  $("damage").textContent = format(damage);
  $("shield").textContent = `${format(shield)} / ${format(maxShield)}`;
  $("stage").textContent = stage();
}
function message(text) { $("message").textContent = text; }

// One master gain controls every sound, including notes already scheduled.
let audio = null, master = null;
function syncVolume() {
  if (master) master.gain.setValueAtTime(soundEnabled && state === "playing" && !document.hidden ? .55 : 0, audio.currentTime);
}
function enableAudio() {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!audio) { audio = new Audio(); master = audio.createGain(); master.gain.value = 0; master.connect(audio.destination); }
    syncVolume();
    audio.resume().catch(() => message("Sound unavailable. You can still play."));
  } catch { message("Sound unavailable. You can still play."); }
}
function tone(frequency, duration, volume, end = frequency, delay = 0, type = "sine") {
  if (!soundEnabled || state !== "playing" || !audio || audio.state !== "running") return;
  const oscillator = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime + delay;
  oscillator.type = type; oscillator.frequency.setValueAtTime(frequency,t);
  oscillator.frequency.exponentialRampToValueAtTime(end,t+duration);
  gain.gain.setValueAtTime(0,t); gain.gain.linearRampToValueAtTime(volume,t+.005);
  gain.gain.exponentialRampToValueAtTime(.001,t+duration);
  oscillator.connect(gain); gain.connect(master); oscillator.start(t); oscillator.stop(t+duration+.02);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
function eliteSound() {
  tone(160,.38,.23,38,0,"triangle");
  tone(90,.26,.18,32);
  [523.25,659.25,783.99,1046.5].forEach((f,i) => tone(f,.23,.08,f,.07+i*.065));
}
function upgradeSound() { [523.25,659.25,783.99].forEach((f,i) => tone(f,.2,.07,f,i*.09)); }
$("soundButton").onclick = () => {
  soundEnabled = !soundEnabled;
  $("soundButton").textContent = soundEnabled ? "Sound: On" : "Sound: Off";
  $("soundButton").setAttribute("aria-pressed",String(!soundEnabled));
  syncVolume(); if (soundEnabled) enableAudio();
};
function updateEffectsButton() {
  $("effectsButton").textContent = effectsEnabled ? "Effects: On" : "Effects: Off";
  $("effectsButton").setAttribute("aria-pressed",String(!effectsEnabled));
}
$("effectsButton").onclick = () => {
  effectsEnabled = !effectsEnabled; updateEffectsButton();
  if (!effectsEnabled) { particles.length=0; rings.length=0; shake=0; }
};

function releasePointer() {
  const old = pointerId; pointerId = null;
  if (old !== null && canvas.hasPointerCapture(old)) canvas.releasePointerCapture(old);
}
function startGame() {
  if (state === "playing" || state === "paused") return;
  releasePointer(); state="playing"; elapsed=0; lastFrame=null;
  score=0; damage=10; shield=200; maxShield=200;
  shotTimer=0; enemyTimer=0; gateTimer=0; enemyCount=0; pairId=0; shake=0; banner=null;
  [bullets,enemies,gates,particles,rings,labels].forEach(a => a.length=0);
  player.x=W/2;
  $("startButton").disabled=true; $("startButton").textContent="Defense in Progress";
  $("pauseButton").disabled=false; $("pauseButton").textContent="Pause";
  message("Choose a gate: POWER for damage, SHIELD for protection."); stats(); enableAudio();
}
function pauseGame() {
  if (state !== "playing") return;
  state="paused"; releasePointer(); $("pauseButton").textContent="Resume";
  message("Paused. Press Resume when ready."); syncVolume();
}
function endGame() {
  state="over"; releasePointer(); $("startButton").disabled=false; $("startButton").textContent="Try Again ↗";
  $("pauseButton").disabled=true; $("pauseButton").textContent="Pause";
  message(`Shelter shield depleted. Score: ${format(score)} · Stage ${stage()}.`); syncVolume();
}
$("startButton").onclick=startGame;
$("pauseButton").onclick=() => {
  if (state === "playing") pauseGame();
  else if (state === "paused" && !document.hidden) {
    state="playing"; lastFrame=null; $("pauseButton").textContent="Pause";
    message("Back on duty. Hold the line!"); enableAudio();
  }
};
document.addEventListener("visibilitychange",() => { if(document.hidden) pauseGame(); });
window.addEventListener("blur",pauseGame);
function move(event) {
  const rect=canvas.getBoundingClientRect();
  player.x=Math.max(34,Math.min(W-34,(event.clientX-rect.left)*W/rect.width));
}
canvas.addEventListener("pointerdown",event => {
  if(state!=="playing" || pointerId!==null || event.button!==0) return;
  event.preventDefault(); pointerId=event.pointerId; canvas.setPointerCapture(pointerId); move(event);
});
canvas.addEventListener("pointermove",event => { if(state==="playing" && pointerId===event.pointerId) move(event); });
for(const name of ["pointerup","pointercancel","lostpointercapture"]) canvas.addEventListener(name,event => { if(pointerId===event.pointerId) releasePointer(); });

function spawnEnemy() {
  const s=stage(); enemyCount++;
  const elite=enemyCount%5===0;
  // Enemy HP doubles every two stages: hundreds -> thousands -> tens of thousands.
  const hp=growth(elite?40:10,1.5,s-1);
  const size=Math.min((elite?68:36)+(s-1)*2,elite?100:64);
  const attack=growth(elite?30:10,1.25,s-1);
  enemies.push({x:Math.random()*(W-size),y:-size-22,width:size,height:size,health:hp,maxHealth:hp,attack,elite,speed:elite?55:78,flash:0});
}
function spawnGates() {
  const s=stage(), id=++pairId;
  const power=growth(5,1.5,s-1), capacity=growth(50,1.5,s-1);
  // Scale with both progression and current weapon: about 3-6 seconds of focused fire.
  // This prevents a missed upgrade from making every later gate impossible.
  const expected=growth(200,1.5,s-1);
  const hp=Math.round(Math.max(damage*12,Math.min(expected,damage*24)));
  for(const [type,x,bonus] of [["power",12,power],["shield",W/2+8,capacity]]) {
    gates.push({id,type,x,y:-64,width:W/2-20,height:58,health:hp,maxHealth:hp,bonus,flash:0});
  }
  message("Supply pair incoming. Break one; the other withdraws.");
}
function burst(x,y,elite,color) {
  if(!effectsEnabled) return;
  const count=elite?42:10;
  for(let i=0;i<count;i++) {
    const angle=Math.random()*Math.PI*2, speed=40+Math.random()*(elite?220:100);
    particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:elite?.8:.4,maxLife:elite?.8:.4,size:2+Math.random()*5,color:i%2?color:"#ffffff"});
  }
  if(elite) { rings.push({x,y,r:12,life:.55}); shake=.22; }
}
function floatText(text,x,y,color="#29465b") {
  labels.push({text,x,y,life:.8,color});
  if(labels.length>45) labels.shift();
}
function hit(b,t) { return b.x+3>t.x && b.x-3<t.x+t.width && b.y+14>t.y && b.y<t.y+t.height; }
function collisionChecks() {
  for(let i=bullets.length-1;i>=0;i--) {
    const b=bullets[i]; let target=null, kind="";
    // A projectile hits only the nearest overlapping object, not both a gate and robot.
    for(const [list,type] of [[enemies,"enemy"],[gates,"gate"]]) for(const t of list) {
      if(hit(b,t) && (!target || t.y+t.height>target.y+target.height)) { target=t; kind=type; }
    }
    if(!target) continue;
    bullets.splice(i,1); target.health=Math.max(0,target.health-b.damage); target.flash=.07;
    floatText("−"+format(b.damage),b.x,target.y);
    if(target.health>0) continue;
    const x=target.x+target.width/2,y=target.y+target.height/2;
    if(kind==="enemy") {
      enemies.splice(enemies.indexOf(target),1);
      const reward=Math.round(target.maxHealth*(target.elite?5:1)); score+=reward;
      burst(x,y,target.elite,"#e889b5");
      if(target.elite) {
        eliteSound(); banner={text:"ELITE DOWN!",sub:"+"+format(reward)+" SCORE",life:1.2};
        message(`Elite destroyed! +${format(reward)} score.`);
      } else tone(210,.07,.025,85);
    } else {
      // Remove the whole pair as soon as one reward is claimed.
      for(let j=gates.length-1;j>=0;j--) if(gates[j].id===target.id) gates.splice(j,1);
      if(target.type==="power") {
        damage=Math.min(1e15,damage+target.bonus);
        message(`POWER +${format(target.bonus)} · Damage: ${format(damage)}`);
        floatText("POWER +"+format(target.bonus),x,y,"#376f97");
      } else {
        const gain=Math.min(target.bonus,1e15-maxShield);
        maxShield+=gain; shield=Math.min(maxShield,shield+gain);
        message(`SHIELD +${format(gain)} · Capacity increased and shield restored.`);
        floatText("SHIELD +"+format(gain),x,y,"#a14c79");
      }
      burst(x,y,false,target.type==="power"?"#83c7e2":"#efacc8"); upgradeSound();
    }
    stats();
  }
}
function update(dt) {
  const oldStage=stage(); elapsed+=dt;
  if(stage()!==oldStage) { stats(); message(`Stage ${stage()} · Stronger robots and richer supplies.`); }
  shotTimer+=dt; enemyTimer+=dt; gateTimer+=dt;
  if(shotTimer>=SHOT_INTERVAL) { shotTimer-=SHOT_INTERVAL; bullets.push({x:player.x,y:player.y-28,damage}); tone(680,.06,.018,260); }
  if(enemyTimer>=ENEMY_INTERVAL) { enemyTimer-=ENEMY_INTERVAL; spawnEnemy(); }
  if(gateTimer>=GATE_INTERVAL) { gateTimer-=GATE_INTERVAL; spawnGates(); }
  for(let i=bullets.length-1;i>=0;i--) { bullets[i].y-=BULLET_SPEED*dt; if(bullets[i].y< -14) bullets.splice(i,1); }
  for(const e of enemies) { e.y+=e.speed*dt; e.flash=Math.max(0,e.flash-dt); }
  for(const g of gates) { g.y+=52*dt; g.flash=Math.max(0,g.flash-dt); }
  collisionChecks();
  for(let i=enemies.length-1;i>=0;i--) if(enemies[i].y>H) {
    const e=enemies[i]; enemies.splice(i,1); shield=Math.max(0,shield-e.attack);
    floatText("−"+format(e.attack)+" SHIELD",player.x,player.y-25,"#a14c79");
    tone(120,.15,.06,45); if(effectsEnabled) shake=.12; stats();
    if(shield<=0) { endGame(); return; }
  }
  for(let i=gates.length-1;i>=0;i--) if(gates[i].y>H) gates.splice(i,1);
  for(let i=particles.length-1;i>=0;i--) {
    const p=particles[i]; p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=110*dt;
    if(p.life<=0) particles.splice(i,1);
  }
  for(let i=rings.length-1;i>=0;i--) { rings[i].life-=dt; rings[i].r+=260*dt; if(rings[i].life<=0) rings.splice(i,1); }
  for(let i=labels.length-1;i>=0;i--) { labels[i].life-=dt; labels[i].y-=32*dt; if(labels[i].life<=0) labels.splice(i,1); }
  shake=Math.max(0,shake-dt);
  if(banner) { banner.life-=dt; if(banner.life<=0) banner=null; }
}

function text(value,x,y,size=12,color="#29465b") {
  ctx.fillStyle=color; ctx.font=`bold ${size}px Arial`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(value,x,y);
}
function bar(x,y,w,h,health,max,color,label) {
  ctx.fillStyle="#d8e3ed"; ctx.fillRect(x,y,w,h);
  ctx.fillStyle=color; ctx.fillRect(x,y,w*Math.max(0,health/max),h);
  text(label,x+w/2,y+h/2,h<15?10:11);
}
function draw() {
  ctx.clearRect(0,0,W,H); ctx.save();
  if(shake>0 && effectsEnabled) ctx.translate((Math.random()-.5)*8,(Math.random()-.5)*8);
  ctx.strokeStyle="#bf91ac"; ctx.setLineDash([8,8]); ctx.beginPath(); ctx.moveTo(0,H-8); ctx.lineTo(W,H-8); ctx.stroke(); ctx.setLineDash([]);
  for(const g of gates) {
    const pink=g.type==="shield";
    ctx.fillStyle=g.flash>0?"#ffffff":pink?"#f8deed":"#d9eef8"; ctx.fillRect(g.x,g.y,g.width,g.height);
    ctx.strokeStyle=pink?"#c77da4":"#589fc2"; ctx.lineWidth=2; ctx.strokeRect(g.x,g.y,g.width,g.height);
    text(`${pink?"SHIELD":"POWER"} +${format(g.bonus)}`,g.x+g.width/2,g.y+17,14);
    bar(g.x+10,g.y+33,g.width-20,15,g.health,g.maxHealth,pink?"#e7a1c3":"#83c7e2",format(g.health));
  }
  for(const e of enemies) {
    if(e.elite) {
      ctx.strokeStyle="#b879b0"; ctx.lineWidth=3; ctx.strokeRect(e.x-3,e.y-3,e.width+6,e.height+6);
      text("ELITE · ATK "+format(e.attack),e.x+e.width/2,e.y-32,10,"#9b477c");
    }
    if(imageReady) {
      const fw=image.naturalWidth/3, frame=Math.floor(elapsed/.15)%3;
      ctx.drawImage(image,frame*fw,0,fw,image.naturalHeight,e.x,e.y,e.width,e.height);
    } else {
      ctx.fillStyle="#e889a8"; ctx.fillRect(e.x,e.y,e.width,e.height);
      text("•  •",e.x+e.width/2,e.y+e.height*.4,18);
    }
    if(e.flash>0 && effectsEnabled) { ctx.fillStyle="#ffffff70"; ctx.fillRect(e.x,e.y,e.width,e.height); }
    bar(e.x,e.y-20,e.width,15,e.health,e.maxHealth,e.elite?"#d9a5e4":"#83c7e2",format(e.health));
  }
  ctx.fillStyle="#d978a7"; for(const b of bullets) ctx.fillRect(b.x-3,b.y,6,14);
  ctx.fillStyle="#29465b"; ctx.beginPath(); ctx.arc(player.x,player.y-12,10,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#83c7e2"; ctx.fillRect(player.x-15,player.y,30,20);
  ctx.fillStyle="#547d9a"; ctx.fillRect(player.x-4,player.y-30,8,12);
  bar(player.x-34,player.y+28,68,16,shield,maxShield,"#e889a8",format(shield)+"/"+format(maxShield));
  for(const p of particles) { ctx.globalAlpha=p.life/p.maxLife; ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,p.size,p.size); }
  ctx.globalAlpha=1;
  for(const r of rings) { ctx.globalAlpha=r.life/.55; ctx.strokeStyle="#bd70ad"; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(r.x,r.y,r.r,0,Math.PI*2); ctx.stroke(); }
  ctx.globalAlpha=1;
  for(const label of labels) { ctx.globalAlpha=Math.min(1,label.life*3); text(label.text,label.x,label.y,12,label.color); }
  ctx.globalAlpha=1; ctx.restore();
  if(banner) {
    ctx.fillStyle="#ffffffdb"; ctx.fillRect(75,115,W-150,68);
    text(banner.text,W/2,140,26,"#a14c79"); text(banner.sub,W/2,167,13);
  }
  if(state!=="playing") {
    ctx.fillStyle="#edf6fcd9"; ctx.fillRect(0,0,W,480);
    const title=state==="ready"?"PINK PROTOCOL":state==="paused"?"PAUSED":"SHIELD DEPLETED";
    const sub=state==="ready"?"Press Defend the Shelter to begin.":state==="paused"?"Press Resume to continue.":`Stage ${stage()} · Score ${format(score)}`;
    text(title,W/2,230,29); text(sub,W/2,270,14);
  }
}
// Only one animation loop exists. Restarting resets state, never starts a second loop.
function animate(time) {
  if(lastFrame===null) lastFrame=time;
  const dt=Math.min((time-lastFrame)/1000,.05); lastFrame=time;
  if(state==="playing") update(dt);
  draw(); requestAnimationFrame(animate);
}
updateEffectsButton(); stats(); requestAnimationFrame(animate);
