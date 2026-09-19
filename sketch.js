// ============================================================
//  SATISFYING ANIMATIONS — Facebook Short Film Generator
//  100% Free | p5.js + p5.sound | Procedural Sound FX
// ============================================================

let W = 1080;
let H = 1920; // 9:16 vertical for Reels/Shorts
let currentScene = 0;
let totalScenes = 6;
let sceneTimer = 0;
let controlsVisible = true;

// Scenes
let scenes = [];

// ======================== AUTO MODE ========================
const _urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const AUTO_MODE = _urlParams.get('auto') === 'true';
const AUTO_SCENE = parseInt(_urlParams.get('scene'));
const AUTO_SEED = parseInt(_urlParams.get('seed')) || Date.now();

// Expose renderFrame for Puppeteer offline capture
window.renderFrame = function () {
  redraw();
};
window.isReady = false;
window.soundEvents = []; // Collect sound events for offline audio synthesis

// ======================== SETUP ========================
function setup() {
  let canvas = createCanvas(W, H);
  canvas.style('max-height', '100vh');
  canvas.style('width', 'auto');
  frameRate(60);
  pixelDensity(1);
  colorMode(HSB, 360, 100, 100, 100);

  // Initialize all scenes
  scenes = [
    new ColorSortingBalls(),
    new SpiralSatisfaction(),
    new LiquidFill(),
    new ParticleVortex(),
    new PendulumWave(),
    new GravityBalls()
  ];

  // Auto mode: headless rendering for CI video generation
  if (AUTO_MODE) {
    const controls = document.getElementById('controls');
    if (controls) controls.style.display = 'none';
    randomSeed(AUTO_SEED);
    // CSS hue-rotate gives each video a unique color palette
    let hueRotation = AUTO_SEED % 360;
    canvas.elt.style.filter = 'hue-rotate(' + hueRotation + 'deg) saturate(' + (0.9 + (AUTO_SEED % 30) / 100) + ')';
    let sceneIdx = isNaN(AUTO_SCENE) ? Math.floor(Math.random() * totalScenes) : AUTO_SCENE;
    switchScene(sceneIdx);
    noLoop(); // Frames rendered on-demand via window.renderFrame()
  } else {
    scenes[currentScene].init();
    updateButtons();
  }

  window.isReady = true;
}

// ======================== DRAW ========================
function draw() {
  scenes[currentScene].update();
  scenes[currentScene].display();
  sceneTimer++;
}

// ======================== AUDIO SYSTEM ========================
// Harmonious pentatonic scale (C3 to G6)
const AUDIO_SCALE = [
  130.81, 146.83, 164.81, 196.00, 220.00,
  261.63, 293.66, 329.63, 392.00, 440.00,
  523.25, 587.33, 659.25, 783.99, 880.00,
  1046.50, 1174.66, 1318.51, 1567.98
];

let webAudioCtx = null;

function getAudioCtx() {
  if (AUTO_MODE) return null;
  if (!webAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      webAudioCtx = new AudioContextClass();
    }
  }
  if (webAudioCtx && webAudioCtx.state === 'suspended') {
    webAudioCtx.resume();
  }
  return webAudioCtx;
}

// Auto unlock audio on any interaction
if (typeof window !== 'undefined') {
  ['click', 'touchstart', 'keydown'].forEach(evt => {
    window.addEventListener(evt, () => getAudioCtx(), { passive: true });
  });
}

function playPop(pitch, x) {
  if (AUTO_MODE) {
    window.soundEvents.push({ frame: sceneTimer, type: 'pop', pitch: pitch, x: x });
    return;
  }
  const ctx = getAudioCtx();
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  const f0 = AUDIO_SCALE[Math.abs(Math.floor(pitch || 0)) % AUDIO_SCALE.length];

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(f0 * 1.6, now);
  osc.frequency.exponentialRampToValueAtTime(f0, now + 0.015);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.45, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

  if (ctx.createStereoPanner && typeof x === 'number') {
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-0.8, Math.min(0.8, ((x / W) - 0.5) * 1.2));
    osc.connect(gain);
    gain.connect(pan);
    pan.connect(ctx.destination);
  } else {
    osc.connect(gain);
    gain.connect(ctx.destination);
  }

  osc.start(now);
  osc.stop(now + 0.22);
}

