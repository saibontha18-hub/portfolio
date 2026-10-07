/* SAI // SYSTEM ONLINE — cinematic engine + world. Vanilla JS, no libraries. */
(function () {
"use strict";

/* ============ failsafe ============ */
function hardFallback() {
  var intro = document.getElementById("intro");
  var world = document.getElementById("world");
  if (intro) intro.style.display = "none";
  if (world) { world.hidden = false; }
  try { initWorld(); } catch (e) { /* content is static HTML, stays readable */ }
}

var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

try {
  boot();
} catch (e) {
  hardFallback();
}

/* ================================================================ */
function boot() {

/* ---------- element refs ---------- */
function $(id) { try { return document.getElementById(id); } catch (e) { return null; } }
/* every critical element must exist — otherwise bail to readable content */
(function guardElements() {
  var need = ["env","intro","boot-ui","boot-lines","init-btn","skip-intro","hero-stage",
    "hero-scene","hero-photo","hero-img","hero-scan","hud-lines","enter-world","world",
    "sound-toggle","briefing"];
  for (var i = 0; i < need.length; i++) {
    if (!$(need[i])) throw new Error("missing #" + need[i]);
  }
})();
var cv = $("env"), ctx = null;
try { ctx = cv.getContext("2d"); } catch (e) { ctx = null; }
if (!ctx) throw new Error("no 2d context");
var intro = $("intro"), bootUI = $("boot-ui"), bootLines = $("boot-lines");
var initBtn = $("init-btn"), skipBtn = $("skip-intro");
var heroStage = $("hero-stage"), heroScene = $("hero-scene"),
    heroPhoto = $("hero-photo"), heroScan = $("hero-scan");
var hudLines = $("hud-lines"), enterBtn = $("enter-world");
var world = $("world"), soundBtn = $("sound-toggle");
var briefing = $("briefing");

heroStage.style.visibility = "hidden";
/* JS is alive: take control — hide world until entered, cancel the CSS failsafe */
try { intro.style.animation = "none"; } catch (e) {}
try { world.hidden = true; } catch (e) {}

var isMobile = window.innerWidth < 768;
var W = 0, H = 0, DPR = 1;

/* ---------- environment state ---------- */
var env = {
  level: 0.10, targetLevel: 0.10,
  camX: 0, camZoom: 1, targetZoom: 1,
  spread: 0, targetSpread: 0,
  streams: false, flash: 0,
  knockPulse: 0, heroMode: false
};

/* ---------- canvas scene ---------- */
var particles = [], fogs = [], structures = [], streamCols = [];

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildScene();
}
function rnd(a, b) { return a + Math.random() * (b - a); }

function buildScene() {
  particles = [];
  var n = isMobile ? 90 : 220;
  for (var i = 0; i < n; i++) {
    particles.push({
      x: rnd(0, W), y: rnd(0, H), z: rnd(0.25, 1),
      vx: rnd(-6, 6), vy: rnd(-4, 4),
      s: rnd(0.6, 2.2), tw: rnd(0, 6.28), ts: rnd(1, 3),
      kx: 0, ky: 0
    });
  }
  fogs = [];
  for (var f = 0; f < 5; f++) {
    fogs.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(180, 420),
      vx: rnd(-8, 8), vy: rnd(-5, 5), hue: f % 2 ? "47,127,224" : "20,40,80", a: rnd(0.05, 0.12) });
  }
  structures = [];
  var count = isMobile ? 5 : 8;
  for (var s = 0; s < count; s++) {
    var bx = (s + 0.5) / count;
    structures.push({
      bx: bx, w: rnd(60, 150), h: rnd(120, 340),
      depth: rnd(0.3, 1), kind: (Math.random() * 3) | 0,
      lights: 2 + ((Math.random() * 4) | 0), seed: Math.random() * 100
    });
  }
  streamCols = [];
  for (var c = 0; c < (isMobile ? 6 : 12); c++) {
    streamCols.push({ x: rnd(0, W), w: rnd(1, 3), sp: rnd(40, 140), off: rnd(0, H), a: rnd(0.08, 0.25) });
  }
}

function drawStructure(st, t) {
  var spreadShift = (st.bx - 0.5) * env.spread * W * 0.35;
  var x = st.bx * W + spreadShift - env.camX * st.depth * 0.6;
  var baseY = H + 40, topY = H - st.h * st.depth - 60;
  var w = st.w * st.depth;
  ctx.fillStyle = "rgba(3,7,15,0.92)";
  if (st.kind === 0) {           /* tower */
    ctx.fillRect(x - w / 2, topY, w, baseY - topY);
    ctx.fillRect(x - w * 0.18, topY - 46, w * 0.36, 46);
  } else if (st.kind === 1) {    /* spire */
    ctx.beginPath();
    ctx.moveTo(x - w / 2, baseY); ctx.lineTo(x - w * 0.12, topY - 30);
    ctx.lineTo(x + w * 0.12, topY - 30); ctx.lineTo(x + w / 2, baseY);
    ctx.closePath(); ctx.fill();
  } else {                        /* dome / facility */
    ctx.beginPath();
    ctx.moveTo(x - w, baseY); ctx.lineTo(x - w, topY + 60);
    ctx.quadraticCurveTo(x, topY - 40, x + w, topY + 60);
    ctx.lineTo(x + w, baseY); ctx.closePath(); ctx.fill();
  }
  /* edge lights fade in with env level */
  var la = env.level * 0.85;
  if (la > 0.02) {
    ctx.fillStyle = "rgba(77,216,255," + la.toFixed(3) + ")";
    for (var i = 0; i < st.lights; i++) {
      var ly = topY + 20 + ((st.seed + i * 53) % Math.max(1, (baseY - topY - 30)));
      var pulse = 0.5 + 0.5 * Math.sin(t * 0.002 + st.seed + i);
      ctx.globalAlpha = la * (0.4 + 0.6 * pulse);
      ctx.fillRect(x - w / 2 - 1.5, ly, 3, 3);
      ctx.fillRect(x + w / 2 - 1.5, ly, 3, 3);
    }
    ctx.globalAlpha = 1;
    if (env.knockPulse > 0.01) {
      ctx.fillStyle = "rgba(120,220,255," + (env.knockPulse * 0.8).toFixed(3) + ")";
      ctx.fillRect(x - w / 2, topY, w, 2);
    }
  }
}

