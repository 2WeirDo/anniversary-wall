/**
 * Star Theater v3.1 — 指尖星图 · 星座收集
 *
 * 设计：「星座拼图」
 * - 狮子座（他 / 12 颗）与天蝎座（她 / 12 颗）
 * - 每个星座背后有星云雾状底图，清晰勾勒星座形态
 * - 指尖划过点亮星点，全部点亮后汇聚成心 + 金色粒子爆发
 * - 无文字提示、无引导线、无 HTML 爱心覆盖层
 */

/* ---- 心形参数方程（32 个采样点）---- */
function heartXY(t) {
  const a = t * Math.PI * 2;
  return {
    x: 16 * Math.pow(Math.sin(a), 3),
    y: -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)),
  };
}
const TOTAL_STARS = 32;
const HEART_SAMPLES = Array.from({ length: TOTAL_STARS }, (_, i) => heartXY(i / TOTAL_STARS));

/* ---- 终章书法路径：W (cursive handwriting) ---- */
const W_CURSIVE_PATH = [
  ['M', -1.35,  0.25],
  ['Q', -1.20, -0.10, -1.05, -0.55],
  ['Q', -0.90, -0.92, -0.60, -0.88],
  ['Q', -0.40, -0.85, -0.25, -0.15],
  ['Q', -0.12,  0.20, -0.15,  0.22],
  ['Q', -0.05,  0.05,  0.08, -0.55],
  ['Q',  0.18, -0.90,  0.20, -0.88],
  ['Q',  0.22, -0.85,  0.35, -0.05],
  ['Q',  0.42,  0.20,  0.42,  0.22],
  ['Q',  0.50,  0.05,  0.65, -0.60],
  ['Q',  0.75, -0.90,  0.78, -0.88],
  ['Q',  0.82, -0.85,  0.98,  0.05],
  ['Q',  1.08,  0.22,  1.10,  0.18],
  ['Q',  1.18, -0.05,  1.30, -0.22],
  ['Q',  1.38, -0.35,  1.34, -0.42],
];

/* ---- 终章书法路径：Y (cursive handwriting) ---- */
const Y_CURSIVE_PATH = [
  ['M', -0.70, -0.92],
  ['Q', -0.50, -0.75, -0.28, -0.45],
  ['Q', -0.10, -0.15,  0.00,  0.08],
  ['Q',  0.08,  0.22,  0.12,  0.15],
  ['Q',  0.18, -0.20,  0.22, -0.55],
  ['Q',  0.28, -0.82,  0.42, -0.88],
  ['Q',  0.38, -0.70,  0.28, -0.25],
  ['Q',  0.18,  0.08,  0.05,  0.15],
  ['Q', -0.08,  0.30, -0.12,  0.48],
  ['Q', -0.15,  0.52, -0.12,  0.50],
  ['Q', -0.02,  0.42, -0.02,  0.32],
];

/** 估算路径总长度（归一化坐标） */
function pathLength(pathData) {
  let len = 0;
  let px = 0, py = 0;
  for (const seg of pathData) {
    const [cmd, ...args] = seg;
    if (cmd === 'M') {
      px = args[args.length - 2];
      py = args[args.length - 1];
    } else {
      // Q: 用控制点-终点弦长近似
      const cpx = args[0], cpy = args[1], ex = args[2], ey = args[3];
      len += Math.hypot(cpx - px, cpy - py) + Math.hypot(ex - cpx, ey - cpy);
      px = ex; py = ey;
    }
  }
  return len;
}

/** 获取路径上 t (0~1) 位置的点 */
function pointOnPath(pathData, t) {
  const total = pathLength(pathData);
  if (t <= 0) return { x: pathData[0][1], y: pathData[0][2] };
  if (t >= 1) { const last = pathData[pathData.length - 1]; return { x: last[last.length - 2], y: last[last.length - 1] }; }
  let acc = 0;
  let px = pathData[0][1], py = pathData[0][2];
  for (let i = 1; i < pathData.length; i++) {
    const seg = pathData[i];
    const cpx = seg[1], cpy = seg[2], ex = seg[3], ey = seg[4];
    const segLen = Math.hypot(cpx - px, cpy - py) + Math.hypot(ex - cpx, ey - cpy);
    if (acc + segLen >= t * total) {
      const localT = (t * total - acc) / segLen;
      // 二次贝塞尔插值
      const mt = 1 - localT;
      return {
        x: mt * mt * px + 2 * mt * localT * cpx + localT * localT * ex,
        y: mt * mt * py + 2 * mt * localT * cpy + localT * localT * ey,
      };
    }
    acc += segLen;
    px = ex; py = ey;
  }
  return { x: px, y: py };
}