function playClick(x) {
  if (AUTO_MODE) {
    window.soundEvents.push({ frame: sceneTimer, type: 'click', pitch: 0, x: x });
    return;
  }
  const ctx = getAudioCtx();
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1500, now);
  osc.frequency.exponentialRampToValueAtTime(750, now + 0.025);

  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

  if (ctx.createStereoPanner && typeof x === 'number') {
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-0.8, Math.min(0.8, ((x / W) - 0.5) * 1.2));
    osc.connect(gain);
    gain.connect(pan);
    pan.connect(ctx.destination);
  } else {
    osc.connect(gain);
    gain.connect(ctx.destination);
  }

  osc.start(now);
  osc.stop(now + 0.045);
}

function playSwoosh(pitch, x) {
  if (AUTO_MODE) {
    window.soundEvents.push({ frame: sceneTimer, type: 'swoosh', pitch: pitch, x: x });
    return;
  }
  const ctx = getAudioCtx();
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  const f0 = AUDIO_SCALE[Math.abs(Math.floor(pitch || 0)) % AUDIO_SCALE.length];

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f0 * 0.8, now);
  osc.frequency.linearRampToValueAtTime(f0 * 1.3, now + 0.2);
  osc.frequency.linearRampToValueAtTime(f0 * 0.9, now + 0.4);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.28, now + 0.18);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

  if (ctx.createStereoPanner && typeof x === 'number') {
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-0.8, Math.min(0.8, ((x / W) - 0.5) * 1.2));
    osc.connect(gain);
    gain.connect(pan);
    pan.connect(ctx.destination);
  } else {
    osc.connect(gain);
    gain.connect(ctx.destination);
  }

  osc.start(now);
  osc.stop(now + 0.45);
}

function playDeep(pitch, x) {
  if (AUTO_MODE) {
    window.soundEvents.push({ frame: sceneTimer, type: 'deep', pitch: pitch, x: x });
    return;
  }
  const ctx = getAudioCtx();
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  const f0 = AUDIO_SCALE[Math.abs(Math.floor(pitch || 0)) % AUDIO_SCALE.length] * 0.5;

  [1.0, 1.498, 2.0].forEach((mult, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = idx === 0 ? 'triangle' : 'sine';
    osc.frequency.value = f0 * mult;

    const vol = idx === 0 ? 0.42 : 0.22;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.3);
  });
}

// ======================== SCENE MANAGEMENT ========================
function switchScene(index) {
  currentScene = index % totalScenes;
  sceneTimer = 0;
  scenes[currentScene].init();
  updateButtons();
}

function updateButtons() {
  for (let i = 0; i < totalScenes; i++) {
    let btn = document.getElementById('btn-' + i);
    if (btn) btn.classList.toggle('active', i === currentScene);
  }
}

function keyPressed() {
  if (key === ' ') {
    switchScene(currentScene + 1);
  } else if (key === 'r' || key === 'R') {
    scenes[currentScene].init();
    sceneTimer = 0;
  } else if (key === 'h' || key === 'H') {
    controlsVisible = !controlsVisible;
    document.getElementById('controls').style.opacity = controlsVisible ? '1' : '0';
    document.getElementById('controls').style.pointerEvents = controlsVisible ? 'auto' : 'none';
  }
}

// ======================== UTILITIES ========================
function drawBackground(h, s, b) {
  background(h, s, b);
  // Subtle vignette
  noStroke();
  for (let i = 0; i < 15; i++) {
    let a = map(i, 0, 15, 0, 8);
    fill(0, 0, 0, a);
    let inset = map(i, 0, 15, 0, 200);
    rect(inset, inset, W - inset * 2, H - inset * 2, 20);
  }
}

function easeOutBounce(t) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  else if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  else if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  else return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

function easeOutElastic(t) {
  if (t === 0 || t === 1) return t;
  return pow(2, -10 * t) * sin((t - 0.075) * (2 * PI) / 0.3) + 1;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
  return 1 - pow(1 - t, 3);
}


// ============================================================
//  SCENE 1: COLOR SORTING BALLS
// ============================================================
class ColorSortingBalls {
  constructor() {
    this.balls = [];
    this.buckets = [];
    this.numColors = 6;
  }