var startT = performance.now();
function frame() {
  var t = performance.now() - startT;
  /* ease env toward targets */
  env.level += (env.targetLevel - env.level) * 0.03;
  env.camZoom += (env.targetZoom - env.camZoom) * 0.04;
  env.spread += (env.targetSpread - env.spread) * 0.03;
  env.flash *= 0.9; env.knockPulse *= 0.92;
  env.camX = Math.sin(t * 0.00012) * 26;

  ctx.clearRect(0, 0, W, H);
  /* deep bg */
  var g0 = ctx.createLinearGradient(0, 0, 0, H);
  g0.addColorStop(0, "#02040a"); g0.addColorStop(0.6, "#040914"); g0.addColorStop(1, "#060b16");
  ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(env.camZoom, env.camZoom); ctx.translate(-W / 2, -H / 2);

  /* fog */
  for (var f = 0; f < fogs.length; f++) {
    var fg = fogs[f];
    fg.x += fg.vx * 0.016; fg.y += fg.vy * 0.016;
    if (fg.x < -fg.r) fg.x = W + fg.r; if (fg.x > W + fg.r) fg.x = -fg.r;
    if (fg.y < -fg.r) fg.y = H + fg.r; if (fg.y > H + fg.r) fg.y = -fg.r;
    var fgG = ctx.createRadialGradient(fg.x, fg.y, 0, fg.x, fg.y, fg.r);
    var fa = fg.a * (0.25 + env.level);
    fgG.addColorStop(0, "rgba(" + fg.hue + "," + fa.toFixed(3) + ")");
    fgG.addColorStop(1, "rgba(" + fg.hue + ",0)");
    ctx.fillStyle = fgG;
    ctx.fillRect(fg.x - fg.r, fg.y - fg.r, fg.r * 2, fg.r * 2);
  }

  /* distant structures */
  for (var s = 0; s < structures.length; s++) drawStructure(structures[s], t);

  /* hero floor: perspective grid + platform glow under the character */
  if (env.heroMode && env.level > 0.2) {
    try {
      var hz = H * 0.80, ga = env.level;
      var pg = ctx.createRadialGradient(W / 2, hz, 10, W / 2, hz, Math.min(W, H) * 0.5);
      pg.addColorStop(0, "rgba(77,216,255," + (0.20 * ga).toFixed(3) + ")");
      pg.addColorStop(1, "rgba(77,216,255,0)");
      ctx.fillStyle = pg;
      ctx.fillRect(0, hz - Math.min(W, H) * 0.12, W, Math.min(W, H) * 0.62);
      ctx.strokeStyle = "rgba(77,216,255," + (0.20 * ga).toFixed(3) + ")";
      ctx.lineWidth = 1;
      var li;
      for (li = -8; li <= 8; li++) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + li * W * 0.02, hz);
        ctx.lineTo(W / 2 + li * W * 0.17, H + 40);
        ctx.stroke();
      }
      for (li = 0; li < 5; li++) {
        var yy = hz + Math.pow(li / 4, 1.6) * (H - hz);
        ctx.globalAlpha = ga * (0.05 + 0.16 * (li / 4));
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } catch (e) { /* floor is decorative — never break the frame */ }
  }

  /* data streams */
  if (env.streams && env.level > 0.25) {
    for (var c = 0; c < streamCols.length; c++) {
      var sc = streamCols[c];
      sc.off -= sc.sp * 0.016; if (sc.off < -80) sc.off = H + 80;
      var sg = ctx.createLinearGradient(0, sc.off - 70, 0, sc.off + 70);
      var sa = sc.a * env.level;
      sg.addColorStop(0, "rgba(77,216,255,0)");
      sg.addColorStop(0.5, "rgba(77,216,255," + sa.toFixed(3) + ")");
      sg.addColorStop(1, "rgba(77,216,255,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(sc.x, sc.off - 70, sc.w, 140);
    }
  }

  /* particles */
  for (var p = 0; p < particles.length; p++) {
    var pt = particles[p];
    pt.x += (pt.vx + pt.kx) * 0.016 * 10; pt.y += (pt.vy + pt.ky) * 0.016 * 10;
    pt.kx *= 0.94; pt.ky *= 0.94;
    pt.x -= env.camX * 0.002 * pt.z;
    if (pt.x < 0) pt.x = W; if (pt.x > W) pt.x = 0;
    if (pt.y < 0) pt.y = H; if (pt.y > H) pt.y = 0;
    var tw = 0.55 + 0.45 * Math.sin(t * 0.001 * pt.ts + pt.tw);
    var a = (0.12 + env.level * 0.75) * pt.z * tw;
    ctx.fillStyle = pt.z > 0.75 ? "rgba(160,225,255," + a.toFixed(3) + ")" : "rgba(120,170,220," + a.toFixed(3) + ")";
    var sz = pt.s * pt.z * (0.7 + env.level * 0.6);
    ctx.fillRect(pt.x, pt.y, sz, sz);
  }
  ctx.restore();

  /* knock ring pulse */
  if (env.knockPulse > 0.02) {
    ctx.strokeStyle = "rgba(120,220,255," + (env.knockPulse * 0.35).toFixed(3) + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, (1 - env.knockPulse) * Math.min(W, H) * 0.7 + 40, 0, 6.283);
    ctx.stroke();
  }
  /* impact flash */
  if (env.flash > 0.01) {
    ctx.fillStyle = "rgba(200,235,255," + (env.flash * 0.55).toFixed(3) + ")";
    ctx.fillRect(0, 0, W, H);
  }
  /* vignette */
  var vg = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.35, W/2, H/2, Math.max(W,H)*0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  if (!reducedMotion) requestAnimationFrame(frame);
}