/** heartbeat 缩放（匹配 CSS @keyframes heartbeat, 0.56s 周期） */
function heartbeatScale(ts) {
  const period = 560; // ms
  const phase = (ts % period) / period; // 0..1
  if (phase < 0.14) return 1 + 0.18 * (phase / 0.14);           // 1 → 1.18
  if (phase < 0.28) return 1.18 - 0.18 * ((phase - 0.14) / 0.14); // 1.18 → 1
  if (phase < 0.42) return 1 + 0.10 * ((phase - 0.28) / 0.14);   // 1 → 1.10
  if (phase < 0.56) return 1.10 - 0.10 * ((phase - 0.42) / 0.14); // 1.10 → 1
  return 1;
}

const W_PATH_LEN = pathLength(W_CURSIVE_PATH);
const Y_PATH_LEN = pathLength(Y_CURSIVE_PATH);

/* ================================================================
   星座数据 — 狮子座 & 天蝎座（各 16 颗，共 32 颗）
   狮子座：侧身剪影朝右 — 圆形鬃毛→身躯→四肢→尾尖毛簇
   天蝎座：螯钳朝上张开 — 头部→身体纵轴→尾钩向左弯→毒刺
   ================================================================ */

// 狮子座 (Leo) — 16 颗，沿侧身剪影轮廓排布（朝右）
// 轮廓路径：鼻尖→额头→鬃毛顶→鬃毛后→背→臀→尾根→尾尖→后腿→腹→前腿→下颌
const LEO_OFFSETS = [
  // 头部/鬃毛（圆形主体）— 6 颗
  { x:   7, y:  -5 },   // 鼻尖 →
  { x:   4, y:  -8 },   // 额头
  { x:   0, y: -10 },   // 鬃毛顶
  { x:  -4, y:  -6 },   // 鬃毛后
  { x:   5, y:  -2 },   // 下颌
  { x:  -1, y:  -1 },   // 咽喉
  // 身躯 — 3 颗
  { x:  -5, y:   0 },   // 颈背
  { x:  -7, y:   2 },   // 背
  { x:  -8, y:   4 },   // 臀
  // 前腿 — 2 颗
  { x:   2, y:   2 },   // 前肩
  { x:   4, y:   6 },   // 前爪
  // 后腿 — 2 颗
  { x:  -4, y:   5 },   // 后腿根
  { x:  -5, y:   9 },   // 后爪
  // 尾巴 — 3 颗
  { x: -10, y:   2 },   // 尾根
  { x: -11, y:  -2 },   // 尾弯
  { x:  -9, y:  -5 },   // 尾尖毛簇 ↑
];
// 天蝎座 (Scorpio) — 16 颗，螯朝上、身纵下、尾钩左弯
// 轮廓路径：左钳→右钳→头→胸→腹→尾节→尾钩→毒囊→毒刺
const SCORPIO_OFFSETS = [
  // 双螯（顶部张开）— 4 颗
  { x: -10, y: -12 },   // 左钳尖 ↙
  { x:  -3, y:  -9 },   // 左钳根
  { x:   3, y:  -9 },   // 右钳根
  { x:  10, y: -12 },   // 右钳尖 ↘
  // 头部 — 2 颗
  { x:  -2, y:  -6 },   // 头左
  { x:   2, y:  -6 },   // 头右
  // 身体纵轴 — 4 颗
  { x:   0, y:  -2 },   // 胸节
  { x:  -1, y:   2 },   // 腹节1
  { x:   0, y:   5 },   // 腹节2（Antares 区）
  { x:   1, y:   8 },   // 尾根
  // 尾钩左弯 → 毒刺 — 6 颗
  { x:  -2, y:  11 },   // 尾节 ↙
  { x:  -5, y:  10 },   // 弯节 ←
  { x:  -8, y:   6 },   // 钩节 ↖
  { x:  -9, y:   2 },   // 钩顶 ↑
  { x:  -6, y:  -1 },   // 毒囊
  { x:  -9, y:  -2 },   // 毒刺 ← 指向狮子
];
export class StarTheater {
  constructor(containerId) {
    this.el = document.getElementById(containerId);
    if (!this.el) return;

    this.canvas = this.el.querySelector('.star-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    // 进度 UI
    this.progressFill = document.getElementById('star-progress-fill');

    // 设备
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.isMobile = window.matchMedia('(max-width: 768px)').matches;

    // 画布尺寸
    this.w = 0;
    this.h = 0;
    this.cx = 0;
    this.cy = 0;
    this._scale = 0;

    // 星场
    this.bgStars = [];
    this.constellationStars = [];
    this.touchedCount = 0;
    this.totalConstellation = TOTAL_STARS;

    // 触控
    this.pointer = { x: -200, y: -200, active: false };
    this.ripples = [];

    // 状态
    this.phase = 'collect';    // collect | merging | merged | finale
    this._mergeStart = 0;
    this._mergeDuration = 2500;
    this._started = false;

    // 成功庆典粒子
    this.burstParticles = [];
    this._burstSpawned = false;

    // 终章：W / Y 字母 + 中心爱心光晕
    this._finaleStart = 0;
    this._finaleDuration = 3500;
    this._mergedAt = 0;
    // 增强状态
    this._letterWProgress = 0;
    this._letterYProgress = 0;
    this._letterDrawn = false;
    this._heartStartedAt = 0;
    this._heartRings = [];
    this._ringSpawnedThisBeat = false;
    this._embers = [];
    this._nebulaPhase = 0;
    this._breathePhase = 0;

    // 帧
    this._tick = null;

    this.init();
  }

  /* ================================================================
     INIT
     ================================================================ */
  init() {
    this.resize();
    this.buildStarField();
    this.bindEvents();
    this.observe();
    this.loop();

    window.addEventListener('resize', () => {
      this.resize();
      this.buildStarField();
    });
  }

  resize() {
    const r = this.el.getBoundingClientRect();
    this.w = r.width;
    this.h = r.height;
    this.cx = this.w / 2;
    this.cy = this.h * 0.50;
    this._scale = Math.min(this.w, this.h) * 0.018;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  /* ================================================================
     BUILD STAR FIELD
     ================================================================ */
  buildStarField() {
    this.bgStars = [];
    this.constellationStars = [];
    this.burstParticles = [];
    this._burstSpawned = false;
    this.touchedCount = 0;
    this.ripples = [];

    const sc = this._scale;
    const cx = this.cx;
    const cy = this.cy;

    // ---- 背景星 ----
    const N_BG = this.isMobile ? 60 : 120;
    for (let i = 0; i < N_BG; i++) {
      this.bgStars.push({
        x: Math.random() * this.w,
        y: this.h * 0.2 + Math.random() * this.h * 0.8,
        r: 0.3 + Math.random() * 1.6,
        alpha: 0.08 + Math.random() * 0.35,
        twinkle: 0.4 + Math.random() * 2.5,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() < 0.12 ? 'warm' : 'cool',
      });
    }

    // ---- 狮子座（左上）----
    const leoBaseX = cx - sc * 15;
    const leoBaseY = cy + sc * 5;
    for (const off of LEO_OFFSETS) {
      this.constellationStars.push({
        x: leoBaseX + off.x * sc,
        y: leoBaseY + off.y * sc,
        r: 2.5 + Math.random() * 2.5,
        alpha: 0.5 + Math.random() * 0.25,
        twinkle: 0.6 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        color: 'leo',
        touched: false,
        originX: leoBaseX + off.x * sc,
        originY: leoBaseY + off.y * sc,
        targetX: 0, targetY: 0,
        sparkAngle: Math.random() * Math.PI * 2,
      });
    }

    // ---- 天蝎座（右上）----
    const scoBaseX = cx + sc * 15;
    const scoBaseY = cy + sc * 5;
    for (const off of SCORPIO_OFFSETS) {
      this.constellationStars.push({
        x: scoBaseX + off.x * sc,
        y: scoBaseY + off.y * sc,
        r: 2.5 + Math.random() * 2.5,
        alpha: 0.5 + Math.random() * 0.25,
        twinkle: 0.6 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        color: 'scorpio',
        touched: false,
        originX: scoBaseX + off.x * sc,
        originY: scoBaseY + off.y * sc,
        targetX: 0, targetY: 0,
        sparkAngle: Math.random() * Math.PI * 2,
      });
    }

    // ---- 心形目标位置 ----
    const heartScale = sc * 1.1;
    const heartCY = cy + sc * 5;
    for (let i = 0; i < this.constellationStars.length; i++) {
      const hp = HEART_SAMPLES[i];
      this.constellationStars[i].targetX = cx + hp.x * heartScale;
      this.constellationStars[i].targetY = heartCY + hp.y * heartScale;
    }

    // 重置状态
    if (this.phase !== 'collect') {
      this.phase = 'collect';
      this._mergeStart = 0;
      this._burstSpawned = false;
      this._finaleStart = 0;
      this._mergedAt = 0;
      this._letterWProgress = 0;
      this._letterYProgress = 0;
      this._letterDrawn = false;
      this._heartStartedAt = 0;
      this._heartRings = [];
      this._ringSpawnedThisBeat = false;
      this._embers = [];
    }
    this.updateProgressUI();
  }

  /* ================================================================
     EVENTS
     ================================================================ */
  bindEvents() {
    this.canvas.addEventListener('pointermove', (e) => {
      this.pointer.active = true;
      this.pointer.x = e.offsetX;
      this.pointer.y = e.offsetY;
      if (this.phase === 'collect') {
        this.checkTouch(e.offsetX, e.offsetY);
      }
      if (this.ripples.length < 6) {
        this.ripples.push({ x: e.offsetX, y: e.offsetY, r: 0, alpha: 0.45 });
      }
    }, { passive: true });

    this.canvas.addEventListener('pointerleave', () => { this.pointer.active = false; });
    this.canvas.addEventListener('pointerenter', (e) => {
      this.pointer.active = true;
      this.pointer.x = e.offsetX;
      this.pointer.y = e.offsetY;
    });
  }

  checkTouch(px, py) {
    const threshold = this.isMobile ? 50 : 42;
    let anyNew = false;
    for (const s of this.constellationStars) {
      if (s.touched) continue;
      const dx = s.x - px;
      const dy = s.y - py;
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        s.touched = true;
        this.touchedCount++;
        anyNew = true;
        this.ripples.push({ x: s.x, y: s.y, r: s.r * 3, alpha: 0.6 });
      }
    }
    if (anyNew) {
      this.updateProgressUI();
      if (this.touchedCount >= this.totalConstellation) {
        setTimeout(() => this.startMerge(), 600);
      }
    }
  }

  updateProgressUI() {
    if (this.progressFill) {
      this.progressFill.style.width = (this.touchedCount / this.totalConstellation) * 100 + '%';
    }
  }

  /* ================================================================
     SCROLL OBSERVER
     ================================================================ */
  observe() {
    new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !this._started) this._started = true;
    }, { threshold: 0.2 }).observe(this.el);
  }

  /* ================================================================
     MERGE + BURST
     ================================================================ */
  startMerge() {
    if (this.phase !== 'collect') return;
    this.phase = 'merging';
    this._mergeStart = performance.now();
  }

  spawnBurst() {
    if (this._burstSpawned) return;
    this._burstSpawned = true;
    // 心形中心
    const bx = this.cx;
    const by = this.cy + this._scale * 2;
    for (let i = 0; i < 70; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.6 + Math.random() * 5;
      this.burstParticles.push({
        x: bx, y: by,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 2,
        life: 1,
        decay: 0.006 + Math.random() * 0.018,
        r: 1.2 + Math.random() * 3.5,
        color: Math.random() < 0.4 ? [255, 230, 160] : Math.random() < 0.5 ? [255, 200, 130] : [240, 170, 180],
      });
    }
  }

  /* ================================================================
     RENDER LOOP
     ================================================================ */
  loop() {
    const frame = (ts) => {
      this.draw(ts);
      this._tick = requestAnimationFrame(frame);
    };
    this._tick = requestAnimationFrame(frame);
  }

  stop() {
    if (this._tick) { cancelAnimationFrame(this._tick); this._tick = null; }
  }

  draw(ts) {
    const ctx = this.ctx;
    const t = ts * 0.001;

    // 1. 清除画布
    ctx.clearRect(0, 0, this.w, this.h);

    // 2. 星座星云底图
    this.drawConstellationNebula(ctx);

    // 3. 汇聚动画
    if (this.phase === 'merging' || this.phase === 'merged') {
      this.updateMerge(ts);
    }

    // 4. 背景星
    for (const s of this.bgStars) this.drawBgStar(ctx, s, t);

    // 5. 星座星
    for (const s of this.constellationStars) this.drawConstellationStar(ctx, s, t);

    // 6. 光漪
    this.drawRipples(ctx);

    // 7. 金色粒子爆发
    this.drawBurst(ctx);

    // 7b. 终章：W / Y 字母 + 中心爱心光晕
    if (this.phase === 'finale') {
      this.updateFinale(ts);
      this.drawFinaleGlows(ctx, ts);
    }

    // 8. 触控光标
    if (this.pointer.active) this.drawCursor(ctx);
  }

  /* ---- 深空背景 ---- */
  drawSky(ctx) {
    const g = ctx.createRadialGradient(this.cx, this.cy * 0.5, 0, this.cx, this.cy, Math.max(this.w, this.h) * 0.85);
    g.addColorStop(0, '#1a1530');
    g.addColorStop(0.5, '#0f0c1e');
    g.addColorStop(1, '#060410');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  /* ---- 顶部遮罩 — 盖住早期星星，让星空晚些浮现 ---- */
  drawTopFade(ctx) {
    const fadeH = this.h * 0.55;
    const g = ctx.createLinearGradient(0, 0, 0, fadeH);
    g.addColorStop(0, '#1a1530');
    g.addColorStop(0.18, '#1a1530');
    g.addColorStop(0.4, 'rgba(22, 18, 44, 0.7)');
    g.addColorStop(0.65, 'rgba(16, 12, 32, 0.22)');
    g.addColorStop(0.85, 'rgba(8, 6, 18, 0.03)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, fadeH);
  }

  /* ---- 星座星云底图 — 每颗星点叠加柔光，自然勾勒动物轮廓 ---- */
  drawConstellationNebula(ctx) {
    const sc = this._scale;
    const cx = this.cx;
    const cy = this.cy;

    ctx.save();
    ctx.globalAlpha = 0.05;

    const leoBX = cx - sc * 15;
    const leoBY = cy + sc * 5;
    const scoBX = cx + sc * 15;
    const scoBY = cy + sc * 5;
    const glowR = sc * 4.5;

    // 狮子座：每颗星位置一个柔光，叠加成形
    for (const off of LEO_OFFSETS) {
      const sx = leoBX + off.x * sc;
      const sy = leoBY + off.y * sc;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      g.addColorStop(0, 'rgba(160,190,230,0.9)');
      g.addColorStop(0.5, 'rgba(140,170,220,0.2)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 天蝎座：每颗星位置一个柔光，叠加成形
    for (const off of SCORPIO_OFFSETS) {
      const sx = scoBX + off.x * sc;
      const sy = scoBY + off.y * sc;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      g.addColorStop(0, 'rgba(220,185,210,0.9)');
      g.addColorStop(0.5, 'rgba(200,170,200,0.2)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /* ---- 背景星 ---- */
  drawBgStar(ctx, s, t) {
    const tw = 0.5 + 0.5 * Math.sin(t * s.twinkle + s.phase);
    const a = s.alpha * tw;
    if (a < 0.015) return;
    ctx.fillStyle = s.color === 'warm'
      ? `rgba(240,210,170,${a})`
      : `rgba(200,195,225,${a})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---- 星座星（4-point sparkle）---- */
  drawConstellationStar(ctx, s, t) {
    const isLit = s.touched || this.phase === 'merging' || this.phase === 'merged';
    const tw = 0.6 + 0.4 * Math.sin(t * s.twinkle + s.phase);
    let alpha = isLit ? 0.75 + 0.25 * tw : (0.4 + 0.2 * tw) * s.alpha;
    if (alpha < 0.02) return;

    let baseColor;
    if (isLit) {
      baseColor = [248, 210, 140];
    } else if (s.color === 'leo') {
      baseColor = [180, 205, 240];
    } else {
      baseColor = [225, 190, 220];
    }

    const r = s.r;
    const [cr, cg, cb] = baseColor;
    ctx.save();

    // Layer 1: 光晕
    const glowR = r * 4.5;
    const glow = ctx.createRadialGradient(s.x, s.y, r * 0.5, s.x, s.y, glowR);
    glow.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha * 0.55})`);
    glow.addColorStop(0.5, `rgba(${cr},${cg},${cb},${alpha * 0.15})`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.x, s.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Layer 2: 4-point sparkle
    const outerR = r * 3.2;
    const innerR = r * 0.5;
    const angle = s.sparkAngle + t * 0.15;
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha * 0.85})`;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a0 = angle + (i * Math.PI) / 2;
      const a1 = angle + ((i + 0.5) * Math.PI) / 2;
      const tipX = s.x + Math.cos(a0) * outerR;
      const tipY = s.y + Math.sin(a0) * outerR;
      const cpR = outerR * 0.65;
      const cpAX = s.x + Math.cos(a0 - 0.35) * cpR;
      const cpAY = s.y + Math.sin(a0 - 0.35) * cpR;
      const cpBX = s.x + Math.cos(a0 + 0.35) * cpR;
      const cpBY = s.y + Math.sin(a0 + 0.35) * cpR;
      const nextX = s.x + Math.cos(angle + ((i + 1) * Math.PI) / 2) * innerR;
      const nextY = s.y + Math.sin(angle + ((i + 1) * Math.PI) / 2) * innerR;
      if (i === 0) ctx.moveTo(
        s.x + Math.cos(a1) * innerR,
        s.y + Math.sin(a1) * innerR);
      ctx.quadraticCurveTo(cpAX, cpAY, tipX, tipY);
      ctx.quadraticCurveTo(cpBX, cpBY, nextX, nextY);
    }
    ctx.closePath();
    ctx.fill();

    // Layer 3: 内核
    const coreG = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 2);
    coreG.addColorStop(0, `rgba(255,255,255,${alpha})`);
    coreG.addColorStop(0.3, `rgba(${cr},${cg},${cb},${alpha * 0.8})`);
    coreG.addColorStop(1, 'transparent');
    ctx.fillStyle = coreG;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* ================================================================
     MERGE ANIMATION
     ================================================================ */
  updateMerge(ts) {
    const elapsed = ts - this._mergeStart;
    const dur = this._mergeDuration;

    if (elapsed >= dur) {
      if (this.phase === 'merging') {
        this.phase = 'merged';
        this._mergedAt = ts;
        this.spawnBurst();
      }
      // 爆发后 1.8s 启动终章 W/Y/心形光晕
      if (this.phase === 'merged' && ts - this._mergedAt > 1800) {
        this.phase = 'finale';
        this._finaleStart = ts;
      }
      for (const s of this.constellationStars) {
        s.x = s.targetX;
        s.y = s.targetY;
      }
      return;
    }

    const t = elapsed / dur;
    const ease = 1 - Math.pow(1 - t, 3);
    for (const s of this.constellationStars) {
      s.x = s.originX + (s.targetX - s.originX) * ease;
      s.y = s.originY + (s.targetY - s.originY) * ease;
    }
  }

  /* ---- 金色粒子爆发 ---- */
  drawBurst(ctx) {
    for (let i = this.burstParticles.length - 1; i >= 0; i--) {
      const p = this.burstParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.01; // 微重力
      p.life -= p.decay;
      if (p.life <= 0) { this.burstParticles.splice(i, 1); continue; }
      const [cr, cg, cb] = p.color;
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${p.life})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---- 终章：W / Y 书法描边 + 脉冲爱心 + 粒子 ---- */
  updateFinale(ts) {
    const elapsed = ts - this._finaleStart;

    // Phase: nebula bloom (0 → 0.3s)
    const nebulaAlpha = Math.min(1, elapsed / 300);

    // Phase: W stroke-draw (0.3 → 1.6s)
    if (elapsed > 300) {
      this._letterWProgress = Math.min(1, (elapsed - 300) / 1300);
    }

    // Phase: Y stroke-draw (0.6 → 2.5s)
    if (elapsed > 600) {
      this._letterYProgress = Math.min(1, (elapsed - 600) / 1900);
    }

    // Phase: heart pulse starts at 1.2s
    if (elapsed > 1200 && this._heartStartedAt === 0) {
      this._heartStartedAt = ts;
    }

    // Check letters drawn
    if (this._letterWProgress >= 1 && this._letterYProgress >= 1 && !this._letterDrawn) {
      this._letterDrawn = true;
    }

    // Drift phases
    this._nebulaPhase = ts * 0.0003;
    this._breathePhase = ts * 0.0018;

    // Update embers
    this._updateEmbers();

    // Update heart rings
    this._updateHeartRings(ts);

    // Spawn embers
    this._spawnFinaleEmbers(ts);
  }

  /* ---- Ember 系统 ---- */
  _spawnFinaleEmbers(ts) {
    const sc = this._scale;
    const cx = this.cx;
    const cy = this.cy;
    const heartCY = cy + sc * 5;
    const wLX = cx - sc * 17, wLY = cy + sc * 3;
    const yLX = cx + sc * 17, yLY = cy + sc * 3;
    const fs = sc * 14;
    const maxEmbers = 400;

    // W trail (while drawing)
    if (this._letterWProgress < 1 && this._letterWProgress > 0) {
      const pt = pointOnPath(W_CURSIVE_PATH, this._letterWProgress);
      this._spawnEmbersAt(wLX + pt.x * fs, wLY + pt.y * fs, 2, 3);
    }
    // Y trail (while drawing)
    if (this._letterYProgress < 1 && this._letterYProgress > 0) {
      const pt = pointOnPath(Y_CURSIVE_PATH, this._letterYProgress);
      this._spawnEmbersAt(yLX + pt.x * fs, yLY + pt.y * fs, 2, 3);
    }
    // Letters drawn — occasional ember from path
    if (this._letterDrawn && Math.random() < 0.5) {
      const ptW = pointOnPath(W_CURSIVE_PATH, Math.random());
      this._spawnEmbersAt(wLX + ptW.x * fs, wLY + ptW.y * fs, 1, 2);
      const ptY = pointOnPath(Y_CURSIVE_PATH, Math.random());
      this._spawnEmbersAt(yLX + ptY.x * fs, yLY + ptY.y * fs, 1, 2);
    }
    // Heart embers
    if (this._heartStartedAt > 0 && Math.random() < 0.6) {
      const hp = heartXY(Math.random());
      const hs = sc * 1.45;
      this._spawnEmbersAt(cx + hp.x * hs, heartCY + hp.y * hs, 1, 3);
    }
    // Cap
    while (this._embers.length > maxEmbers) this._embers.shift();
  }

  _spawnEmbersAt(x, y, minCount, maxCount) {
    const count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));
    for (let i = 0; i < count; i++) {
      this._embers.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -(0.3 + Math.random() * 0.8),
        life: 1,
        decay: 0.004 + Math.random() * 0.008,
        r: 0.5 + Math.random() * 1.6,
      });
    }
  }

  _updateEmbers() {
    for (let i = this._embers.length - 1; i >= 0; i--) {
      const p = this._embers[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.003;
      p.life -= p.decay;
      if (p.life <= 0 || p.y < -40) { this._embers.splice(i, 1); }
    }
  }

  /* ---- Heart ring 系统 ---- */
  _updateHeartRings(ts) {
    const sc = this._scale;
    if (this._heartStartedAt <= 0) return;
    const beatT = (ts - this._heartStartedAt) % 560;
    const hb = heartbeatScale(ts - this._heartStartedAt);

    // Spawn ring at heartbeat peak
    if (hb > 1.15 && !this._ringSpawnedThisBeat) {
      this._ringSpawnedThisBeat = true;
      const cx = this.cx;
      const heartCY = this.cy + sc * 5;
      this._heartRings.push({ r: sc * 2, alpha: 0.55, x: cx, y: heartCY });
    }
    if (hb < 1.02) this._ringSpawnedThisBeat = false;

    // Expand + fade
    for (let i = this._heartRings.length - 1; i >= 0; i--) {
      const ring = this._heartRings[i];
      ring.r += sc * 0.12;
      ring.alpha -= 0.012;
      if (ring.alpha <= 0) this._heartRings.splice(i, 1);
    }
  }

  /* ================================================================
     PREMIUM FINALE DRAW
     ================================================================ */
  drawFinaleGlows(ctx, ts) {
    const sc = this._scale;
    const cx = this.cx;
    const cy = this.cy;
    const heartCY = cy + sc * 5;
    const wX = cx - sc * 17, wY = cy + sc * 3;
    const yX = cx + sc * 17, yY = cy + sc * 3;
    const fs = sc * 14;

    // Nebula bloom alpha
    const elapsed = ts - this._finaleStart;
    const nebulaA = Math.min(1, elapsed / 300) * 0.55;

    // 1. Letter nebulae (behind)
    this._drawLetterNebula(ctx, wX, wY, fs, nebulaA, 0);
    this._drawLetterNebula(ctx, yX, yY, fs, nebulaA, 1);

    // 2. Stroke-draw letters
    if (this._letterWProgress > 0) {
      this._drawCursiveLetter(ctx, W_CURSIVE_PATH, W_PATH_LEN, wX, wY, fs, this._letterWProgress, this._letterDrawn);
    }
    if (this._letterYProgress > 0) {
      this._drawCursiveLetter(ctx, Y_CURSIVE_PATH, Y_PATH_LEN, yX, yY, fs, this._letterYProgress, this._letterDrawn);
    }

    // 3. Pulsing heart
    if (this._heartStartedAt > 0) {
      this._drawHeartPulse(ctx, cx, heartCY, sc, ts);
      // Expanding rings
      for (const ring of this._heartRings) {
        ctx.strokeStyle = `rgba(255,200,150,${ring.alpha})`;
        ctx.lineWidth = sc * 0.25;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 4. Embers
    this._drawEmbers(ctx);
  }

  /* 字母底光 — 3 个偏移暖色 blob additive blend */
  _drawLetterNebula(ctx, lx, ly, fs, alpha, seed) {
    if (alpha < 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const blobColors = [
      [255, 200, 140],
      [255, 170, 110],
      [255, 220, 175],
    ];
    const offsets = [
      [fs * 0.12, fs * -0.08],
      [fs * -0.10, fs * 0.10],
      [fs * 0.04, fs * 0.06],
    ];

    for (let i = 0; i < 3; i++) {
      const [cr, cg, cb] = blobColors[i];
      const [ox, oy] = offsets[i];
      const drift = Math.sin(this._nebulaPhase * (i + 1) * 1.7 + seed) * fs * 0.06;
      const bx = lx + ox + drift;
      const by = ly + oy + drift * 0.6;
      const blobR = fs * (0.55 + 0.15 * Math.sin(this._nebulaPhase * (i + 3) * 2.1 + seed * 5));
      const a_i = [0.35, 0.25, 0.30][i] * alpha;

      const g = ctx.createRadialGradient(bx, by, 0, bx, by, blobR);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${a_i})`);
      g.addColorStop(0.6, `rgba(${cr},${cg},${cb},${a_i * 0.3})`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, blobR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* 书法描边字母 — setLineDash 动画 + 三层 glow */
  _drawCursiveLetter(ctx, pathData, pathTotalLen, lx, ly, fs, progress, drawn) {
    if (progress <= 0) return;
    ctx.save();

    const sc = fs;
    const totalLen = pathTotalLen * sc;
    const dashLen = progress * totalLen;
    const tipBoost = progress < 1 ? 1.3 : 1.0;

    // Build path
    ctx.beginPath();
    for (const seg of pathData) {
      const [cmd, ...args] = seg;
      if (cmd === 'M') {
        ctx.moveTo(lx + args[0] * sc, ly + args[1] * sc);
      } else {
        ctx.quadraticCurveTo(
          lx + args[0] * sc, ly + args[1] * sc,
          lx + args[2] * sc, ly + args[3] * sc
        );
      }
    }

    // Post-draw breathing
    if (drawn) {
      const breathe = 1 + 0.012 * Math.sin(this._breathePhase + (pathData === Y_CURSIVE_PATH ? 0.8 : 0));
      ctx.translate(lx, ly);
      ctx.scale(breathe, breathe);
      ctx.translate(-lx, -ly);
    }

    // Layer 1: Outer glow
    ctx.setLineDash([totalLen, totalLen]);
    ctx.lineDashOffset = -dashLen;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = sc * 0.22;
    ctx.shadowColor = `rgba(255,180,120,${0.4 * tipBoost})`;
    ctx.shadowBlur = sc * 0.55;
    ctx.strokeStyle = `rgba(255,210,160,${0.3 * tipBoost})`;
    ctx.stroke();

    // Layer 2: Mid glow
    ctx.shadowColor = `rgba(255,210,155,${0.5 * tipBoost})`;
    ctx.shadowBlur = sc * 0.28;
    ctx.lineWidth = sc * 0.10;
    ctx.strokeStyle = `rgba(255,235,195,${0.55 * tipBoost})`;
    ctx.stroke();

    // Layer 3: Core
    ctx.shadowBlur = 0;
    ctx.lineWidth = sc * 0.04;
    ctx.strokeStyle = `rgba(255,250,240,${0.85 * tipBoost})`;
    ctx.stroke();

    ctx.restore();
  }

  /* 脉冲爱心 + 光环 */
  _drawHeartPulse(ctx, hx, hy, sc, ts) {
    const beatScale = heartbeatScale(ts - this._heartStartedAt);
    const hs = sc * 1.45 * beatScale;
    const a = Math.min(1, (ts - this._heartStartedAt) / 800); // fade in over 0.8s

    ctx.save();

    // Heart path
    ctx.beginPath();
    const samples = 48;
    for (let i = 0; i <= samples; i++) {
      const hp = heartXY(i / samples);
      const px = hx + hp.x * hs;
      const py = hy + hp.y * hs;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    // Outer shadow fill
    ctx.shadowColor = `rgba(255,140,110,${a * 0.5})`;
    ctx.shadowBlur = sc * 6;
    ctx.fillStyle = `rgba(255,190,160,${a * 0.10})`;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Mid stroke
    ctx.shadowColor = `rgba(255,180,150,${a * 0.35})`;
    ctx.shadowBlur = sc * 2.5;
    ctx.strokeStyle = `rgba(255,210,175,${a * 0.28})`;
    ctx.lineWidth = sc * 0.6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner core gradient
    const coreR = sc * 7;
    const gCore = ctx.createRadialGradient(hx, hy, sc * 0.5, hx, hy, coreR);
    gCore.addColorStop(0, `rgba(255,245,230,${a * 0.4})`);
    gCore.addColorStop(0.45, `rgba(255,200,160,${a * 0.12})`);
    gCore.addColorStop(1, 'transparent');
    ctx.fillStyle = gCore;
    ctx.beginPath();
    ctx.arc(hx, hy, coreR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* Ember 粒子绘制 */
  _drawEmbers(ctx) {
    for (const p of this._embers) {
      if (p.life <= 0) continue;
      // Tiny glow
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.5);
      g.addColorStop(0, `rgba(255,215,140,${p.life * 0.55})`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = `rgba(255,245,220,${p.life * 0.85})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---- 光漪 ---- */
  drawRipples(ctx) {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rp = this.ripples[i];
      rp.r += 1.0;
      rp.alpha -= 0.014;
      if (rp.alpha <= 0) { this.ripples.splice(i, 1); continue; }
      const g = ctx.createRadialGradient(rp.x, rp.y, rp.r * 0.4, rp.x, rp.y, rp.r);
      g.addColorStop(0, `rgba(248,210,150,${rp.alpha * 0.6})`);
      g.addColorStop(0.5, `rgba(248,190,130,${rp.alpha * 0.25})`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---- 触控光标 ---- */
  drawCursor(ctx) {
    const { x, y } = this.pointer;
    if (x < -100) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 18);
    g.addColorStop(0, 'rgba(248,210,150,0.25)');
    g.addColorStop(0.5, 'rgba(248,190,120,0.06)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  destroy() {
    this.stop();
  }
}