  init() {
    this.balls = [];
    this.buckets = [];

    let bucketW = W / this.numColors;
    let hues = [0, 30, 60, 140, 220, 280]; // red, orange, yellow, green, blue, purple

    // Create buckets
    for (let i = 0; i < this.numColors; i++) {
      this.buckets.push({
        x: i * bucketW + bucketW / 2,
        y: H - 250,
        w: bucketW - 16,
        h: 450,
        hue: hues[i],
        fillLevel: 0,
        balls: []
      });
    }

    // Create balls in shuffled order
    for (let wave = 0; wave < 8; wave++) {
      for (let i = 0; i < this.numColors; i++) {
        let colorIdx = i;
        let ball = {
          x: random(100, W - 100),
          y: -random(50, 200) - wave * 350,
          targetX: 0,
          targetY: 0,
          r: bucketW / 2 - 16,
          hue: hues[colorIdx],
          colorIdx: colorIdx,
          vy: 0,
          vx: 0,
          state: 'falling', // falling, sorting, settled
          settled: false,
          sortDelay: (wave * this.numColors + i) * 18,
          sortTimer: 0,
          bounceCount: 0
        };
        this.balls.push(ball);
      }
    }

    // Shuffle balls
    for (let i = this.balls.length - 1; i > 0; i--) {
      let j = Math.floor(random(i + 1));
      [this.balls[i], this.balls[j]] = [this.balls[j], this.balls[i]];
    }

    // Reassign delays after shuffle
    for (let i = 0; i < this.balls.length; i++) {
      this.balls[i].sortDelay = i * 12;
      this.balls[i].y = -random(50, 300) - Math.floor(i / this.numColors) * 250;
    }
  }

  update() {
    let gravity = 0.6;

    for (let ball of this.balls) {
      if (ball.state === 'falling') {
        ball.vy += gravity;
        ball.y += ball.vy;

        // Find target bucket
        let bucket = this.buckets[ball.colorIdx];
        let bucketTop = bucket.y;

        if (ball.y + ball.r >= bucketTop + bucket.h - bucket.fillLevel * (ball.r * 2 + 4) - ball.r) {
          ball.y = bucketTop + bucket.h - bucket.fillLevel * (ball.r * 2 + 4) - ball.r;

          if (Math.abs(ball.x - bucket.x) < bucket.w / 2) {
            // In correct bucket
            ball.state = 'settled';
            ball.vy = 0;
            bucket.fillLevel++;
            ball.x = bucket.x;
            playPop(ball.colorIdx, ball.x);
          } else {
            // Bounce
            ball.vy *= -0.5;
            ball.bounceCount++;
            if (ball.bounceCount > 2) {
              // Guide to bucket
              ball.state = 'sorting';
              ball.sortTimer = 0;
              ball.targetX = bucket.x;
              ball.targetY = bucket.y + bucket.h - bucket.fillLevel * (ball.r * 2 + 4) - ball.r;
            }
            playClick(ball.x);
          }
        }

        // Gentle drift toward bucket
        let bucket2 = this.buckets[ball.colorIdx];
        ball.vx += (bucket2.x - ball.x) * 0.003;
        ball.x += ball.vx;
        ball.vx *= 0.98;

      } else if (ball.state === 'sorting') {
        ball.sortTimer++;
        let t = constrain(ball.sortTimer / 40, 0, 1);
        t = easeOutCubic(t);
        let bucket = this.buckets[ball.colorIdx];
        ball.targetY = bucket.y + bucket.h - bucket.fillLevel * (ball.r * 2 + 4) - ball.r;
        ball.x = lerp(ball.x, bucket.x, t * 0.15);
        ball.y = lerp(ball.y, ball.targetY, t * 0.15);

        if (dist(ball.x, ball.y, bucket.x, ball.targetY) < 3) {
          ball.state = 'settled';
          ball.x = bucket.x;
          ball.y = ball.targetY;
          bucket.fillLevel++;
          playPop(ball.colorIdx, ball.x);
        }
      }
    }

    // Seamless loop: when all balls have settled, trigger completion chime and launch fresh wave
    const allSettled = this.balls.length > 0 && this.balls.every(b => b.state === 'settled');
    if (allSettled) {
      this.settleTimer = (this.settleTimer || 0) + 1;
      if (this.settleTimer > 45) {
        playDeep(0, W / 2);
        this.settleTimer = 0;
        this.init();
      }
    }
  }

