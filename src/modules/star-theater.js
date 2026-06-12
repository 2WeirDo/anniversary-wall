/**
 * Star Theater v3.1 — 指尖星图 · 星座收集
 *
 * 设计：「星座拼图」
 * - 狮子座（他 / 12 颗）与天蝎座（她 / 12 颗）
 * - 每个星座背后有星云雾状底图，清晰勾勒星座形态
 * - 指尖划过点亮星点，全部点亮后汇聚成心 + 金色粒子爆发
 * - 无文字提示、无引导线、无 HTML 爱心覆盖层
 */

/* ---- 心形参数方程（24 个采样点）---- */
function heartXY(t) {
  const a = t * Math.PI * 2;
  return {
    x: 16 * Math.pow(Math.sin(a), 3),
    y: -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)),
  };
}
const HEART_SAMPLES = Array.from({ length: 24 }, (_, i) => heartXY(i / 24));

/* ================================================================
   星座数据 — 扩大散布，形态分明
   狮子座：镰刀曲线 + 身体三角 + 尾星
   天蝎座：螯钳 + 弯曲身体 + 毒刺尾钩
   ================================================================ */

// 狮子座 — 扩大散布，镰刀形态清晰
const LEO_OFFSETS = [
  // 镰刀 (Sickle) — 标志性反写问号
  { x:  -7, y: -11 },   // 镰刀顶
  { x:  -9, y:  -7 },
  { x: -10, y:  -2 },
  { x:  -9, y:   3 },   // γ Leo
  { x:  -6, y:   7 },   // η Leo
  { x:   0, y:   8 },   // α Leo (Regulus) — 狮心
  // 身体
  { x:   4, y:   4 },
  { x:   7, y:  -1 },
  { x:   9, y:  -5 },   // δ Leo
  // 尾部三角
  { x:  11, y:  -9 },   // β Leo (Denebola)
  { x:   8, y: -11 },
  { x:   4, y:  -8 },
];

// 天蝎座 — 扩大散布，钩尾明显
const SCORPIO_OFFSETS = [
  // 螯钳
  { x:  6, y: -12 },
  { x: 10, y:  -9 },
  { x: 11, y:  -4 },
  // 身体纵轴
  { x:  8, y:   1 },    // β Sco
  { x:  5, y:   5 },    // δ Sco
  { x:  2, y:   9 },    // α Sco (Antares) — 蝎心
  { x: -1, y:  11 },
  // 尾钩向左下弯曲
  { x: -4, y:   8 },
  { x: -7, y:   5 },
  { x: -9, y:   7 },    // λ Sco (Shaula) — 毒刺
  { x: -6, y:   1 },
  { x: -2, y:  -1 },
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
    this.totalConstellation = 24;

    // 触控
    this.pointer = { x: -200, y: -200, active: false };
    this.ripples = [];

    // 状态
    this.phase = 'collect';    // collect | merging | merged
    this._mergeStart = 0;
    this._mergeDuration = 2500;
    this._started = false;

    // 成功庆典粒子
    this.burstParticles = [];
    this._burstSpawned = false;

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
    this.cy = this.h * 0.38;
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
        y: Math.random() * this.h,
        r: 0.3 + Math.random() * 1.6,
        alpha: 0.08 + Math.random() * 0.35,
        twinkle: 0.4 + Math.random() * 2.5,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() < 0.12 ? 'warm' : 'cool',
      });
    }

    // ---- 狮子座（左上）----
    const leoBaseX = cx - sc * 10;
    const leoBaseY = cy - sc * 2;
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
    const scoBaseX = cx + sc * 10;
    const scoBaseY = cy - sc * 2;
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
    const heartCY = cy + sc * 2;
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

    // 1. 深空背景
    this.drawSky(ctx);

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

  /* ---- 星座星云底图（狮子身体 + 天蝎身体）---- */
  drawConstellationNebula(ctx) {
    const sc = this._scale;
    const cx = this.cx;
    const cy = this.cy;

    ctx.save();
    ctx.globalAlpha = 0.06;

    // === 狮子座：头部光晕 + 身体椭圆 ===
    const leoX = cx - sc * 10;
    const leoY = cy - sc * 2;

    // 狮头/鬃毛 — 大圆
    const maneG = ctx.createRadialGradient(leoX - sc * 4, leoY - sc * 4, 0,
                                            leoX - sc * 4, leoY - sc * 4, sc * 7);
    maneG.addColorStop(0, 'rgba(160,190,230,0.7)');
    maneG.addColorStop(0.5, 'rgba(140,170,220,0.25)');
    maneG.addColorStop(1, 'transparent');
    ctx.fillStyle = maneG;
    ctx.beginPath();
    ctx.arc(leoX - sc * 4, leoY - sc * 4, sc * 7, 0, Math.PI * 2);
    ctx.fill();

    // 狮身 — 椭圆
    const bodyG = ctx.createRadialGradient(leoX + sc * 2, leoY, sc, leoX + sc * 2, leoY, sc * 8);
    bodyG.addColorStop(0, 'rgba(160,190,230,0.5)');
    bodyG.addColorStop(0.6, 'rgba(140,170,220,0.15)');
    bodyG.addColorStop(1, 'transparent');
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.ellipse(leoX + sc * 2, leoY, sc * 8, sc * 4.5, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // === 天蝎座：身体弧线 + 螯钳 ===
    const scoX = cx + sc * 10;
    const scoY = cy - sc * 2;

    // 身体/头部光晕
    const scoBodyG = ctx.createRadialGradient(scoX + sc * 2, scoY, 0, scoX + sc * 2, scoY, sc * 6);
    scoBodyG.addColorStop(0, 'rgba(220,185,210,0.6)');
    scoBodyG.addColorStop(0.5, 'rgba(200,170,200,0.2)');
    scoBodyG.addColorStop(1, 'transparent');
    ctx.fillStyle = scoBodyG;
    ctx.beginPath();
    ctx.ellipse(scoX + sc * 2, scoY + sc, sc * 5, sc * 3.5, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 尾钩 — 弯曲路径上的软光晕
    const tailG = ctx.createRadialGradient(scoX - sc * 2, scoY + sc * 4, 0,
                                            scoX - sc * 2, scoY + sc * 4, sc * 5);
    tailG.addColorStop(0, 'rgba(220,185,210,0.5)');
    tailG.addColorStop(0.5, 'rgba(200,170,200,0.15)');
    tailG.addColorStop(1, 'transparent');
    ctx.fillStyle = tailG;
    ctx.beginPath();
    ctx.ellipse(scoX - sc * 2, scoY + sc * 3, sc * 4, sc * 4.5, -0.5, 0, Math.PI * 2);
    ctx.fill();

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
      if (this.phase !== 'merged') {
        this.phase = 'merged';
        this.spawnBurst();
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
