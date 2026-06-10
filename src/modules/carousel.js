/**
 * 旋转木马照片墙
 * GSAP 驱动 — 连续浮动位置，自由拖拽 + 松手后原地继续轮播
 * 点击照片弹出详情弹窗
 * 内容来源：src/data/content.json
 */
import gsap from 'gsap';
import content from '../data/content.json';

export const PHOTOS = content.photos.map(p => p.file);

/** 每张照片的日期和故事 */
export const PHOTO_META = content.photos.map(p => ({
  date: p.date,
  story: p.story,
}));

/** 翻转背面的情话 */
export const PHOTO_FLIP_TEXTS = content.photos.map(p => p.flipText);

/**
 * 计算卡片 i 相对于 current 的最短环绕偏移
 * 例如 total=14 时，offset 范围在 [-7, 7)
 */
function circularOffset(i, current, total) {
  let offset = i - current;
  const half = total / 2;
  if (offset > half) offset -= total;
  if (offset < -half) offset += total;
  return offset;
}

/**
 * smoothstep: 在 [edge0, edge1] 范围内平滑插值
 */
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export class Carousel {
  constructor(containerId, stageId, onPhotoClick) {
    this.stage = document.getElementById(stageId);
    this.container = document.getElementById(containerId);
    this.total = PHOTOS.length;
    this.current = 0;          // 浮点位置，持续递增（不取模）
    this.items = [];
    this.isDragging = false;
    this.startX = 0;
    this._dragStartCurrent = 0;
    this._swiped = false;
    this._autoTick = null;     // GSAP ticker 回调引用
    this._autoStartTime = 0;
    this._autoStartCurrent = 0;
    this.paused = false;
    this.SPEED = 1 / 2500;     // 每 ms 推进的 current 单位（2.5s/张）
    this.onPhotoClick = onPhotoClick || null;

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
    this.layoutAll(0);
    this.scheduleAuto();
    window.addEventListener('resize', () => this.layoutAll(0));
  }

  /* ---------- 渲染 ---------- */
  render() {
    this.container.innerHTML = '';
    this.items = [];

    PHOTOS.forEach((photo, i) => {
      const base = photo.replace(/\.(jpg|jpeg|png)$/i, '');
      const el = document.createElement('div');
      el.className = 'carousel-card';
      el.setAttribute('data-index', i);
      el.innerHTML = `
        <div class="photo-frame">
          <picture>
            <source srcset="${import.meta.env.BASE_URL}photos-optimized/${base}.webp" type="image/webp" />
            <img src="${import.meta.env.BASE_URL}photos/${photo}" alt="照片 ${i + 1}" draggable="false" />
          </picture>
        </div>
      `;
      this.container.appendChild(el);
      this.items.push(el);
    });
  }

  /* ---------- 布局 ---------- */
  layoutAll(duration = 0.45) {
    this.items.forEach((el, i) => {
      const offset = circularOffset(i, this.current, this.total);
      this.layoutCard(el, offset, duration);
    });
  }

  /**
   * 单张卡片布局 — 全部用连续公式，没有 if/else 硬切换
   *
   * 参数从「中心 (offset=0)」到「远侧 (offset>=2)」平滑过渡：
   *   xPercent: offset * 60        — 线性展开
   *   scale:     1.0 → 0.5        — 指数衰减
   *   opacity:   1.0 → 0.15       — 指数衰减
   *   rotateY:   offset * 18°     — 线性倾斜
   *   zIndex:    10 → 0           — 阶梯下降
   */
  layoutCard(el, offset, duration = 0.45) {
    const absOff = Math.abs(offset);
    const side = offset > 0 ? 1 : (offset < 0 ? -1 : 0);

    // 连续参数（无断点）
    const xPercent = offset * 60;
    const scale = Math.max(0.5, 1 - absOff * 0.22);
    const opacity = Math.max(0.15, 1 - absOff * 0.38);
    const rotateY = side * Math.min(35, absOff * 17);
    const zIndex = Math.max(0, 10 - Math.round(absOff * 2));

    // 只有接近中心的卡片可交互
    const isActive = absOff < 0.5;

    gsap.to(el, {
      xPercent,
      scale,
      opacity,
      zIndex,
      rotateY,
      duration,
      ease: 'power2.out',
      overwrite: 'auto',
    });

    el.classList.toggle('active', isActive);
    el.style.pointerEvents = isActive ? 'auto' : 'none';
  }

  /* ---------- 事件绑定 ---------- */
  bindEvents() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.prev();
      if (e.key === 'ArrowRight') this.next();
    });

    this.stage.addEventListener('mousedown', (e) => this.onDown(e));
    window.addEventListener('mousemove', (e) => this.onMove(e));
    window.addEventListener('mouseup', () => this.onUp());

    this.stage.addEventListener('touchstart', (e) => this.onDown(e), { passive: false });
    window.addEventListener('touchmove', (e) => this.onMove(e), { passive: false });
    window.addEventListener('touchend', () => this.onUp());

    this.container.addEventListener('click', (e) => {
      if (this._swiped) return;
      const card = e.target.closest('.carousel-card');
      if (!card) return;
      const idx = parseInt(card.getAttribute('data-index'));
      if (this.onPhotoClick) this.onPhotoClick(idx);
    });
  }

  /* ---------- 拖拽 ---------- */
  onDown(e) {
    this.isDragging = true;
    this._swiped = false;
    this.stopAuto();
    this.startX = e.touches ? e.touches[0].clientX : e.clientX;
    this._lastX = this.startX;
    this._lastTime = Date.now();
    this._velocity = 0;
    this._dragStartCurrent = this.current;
    this.stage.classList.add('dragging');
  }

  onMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const now = Date.now();
    const dt = now - this._lastTime;
    if (dt > 0) {
      this._velocity = (cx - this._lastX) / dt;
    }
    this._lastX = cx;
    this._lastTime = now;

    if (Math.abs(cx - this.startX) > 5) {
      this._swiped = true;
    }

    this.current = this._dragStartCurrent - (cx - this.startX) / 150;
    this.layoutAll(0);
  }

  onUp() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.stage.classList.remove('dragging');

    const absVel = Math.abs(this._velocity);

    if (absVel > 0.15) {
      // 惯性滑动 → 动量衰减 → 自动轮播
      const momentum = this._velocity * 400;
      const target = this.current - momentum / 150;
      const inertiaTween = gsap.to(this, {
        current: target,
        duration: 0.5,
        ease: 'power2.out',
        onUpdate: () => this.layoutAll(0),
        onComplete: () => {
          this.layoutAll(0);
          this.scheduleAuto();
        },
      });
      // 暂存以便 stopAuto 能清理
      this._inertiaTween = inertiaTween;
    } else {
      this.layoutAll(0.2);
      this.scheduleAuto();
    }
  }

  /* ---------- 导航 ---------- */
  prev() {
    this.stopAuto();
    this.current = Math.round(this.current) - 1;
    this.layoutAll(0.45);
    this.scheduleAuto();
  }

  next() {
    this.stopAuto();
    this.current = Math.round(this.current) + 1;
    this.layoutAll(0.45);
    this.scheduleAuto();
  }

  goTo(index) {
    this.stopAuto();
    const rounded = Math.round(this.current);
    let target = index;
    while (target < rounded - this.total / 2) target += this.total;
    while (target > rounded + this.total / 2) target -= this.total;
    if (Math.abs(target - this.current) > this.total / 2) {
      target = target > this.current ? target - this.total : target + this.total;
    }
    this.current = target;
    this.layoutAll(0.35);
    this.scheduleAuto();
  }

  /* ---------- 自动轮播 ---------- */

  /**
   * 使用 GSAP ticker 持续推进 current
   * 不依赖 onComplete 链式回调，不会被意外打断
   */
  scheduleAuto() {
    this.stopAuto();
    if (this.paused) return;

    this._autoStartTime = Date.now();
    this._autoStartCurrent = this.current;

    const onTick = () => {
      if (this.paused || this.isDragging) return;
      const elapsed = Date.now() - this._autoStartTime;
      this.current = this._autoStartCurrent + elapsed * this.SPEED;
      this.layoutAll(0);
    };

    gsap.ticker.add(onTick);
    this._autoTick = onTick;
  }

  stopAuto() {
    if (this._autoTick) {
      gsap.ticker.remove(this._autoTick);
      this._autoTick = null;
    }
    if (this._inertiaTween) {
      this._inertiaTween.kill();
      this._inertiaTween = null;
    }
  }

  pause() {
    this.paused = true;
    this.stopAuto();
  }

  resume() {
    this.paused = false;
    this.scheduleAuto();
  }
}