  display() {
    drawBackground(230, 15, 12);

    // Draw buckets
    for (let bucket of this.buckets) {
      // Bucket glow
      noStroke();
      fill(bucket.hue, 60, 50, 10);
      rect(bucket.x - bucket.w / 2 - 10, bucket.y - 10, bucket.w + 20, bucket.h + 30, 20);

      // Bucket body
      stroke(bucket.hue, 40, 40);
      strokeWeight(3);
      fill(bucket.hue, 20, 15, 60);
      rect(bucket.x - bucket.w / 2, bucket.y, bucket.w, bucket.h, 0, 0, 16, 16);

      // Bucket rim
      noStroke();
      fill(bucket.hue, 50, 60);
      rect(bucket.x - bucket.w / 2 - 6, bucket.y - 8, bucket.w + 12, 16, 8);
    }

    // Draw balls
    for (let ball of this.balls) {
      if (ball.y < -ball.r * 2) continue;

      // Shadow
      noStroke();
      fill(0, 0, 0, 20);
      ellipse(ball.x + 4, ball.y + 4, ball.r * 2, ball.r * 2);

      // Ball
      fill(ball.hue, 75, 85);
      ellipse(ball.x, ball.y, ball.r * 2, ball.r * 2);

      // Highlight
      fill(ball.hue, 30, 100, 50);
      ellipse(ball.x - ball.r * 0.25, ball.y - ball.r * 0.25, ball.r * 0.8, ball.r * 0.8);

      // Shine
      fill(0, 0, 100, 30);
      ellipse(ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, ball.r * 0.4, ball.r * 0.3);
    }

    // Title
    this.drawTitle("Color Sorting");
  }

  drawTitle(text) {
    push();
    noStroke();
    fill(0, 0, 100, 60);
    textAlign(CENTER, TOP);
    textSize(52);
    textStyle(BOLD);
    text(text, W / 2, 60);
    pop();
  }
}


// ============================================================
//  SCENE 2: SPIRAL SATISFACTION
// ============================================================
class SpiralSatisfaction {
  constructor() {
    this.dots = [];
    this.numArms = 8;
    this.dotsPerArm = 30;
  }

  init() {
    this.dots = [];
    for (let arm = 0; arm < this.numArms; arm++) {
      for (let i = 0; i < this.dotsPerArm; i++) {
        this.dots.push({
          arm: arm,
          index: i,
          baseAngle: (TWO_PI / this.numArms) * arm,
          radius: map(i, 0, this.dotsPerArm, 40, 420),
          size: map(i, 0, this.dotsPerArm, 14, 40),
          hue: (arm * (360 / this.numArms) + i * 4) % 360,
          phase: i * 0.15
        });
      }
    }
    this.lastSoundFrame = 0;
  }

  update() {
    // Rhythmic musical arpeggio synced to spiral rotation and arm breathing
    if (sceneTimer % 15 === 0 && sceneTimer !== this.lastSoundFrame) {
      this.lastSoundFrame = sceneTimer;
      let beat = Math.floor(sceneTimer / 15);
      let note = (beat * 2) % 14;
      let arm = beat % this.numArms;
      let angle = (TWO_PI / this.numArms) * arm + sceneTimer * 0.02;
      let x = (W / 2) + cos(angle) * 260;
      playPop(note, x);

      if (beat % 16 === 0) {
        playDeep((beat / 16) % 4, W / 2);
      }
    }
  }

  display() {
    // Fading background for trails
    fill(250, 30, 8, 25);
    noStroke();
    rect(0, 0, W, H);

    let cx = W / 2;
    let cy = H / 2;
    let t = sceneTimer * 0.02;

    // Draw connecting lines
    for (let arm = 0; arm < this.numArms; arm++) {
      let armDots = this.dots.filter(d => d.arm === arm);
      stroke(armDots[0].hue, 40, 50, 20);
      strokeWeight(2);
      noFill();
      beginShape();
      for (let dot of armDots) {
        let angle = dot.baseAngle + t + sin(t * 2 + dot.phase) * 0.3;
        let r = dot.radius + sin(t * 3 + dot.phase) * 30;
        let x = cx + cos(angle) * r;
        let y = cy + sin(angle) * r;
        curveVertex(x, y);
      }
      endShape();
    }

    // Draw dots
    noStroke();
    for (let dot of this.dots) {
      let angle = dot.baseAngle + t + sin(t * 2 + dot.phase) * 0.3;
      let r = dot.radius + sin(t * 3 + dot.phase) * 30;
      let x = cx + cos(angle) * r;
      let y = cy + sin(angle) * r;

      // Glow
      fill(dot.hue, 70, 80, 15);
      ellipse(x, y, dot.size * 2.5);

      // Dot
      fill(dot.hue, 65, 90);
      ellipse(x, y, dot.size);

      // Inner shine
      fill(dot.hue, 20, 100, 50);
      ellipse(x - dot.size * 0.15, y - dot.size * 0.15, dot.size * 0.4);
    }

    // Center glow
    for (let i = 5; i > 0; i--) {
      fill((t * 30) % 360, 50, 80, 5);
      ellipse(cx, cy, i * 80);
    }
  }
}


// ============================================================
//  SCENE 3: LIQUID FILL
// ============================================================
class LiquidFill {
  constructor() {
    this.shapes = [];
    this.currentShape = 0;
    this.fillProgress = 0;
  }