/* ---------- Web Audio ---------- */
var actx = null, soundOn = true;
function ensureAudio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
  if (actx && actx.state === "suspended") actx.resume();
}
function knockSound() {
  if (!soundOn || !actx) return;
  var t = actx.currentTime;
  var o = actx.createOscillator(), g = actx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(72, t);
  o.frequency.exponentialRampToValueAtTime(36, t + 0.2);
  g.gain.setValueAtTime(0.85, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  o.connect(g); g.connect(actx.destination);
  o.start(t); o.stop(t + 0.3);
  var nb = actx.createBuffer(1, actx.sampleRate * 0.12, actx.sampleRate);
  var d = nb.getChannelData(0);
  for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  var ns = actx.createBufferSource(); ns.buffer = nb;
  var nf = actx.createBiquadFilter(); nf.type = "lowpass"; nf.frequency.value = 320;
  var ng = actx.createGain(); ng.gain.setValueAtTime(0.5, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  ns.connect(nf); nf.connect(ng); ng.connect(actx.destination);
  ns.start(t);
}
function boomSound() {
  if (!soundOn || !actx) return;
  var t = actx.currentTime;
  var o = actx.createOscillator(), g = actx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(52, t);
  o.frequency.exponentialRampToValueAtTime(26, t + 1.1);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
  o.connect(g); g.connect(actx.destination);
  o.start(t); o.stop(t + 1.4);
}
function blip(freq) {
  if (!soundOn || !actx) return;
  var t = actx.currentTime;
  var o = actx.createOscillator(), g = actx.createGain();
  o.type = "square"; o.frequency.value = freq || 880;
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  o.connect(g); g.connect(actx.destination);
  o.start(t); o.stop(t + 0.08);
}

/* ---------- timeline scheduler ---------- */
var timers = [];
var introActive = true;   /* false once the world is shown */
var progressT = Date.now();
function markProgress() { try { progressT = Date.now(); } catch (e) {} }
function at(ms, fn) {
  timers.push(setTimeout(function () {
    try { fn(); } catch (e) { forceWorld(); }
  }, ms));
}
function clearTimers() { try { timers.forEach(clearTimeout); } catch (e) {} timers = []; }

/* jump to the world no matter what — the user can never be trapped */
function forceWorld() {
  try { clearTimers(); } catch (e) {}
  try { clearInterval(watchdogIv); } catch (e) {}
  try { voice.pause(); } catch (e) {}
  try { env.heroMode = false; } catch (e) {}
  var i = $("intro"), w = $("world");
  if (i) { try { i.style.display = "none"; } catch (e) {} }
  if (w) { try { w.hidden = false; } catch (e) {} }
  try { initWorld(); } catch (e) { /* static HTML stays readable */ }
}
function toWorld() {
  if (!introActive) return;
  introActive = false;
  forceWorld();
}

/* ---------- boot text ---------- */
function addLine(text, dim) {
  markProgress();
  var p = document.createElement("p");
  p.textContent = text;
  if (dim) p.className = "dim";
  bootLines.appendChild(p);
  while (bootLines.children.length > 8) bootLines.removeChild(bootLines.firstChild);
}
function hudLine(html, delay) {
  at(delay, function () {
    var p = document.createElement("p");
    p.innerHTML = html;
    hudLines.appendChild(p);
    blip(660);
  });
}

/* ---------- knock reaction ---------- */
function knockReaction() {
  env.knockPulse = 1;
  for (var i = 0; i < particles.length; i++) {
    var pt = particles[i];
    var dx = pt.x - W / 2, dy = pt.y - H / 2;
    var dist = Math.hypot(dx, dy) || 1;
    var f = Math.max(0, 1 - dist / (Math.min(W, H) * 0.6)) * 260;
    pt.kx += (dx / dist) * f * 0.06;
    pt.ky += (dy / dist) * f * 0.06;
  }
}

/* ---------- voice ---------- */
var voice = new Audio("assets/voice-intro.mp3");
voice.preload = "auto";
var VOICE_MS = 5090;
var revealed = false;

var voicePlayed = false;
function playVoiceThenReveal() {
  if (voicePlayed) return; /* never play the line twice */
  voicePlayed = true;
  markProgress();
  var revealFn = shortMode ? shortReveal : doImpactAndReveal;
  function onEnded() {
    voice.removeEventListener("ended", onEnded);
    at(600, revealFn);
  }
  voice.addEventListener("ended", onEnded);
  voice.addEventListener("error", function () { /* fallback timer covers it */ }, { once: true });
  try {
    /* defensive reset: kill any stray muted unlock playback so the real
       play() starts clean from 0, unmuted */
    try { voice.pause(); } catch (e0) {}
    try { voice.currentTime = 0; } catch (e1) {}
    try { voice.muted = false; } catch (e2) {}
    var pr = voice.play();
    if (pr && pr.catch) pr.catch(function () { at(1200, revealFn); });
  } catch (e) { at(1200, revealFn); }
  /* safety fallback: never reveal early, but never hang */
  at(VOICE_MS + 1500, function () { if (!revealed) revealFn(); });
  /* intensify during voice */
  env.targetLevel = 1.0;
  env.streams = true;
}

function doImpactAndReveal() {
  if (revealed) return;
  revealed = true;
  markProgress();
  boomSound();
  env.flash = 1;
  env.heroMode = true;
  bootUI.style.transition = "opacity .8s";
  bootUI.style.opacity = "0";
  at(700, function () {
    bootUI.style.display = "none";
    heroStage.style.visibility = "visible";
    heroScene.style.transform = "scale(1.12)";
    heroPhoto.classList.add("materializing");
    at(150, function () { heroPhoto.classList.add("on"); });
    at(1500, function () { heroPhoto.classList.remove("materializing"); });
    landscapePullback();
  });
}

function landscapePullback() {
  /* camera pulls back: photo keeps its natural aspect, scales down uniformly;
     the landscape comes from environment expansion + camera movement */
  var dur = 2600, t0 = performance.now();
  env.targetSpread = 1;
  env.targetZoom = 1.06;
  function step() {
    var k = Math.min(1, (performance.now() - t0) / dur);
    var e = 1 - Math.pow(1 - k, 3);
    var s = 1.12 - 0.12 * e;
    heroScene.style.transform = "scale(" + s.toFixed(3) + ")";
    if (k < 1 && !reducedMotion) requestAnimationFrame(step);
  }
  if (!reducedMotion) requestAnimationFrame(step);
  else heroScene.style.transform = "scale(1)";

  var seq = [
    "<b>SAI // SYSTEM ONLINE</b>",
    "IDENTITY: <b>SAI BONTHA</b>",
    "ROLE: EMBEDDED SYSTEMS ENGINEER",
    "SPECIALIZATION: FIRMWARE / LINUX / SYSTEMS",
    "PRIMARY SYSTEMS: ARM / RTOS / LINUX",
    "STATUS: <b>OPERATIONAL</b>"
  ];
  seq.forEach(function (h, i) { hudLine(h, 2200 + i * 750); });
  at(2200 + seq.length * 750 + 400, function () {
    markProgress();
    enterBtn.hidden = false;
    enterBtn.focus();
    blip(990);
  });
}

/* ---------- enter world ---------- */
function enterWorld() {
  try {
    introActive = false;
    clearTimers();
    try { voice.pause(); } catch (e) {}
    env.targetZoom = 1.32; env.flash = 0.5; boomSound();
    at(950, function () {
      intro.classList.add("gone");
      env.targetLevel = 0.32; env.targetZoom = 1.0; env.targetSpread = 0.4;
      env.heroMode = false;
      world.hidden = false;
      try { window.scrollTo(0, 0); } catch (e) {}
      initWorld();
      at(900, function () { intro.style.display = "none"; });
    });
  } catch (e) { forceWorld(); }
}

function skipIntro() {
  introActive = false;
  clearTimers();
  try { voice.pause(); } catch (e) {}
  try { env.heroMode = false; } catch (e) {}
  intro.style.display = "none";
  env.targetLevel = 0.32;
  world.hidden = false;
  initWorld();
}

/* ---------- intro sequences ---------- */
function fullSequence() {
  at(1000, function () { knockSound(); knockReaction(); });
  at(1900, function () { knockSound(); knockReaction(); });
  at(2700, function () { addLine("INCOMING CONNECTION"); blip(520); });
  at(3500, function () { addLine("SIGNAL DETECTED"); blip(580); });
  at(4300, function () { addLine("INITIALIZING ENGINEERING SYSTEM"); blip(640); });
  at(5100, function () { addLine("SYSTEM STANDBY", true); });
  at(5900, function () { addLine("BOOTING SYSTEM"); env.targetLevel = 0.38; env.streams = true; blip(700); });
  at(6700, function () { addLine("LOADING ENGINEERING CORE"); env.targetLevel = 0.55; blip(760); });
  at(7500, function () { addLine("ESTABLISHING CONNECTION"); env.targetLevel = 0.7; blip(820); });
  at(8300, function () { addLine("IDENTITY SIGNAL LOCKED"); env.targetLevel = 0.85; blip(880); });
  at(9100, function () { addLine("SYSTEM READY"); env.targetLevel = 1.0; blip(990); });
  at(9800, playVoiceThenReveal);
}

function shortSequence() {
  /* repeat visitors: same story beats, compressed */
  at(600, function () { addLine("INCOMING CONNECTION"); blip(520); });
  at(1300, function () { addLine("SIGNAL DETECTED"); blip(640); });
  at(2000, function () { addLine("SYSTEM READY"); env.targetLevel = 1.0; env.streams = true; blip(880); });
  /* voice ALWAYS plays — it is the signature moment, even for repeat visitors */
  at(2600, playVoiceThenReveal);
}

function shortReveal() {
  /* called only after the voice finishes (ended event or fallback) */
  if (revealed) return;
  revealed = true;
  env.heroMode = true;
  bootUI.style.display = "none";
  heroStage.style.visibility = "visible";
  heroPhoto.classList.add("on");
  heroScene.style.transform = "scale(1)";
  env.targetSpread = 1; env.targetZoom = 1.06;
  var seq = ["<b>SAI // SYSTEM ONLINE</b>", "IDENTITY: <b>SAI BONTHA</b>",
    "ROLE: EMBEDDED SYSTEMS ENGINEER", "STATUS: <b>OPERATIONAL</b>"];
  seq.forEach(function (h, i) { hudLine(h, i * 500); });
  at(seq.length * 500 + 300, function () { enterBtn.hidden = false; enterBtn.focus(); });
}

/* ================================================================
   MAIN WORLD
   ================================================================ */
var worldInit = false;

var SKILL_DATA = [
  { n: "FIRMWARE", d: "Bare-metal and RTOS firmware: the code that owns the hardware.", c: [
    ["C", "Systems-level C: drivers, boot code, and bare-metal bring-up."],
    ["C++", "Modern C++ for firmware abstractions and testable embedded modules."],
    ["Bare Metal", "Startup code, linker scripts, and register-level hardware control."],
    ["ARM", "Cortex-M/A: exception handling, memory maps, and low-level optimization."],
    ["RTOS", "FreeRTOS and Zephyr: tasks, scheduling, and real-time constraints."]]},
  { n: "LINUX", d: "Embedded Linux: from bootloader to userspace.", c: [
    ["Embedded Linux", "Custom Linux systems: kernel config, rootfs, and board integration."],
    ["Device Tree", "Hardware description for the kernel: DTS structure and bindings."],
    ["Root Filesystem", "Buildroot/Yocto-based rootfs: init, services, and packaging."],
    ["Cross Compilation", "Toolchains and sysroots targeting ARM."],
    ["Linux Applications", "Userspace daemons, IPC, and system integration."]]},
  { n: "DRIVERS", d: "Hardware interfaces: making peripherals speak.", c: [
    ["GPIO", "Digital I/O: configuration, interrupts, and debouncing."],
    ["SPI", "High-speed synchronous serial: sensors, flash, displays."],
    ["I2C", "Two-wire bus: multi-device addressing and bus recovery."],
    ["UART", "Serial consoles, logging, and protocol framing."],
    ["CAN", "Robust vehicle/industrial networking with frame validation."],
    ["ADC", "Analog capture: sampling, calibration, and noise handling."],
    ["PWM", "Timed output: motor control, dimming, and signal generation."]]},
  { n: "SYSTEMS", d: "How software components talk to each other.", c: [
    ["IPC", "Pipes, message queues, and shared memory between processes."],
    ["Shared Memory", "Zero-copy data exchange with proper synchronization."],
    ["Message Queues", "Asynchronous task communication with bounded queues."],
    ["Sockets", "TCP/UDP networking for device connectivity."],
    ["POSIX Threads", "Multithreaded design: mutexes, condition variables, thread safety."]]},
  { n: "DEBUGGING", d: "Diagnostics: finding the fault, wherever it hides.", c: [
    ["GDB", "Source-level debugging: breakpoints, watchpoints, core dumps."],
    ["JTAG", "Boundary scan and hardware-level debug access."],
    ["SWD", "Serial wire debug for Cortex-M targets."],
    ["Serial Console", "UART logs, boot traces, and kernel messages."],
    ["Root Cause Analysis", "Structured defect triage from symptom to silicon."]]}
];

var PROJECTS = [
  { id: "P-01", repo: "linux-char-driver", name: "LINUX CHAR DRIVER", feat: true,
    obj: "Misc character device driver for Linux with ioctl interface and clean error-path handling.",
    chal: "Every failure path in module init and exit must release exactly what it acquired — no leaked devices, no dangling memory.",
    arch: "Userspace app → ioctl → char device node → kernel module → hardware abstraction",
    impl: "Misc-device registration, ioctl dispatch table, defensive error paths verified with CMocka host tests.",
    tech: "C · Linux Kernel · ioctl · CMocka" },
  { id: "P-02", repo: "can-frame-codec", name: "CAN FRAME CODEC", feat: true,
    obj: "C library encoding/decoding CAN 2.0 frames with validation and CMocka unit tests.",
    chal: "Malformed frames must be rejected before they can corrupt bus logic or state machines.",
    arch: "Raw bytes → validator → frame struct → application logic",
    impl: "Pure-C encode/decode with strict field validation and a CMocka test suite covering edge cases.",
    tech: "C · CAN 2.0 · CMocka" },
  { id: "P-03", repo: "freertos-skeleton", name: "FREERTOS SKELETON", feat: true,
    obj: "Minimal FreeRTOS project skeleton with tasks, queues, ready build setup.",
    chal: "New firmware needs a deterministic, documented starting structure instead of copy-pasted fragments.",
    arch: "main → scheduler → tasks ⇄ queues → drivers",
    impl: "Task and queue templates with a documented, reproducible build configuration.",
    tech: "C · FreeRTOS · ARM" },
  { id: "P-04", repo: "uart-data-logger", name: "UART DATA LOGGER",
    obj: "Userspace UART data logger with ring-buffered capture and timestamped output.",
    chal: "Bursty serial data must be captured without drops on a busy system.",
    arch: "UART → ring buffer → timestamping → log output",
    impl: "Userspace daemon with lock-free-ish ring buffering and monotonic timestamps.",
    tech: "C · Linux · UART" },
  { id: "P-05", repo: "modbus-rtu-slave", name: "MODBUS RTU SLAVE",
    obj: "Modbus RTU slave over UART with CRC checking.",
    chal: "RTU framing rules are unforgiving — timing and CRC must be exact.",
    arch: "UART bytes → frame state machine → CRC-16 → register map",
    impl: "State-machine parser with CRC-16 validation against the Modbus spec.",
    tech: "C · Modbus RTU · UART · CRC" },
  { id: "P-06", repo: "cmocka-unit-tests", name: "CMOCKA UNIT TESTS",
    obj: "CMocka unit test suite for embedded C modules, CI-ready.",
    chal: "Embedded C modules must be testable on the host, long before hardware exists.",
    arch: "Module under test → CMocka harness → CI runner",
    impl: "Host-compiled test harness with a CI-ready layout for automated runs.",
    tech: "C · CMocka · CI" },
  { id: "P-07", repo: "json-stream", name: "JSON STREAM",
    obj: "Lightweight streaming JSON parser for memory-constrained targets.",
    chal: "Parse JSON in kilobytes of RAM — no DOM, no heap spikes.",
    arch: "Byte stream → tokenizer → event callbacks → application",
    impl: "Single-pass streaming parser emitting events instead of building a tree.",
    tech: "C · Embedded" },
  { id: "P-08", repo: null, name: "JARVIS", feat: false, dev: true,
    obj: "Embedded system monitoring platform combining Linux telemetry, system diagnostics, and a command-center interface.",
    chal: "Correlate low-level system signals into one coherent operational picture.",
    arch: "Hardware → Driver → Linux → IPC → Application → Telemetry → Dashboard",
    impl: "In development: telemetry collectors feeding a centralized diagnostics interface.",
    tech: "Embedded Linux · C · Python · IPC" }
];

var LINUX_MAP = [
  ["BOOT", "Bootloader (U-Boot): initializes RAM and loads the kernel."],
  ["LINUX KERNEL", "The core: scheduling, memory management, and the driver framework."],
  ["DEVICE TREE", "Describes the hardware to the kernel at boot time."],
  ["DEVICE DRIVERS", "Kernel modules that expose hardware as devices."],
  ["USER SPACE", "Applications, daemons, and system services."],
  ["APPLICATION", "The product software the user interacts with."]
];
var RTOS_MAP = [
  ["INTERRUPT", "Hardware signals the CPU: something needs attention right now."],
  ["ISR", "Interrupt Service Routine: minimal, fast, defers work to tasks."],
  ["RTOS TASK", "Scheduled thread of execution with a fixed priority."],
  ["QUEUE / SEMAPHORE", "Safe handoff primitives between ISRs, tasks, and drivers."],
  ["DRIVER", "Peripheral driver: configures registers and moves data."],
  ["PERIPHERAL", "UART, SPI, I2C, CAN, timers, ADC — the on-chip hardware."],
  ["HARDWARE", "The silicon and board everything runs on."]
];

function initWorld() {
  if (worldInit) return;
  worldInit = true;
  buildSkillTree();
  buildProjects();
  buildMap("linux-map", "linux-info", LINUX_MAP);
  buildMap("rtos-map", "rtos-info", RTOS_MAP);
  initNav();
  initReveals();
}

/* ---------- skill tree ---------- */
function buildSkillTree() {
  var svg = $("skilltree");
  var NS = "http://www.w3.org/2000/svg";
  var VW = 920, VH = 620;
  svg.setAttribute("viewBox", "0 0 " + VW + " " + VH);
  var info = $("skill-info");
  var edges = [], nodes = [];

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  }
  function edge(x1, y1, x2, y2, id) {
    var l = el("line", { x1: x1, y1: y1, x2: x2, y2: y2, "class": "edge", id: "e-" + id }, svg);
    edges.push(l); return l;
  }
  var nodeSeq = 0;
  function node(x, y, r, label, desc, cls, path) {
    var gid = "n" + (nodeSeq++);
    var g = el("g", { "class": "node " + (cls || ""), transform: "translate(" + x + "," + y + ")",
      tabindex: "0", role: "treeitem", "aria-label": label, id: gid }, svg);
    el("circle", { r: r, cx: 0, cy: 0 }, g);
    var t = el("text", { y: r + 16, "text-anchor": "middle" }, g);
    t.textContent = label;
    var nd = { g: g, label: label, desc: desc, path: path, id: gid };
    nodes.push(nd);
    function activate() {
      nodes.forEach(function (o) { o.g.classList.remove("active"); });
      edges.forEach(function (e2) { e2.classList.remove("lit"); });
      g.classList.add("active");
      path.forEach(function (pid) {
        var pe = document.getElementById("e-" + pid);
        if (pe) pe.classList.add("lit");
      });
      info.innerHTML = "";
      var h = document.createElement("h4"); h.textContent = label;
      var p = document.createElement("p"); p.textContent = desc;
      info.appendChild(h); info.appendChild(p);
      blip(760);
    }
    g.addEventListener("click", activate);
    g.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); activate(); }
    });
    return nd;
  }

  var root = node(460, 44, 20, "EMBEDDED ENGINEERING",
    "The whole discipline: firmware, Linux, drivers, systems, and diagnostics working as one.",
    "root", []);
  var bx = [92, 276, 460, 644, 828];
  SKILL_DATA.forEach(function (br, bi) {
    var bnd = node(bx[bi], 128, 15, br.n, br.d, "", ["b" + bi]);
    edge(460, 64, bx[bi], 113, "b" + bi);
    br.c.forEach(function (ch, ci) {
      var cy = 200 + ci * 56;
      var cnd = node(bx[bi], cy, 10, ch[0], ch[1], "", ["b" + bi, "b" + bi + "c" + ci]);
      edge(bx[bi], 143, bx[bi], cy - 10, "b" + bi + "c" + ci);
    });
  });
  svg.setAttribute("height", 620);
}

