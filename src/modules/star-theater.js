/**
 * Star Theater v2 — 指尖星图 × 剪影小剧场
 *
 * 设计：「暮光到星夜」
 * - 两个星座群在深空中随剪影靠近而漂移
 * - 拥抱时星群汇聚成一颗心
 * - 指尖划过星点微亮 + 光漪扩散
 * - Canvas 渲染星场，CSS 驱动剪影表演
 */

/* ---- 心形采样点（24 颗星座星） ---- */
function heartSample(t) {
  const a = t * Math.PI * 2;
  return {
    x: 16 * Math.pow(Math.sin(a), 3),
    y: -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)),
  };
}
const HEART_POINTS = Array.from({ length: 24 }, (_, i) => heartSample(i / 24));

export class StarTheater {
  constructor(containerId) {
    this.el = document.getElementById(containerId);
    if (!this.el) return;

    this.canvas = this.el.querySelector('.star-canvas');
    this.stage = this.el.querySelector('.silhouette-stage');
    this.her = this.el.querySelector('.silhouette-her');
    this.him = this.el.querySelector('.silhouette-him');

    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    // 设备
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.isMobile = window.matchMedia('(max-width: 768px)').matches;

    // 尺寸
    this.w = 0;
    this.h = 0;
    this.cx = 0; // 画布中心 x
    this.cy = 0; // 画布中心 y

    // 星场
    this.stars = [];          // 所有星星
    this.herGroup = [];       // 她的星座星索引
    this.hisGroup = [];       // 他的星座星索引
    this.heartStars = [];     // 心形位置（画布坐标）

    // 触控
    this.pointer = { x: -200, y: -200, active: false };
    this.ripples = [];        // 光漪

    // 剧场
    this.phase = 'idle';      // idle | herEnter | himEnter | meet | reach | embrace | merged
    this._phaseTimer = null;
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
    this.buildStars();
    this.bindEvents();
    this.observe();
    this.loop();

    window.addEventListener('resize', () => {
      this.resize();
      this.buildStars();
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
     STAR GENERATION
     ================================================================ */
  buildStars() {
    this.stars = [];
    this.herGroup = [];
    this.hisGroup = [];
    this.heartStars = [];

    const N = this.isMobile ? 80 : 160;
    const scale = Math.min(this.w, this.h) * 0.024;
    const cx = this.cx;
    const cy = this.cy;

    // 背景星
    for (let i = 0; i < N; i++) {
      const x = Math.random() * this.w;
      const y = Math.random() * this.h;
      this.stars.push({
        x, y,
        r: 0.3 + Math.random() * 2.0,
        baseAlpha: 0.12 + Math.random() * 0.45,
        twinkle: 0.3 + Math.random() * 2.2,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() < 0.15 ? 'warm' : 'cool', // 少数暖色
        group: 'bg',
        homeX: x, homeY: y,
      });
    }

    // 她的星座 — 散布在左上方
    const herBase = { x: cx - scale * 12, y: cy - scale * 6 };
    for (let i = 0; i < 12; i++) {
      const idx = this.stars.length;
      this.herGroup.push(idx);
      const offsetX = (Math.random() - 0.5) * scale * 8;
      const offsetY = (Math.random() - 0.5) * scale * 5;
      this.stars.push({
        x: herBase.x + offsetX,
        y: herBase.y + offsetY,
        r: 1.2 + Math.random() * 1.8,
        baseAlpha: 0.35 + Math.random() * 0.3,
        twinkle: 0.5 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
        color: 'her',
        group: 'her',
        homeX: herBase.x + offsetX,
        homeY: herBase.y + offsetY,
      });
    }

    // 他的星座 — 散布在右上方
    const hisBase = { x: cx + scale * 12, y: cy - scale * 6 };
    for (let i = 0; i < 12; i++) {
      const idx = this.stars.length;
      this.hisGroup.push(idx);
      const offsetX = (Math.random() - 0.5) * scale * 8;
      const offsetY = (Math.random() - 0.5) * scale * 5;
      this.stars.push({
        x: hisBase.x + offsetX,
        y: hisBase.y + offsetY,
        r: 1.2 + Math.random() * 1.8,
        baseAlpha: 0.35 + Math.random() * 0.3,
        twinkle: 0.5 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
        color: 'him',
        group: 'him',
        homeX: hisBase.x + offsetX,
        homeY: hisBase.y + offsetY,
      });
    }

    // 心形星座目标位置
    this.heartStars = HEART_POINTS.map(p => ({
      x: cx + p.x * scale * 0.8,
      y: cy + p.y * scale * 0.8,
    }));
  }

  /* ================================================================
     EVENTS
     ================================================================ */
  bindEvents() {
    this.canvas.addEventListener('pointermove', e => {
      this.pointer.active = true;
      this.pointer.x = e.offsetX;
      this.pointer.y = e.offsetY;
      // 加光漪
      if (this.ripples.length < 8) {
        this.ripples.push({ x: e.offsetX, y: e.offsetY, r: 0, alpha: 0.5 });
      }
    }, { passive: true });
    this.canvas.addEventListener('pointerleave', () => { this.pointer.active = false; });
    this.canvas.addEventListener('pointerenter', e => {
      this.pointer.active = true;
      this.pointer.x = e.offsetX;
      this.pointer.y = e.offsetY;
    });
  }

  /* ================================================================
     SCROLL OBSERVER → 启动剧场
     ================================================================ */
  observe() {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !this._started) {
        this._started = true;
        this.startTheater();
      }
    }, { threshold: 0.25 });
    obs.observe(this.el);
  }