  init() {
    this.shapes = [];
    this.currentShape = 0;
    this.fillProgress = 0;

    let shapeTypes = ['circle', 'square', 'triangle', 'star', 'heart', 'hexagon'];
    let hues = [350, 30, 55, 160, 220, 280];

    for (let i = 0; i < shapeTypes.length; i++) {
      this.shapes.push({
        type: shapeTypes[i],
        x: W / 2,
        y: H / 2,
        size: 350,
        hue: hues[i],
        fillAmount: 0,
        filled: false,
        particles: []
      });
    }
  }

  update() {
    if (this.currentShape >= this.shapes.length) {
      this.currentShape = 0;
    }

    let shape = this.shapes[this.currentShape];
    shape.fillAmount += 0.008;

    // Sound on progress milestones: ascending scale as liquid level rises
    let currentStep = Math.floor(shape.fillAmount * 25);
    let prevStep = Math.floor((shape.fillAmount - 0.008) * 25);
    if (currentStep > prevStep && currentStep <= 25) {
      playPop(currentStep % 16, shape.x + random(-40, 40));
    }

    // Add particles
    if (shape.fillAmount < 1 && sceneTimer % 3 === 0) {
      shape.particles.push({
        x: shape.x + random(-10, 10),
        y: shape.y - shape.size / 2,
        vx: random(-2, 2),
        vy: random(1, 4),
        size: random(4, 10),
        life: 1
      });
    }

    // Update particles
    for (let p of shape.particles) {
      p.x += p.vx;
      p.vy += 0.2;
      p.y += p.vy;
      p.life -= 0.015;
    }
    shape.particles = shape.particles.filter(p => p.life > 0 && p.y < H);

    if (shape.fillAmount >= 1.25) {
      shape.filled = true;
      playDeep(this.currentShape, shape.x);
      this.currentShape = (this.currentShape + 1) % this.shapes.length;
      this.shapes[this.currentShape].fillAmount = 0;
      this.shapes[this.currentShape].particles = [];
      this.fillProgress = 0;
    }
  }

  display() {
    drawBackground(240, 20, 10);

    if (this.currentShape >= this.shapes.length) return;

    let shape = this.shapes[this.currentShape];
    let fillAmt = constrain(shape.fillAmount, 0, 1);
    let cx = shape.x;
    let cy = shape.y;
    let sz = shape.size;

    // Draw shape outline
    push();
    noFill();
    stroke(shape.hue, 50, 70, 60);
    strokeWeight(4);
    this.drawShapeOutline(shape.type, cx, cy, sz);
    pop();

    // Draw liquid fill using clipping
    push();
    // Draw filled portion
    let liquidTop = cy + sz / 2 - fillAmt * sz;
    let waveAmp = 12;
    let waveFreq = 0.015;

    // Liquid body with wave
    noStroke();
    fill(shape.hue, 70, 75, 80);

    beginShape();
    for (let x = cx - sz / 2 - 20; x <= cx + sz / 2 + 20; x += 4) {
      let waveY = liquidTop + sin(x * waveFreq + sceneTimer * 0.08) * waveAmp;
      vertex(x, waveY);
    }
    vertex(cx + sz / 2 + 20, cy + sz / 2 + 20);
    vertex(cx - sz / 2 - 20, cy + sz / 2 + 20);
    endShape(CLOSE);

    // Wave highlight
    fill(shape.hue, 40, 90, 30);
    beginShape();
    for (let x = cx - sz / 2 - 20; x <= cx + sz / 2 + 20; x += 4) {
      let waveY = liquidTop + sin(x * waveFreq + sceneTimer * 0.08) * waveAmp;
      vertex(x, waveY);
    }
    for (let x = cx + sz / 2 + 20; x >= cx - sz / 2 - 20; x -= 4) {
      let waveY = liquidTop + sin(x * waveFreq + sceneTimer * 0.08) * waveAmp + 15;
      vertex(x, waveY);
    }
    endShape(CLOSE);
    pop();

    // Particles
    noStroke();
    for (let p of shape.particles) {
      fill(shape.hue, 60, 90, p.life * 60);
      ellipse(p.x, p.y, p.size);
    }

    // Percentage text
    push();
    fill(0, 0, 100, 80);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(80);
    textStyle(BOLD);
    text(Math.floor(fillAmt * 100) + '%', cx, cy - sz / 2 - 80);

    // Shape label
    textSize(36);
    fill(0, 0, 100, 40);
    textStyle(NORMAL);
    text(shape.type.toUpperCase(), cx, cy + sz / 2 + 70);
    pop();

    // Progress dots
    this.drawProgress();
  }

