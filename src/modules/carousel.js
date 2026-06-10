/**
 * 旋转木马照片墙
 * GSAP 驱动 — 当前照片居中，两侧卡片缩小倾斜，丝滑切换
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

export class Carousel {
  constructor(containerId, stageId, onPhotoClick) {
    this.stage = document.getElementById(stageId);
    this.container = document.getElementById(containerId);
    this.total = PHOTOS.length;
    this.current = 0;
    this.items = [];
    this.isDragging = false;
    this.startX = 0;
    this.startOffset = 0;
    this.dragOffset = 0;
    this.autoTimer = null;
    this.paused = false;
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
      const offset = i - this.current;
      this.layoutCard(el, offset, duration);
    });
  }

  layoutCard(el, offset, duration = 0.45) {
    const isActive = offset === 0;
    const absOff = Math.abs(offset);

    let xPercent, scale, opacity, zIndex, rotateY;

    if (isActive) {
      xPercent = 0;
      scale = 1;
      opacity = 1;
      zIndex = 10;
      rotateY = 0;
    } else {
      const side = offset > 0 ? 1 : -1;
      const gap = 55 + absOff * 8;
      xPercent = side * gap;
      scale = 0.82 - absOff * 0.06;
      if (scale < 0.5) scale = 0.5;
      opacity = 0.55 - absOff * 0.15;
      if (opacity < 0.15) opacity = 0.15;
      zIndex = 5 - absOff;
      if (zIndex < 0) zIndex = 0;
      rotateY = side * (12 + absOff * 3);
    }

    const tl = gsap.timeline();
    tl.to(el, {
      xPercent,
      scale,
      opacity,
      rotateY,
      zIndex,
      duration,
      ease: 'power2.out',
      overwrite: 'auto',
    }, 0);

    el.classList.toggle('active', isActive);
    el.style.pointerEvents = isActive ? 'auto' : 'none';
  }

  /* ---------- 事件绑定 ---------- */
  bindEvents() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.prev();
      if (e.key === 'ArrowRight') this.next();
    });

    // 鼠标拖拽
    this.stage.addEventListener('mousedown', (e) => this.onDown(e));
    window.addEventListener('mousemove', (e) => this.onMove(e));
    window.addEventListener('mouseup', () => this.onUp());

    // 触摸
    this.stage.addEventListener('touchstart', (e) => this.onDown(e), { passive: false });
    window.addEventListener('touchmove', (e) => this.onMove(e), { passive: false });
    window.addEventListener('touchend', () => this.onUp());

    // 点击卡片 → 弹出详情
    this.container.addEventListener('click', (e) => {
      // 滑动超过阈值不算点击
      if (this._swiped) return;
      const card = e.target.closest('.carousel-card');
      if (!card) return;
      const idx = parseInt(card.getAttribute('data-index'));
      if (this.onPhotoClick) {
        this.onPhotoClick(idx);
      }
    });
  }

  onDown(e) {
    this.isDragging = true;
    this._swiped = false;
    this.stopAuto();
    this.startX = e.touches ? e.touches[0].clientX : e.clientX;
    this._lastX = this.startX;
    this._lastTime = Date.now();
    this._velocity = 0;
    this.startOffset = 0;
    this.dragOffset = 0;
    this.stage.classList.add('dragging');
  }

  onMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const now = Date.now();
    const dt = now - this._lastTime;
    if (dt > 0) {
      this._velocity = (cx - this._lastX) / dt; // px/ms
    }
    this._lastX = cx;
    this._lastTime = now;

    // 标记滑动（移动超过5px即为滑动而非点击）
    if (Math.abs(cx - this.startX) > 5) {
      this._swiped = true;
    }

    this.dragOffset = (cx - this.startX) / 150;
    this.items.forEach((el, i) => {
      const offset = i - this.current + this.dragOffset;
      this.layoutCard(el, offset, 0.15);
    });
  }

  onUp() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.stage.classList.remove('dragging');

    const threshold = 0.3;
    // 惯性：如果速度够快，自动切换
    const velocityThreshold = 0.3; // px/ms

    if (this._velocity < -velocityThreshold) {
      // 快速左滑 → 下一张
      this.current = Math.min(this.current + 1, this.total - 1);
    } else if (this._velocity > velocityThreshold) {
      // 快速右滑 → 上一张
      this.current = Math.max(this.current - 1, 0);
    } else if (this.dragOffset < -threshold) {
      this.current = Math.min(this.current + 1, this.total - 1);
    } else if (this.dragOffset > threshold) {
      this.current = Math.max(this.current - 1, 0);
    }

    this.layoutAll(0.4);
    this.scheduleAuto();
  }

  /* ---------- 导航 ---------- */
  prev() {
    this.stopAuto();
    this.current = (this.current - 1 + this.total) % this.total;
    this.layoutAll(0.45);
    this.scheduleAuto();
  }

  next() {
    this.stopAuto();
    this.current = (this.current + 1) % this.total;
    this.layoutAll(0.45);
    this.scheduleAuto();
  }

  goTo(index) {
    this.stopAuto();
    this.current = index;
    this.layoutAll(0.35);
    this.scheduleAuto();
  }

  /* ---------- 自动轮播 ---------- */
  scheduleAuto() {
    this.stopAuto();
    if (this.paused) return;
    this.autoTimer = setTimeout(() => this.autoLoop(), 1800);
  }

  autoLoop() {
    if (this.isDragging || this.paused) {
      this.scheduleAuto();
      return;
    }
    this.next();
  }

  stopAuto() {
    if (this.autoTimer) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
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
