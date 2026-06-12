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
  while (offset > half) offset -= total;
  while (offset < -half) offset += total;
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
    this._quickSetters = [];   // 每卡片预创建的 quickSetter，避免 tick 中创建 tween
    this.dotsEl = document.getElementById('carousel-dots');
    this._dots = [];
    this.isDragging = false;
    this.startX = 0;
    this._dragStartCurrent = 0;
    this._swiped = false;
    this._autoTick = null;     // GSAP ticker 回调引用
    this._autoStartTime = 0;
    this._autoStartCurrent = 0;
    this.paused = false;
    this.SPEED = 1 / 2500;     // 每 ms 推进的 current 单位（2.5s/张）
    this.SLOW_SPEED = 1 / 5000; // hover 减速（~5s/张）
    this._currentSpeed = this.SPEED;
    this._lastTickTime = 0;
    this._isHovering = false;
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

    // 渲染圆点指示器
    if (this.dotsEl) {
      this.dotsEl.innerHTML = '';
      this._dots = [];
      for (let i = 0; i < this.total; i++) {
        const dot = document.createElement('span');
        dot.className = 'carousel-dot';
        if (i === 0) dot.classList.add('active');
        this.dotsEl.appendChild(dot);
        this._dots.push(dot);
      }
    }

    PHOTOS.forEach((photo, i) => {
      const base = photo.replace(/\.(jpg|jpeg|png)$/i, '');
      const el = document.createElement('div');
      el.className = 'carousel-card';
      el.setAttribute('data-index', i);
      el.innerHTML = `
        <div class="photo-frame">
          <picture>
            <source srcset="${import.meta.env.BASE_URL}photos-optimized/${base}.webp" type="image/webp" />
            <img src="${import.meta.env.BASE_URL}photos/${photo}" alt="${PHOTO_META[i]?.story || '照片 ' + (i + 1)}" draggable="false"
              onload="this.closest('.photo-frame').classList.add('loaded');this.classList.add('loaded')"
              onerror="const f=this.closest('.photo-frame');const p=this.closest('picture');if(p){const s=p.querySelector('source');if(s){s.remove();}}this.src='${import.meta.env.BASE_URL}photos/${photo}';this.onerror=null"
            />
          </picture>
        </div>
      `;
      this.container.appendChild(el);
      this.items.push(el);
    });
  }

  /* ---------- 布局 ---------- */

  /** 计算单张卡片的视觉参数（纯计算，不操作 DOM） */
  _calcCard(offset) {
    const absOff = Math.abs(offset);
    const side = offset > 0 ? 1 : (offset < 0 ? -1 : 0);

    const activeX = offset * 55;
    const activeScale = 1;
    const activeOpacity = 1;
    const activeRotateY = offset * 8;
    const activeZIndex = 10;

    const sideGap = 42 + Math.max(0, absOff - 0.5) * 6;
    const sideX = side * sideGap;
    let sideScale = 0.90 - absOff * 0.04;
    if (sideScale < 0.55) sideScale = 0.55;
    let sideOpacity = 0.76 - absOff * 0.10;
    if (sideOpacity < 0.22) sideOpacity = 0.22;
    const sideZIndex = Math.max(0, 5 - Math.floor(absOff));
    const sideRotateY = side * (10 + absOff * 2.5);

    const t = smoothstep(0.3, 0.6, absOff);

    return {
      xPercent: activeX + (sideX - activeX) * t,
      scale: activeScale + (sideScale - activeScale) * t,
      opacity: activeOpacity + (sideOpacity - activeOpacity) * t,
      rotateY: activeRotateY + (sideRotateY - activeRotateY) * t,
      zIndex: Math.round(activeZIndex + (sideZIndex - activeZIndex) * t),
      isActive: absOff < 0.5,
    };
  }

  layoutAll(duration = 0.45) {
    this.items.forEach((el, i) => {
      const offset = circularOffset(i, this.current, this.total);
      this.layoutCard(el, offset, duration);
    });
    this.updateCounter();
  }

  /** 更新圆点指示器 — 窗口限制最多 9 个，超出时隐藏边缘 */
  updateCounter() {
    if (!this._dots.length) return;
    const idx = ((Math.round(this.current) % this.total) + this.total) % this.total;
    const MAX = 9;
    const total = this._dots.length;

    let start, end;
    if (total <= MAX) {
      start = 0;
      end = total;
    } else {
      const half = Math.floor(MAX / 2);
      start = Math.max(0, idx - half);
      end = start + MAX;
      if (end > total) { end = total; start = end - MAX; }
    }

    this._dots.forEach((dot, i) => {
      const visible = i >= start && i < end;
      dot.style.display = visible ? '' : 'none';
      dot.classList.toggle('active', i === idx);
    });
  }

  /**
   * 单张卡片布局（带动画）— 用于点击/拖拽结束等离散操作
   */
  layoutCard(el, offset, duration = 0.45) {
    const c = this._calcCard(offset);
    gsap.to(el, {
      xPercent: c.xPercent,
      scale: c.scale,
      opacity: c.opacity,
      zIndex: c.zIndex,
      rotateY: c.rotateY,
      duration,
      ease: 'power2.out',
      overwrite: 'auto',
    });
    el.classList.toggle('active', c.isActive);
    el.style.pointerEvents = c.isActive ? 'auto' : 'none';
  }

  /**
   * 单张卡片布局（直接设值，无 tween 开销）— 用于高频 auto-tick
   */
  _setCard(el, offset) {
    const c = this._calcCard(offset);
    el.style.transform = `translateX(${c.xPercent}%) scale(${c.scale}) rotateY(${c.rotateY}deg)`;
    el.style.opacity = c.opacity;
    el.style.zIndex = c.zIndex;
    el.classList.toggle('active', c.isActive);
    el.style.pointerEvents = c.isActive ? 'auto' : 'none';
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

    // hover 减速轮播（不暂停）
    this.stage.addEventListener('mouseenter', () => {
      this._isHovering = true;
      this.slowDown();
      this.stage.style.cursor = 'grab';
    });
    this.stage.addEventListener('mouseleave', () => {
      this._isHovering = false;
      this.speedUp();
      this.stage.style.cursor = '';
    });

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
    this._currentSpeed = this.SPEED; // 拖拽时恢复原速
    this.startX = e.touches ? e.touches[0].clientX : e.clientX;
    this._lastX = this.startX;
    this._lastTime = Date.now();
    this._velocity = 0;
    this._dragStartCurrent = this.current;
    this.stage.classList.add('dragging');
    this.stage.style.cursor = 'grabbing';
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
    this.stage.style.cursor = this._isHovering ? 'grab' : '';
    // 松手后若仍 hover 则恢复减速
    if (this._isHovering) {
      this._currentSpeed = this.SLOW_SPEED;
    }

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
   * delta-based 推进，hover 时实时减速，松手后恢复原速，无跳变
   */
  scheduleAuto() {
    this.stopAuto();
    if (this.paused) return;

    this._lastTickTime = Date.now();
    this._tickFrame = 0;

    const onTick = () => {
      if (this.paused || this.isDragging) return;
      const now = Date.now();
      const dt = now - this._lastTickTime;
      this._lastTickTime = now;
      this.current += dt * this._currentSpeed;

      // 直接设值，不创建 GSAP tween（高频 tick 优化）
      for (let i = 0; i < this.items.length; i++) {
        const offset = circularOffset(i, this.current, this.total);
        this._setCard(this.items[i], offset);
      }

      // 计数器每 30 帧更新一次（减少 DOM 写入）
      this._tickFrame++;
      if (this._tickFrame % 30 === 0) {
        this.updateCounter();
      }
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

  /** hover 时减速轮播，不暂停 */
  slowDown() {
    if (this.isDragging) return;
    this._currentSpeed = this.SLOW_SPEED;
  }

  /** 离开 hover 区域恢复原速 */
  speedUp() {
    this._currentSpeed = this.SPEED;
  }
}