  drawShapeOutline(type, x, y, s) {
    switch (type) {
      case 'circle':
        ellipse(x, y, s, s);
        break;
      case 'square':
        rectMode(CENTER);
        rect(x, y, s, s, 16);
        break;
      case 'triangle':
        triangle(x, y - s / 2, x - s / 2, y + s / 2, x + s / 2, y + s / 2);
        break;
      case 'star':
        this.drawStar(x, y, s / 4, s / 2, 5);
        break;
      case 'heart':
        this.drawHeart(x, y, s);
        break;
      case 'hexagon':
        this.drawPolygon(x, y, s / 2, 6);
        break;
    }
  }

  drawStar(x, y, r1, r2, n) {
    beginShape();
    for (let i = 0; i < n * 2; i++) {
      let angle = (i * PI / n) - HALF_PI;
      let r = i % 2 === 0 ? r2 : r1;
      vertex(x + cos(angle) * r, y + sin(angle) * r);
    }
    endShape(CLOSE);
  }

  drawHeart(x, y, s) {
    beginShape();
    for (let a = 0; a < TWO_PI; a += 0.05) {
      let r = s / 2;
      let px = r * 0.7 * (16 * pow(sin(a), 3));
      let py = -r * 0.7 * (13 * cos(a) - 5 * cos(2 * a) - 2 * cos(3 * a) - cos(4 * a));
      vertex(x + px / 16, y + py / 16 + 20);
    }
    endShape(CLOSE);
  }

  drawPolygon(x, y, r, n) {
    beginShape();
    for (let i = 0; i < n; i++) {
      let angle = (TWO_PI / n) * i - HALF_PI;
      vertex(x + cos(angle) * r, y + sin(angle) * r);
    }
    endShape(CLOSE);
  }

  drawProgress() {
    let dotSize = 16;
    let spacing = 40;
    let startX = W / 2 - (this.shapes.length - 1) * spacing / 2;
    let y = H - 120;

    noStroke();
    for (let i = 0; i < this.shapes.length; i++) {
      if (i < this.currentShape) {
        fill(this.shapes[i].hue, 60, 80);
      } else if (i === this.currentShape) {
        fill(this.shapes[i].hue, 70, 90);
        ellipse(startX + i * spacing, y, dotSize + 8);
        fill(0, 0, 100, 50);
      } else {
        fill(0, 0, 40, 40);
      }
      ellipse(startX + i * spacing, y, dotSize);
    }
  }
}


// ============================================================
//  SCENE 4: PARTICLE VORTEX
// ============================================================
class ParticleVortex {
  constructor() {
    this.particles = [];
    this.numParticles = 600;
  }

  init() {
    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push({
        angle: random(TWO_PI),
        radius: random(50, 500),
        targetRadius: random(50, 450),
        speed: random(0.005, 0.025),
        size: random(3, 10),
        hue: random(360),
        baseHue: random(360),
        trail: [],
        trailLen: Math.floor(random(5, 20)),
        orbitSpeed: random(0.01, 0.04),
        wobble: random(10, 50)
      });
    }
  }

  update() {
    for (let p of this.particles) {
      p.angle += p.speed;
      p.hue = (p.baseHue + sceneTimer * 0.5) % 360;

      // Breathing radius
      p.radius = p.targetRadius + sin(sceneTimer * 0.02 + p.angle * 2) * p.wobble;

      let x = W / 2 + cos(p.angle) * p.radius;
      let y = H / 2 + sin(p.angle) * p.radius;

      p.trail.unshift({ x, y });
      if (p.trail.length > p.trailLen) p.trail.pop();
    }

    // Interactive vortex soundscape: swooshes, chime sparkles, and resonant core pulses
    if (sceneTimer % 45 === 0) {
      let step = Math.floor(sceneTimer / 45);
      let xPan = (step % 2 === 0) ? W * 0.25 : W * 0.75;
      playSwoosh(step % 4, xPan);
    }
    if (sceneTimer % 20 === 0) {
      let step = Math.floor(sceneTimer / 20);
      let note = (step * 3) % 14;
      let sparkleX = W / 2 + sin(sceneTimer * 0.04) * 240;
      playPop(note, sparkleX);
    }
    if (sceneTimer % 180 === 0) {
      playDeep(Math.floor(sceneTimer / 180) % 4, W / 2);
    }
  }

  display() {
    // Dark fade
    fill(260, 30, 6, 20);
    noStroke();
    rect(0, 0, W, H);

    // Center glow
    let cx = W / 2;
    let cy = H / 2;
    for (let i = 8; i > 0; i--) {
      fill((sceneTimer * 0.8) % 360, 60, 60, 3);
      ellipse(cx, cy, i * 120);
    }

    // Draw particles with trails
    noStroke();
    for (let p of this.particles) {
      for (let i = 0; i < p.trail.length; i++) {
        let t = p.trail[i];
        let alpha = map(i, 0, p.trail.length, 70, 0);
        let sz = map(i, 0, p.trail.length, p.size, p.size * 0.3);
        fill(p.hue, 70, 85, alpha);
        ellipse(t.x, t.y, sz);
      }
    }

    // Center bright core
    fill(0, 0, 100, 20);
    ellipse(cx, cy, 30 + sin(sceneTimer * 0.05) * 10);
  }
}


