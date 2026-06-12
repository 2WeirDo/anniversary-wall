/**
 * Star Theater — 指尖星图 × 剪影小剧场
 * Canvas 星空背景 + 星座连线 + 触控星光 + SVG 剪影动画
 */

/* ---- 心形星座采样点（参数方程，20 个关键星） ---- */
function heartCurve(t) {
  const t2 = t * Math.PI * 2;
  return {
    x: 16 * Math.pow(Math.sin(t2), 3),
    y: -(13 * Math.cos(t2) - 5 * Math.cos(2 * t2) - 2 * Math.cos(3 * t2) - Math.cos(4 * t2)),
  };
}

const CONSTELLATION_POINTS = Array.from({ length: 20 }, (_, i) => heartCurve(i / 20));

export class StarTheater {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    // Canvas
    this.canvas = this.container.querySelector('.star-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    // Silhouette stage
    this.stage = this.container.querySelector('.silhouette-stage');
    this.silHer = this.container.querySelector('.silhouette-her');
    this.silHim = this.container.querySelector('.silhouette-him');

    // State
    this.width = 0;
    this.height = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.stars = [];
    this.constellationIndices = [];
    this.pointer = { x: -100, y: -100, active: false };
    this.trail = [];
    this.phase = 0;          // 0=idle, 1=her-enters, 2=him-enters, 3=meeting, 4=connected
    this.phaseStart = 0;
    this.theaterStarted = false;
    this.animationId = null;
    this.isMobile = window.matchMedia('(max-width: 768px)').matches;

    this.init();
  }

  /* ======== 初始化 ======== */
  init() {
    this.resize();
    this.generateStars();
    this.bindEvents();
    this.startLoop();
    this.observeScroll();

    window.addEventListener('resize', () => {
      this.resize();
      this.generateStars();
    });
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  /* ======== 星星生成 ======== */
  generateStars() {
    this.stars = [];
    this.constellationIndices = [];

    const count = this.isMobile ? 100 : 180;
    const cx = this.width / 2;
    const cy = this.height * 0.38;
    const scale = Math.min(this.width, this.height) * 0.022;

    // 随机背景星
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        r: 0.4 + Math.random() * 1.8,
        baseAlpha: 0.15 + Math.random() * 0.55,
        twinkleSpeed: 0.3 + Math.random() * 1.8,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }

    // 星座关键星（心形，偏移到画布中心偏上）
    for (const pt of CONSTELLATION_POINTS) {
      const idx = this.stars.length;
      this.constellationIndices.push(idx);
      this.stars.push({
        x: cx + pt.x * scale,
        y: cy + pt.y * scale,
        r: 1.6 + Math.random() * 1.4,
        baseAlpha: 0, // 初始不可见，剧场触发后渐亮
        twinkleSpeed: 0.6 + Math.random() * 0.8,
        twinklePhase: Math.random() * Math.PI * 2,
        isConstellation: true,
      });
    }
  }

