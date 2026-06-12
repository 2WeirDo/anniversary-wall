/**
 * Star Theater v3 — 指尖星图 · 星座收集
 *
 * 设计：「星座拼图」
 * - 狮子座（他 / 12 颗）与天蝎座（她 / 12 颗）散落在星夜中
 * - 指尖划过点亮星点，全部点亮后汇聚成一颗发光的心
 * - 星点用 4-point sparkle 渲染，高级质感
 * - 爱心：双层心形 + 光点散布 + 金色渐变
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
   星座数据 — 艺术家诠释版
   基于真实星座星位简化，设计为视觉辨识度高的散点图案
   ================================================================ */

// 狮子座 — "镰刀"星群（头部）+ 身体三角 + 尾星 Denebola
// 正常化到 [-7, 7] × [-8, 6] 范围内
const LEO_OFFSETS = [
  // 镰刀曲线 (Sickle) — 反写的问号形状，从顶弯到底
  { x: -4.5, y: -6.5 },  // ε Leo — 镰刀顶端
  { x: -5.5, y: -4.0 },  // μ Leo
  { x: -5.8, y: -1.0 },  // ζ Leo
  { x: -5.0, y:  2.0 },  // γ Leo (Algieba) — 双星系统
  { x: -3.0, y:  4.0 },  // η Leo
  { x:  0.0, y:  4.5 },  // α Leo (Regulus) — 狮之心，镰刀底部
  // 身体
  { x:  2.0, y:  2.0 },
  { x:  3.5, y: -1.0 },
  { x:  4.8, y: -3.5 },  // δ Leo
  // 尾部三角
  { x:  6.0, y: -5.5 },  // β Leo (Denebola) — 尾尖亮星
  { x:  5.0, y: -6.5 },
  { x:  3.0, y: -5.0 },
];

// 天蝎座 — 螯钳 + 弯曲身体 + 毒刺尾钩
// 正常化到 [-7, 7] × [-8, 6] 范围内
const SCORPIO_OFFSETS = [
  // 螯钳（头部三叉）
  { x:  3.5, y: -7.0 },  // 北螯
  { x:  5.5, y: -5.5 },  // 螯中
  { x:  6.0, y: -2.5 },  // 螯基
  // 身体（纵贯）
  { x:  4.0, y:  0.5 },  // β Sco (Graffias)
  { x:  2.5, y:  2.5 },  // δ Sco (Dschubba)
  { x:  1.0, y:  5.0 },  // α Sco (Antares) — 蝎之心，红色超巨星
  { x: -0.5, y:  6.5 },
  // 尾钩（弯向左下方）
  { x: -2.0, y:  5.0 },
  { x: -4.0, y:  3.0 },
  { x: -5.5, y:  4.5 },  // λ Sco (Shaula) — 毒刺尖端
  { x: -4.0, y:  1.0 },
  { x: -1.5, y:  0.0 },
];