/* ---------- projects ---------- */
function buildProjects() {
  var grid = $("mission-grid");
  PROJECTS.forEach(function (p) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "mcard" + (p.feat ? " featured" : "");
    b.setAttribute("aria-haspopup", "dialog");
    var h = '<span class="m-id">' + p.id + "</span>";
    if (p.dev) h += ' <span class="flag">IN DEVELOPMENT</span>';
    h += "<h3>" + p.name + "</h3><p>" + p.obj + '</p><p class="mtech">' + p.tech + "</p>";
    b.innerHTML = h;
    b.addEventListener("click", function () { openBriefing(p); blip(880); });
    grid.appendChild(b);
  });
  $("brief-close").addEventListener("click", closeBriefing);
  briefing.addEventListener("click", function (ev) { if (ev.target === briefing) closeBriefing(); });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && !briefing.hidden) closeBriefing();
  });
}
function openBriefing(p) {
  $("brief-title").textContent = p.id + " — " + p.name;
  var st = $("brief-status");
  if (p.dev) { st.textContent = "STATUS: IN DEVELOPMENT"; st.className = "os-status pend"; }
  else { st.textContent = "STATUS: COMPLETED"; st.className = "os-status ok"; }
  $("brief-objective").textContent = p.obj;
  $("brief-challenge").textContent = p.chal;
  $("brief-arch").textContent = p.arch;
  $("brief-impl").textContent = p.impl;
  $("brief-techs").textContent = p.tech;
  var gh = $("brief-github");
  if (p.repo) { gh.href = "https://github.com/saibontha18-hub/" + p.repo; gh.style.display = ""; }
  else gh.style.display = "none";
  briefing.hidden = false;
  $("brief-close").focus();
}
function closeBriefing() { briefing.hidden = true; }