  /* ======== 事件绑定 ======== */
  bindEvents() {
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e), { passive: true });
    this.canvas.addEventListener('pointerleave', () => this.onPointerLeave());
    this.canvas.addEventListener('pointerenter', (e) => {
      this.pointer.active = true;
      this.pointer.x = e.offsetX;
      this.pointer.y = e.offsetY;
    });
  }

  onPointerMove(e) {
    this.pointer.active = true;
    this.pointer.x = e.offsetX;
    this.pointer.y = e.offsetY;

    // 生成拖尾粒子
    if (!this.isMobile) {
      this.trail.push({
        x: e.offsetX,
        y: e.offsetY,
        r: 2 + Math.random() * 6,
        alpha: 0.7,
        life: 1,
      });
    }
  }

  onPointerLeave() {
    this.pointer.active = false;
  }

  /* ======== IntersectionObserver ======== */
  observeScroll() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !this.theaterStarted) {
            this.theaterStarted = true;
            this.startTheater();
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(this.container);
  }

  /* ======== 剧场时间线 ======== */
  startTheater() {
    this.phase = 1;
    this.phaseStart = performance.now();

    if (this.stage) this.stage.classList.add('active');
    if (this.silHer) this.silHer.classList.add('enter');
    if (this.silHim) this.silHim.classList.add('enter');
  }

  /* ======== 渲染循环 ======== */
  startLoop() {
    const loop = (ts) => {
      this.draw(ts);
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  draw(timestamp) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. 深空背景渐变
    const bg = ctx.createRadialGradient(
      this.width / 2, this.height * 0.35, 0,
      this.width / 2, this.height * 0.5, Math.max(this.width, this.height) * 0.9
    );
    bg.addColorStop(0, 'rgba(20, 15, 40, 0.15)');
    bg.addColorStop(0.5, 'rgba(10, 8, 24, 0.6)');
    bg.addColorStop(1, 'rgba(6, 4, 16, 0.95)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. 更新剧场阶段
    this.updateTheaterPhase(timestamp);

    // 3. 画星座连线
    this.drawConstellationLines(ctx);

    // 4. 画所有星星
    for (const star of this.stars) {
      this.drawStar(ctx, star, timestamp);
    }

    // 5. 触控光晕
    if (this.pointer.active) {
      this.drawPointerGlow(ctx);
    }

    // 6. 拖尾粒子
    this.drawTrail(ctx);

    // 7. 触控点亮附近星星
    if (this.pointer.active) {
      this.glowNearbyStars(ctx, timestamp);
    }
  }

  /* ======== 剧场阶段管理 ======== */
  updateTheaterPhase(ts) {
    if (this.phase === 0) return;
    const elapsed = (ts - this.phaseStart) / 1000;

    // Phase 1→2: her 到达后 him 出发
    if (this.phase === 1 && elapsed > 1.2) {
      this.phase = 2;
      if (this.silHim) this.silHim.classList.add('enter');
    }
    // Phase 2→3: 两人相遇
    if (this.phase === 2 && elapsed > 2.4) {
      this.phase = 3;
      if (this.stage) this.stage.classList.add('meeting');
    }
    // Phase 3→4: 心形星座点亮
    if (this.phase === 3 && elapsed > 3.8) {
      this.phase = 4;
      if (this.stage) this.stage.classList.add('connected');
      // 星座星渐亮
      for (const idx of this.constellationIndices) {
        this.stars[idx]._fadeIn = ts;
      }
    }
  }

  /* ======== 星座连线 ======== */
  drawConstellationLines(ctx) {
    if (this.phase < 3) return; // meeting 阶段开始画线

    const constellationAlpha = this.phase >= 4 ? 1 : Math.min(1, this.constellationFadeProgress());

    ctx.save();
    ctx.globalAlpha = constellationAlpha * 0.45;
    ctx.strokeStyle = '#e8b860';
    ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(240, 200, 140, 0.5)';
    ctx.shadowBlur = 6;

    ctx.beginPath();
    const pts = this.constellationIndices.map(i => this.stars[i]);
    if (pts.length > 0) {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
    }
    ctx.stroke();

    // 画第二组稀疏连线（交叉线增加星座感）
    ctx.globalAlpha = constellationAlpha * 0.2;
    ctx.lineWidth = 0.5;
    ctx.shadowBlur = 3;
    ctx.beginPath();
    for (let i = 0; i < pts.length - 3; i++) {
      const j = (i + 8) % pts.length;
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[j].x, pts[j].y);
    }
    ctx.stroke();

    ctx.restore();
  }

  constellationFadeProgress() {
    if (this.phase < 3) return 0;
    // 根据时间缓入
    const now = performance.now();
    const firstStar = this.constellationIndices[0];
    if (!firstStar || !this.stars[firstStar]._fadeIn) return 0;
    const elapsed = (now - this.stars[firstStar]._fadeIn) / 1000;
    return Math.min(1, elapsed / 1.5);
  }

  /* ======== 单颗星星 ======== */
  drawStar(ctx, star, ts) {
    // 星座星渐变 alpha
    let alpha = star.baseAlpha;
    if (star.isConstellation) {
      if (star._fadeIn) {
        const elapsed = (ts - star._fadeIn) / 1000;
        alpha = Math.min(0.9, elapsed / 1.2 * 0.9);
      } else {
        alpha = 0;
      }
    }

    if (alpha <= 0.01) return;

    // 闪烁
    const twinkle = 0.6 + 0.4 * Math.sin(ts * 0.001 * star.twinkleSpeed + star.twinklePhase);
    const finalAlpha = alpha * twinkle;

    const color = star.isConstellation
      ? `rgba(248, 216, 144, ${finalAlpha})`
      : `rgba(220, 210, 240, ${finalAlpha})`;

    ctx.save();
    ctx.fillStyle = color;

    // 光晕
    if (star.isConstellation || star.r > 1.4) {
      const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.r * 3);
      const glowColor = star.isConstellation
        ? `rgba(248, 200, 120, ${finalAlpha * 0.5})`
        : `rgba(200, 190, 230, ${finalAlpha * 0.3})`;
      glow.addColorStop(0, glowColor);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 星点本体
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* ======== 触控光晕 ======== */
  drawPointerGlow(ctx) {
    const { x, y } = this.pointer;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 80);
    glow.addColorStop(0, 'rgba(248, 210, 140, 0.35)');
    glow.addColorStop(0.3, 'rgba(248, 190, 120, 0.15)');
    glow.addColorStop(0.7, 'rgba(200, 160, 200, 0.04)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 80, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ======== 触控点亮附近星星 ======== */
  glowNearbyStars(ctx, ts) {
    const { x, y } = this.pointer;
    for (const star of this.stars) {
      const dx = star.x - x;
      const dy = star.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100) {
        const boost = (1 - dist / 100) * 0.5;
        const alpha = Math.min(1, star.baseAlpha + boost);
        const color = star.isConstellation
          ? `rgba(255, 230, 170, ${alpha})`
          : `rgba(240, 230, 255, ${alpha})`;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r + boost * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* ======== 拖尾粒子 ======== */
  drawTrail(ctx) {
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = this.trail[i];
      p.life -= 0.025;
      p.alpha = p.life * 0.6;
      if (p.life <= 0) {
        this.trail.splice(i, 1);
        continue;
      }
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      glow.addColorStop(0, `rgba(248, 210, 150, ${p.alpha})`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ======== 销毁 ======== */
  destroy() {
    this.stop();
    window.removeEventListener('resize', this.resize);
  }
}