export class StarTheater {
  constructor(containerId) {
    this.el = document.getElementById(containerId);
    if (!this.el) return;

    this.canvas = this.el.querySelector('.star-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    // 进度 UI
    this.progressEl = document.getElementById('star-progress');
    this.progressFill = document.getElementById('star-progress-fill');
    this.progressLabel = document.getElementById('star-progress-label');
    this.heartReveal = document.getElementById('heart-reveal');

    // 设备
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.isMobile = window.matchMedia('(max-width: 768px)').matches;

    // 画布尺寸
    this.w = 0;
    this.h = 0;
    this.cx = 0;
    this.cy = 0;

    // 星场
    this.bgStars = [];         // 背景星
    this.constellationStars = [];  // 星座星（24 颗）
    this.touchedCount = 0;
    this.totalConstellation = 24;

    // 触控
    this.pointer = { x: -200, y: -200, active: false };
    this.ripples = [];         // 光漪

    // 状态
    this.phase = 'collect';    // collect | merging | merged
    this._mergeStart = 0;
    this._mergeDuration = 2500; // 汇聚动画 2.5s
    this._started = false;

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
    this.touchedCount = 0;
    this.ripples = [];

    const scale = Math.min(this.w, this.h) * 0.022;
    const cx = this.cx;
    const cy = this.cy;

    // ---- 背景星（非交互）----
    const N_BG = this.isMobile ? 50 : 100;
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

    // ---- 狮子座（左上区域）----
    const leoBaseX = cx - scale * 9;
    const leoBaseY = cy - scale * 3;
    for (const off of LEO_OFFSETS) {
      this.constellationStars.push({
        x: leoBaseX + off.x * scale,
        y: leoBaseY + off.y * scale,
        r: 2.8 + Math.random() * 2.4,        // 较大星点
        alpha: 0.55 + Math.random() * 0.2,
        twinkle: 0.6 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        color: 'leo',
        touched: false,
        // 原始位置（用于汇聚时 lerp 起点）
        originX: leoBaseX + off.x * scale,
        originY: leoBaseY + off.y * scale,
        targetX: 0, targetY: 0,   // 稍后填充
        sparkAngle: Math.random() * Math.PI * 2,  // 星芒旋转
      });
    }

    // ---- 天蝎座（右上区域）----
    const scoBaseX = cx + scale * 9;
    const scoBaseY = cy - scale * 3;
    for (const off of SCORPIO_OFFSETS) {
      this.constellationStars.push({
        x: scoBaseX + off.x * scale,
        y: scoBaseY + off.y * scale,
        r: 2.8 + Math.random() * 2.4,
        alpha: 0.55 + Math.random() * 0.2,
        twinkle: 0.6 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        color: 'scorpio',
        touched: false,
        originX: scoBaseX + off.x * scale,
        originY: scoBaseY + off.y * scale,
        targetX: 0, targetY: 0,
        sparkAngle: Math.random() * Math.PI * 2,
      });
    }

    // ---- 预计算 24 颗星的心形目标位置 ----
    const heartScale = scale * 1.15;
    const heartCY = cy + scale * 1.5;  // 心形略低于画面中线
    for (let i = 0; i < this.constellationStars.length; i++) {
      const hp = HEART_SAMPLES[i];
      this.constellationStars[i].targetX = cx + hp.x * heartScale;
      this.constellationStars[i].targetY = heartCY + hp.y * heartScale;
    }

    // 如果之前已经 merged，重置状态
    if (this.phase !== 'collect') {
      this.phase = 'collect';
      this._mergeStart = 0;
      if (this.heartReveal) {
        this.heartReveal.classList.remove('visible');
        this.heartReveal.setAttribute('aria-hidden', 'true');
      }
      this.updateProgressUI();
    }
  }

  /* ================================================================
     EVENTS
     ================================================================ */
  bindEvents() {
    // 指针移动 → 检测触碰星座星
    this.canvas.addEventListener('pointermove', (e) => {
      this.pointer.active = true;
      this.pointer.x = e.offsetX;
      this.pointer.y = e.offsetY;

      // 收集阶段的触碰检测
      if (this.phase === 'collect') {
        this.checkTouch(e.offsetX, e.offsetY);
      }

      // 光漪
      if (this.ripples.length < 6) {
        this.ripples.push({ x: e.offsetX, y: e.offsetY, r: 0, alpha: 0.45 });
      }
    }, { passive: true });

    this.canvas.addEventListener('pointerleave', () => {
      this.pointer.active = false;
    });
    this.canvas.addEventListener('pointerenter', (e) => {
      this.pointer.active = true;
      this.pointer.x = e.offsetX;
      this.pointer.y = e.offsetY;
    });
  }

  /* ---- 触碰检测：标记星座星为已点亮 ---- */
  checkTouch(px, py) {
    const threshold = this.isMobile ? 50 : 42;
    let anyNew = false;

    for (const s of this.constellationStars) {
      if (s.touched) continue;
      const dx = s.x - px;
      const dy = s.y - py;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < threshold) {
        s.touched = true;
        this.touchedCount++;
        anyNew = true;

        // 点亮涟漪
        this.ripples.push({ x: s.x, y: s.y, r: s.r * 3, alpha: 0.6 });
      }
    }

    if (anyNew) {
      this.updateProgressUI();

      // 全部点亮 → 触发汇聚
      if (this.touchedCount >= this.totalConstellation) {
        setTimeout(() => this.startMerge(), 600);
      }
    }
  }