/* ---------- system maps ---------- */
function buildMap(svgId, infoId, data) {
  var svg = $(svgId), info = $(infoId);
  var NS = "http://www.w3.org/2000/svg";
  var W2 = 400, rowH = 74, nodeH = 42, nodeW = 280;
  var H2 = data.length * rowH + 20;
  svg.setAttribute("viewBox", "0 0 " + W2 + " " + H2);
  svg.setAttribute("style", "height:" + H2 + "px");
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e); return e;
  }
  data.forEach(function (nd, i) {
    var y = 14 + i * rowH;
    if (i > 0) {
      el("line", { x1: W2 / 2, y1: y - rowH + nodeH + 6, x2: W2 / 2, y2: y - 8,
        "class": "flow", "marker-end": "none" }, svg);
      el("path", { d: "M" + (W2/2 - 6) + " " + (y - 14) + " L" + (W2/2) + " " + (y - 6) +
        " L" + (W2/2 + 6) + " " + (y - 14), stroke: "#4dd8ff", "stroke-width": 2, fill: "none", opacity: "0.6" }, svg);
    }
    var g = el("g", { "class": "mnode", transform: "translate(" + (W2/2 - nodeW/2) + "," + y + ")",
      tabindex: "0", role: "button", "aria-label": nd[0] }, svg);
    el("rect", { width: nodeW, height: nodeH }, g);
    var t = el("text", { x: nodeW / 2, y: nodeH / 2 + 4 }, g);
    t.textContent = nd[0];
    function sel() {
      var all = svg.querySelectorAll(".mnode");
      for (var j = 0; j < all.length; j++) all[j].classList.remove("sel");
      g.classList.add("sel");
      info.innerHTML = "";
      var h = document.createElement("h4"); h.textContent = nd[0];
      var p = document.createElement("p"); p.textContent = nd[1];
      info.appendChild(h); info.appendChild(p);
      blip(700);
    }
    g.addEventListener("click", sel);
    g.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); sel(); }
    });
  });
}