  /* ================================================================
     THEATER TIMELINE
     ================================================================ */
  startTheater() {
    const add = (cls, el) => el && el.classList.add(cls);
    const schedule = (ms, fn) => setTimeout(fn, ms);

    // 0ms: 舞台激活
    add('active', this.stage);

    // 0ms: 她入场
    this.phase = 'herEnter';
    add('enter', this.her);

    // 600ms: 他入场
    schedule(600, () => {
      this.phase = 'himEnter';
      add('enter', this.him);
    });

    // 2400ms: 相遇
    schedule(2400, () => {
      this.phase = 'meet';
      add('meeting', this.stage);
    });

    // 3400ms: 伸手
    schedule(3400, () => {
      this.phase = 'reach';
      add('reaching', this.stage);
    });

    // 4400ms: 拥抱
    schedule(4400, () => {
      this.phase = 'embrace';
      add('embracing', this.stage);
    });

    // 5400ms: 星座融合
    schedule(5400, () => {
      this.phase = 'merged';
      add('merged', this.stage);
    });
  }

  /* ================================================================
     RENDER LOOP
     ================================================================ */
  loop() {
    const frame = ts => {
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

    // 1. 背景
    this.drawSky(ctx);

    // 2. 更新星位置（随剧场阶段漂移）
    this.driftStars();

    // 3. 星座连线
    this.drawLines(ctx);

    // 4. 所有星星
    for (const s of this.stars) this.drawStar(ctx, s, t);

    // 5. 触控光漪 + 点亮
    this.drawRipples(ctx);
    if (this.pointer.active) this.glowNear(ctx);

    // 6. 触控光标
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

  /* ---- 星座星漂移 ---- */
  driftStars() {
    const herTarget = this.phase === 'merged' ? this.cx - 15 : this.cx - (this.phase === 'idle' ? 0 : 60);
    const himTarget = this.phase === 'merged' ? this.cx + 15 : this.cx + (this.phase === 'idle' ? 0 : 60);

    const driftSpeed = this.phase === 'merged' ? 0.015 : this.phase === 'idle' ? 0 : 0.008;

    for (const i of this.herGroup) {
      const s = this.stars[i];
      const tx = this.phase === 'merged'
        ? this.heartStars[i - this.herGroup[0]]?.x ?? s.homeX
        : s.homeX + (herTarget - this.cx) * 0.6;
      const ty = this.phase === 'merged'
        ? this.heartStars[i - this.herGroup[0]]?.y ?? s.homeY
        : s.homeY;
      s.x += (tx - s.x) * driftSpeed;
      s.y += (ty - s.y) * driftSpeed;
    }
    for (const i of this.hisGroup) {
      const s = this.stars[i];
      const offset = i - this.hisGroup[0];
      const tx = this.phase === 'merged'
        ? this.heartStars[12 + offset]?.x ?? s.homeX
        : s.homeX + (himTarget - this.cx) * 0.6;
      const ty = this.phase === 'merged'
        ? this.heartStars[12 + offset]?.y ?? s.homeY
        : s.homeY;
      s.x += (tx - s.x) * driftSpeed;
      s.y += (ty - s.y) * driftSpeed;
    }
  }

  /* ---- 星座连线 ---- */
  drawLines(ctx) {
    const drawGroup = (indices, color, alpha) => {
      if (indices.length < 2) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.6;
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      const first = this.stars[indices[0]];
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < indices.length; i++) {
        const s = this.stars[indices[i]];
        ctx.lineTo(s.x, s.y);
      }
      ctx.stroke();
      ctx.restore();
    };

    const phaseAlpha = { idle: 0, herEnter: 0.35, himEnter: 0.45, meet: 0.55, reach: 0.65, embrace: 0.7, merged: 0.75 };
    const a = phaseAlpha[this.phase] || 0;

    if (a > 0) {
      drawGroup(this.herGroup, 'rgba(240,180,200,0.5)', a * 0.7);
      drawGroup(this.hisGroup, 'rgba(180,200,240,0.5)', a * 0.7);

      // merged 阶段加金色心形连线
      if (this.phase === 'merged') {
        const all = [...this.herGroup, ...this.hisGroup];
        drawGroup(all, 'rgba(248,200,140,0.6)', 0.55);
      }
    }
  }

  /* ---- 单星渲染 ---- */
  drawStar(ctx, s, t) {
    let alpha = s.baseAlpha;
    if (s.group !== 'bg' && this.phase === 'idle') alpha = 0;
    if (alpha < 0.01) return;

    const tw = 0.6 + 0.4 * Math.sin(t * s.twinkle + s.phase);
    const a = alpha * tw;
    if (a < 0.01) return;

    // 颜色
    let rgba;
    if (s.color === 'her') rgba = `rgba(245,185,200,${a})`;
    else if (s.color === 'him') rgba = `rgba(185,205,245,${a})`;
    else if (s.color === 'warm') rgba = `rgba(240,210,170,${a})`;
    else rgba = `rgba(200,195,225,${a})`;

    ctx.save();

    // 光晕
    const glowR = s.r * 3.5;
    const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowR);
    glow.addColorStop(0, rgba.replace(/[\d.]+\)$/, `${a * 0.5})`));
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.x, s.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    // 星核
    ctx.fillStyle = rgba;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* ---- 光漪 ---- */
  drawRipples(ctx) {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rp = this.ripples[i];
      rp.r += 1.2;
      rp.alpha -= 0.012;
      if (rp.alpha <= 0) { this.ripples.splice(i, 1); continue; }

      const g = ctx.createRadialGradient(rp.x, rp.y, rp.r * 0.5, rp.x, rp.y, rp.r);
      g.addColorStop(0, `rgba(248,210,150,${rp.alpha * 0.7})`);
      g.addColorStop(0.5, `rgba(248,190,130,${rp.alpha * 0.3})`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---- 触控点亮附近星 ---- */
  glowNear(ctx) {
    const { x, y } = this.pointer;
    const radius = this.isMobile ? 90 : 130;
    for (const s of this.stars) {
      const dx = s.x - x;
      const dy = s.y - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= radius) continue;
      const boost = (1 - d / radius) * 0.55;
      const a = Math.min(1, s.baseAlpha + boost);
      const r = s.r + boost * 2.5;

      let rgba;
      if (s.color === 'her') rgba = `rgba(255,200,215,${a})`;
      else if (s.color === 'him') rgba = `rgba(200,215,255,${a})`;
      else rgba = `rgba(240,220,200,${a})`;

      ctx.fillStyle = rgba;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---- 光标微光 ---- */
  drawCursor(ctx) {
    const { x, y } = this.pointer;
    if (x < -100) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 22);
    g.addColorStop(0, 'rgba(248,210,150,0.3)');
    g.addColorStop(0.5, 'rgba(248,190,120,0.08)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ================================================================
     DESTROY
     ================================================================ */
  destroy() {
    this.stop();
  }
}