// ============================================================
//  SCENE 5: PENDULUM WAVE
// ============================================================
class PendulumWave {
  constructor() {
    this.pendulums = [];
    this.numPendulums = 24;
  }

  init() {
    this.pendulums = [];
    for (let i = 0; i < this.numPendulums; i++) {
      this.pendulums.push({
        x: map(i, 0, this.numPendulums - 1, 120, W - 120),
        length: map(i, 0, this.numPendulums - 1, 250, 700),
        angle: 0,
        prevAngle: 0,
        frequency: map(i, 0, this.numPendulums - 1, 0.03, 0.07),
        amplitude: PI / 3.5,
        hue: map(i, 0, this.numPendulums - 1, 0, 300),
        size: 36,
        trail: [],
        lastSoundTrigger: -100
      });
    }
  }

  update() {
    for (let i = 0; i < this.pendulums.length; i++) {
      let p = this.pendulums[i];
      let prev = p.angle;
      p.prevAngle = prev;
      p.angle = sin(sceneTimer * p.frequency) * p.amplitude;

      let bx = p.x + sin(p.angle) * p.length;
      let by = 80 + cos(p.angle) * p.length;

      p.trail.unshift({ x: bx, y: by });
      if (p.trail.length > 12) p.trail.pop();

      // Zero crossing: each pendulum plays its tuned note as it sweeps through center!
      if (((prev < 0 && p.angle >= 0) || (prev > 0 && p.angle <= 0)) && (sceneTimer - p.lastSoundTrigger > 8)) {
        p.lastSoundTrigger = sceneTimer;
        playPop(i % 16, bx);
      }
    }
  }

  display() {
    drawBackground(230, 20, 8);

    // Top bar
    noStroke();
    fill(0, 0, 25);
    rect(60, 60, W - 120, 24, 12);

    // Glow on top bar
    fill(200, 30, 50, 20);
    rect(60, 60, W - 120, 24, 12);

    for (let p of this.pendulums) {
      let bx = p.x + sin(p.angle) * p.length;
      let by = 80 + cos(p.angle) * p.length;

      // String
      stroke(0, 0, 50, 30);
      strokeWeight(2);
      line(p.x, 72, bx, by);

      // Trail glow
      noStroke();
      for (let i = 0; i < p.trail.length; i++) {
        let t = p.trail[i];
        let alpha = map(i, 0, p.trail.length, 35, 0);
        fill(p.hue, 60, 80, alpha);
        let sz = map(i, 0, p.trail.length, p.size, p.size * 0.4);
        ellipse(t.x, t.y, sz);
      }

      // Ball shadow
      fill(0, 0, 0, 15);
      ellipse(bx + 3, by + 3, p.size);

      // Ball
      fill(p.hue, 65, 85);
      ellipse(bx, by, p.size);

      // Highlight
      fill(p.hue, 25, 100, 45);
      ellipse(bx - p.size * 0.15, by - p.size * 0.15, p.size * 0.35);
    }
  }
}


// ============================================================
//  SCENE 6: GRAVITY BALLS
// ============================================================
class GravityBalls {
  constructor() {
    this.balls = [];
    this.platforms = [];
    this.spawnTimer = 0;
    this.maxBalls = 80;
  }

  init() {
    this.balls = [];
    this.platforms = [];
    this.spawnTimer = 0;

    // Create zigzag platforms
    let numPlatforms = 12;
    for (let i = 0; i < numPlatforms; i++) {
      let isLeft = i % 2 === 0;
      this.platforms.push({
        x: isLeft ? 140 : W - 140,
        y: 250 + i * 130,
        w: 500,
        angle: isLeft ? 0.2 : -0.2,
        hue: map(i, 0, numPlatforms, 180, 340)
      });
    }
  }