/* ---------- nav / reveals ---------- */
function initNav() {
  var toggle = $("nav-toggle"), list = $("nav-list");
  toggle.addEventListener("click", function () {
    var open = list.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  list.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () { list.classList.remove("open"); });
  });
  soundBtn.addEventListener("click", function () {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "SOUND: ON" : "SOUND: OFF";
    soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
    if (soundOn) { ensureAudio(); blip(880); }
  });
  /* scroll spy */
  var links = {};
  list.querySelectorAll("a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        Object.keys(links).forEach(function (k) { links[k].classList.remove("active"); });
        var l = links[e.target.id];
        if (l) l.classList.add("active");
      }
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  document.querySelectorAll("main section[id]").forEach(function (s) { spy.observe(s); });
}
function initReveals() {
  var els = document.querySelectorAll(".panel");
  els.forEach(function (p) { p.classList.add("reveal"); });
  if (reducedMotion) { els.forEach(function (p) { p.classList.add("in"); }); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.08 });
  els.forEach(function (p) { io.observe(p); });
}

/* ---------- wire up intro ---------- */
resize();
window.addEventListener("resize", resize);

/* ---------- star cursor ---------- */
/* disabled per Sai: use the normal system cursor */
function initCursor() {
  return;
  try {
    var mq = window.matchMedia ? window.matchMedia("(hover:hover) and (pointer:fine)") : null;
    if (!mq || !mq.matches) return; /* touch devices: native cursor stays */
    document.documentElement.classList.add("starcursor");
    var ccv = document.createElement("canvas");
    ccv.id = "cursor-fx";
    ccv.setAttribute("aria-hidden", "true");
    document.body.appendChild(ccv);
    var cx2d = ccv.getContext("2d");
    if (!cx2d) return;
    var mx = -100, my = -100, px = -100, py = -100, hot = false;
    var trail = [], bursts = [];
    function sizeC() {
      var d = Math.min(window.devicePixelRatio || 1, 2);
      ccv.width = window.innerWidth * d; ccv.height = window.innerHeight * d;
      cx2d.setTransform(d, 0, 0, d, 0, 0);
    }
    sizeC();
    window.addEventListener("resize", sizeC);
    document.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      if (!reducedMotion && trail.length < 40) {
        trail.push({ x: mx, y: my, life: 1, s: 1 + Math.random() * 1.6 });
      }
    }, { passive: true });
    document.addEventListener("mouseover", function (e) {
      try {
        hot = !!(e.target && e.target.closest &&
          e.target.closest("a,button,[role='button'],[role='treeitem'],.node,.mnode,.mcard"));
      } catch (err) { hot = false; }
    }, { passive: true });
    document.addEventListener("mousedown", function (e) {
      if (reducedMotion) return;
      bursts.push({ x: e.clientX, y: e.clientY, r: 4, life: 1 });
      for (var i = 0; i < 10; i++) {
        var a = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
        bursts.push({ x: e.clientX, y: e.clientY, r: 2, life: 1,
          vx: Math.cos(a) * (2 + Math.random() * 3), vy: Math.sin(a) * (2 + Math.random() * 3) });
      }
    }, { passive: true });
    function star(x, y, R, alpha) {
      cx2d.save();
      cx2d.translate(x, y);
      var glow = cx2d.createRadialGradient(0, 0, 0, 0, 0, R * 3.2);
      glow.addColorStop(0, "rgba(200,240,255," + (0.85 * alpha).toFixed(3) + ")");
      glow.addColorStop(0.4, "rgba(120,210,255," + (0.35 * alpha).toFixed(3) + ")");
      glow.addColorStop(1, "rgba(120,210,255,0)");
      cx2d.fillStyle = glow;
      cx2d.fillRect(-R * 3.2, -R * 3.2, R * 6.4, R * 6.4);
      cx2d.strokeStyle = "rgba(230,250,255," + (0.95 * alpha).toFixed(3) + ")";
      cx2d.lineWidth = 1.4;
      cx2d.beginPath();
      cx2d.moveTo(-R * 2.2, 0); cx2d.lineTo(R * 2.2, 0);
      cx2d.moveTo(0, -R * 2.2); cx2d.lineTo(0, R * 2.2);
      cx2d.stroke();
      cx2d.rotate(Math.PI / 4);
      cx2d.strokeStyle = "rgba(200,235,255," + (0.55 * alpha).toFixed(3) + ")";
      cx2d.beginPath();
      cx2d.moveTo(-R * 1.2, 0); cx2d.lineTo(R * 1.2, 0);
      cx2d.moveTo(0, -R * 1.2); cx2d.lineTo(0, R * 1.2);
      cx2d.stroke();
      cx2d.fillStyle = "rgba(255,255,255," + alpha.toFixed(3) + ")";
      cx2d.beginPath(); cx2d.arc(0, 0, R * 0.42, 0, 6.283); cx2d.fill();
      cx2d.restore();
    }
    function cursorFrame() {
      try {
        /* main star tracks the REAL pointer exactly — no lag, so clicks
           always land where the user aims. The trail keeps the fluid feel. */
        px = mx; py = my;
        cx2d.clearRect(0, 0, window.innerWidth, window.innerHeight);
        var i;
        for (i = trail.length - 1; i >= 0; i--) {
          var tp = trail[i];
          tp.life -= 0.06;
          if (tp.life <= 0) { trail.splice(i, 1); continue; }
          cx2d.fillStyle = "rgba(150,220,255," + (tp.life * 0.5).toFixed(3) + ")";
          cx2d.beginPath(); cx2d.arc(tp.x, tp.y, tp.s * tp.life, 0, 6.283); cx2d.fill();
        }
        for (i = bursts.length - 1; i >= 0; i--) {
          var b = bursts[i];
          b.life -= 0.05;
          if (b.life <= 0) { bursts.splice(i, 1); continue; }
          if (b.vx !== undefined) { b.x += b.vx; b.y += b.vy; }
          else b.r += 2.4;
          cx2d.strokeStyle = "rgba(200,240,255," + (b.life * 0.8).toFixed(3) + ")";
          cx2d.lineWidth = 1.5;
          cx2d.beginPath(); cx2d.arc(b.x, b.y, Math.max(0.1, b.r), 0, 6.283); cx2d.stroke();
        }
        if (mx > -50) star(px, py, hot ? 7 : 5.2, hot ? 1 : 0.85);
      } catch (e) { /* cursor is decorative */ }
      requestAnimationFrame(cursorFrame);
    }
    if (!reducedMotion) requestAnimationFrame(cursorFrame);
    else {
      /* reduced motion: static star follows, no trail */
      (function staticStar() {
        try {
          px = mx; py = my;
          cx2d.clearRect(0, 0, window.innerWidth, window.innerHeight);
          if (mx > -50) star(px, py, 5.2, 0.85);
        } catch (e) {}
        requestAnimationFrame(staticStar);
      })();
    }
  } catch (e) { /* cursor is decorative — never break the page */ }
}

