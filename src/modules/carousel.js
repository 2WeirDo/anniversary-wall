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

export class Carousel {
  constructor(containerId, stageId, onPhotoClick) {
    this.stage = document.getElementById(stageId);
    this.container = document.getElementById(containerId);
    this.total = PHOTOS.length;
    this.current = 0; // 浮点位置，可跨越多圈
    this.items = [];
    this.isDragging = false;
    this.startX = 0;
    this._dragStartCurrent = 0;
    this._swiped = false;
    this._autoTween = null;
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
      const offset = circularOffset(i, this.current, this.total);
      this.layoutCard(el, offset, duration);
    });
  }

  layoutCard(el, offset, duration = 0.45) {
    const isActive = Math.abs(offset) < 0.5;
    const absOff = Math.abs(offset);

    let xPercent, scale, opacity, zIndex, rotateY;

    if (isActive) {
      // 在中心附近：平缓过渡
      const t = absOff / 0.5; // 0（完全居中）→ 1（边缘）
      xPercent = offset * 55; // 跟随偏移微调
      scale = 1 - t * 0.05;
      opacity = 1 - t * 0.1;
      zIndex = 10;
      rotateY = offset * 8;
    } else {
      const side = offset > 0 ? 1 : -1;
      const gap = 55 + (absOff - 0.5) * 8;
      xPercent = side * gap;
      scale = 0.82 - absOff * 0.06;
      if (scale < 0.5) scale = 0.5;
      opacity = 0.55 - absOff * 0.15;
      if (opacity < 0.15) opacity = 0.15;
      zIndex = 5 - Math.floor(absOff);
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
      this._velocity = (cx - this._lastX) / dt; // px/ms
    }
    this._lastX = cx;
    this._lastTime = now;

    // 标记滑动（移动超过5px即为滑动而非点击）
    if (Math.abs(cx - this.startX) > 5) {
      this._swiped = true;
    }

    // 直接更新浮点位置：拖拽像素 / 150 → 卡片偏移量
    const dragOffset = (cx - this.startX) / 150;
    this.current = this._dragStartCurrent - dragOffset;
    this.layoutAll(0);
  }

  onUp() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.stage.classList.remove('dragging');

    const absVel = Math.abs(this._velocity);

    if (absVel > 0.15) {
      // 有惯性：继续滑动一段后自然停下，然后接自动轮播
      const momentum = this._velocity * 400; // 惯性距离
      const target = this.current - momentum / 150;
      this._autoTween = gsap.to(this, {
        current: target,
        duration: 0.5,
        ease: 'power2.out',
        onUpdate: () => this.layoutAll(0),
        onComplete: () => {
          this.layoutAll(0);
          this.scheduleAuto();
        },
      });
    } else {
      // 无惯性：直接从当前位置开始自动轮播
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
    // 找到离当前位置最近的该卡片实例
    const rounded = Math.round(this.current);
    let target = index;
    while (target < rounded - this.total / 2) target += this.total;
    while (target > rounded + this.total / 2) target -= this.total;
    // 微调：让最近的整数位置指向这张卡片
    if (Math.abs(target - this.current) > this.total / 2) {
      target = target > this.current ? target - this.total : target + this.total;
    }
    this.current = target;
    this.layoutAll(0.35);
    this.scheduleAuto();
  }

  /* ---------- 自动轮播 ---------- */
  scheduleAuto() {
    this.stopAuto();
    if (this.paused) return;
    // 从当前浮点位置平滑移动到下一整数位置
    const next = Math.floor(this.current) + 1;
    const remaining = next - this.current;
    const duration = Math.max(0.8, remaining * 2.5);
    this._autoTween = gsap.to(this, {
      current: next,
      duration,
      ease: 'none',
      onUpdate: () => this.layoutAll(0),
      onComplete: () => this.scheduleAuto(),
    });
  }

  stopAuto() {
    if (this._autoTween) {
      this._autoTween.kill();
      this._autoTween = null;
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