  /* ---- 进度 UI ---- */
  updateProgressUI() {
    const pct = (this.touchedCount / this.totalConstellation) * 100;

    if (this.progressFill) {
      this.progressFill.style.width = pct + '%';
    }

    if (this.progressLabel) {
      if (this.touchedCount === 0) {
        this.progressLabel.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span>轻划星空，点亮星座</span>`;
      } else if (this.touchedCount >= this.totalConstellation) {
        this.progressLabel.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span>星座已点亮 · 正在汇聚…</span>`;
      } else {
        this.progressLabel.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span>已点亮 ${this.touchedCount}/${this.totalConstellation}</span>`;
      }
    }
  }

  /* ================================================================
     SCROLL OBSERVER
     ================================================================ */
  observe() {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !this._started) {
        this._started = true;
      }
    }, { threshold: 0.2 });
    obs.observe(this.el);
  }

  /* ================================================================
     MERGE TO HEART
     ================================================================ */
  startMerge() {
    if (this.phase !== 'collect') return;
    this.phase = 'merging';
    this._mergeStart = performance.now();

    // 更新进度 UI 状态
    this.updateProgressUI();
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

    // 2. 更新星座星位置（汇聚动画）
    if (this.phase === 'merging' || this.phase === 'merged') {
      this.updateMerge(ts);
    }

    // 3. 背景星
    for (const s of this.bgStars) this.drawBgStar(ctx, s, t);

    // 4. 星座连线（已点亮的星之间）
    this.drawConstellationLines(ctx);

    // 5. 星座星
    for (const s of this.constellationStars) this.drawConstellationStar(ctx, s, t);

    // 6. 光漪
    this.drawRipples(ctx);

    // 7. 触控光标
    if (this.pointer.active) this.drawCursor(ctx);
  }

  /* ---- 深空背景 ---- */
  drawSky(ctx) {
    const g = ctx.createRadialGradient(this.cx, this.cy * 0.5, 0, this.cx, this.cy, Math.max(this.w, this.h) * 0.8);
    g.addColorStop(0, '#1a1530');
    g.addColorStop(0.5, '#0f0c1e');
    g.addColorStop(1, '#060410');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  /* ---- 背景星渲染（简化为圆点）---- */
  drawBgStar(ctx, s, t) {
    const tw = 0.5 + 0.5 * Math.sin(t * s.twinkle + s.phase);
    const a = s.alpha * tw;
    if (a < 0.015) return;

    if (s.color === 'warm') {
      ctx.fillStyle = `rgba(240,210,170,${a})`;
    } else {
      ctx.fillStyle = `rgba(200,195,225,${a})`;
    }
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---- 星座星渲染（4-point sparkle）---- */
  drawConstellationStar(ctx, s, t) {
    // 未点亮 + 收集阶段 → 使用基础 alpha
    // 已点亮 → 高 alpha + 金色
    // 汇聚阶段 → 所有星高亮
    let alpha = s.alpha;
    const isLit = s.touched || this.phase === 'merging' || this.phase === 'merged';

    const tw = 0.6 + 0.4 * Math.sin(t * s.twinkle + s.phase);
    if (isLit) {
      alpha = 0.75 + 0.25 * tw;
    } else {
      alpha = (0.4 + 0.2 * tw) * s.alpha;
    }
    if (alpha < 0.02) return;

    // 颜色
    let baseColor;
    if (isLit) {
      // 点亮后统一暖金
      baseColor = [248, 210, 140];
    } else if (s.color === 'leo') {
      // 狮子座 — 冰蓝白
      baseColor = [190, 210, 240];
    } else {
      // 天蝎座 — 粉紫白
      baseColor = [225, 195, 220];
    }

    const r = s.r;

    ctx.save();

    // === Layer 1: 外层光晕 ===
    const glowR = r * 4.5;
    const glow = ctx.createRadialGradient(s.x, s.y, r * 0.5, s.x, s.y, glowR);
    const [cr, cg, cb] = baseColor;
    glow.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha * 0.55})`);
    glow.addColorStop(0.5, `rgba(${cr},${cg},${cb},${alpha * 0.15})`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.x, s.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    // === Layer 2: 4-point sparkle 星芒 ===
    const outerR = r * 3.2;
    const innerR = r * 0.5;
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha * 0.85})`;

    // 旋转星芒
    const angle = s.sparkAngle + t * 0.15; // 缓慢旋转

    ctx.beginPath();
    // 绘制 4 个软圆角顶点
    for (let i = 0; i < 4; i++) {
      const a0 = angle + (i * Math.PI) / 2;         // 主轴方向
      const a1 = angle + ((i + 0.5) * Math.PI) / 2; // 内凹方向

      const tipX = s.x + Math.cos(a0) * outerR;
      const tipY = s.y + Math.sin(a0) * outerR;
      const indentX = s.x + Math.cos(a1) * innerR;
      const indentY = s.y + Math.sin(a1) * innerR;

      // 贝塞尔控制点：从内凹弯向顶端
      const cpR = outerR * 0.65;
      const cpAX = s.x + Math.cos(a0 - 0.35) * cpR;
      const cpAY = s.y + Math.sin(a0 - 0.35) * cpR;
      const cpBX = s.x + Math.cos(a0 + 0.35) * cpR;
      const cpBY = s.y + Math.sin(a0 + 0.35) * cpR;

      if (i === 0) {
        ctx.moveTo(indentX, indentY);
      }
      ctx.quadraticCurveTo(cpAX, cpAY, tipX, tipY);
      ctx.quadraticCurveTo(cpBX, cpBY,
        s.x + Math.cos(angle + ((i + 1) * Math.PI) / 2) * innerR,
        s.y + Math.sin(angle + ((i + 1) * Math.PI) / 2) * innerR);
    }
    ctx.closePath();
    ctx.fill();

    // === Layer 3: 内核高亮 ===
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

  /* ---- 星座连线（已点亮星之间）---- */
  drawConstellationLines(ctx) {
    const litStars = this.constellationStars.filter(s => s.touched);
    if (litStars.length < 2) return;

    // 分别绘制狮子座和天蝎座的连线
    const leoStars = litStars.filter(s => s.color === 'leo');
    const scoStars = litStars.filter(s => s.color === 'scorpio');

    ctx.save();
    ctx.lineWidth = 0.5;
    ctx.lineCap = 'round';

    // 狮子座连线
    if (leoStars.length >= 2) {
      ctx.strokeStyle = 'rgba(180,200,230,0.3)';
      ctx.shadowColor = 'rgba(180,200,230,0.4)';
      ctx.shadowBlur = 6;
      this.drawStarConnections(ctx, leoStars);
    }

    // 天蝎座连线
    if (scoStars.length >= 2) {
      ctx.strokeStyle = 'rgba(220,190,210,0.3)';
      ctx.shadowColor = 'rgba(220,190,210,0.4)';
      ctx.shadowBlur = 6;
      this.drawStarConnections(ctx, scoStars);
    }

    ctx.restore();
  }

  drawStarConnections(ctx, stars) {
    // 按星座原始顺序连线（它们在 constellationStars 中的顺序就是 offsets 顺序）
    ctx.beginPath();
    ctx.moveTo(stars[0].x, stars[0].y);
    for (let i = 1; i < stars.length; i++) {
      ctx.lineTo(stars[i].x, stars[i].y);
    }
    ctx.stroke();
  }

  /* ================================================================
     MERGE ANIMATION — 所有星座星汇聚成心
     ================================================================ */
  updateMerge(ts) {
    const elapsed = ts - this._mergeStart;
    const dur = this._mergeDuration;

    if (elapsed >= dur) {
      // 汇聚完成
      if (this.phase !== 'merged') {
        this.phase = 'merged';
        // 显示爱心揭示层
        this.revealHeart();
      }
      // 所有星固定在心形位置
      for (const s of this.constellationStars) {
        s.x = s.targetX;
        s.y = s.targetY;
      }
      return;
    }

    // ease-out 缓动
    const t = elapsed / dur;
    const ease = 1 - Math.pow(1 - t, 3);  // cubic ease-out

    for (const s of this.constellationStars) {
      s.x = s.originX + (s.targetX - s.originX) * ease;
      s.y = s.originY + (s.targetY - s.originY) * ease;
    }
  }

  revealHeart() {
    if (this.heartReveal) {
      this.heartReveal.classList.add('visible');
      this.heartReveal.setAttribute('aria-hidden', 'false');
    }
    if (this.progressLabel) {
      this.progressLabel.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
        <span>心意已至</span>`;
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

  /* ================================================================
     DESTROY
     ================================================================ */
  destroy() {
    this.stop();
  }
}
