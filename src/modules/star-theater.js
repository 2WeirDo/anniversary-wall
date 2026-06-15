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

    // 终章：W / Y 字母渐显
    this._finaleStart = 0;
    this._finaleDuration = 3500;
    this._finaleAlpha = 0;
    this._mergedAt = 0;

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
      this._finaleAlpha = 0;
      this._finaleStart = 0;
      this._mergedAt = 0;
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
      this.drawFinaleGlows(ctx);
    }

    // 8. 触控光标
    if (this.pointer.active) this.drawCursor(ctx);
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

  /* ---- 终章：W / Y 字母渐显 ---- */
  updateFinale(ts) {
    const elapsed = ts - this._finaleStart;
    this._finaleAlpha = Math.min(1, elapsed / this._finaleDuration);
  }

  drawFinaleGlows(ctx) {
    const a = this._finaleAlpha;
    if (a <= 0) return;
    const sc = this._scale;
    const cx = this.cx;
    const cy = this.cy;

    // 缓出
    const ease = 1 - Math.pow(1 - a, 3);

    // ---- 左侧 W 光晕 ----
    this.drawLetterGlow(ctx, 'W', cx - sc * 17, cy + sc * 3, sc * 14, ease,
      [255, 235, 210], [255, 220, 190]);

    // ---- 右侧 Y 光晕 ----
    this.drawLetterGlow(ctx, 'Y', cx + sc * 17, cy + sc * 3, sc * 14, ease,
      [255, 235, 210], [255, 220, 190]);
  }

  /* 绘制发光字母 */
  drawLetterGlow(ctx, letter, lx, ly, fontSize, alpha, glowColor, coreColor) {
    const a = alpha;
    if (a < 0.01) return;

    const [gr, gg, gb] = glowColor;
    const [cr, cg, cb] = coreColor;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 外层柔光（大范围模糊）
    const outerR = fontSize * 0.8;
    const gOuter = ctx.createRadialGradient(lx, ly, fontSize * 0.15, lx, ly, outerR);
    gOuter.addColorStop(0, `rgba(${gr},${gg},${gb},${a * 0.35})`);
    gOuter.addColorStop(0.5, `rgba(${gr},${gg},${gb},${a * 0.10})`);
    gOuter.addColorStop(1, 'transparent');
    ctx.fillStyle = gOuter;
    ctx.beginPath();
    ctx.arc(lx, ly, outerR, 0, Math.PI * 2);
    ctx.fill();

    // 中层光晕
    const midR = fontSize * 0.45;
    const gMid = ctx.createRadialGradient(lx, ly, fontSize * 0.08, lx, ly, midR);
    gMid.addColorStop(0, `rgba(${cr},${cg},${cb},${a * 0.45})`);
    gMid.addColorStop(0.6, `rgba(${cr},${cg},${cb},${a * 0.08})`);
    gMid.addColorStop(1, 'transparent');
    ctx.fillStyle = gMid;
    ctx.beginPath();
    ctx.arc(lx, ly, midR, 0, Math.PI * 2);
    ctx.fill();

    // 字母主体
    ctx.font = `bold ${fontSize}px "Georgia", "Times New Roman", serif`;
    ctx.shadowColor = `rgba(${gr},${gg},${gb},${a * 0.35})`;
    ctx.shadowBlur = fontSize * 0.35;
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${a * 0.6})`;
    ctx.fillText(letter, lx, ly);

    // 内层亮核
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(255,255,255,${a * 0.18})`;
    ctx.fillText(letter, lx, ly);

    ctx.restore();
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