/* ---------- wire up intro ---------- */
resize();
window.addEventListener("resize", resize);
try { initCursor(); } catch (e) {}

if (reducedMotion) {
  /* immediate readable content, static backdrop */
  introActive = false;
  frame();
  intro.style.display = "none";
  world.hidden = false;
  initWorld();
} else {
  requestAnimationFrame(frame);
  var seen = false;
  try { seen = sessionStorage.getItem("sai_intro_seen") === "1"; } catch (e) {}
  var shortMode = false; /* repeat-visit path: compressed boot, but voice still plays */
  /* global watchdog: if the intro makes no progress for 15s, jump to the world */
  var watchdogIv = setInterval(function () {
    try {
      if (!introActive) { clearInterval(watchdogIv); return; }
      if (Date.now() - progressT > 15000) toWorld();
    } catch (e) {}
  }, 5000);
  var started = false;
  function startSequence() {
    if (started || !introActive) return;
    started = true;
    try {
      ensureAudio();
      /* unlock the voice element inside the user gesture (muted) so the
         later play() is allowed by mobile autoplay policies */
      try {
        voice.muted = true;
        var up = voice.play();
        if (up && up.then) {
          up.then(function () { try { voice.pause(); voice.currentTime = 0; voice.muted = false; } catch (e) {} },
                  function () { try { voice.muted = false; } catch (e) {} });
        } else { try { voice.pause(); voice.currentTime = 0; voice.muted = false; } catch (e) {} }
      } catch (e) { try { voice.muted = false; } catch (e2) {} }
      initBtn.style.display = "none";
      try { sessionStorage.setItem("sai_intro_seen", "1"); } catch (e) {}
      /* progress watchdog: if boot text hasn't advanced in 4s, jump to world */
      var linesAtClick = bootLines.children.length;
      at(4000, function () {
        if (introActive && !revealed && bootLines.children.length <= linesAtClick) toWorld();
      });
      if (seen) { shortMode = true; shortSequence(); } else fullSequence();
    } catch (e) { forceWorld(); }
  }
  initBtn.addEventListener("click", startSequence);
  /* clicking anywhere on the intro also starts it — the star cursor can make
     precise aiming tricky, so the whole screen is a valid target */
  intro.addEventListener("click", function (e) {
    try {
      if (e.target && e.target.closest && e.target.closest("#skip-intro,#enter-world")) return;
    } catch (err) {}
    startSequence();
  });
  skipBtn.addEventListener("click", function () { try { skipIntro(); } catch (e) { forceWorld(); } });
  enterBtn.addEventListener("click", function () { try { enterWorld(); } catch (e) { forceWorld(); } });
}

} /* end boot() */
})();