  update() {
    this.spawnTimer++;

    // Spawn new ball
    if (this.spawnTimer % 20 === 0 && this.balls.length < this.maxBalls) {
      let hues = [0, 30, 55, 160, 220, 280, 310];
      this.balls.push({
        x: W / 2 + random(-50, 50),
        y: -20,
        vx: random(-1, 1),
        vy: 0,
        r: random(14, 26),
        hue: hues[Math.floor(random(hues.length))],
        bounces: 0,
        trail: []
      });
    }

    let gravity = 0.45;

    for (let ball of this.balls) {
      ball.vy += gravity;
      ball.x += ball.vx;
      ball.y += ball.vy;

      // Trail
      ball.trail.unshift({ x: ball.x, y: ball.y });
      if (ball.trail.length > 8) ball.trail.pop();

      // Wall bounce
      // Wall bounce
      if (ball.x < ball.r) { 
        ball.x = ball.r; 
        ball.vx *= -0.8; 
        playClick(ball.x);
      }
      if (ball.x > W - ball.r) { 
        ball.x = W - ball.r; 
        ball.vx *= -0.8; 
        playClick(ball.x);
      }

      // Platform collision
      for (let pIdx = 0; pIdx < this.platforms.length; pIdx++) {
        let plat = this.platforms[pIdx];
        let px1 = plat.x - (plat.w / 2) * cos(plat.angle);
        let py1 = plat.y - (plat.w / 2) * sin(plat.angle);
        let px2 = plat.x + (plat.w / 2) * cos(plat.angle);
        let py2 = plat.y + (plat.w / 2) * sin(plat.angle);

        // Simple platform collision (line segment)
        let platY = map(ball.x, px1, px2, py1, py2);

        if (ball.x > min(px1, px2) && ball.x < max(px1, px2)) {
          if (ball.y + ball.r > platY - 8 && ball.y + ball.r < platY + 20 && ball.vy > 0) {
            ball.y = platY - ball.r - 8;
            ball.vy *= -0.7;
            ball.vx += plat.angle * 6;
            ball.bounces++;
            // Each platform tier plays a tuned note down the musical ladder
            playPop((12 - pIdx) % 14, ball.x);
          }
        }
      }
    }

    // Remove balls that fell off screen
    this.balls = this.balls.filter(b => b.y < H + 50);
  }

  display() {
    drawBackground(220, 25, 8);

    // Draw platforms
    for (let plat of this.platforms) {
      push();
      translate(plat.x, plat.y);
      rotate(plat.angle);

      // Platform glow
      noStroke();
      fill(plat.hue, 40, 50, 15);
      rect(-plat.w / 2 - 8, -14, plat.w + 16, 28, 14);

      // Platform body
      fill(plat.hue, 35, 30);
      rect(-plat.w / 2, -8, plat.w, 16, 8);

      // Platform shine
      fill(plat.hue, 25, 45, 50);
      rect(-plat.w / 2 + 10, -6, plat.w - 20, 5, 3);
      pop();
    }

    // Draw balls
    noStroke();
    for (let ball of this.balls) {
      // Trail
      for (let i = 0; i < ball.trail.length; i++) {
        let t = ball.trail[i];
        let alpha = map(i, 0, ball.trail.length, 30, 0);
        let sz = map(i, 0, ball.trail.length, ball.r * 2, ball.r * 0.5);
        fill(ball.hue, 60, 80, alpha);
        ellipse(t.x, t.y, sz);
      }

      // Shadow
      fill(0, 0, 0, 20);
      ellipse(ball.x + 3, ball.y + 3, ball.r * 2);

      // Ball
      fill(ball.hue, 70, 88);
      ellipse(ball.x, ball.y, ball.r * 2);

      // Highlight
      fill(ball.hue, 30, 100, 50);
      ellipse(ball.x - ball.r * 0.25, ball.y - ball.r * 0.25, ball.r * 0.7);

      // Shine dot
      fill(0, 0, 100, 35);
      ellipse(ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, ball.r * 0.35);
    }

    // Spawn indicator
    push();
    noStroke();
    fill((sceneTimer * 2) % 360, 50, 70, 30 + sin(sceneTimer * 0.1) * 20);
    ellipse(W / 2, 30, 40 + sin(sceneTimer * 0.1) * 10);
    fill(0, 0, 100, 60);
    triangle(W / 2 - 8, 22, W / 2 + 8, 22, W / 2, 38);
    pop();
  }
}
