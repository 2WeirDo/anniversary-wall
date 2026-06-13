/**
 * 移动端照片画廊 — 触摸滑动 + 惯性动画
 * 替代桌面端 3D carousel（≤768px 时启用）
 * 数据源与 Carousel 共享：PHOTOS、PHOTO_META
 */
import { PHOTOS, PHOTO_META } from './carousel.js';

export class MobileGallery {
  constructor(containerId, onPhotoClick) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.total = PHOTOS.length;
    this.current = 0;
    this.onPhotoClick = onPhotoClick || null;

    // 触摸状态
    this._touchStartX = 0;
    this._touchStartY = 0;
    this._touchCurrentX = 0;
    this._dragging = false;
    this._startOffset = 0;
    this._velocity = 0;
    this._lastX = 0;
    this._lastTime = 0;
    this._animId = null;

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
  }

  /* ---------- 渲染 ---------- */
  render() {
    this.container.innerHTML = '';

    // Track
    const track = document.createElement('div');
    track.className = 'mobile-gallery-track';
    track.id = 'mobile-gallery-track';

    PHOTOS.forEach((photo, i) => {
      const base = photo.replace(/\.(jpg|jpeg|png)$/i, '');
      const slide = document.createElement('div');
      slide.className = 'mobile-gallery-slide' + (i === 0 ? ' active' : '');
      slide.setAttribute('data-index', i);

      // 首屏预加载 ±1
      const eager = Math.abs(i) <= 1;
      const imgAttr = eager ? 'src' : 'data-src';

      slide.innerHTML = `
        <div class="mobile-photo-frame">
          <picture>
            <source ${eager ? 'srcset' : 'data-srcset'}="${import.meta.env.BASE_URL}photos-optimized/${base}-small.webp" type="image/webp" />
            <img ${imgAttr}="${import.meta.env.BASE_URL}photos-optimized/${base}-small.webp"
              alt="${PHOTO_META[i]?.story || '照片 ' + (i + 1)}" draggable="false"
              onload="this.style.opacity='1'"
              onerror="this.style.display='none';this.onerror=null"
            />
          </picture>
        </div>
      `;

      track.appendChild(slide);
    });

    this.container.appendChild(track);
    this.track = track;

    // 指示点
    const dotsEl = document.createElement('div');
    dotsEl.className = 'mobile-gallery-dots';
    for (let i = 0; i < this.total; i++) {
      const dot = document.createElement('span');
      dot.className = 'mobile-gallery-dot' + (i === 0 ? ' active' : '');
      dotsEl.appendChild(dot);
    }
    this.container.appendChild(dotsEl);
    this.dotsEl = dotsEl;

    // 计数器
    const counter = document.createElement('div');
    counter.className = 'mobile-gallery-counter';
    counter.textContent = `1 / ${this.total}`;
    this.container.appendChild(counter);
    this.counterEl = counter;

    // 初始定位
    this._setOffset(0, 0);

    // 兼容 modal.js 接口（Array，支持 .find()）
    this.items = Array.from(this.track.querySelectorAll('.mobile-gallery-slide'));

    // 延迟加载可视范围图片
    this._loadVisibleSlides();
  }

  /** 延迟加载可视窗口内的图片 */
  _loadVisibleSlides() {
    const slides = this.track.querySelectorAll('.mobile-gallery-slide');
    const loadSlide = (s) => {
      const source = s.querySelector('source');
      const img = s.querySelector('img');
      if (source && source.dataset.srcset) {
        source.srcset = source.dataset.srcset;
        source.removeAttribute('data-srcset');
      }
      if (img && img.dataset.src) {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      }
    };

    // 立即加载当前 ±2
    slides.forEach((s, i) => {
      if (Math.abs(i - this.current) <= 2) loadSlide(s);
    });

    // 150ms 后加载剩余
    setTimeout(() => {
      slides.forEach((s, i) => {
        if (Math.abs(i - this.current) <= 5) loadSlide(s);
      });
    }, 300);
  }

  /* ---------- 定位 ---------- */
  _setOffset(offset, duration = 0) {
    if (!this.track) return;
    this.track.style.transition = duration > 0 ? `transform ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1)` : 'none';
    this.track.style.transform = `translateX(${offset}px)`;
    this._currentOffset = offset;
  }

  _calcTargetOffset(index) {
    const slideWidth = this.container.offsetWidth;
    return -index * slideWidth;
  }

  goTo(index, animateOrCallback, onComplete) {
    const animate = typeof animateOrCallback === 'boolean' ? animateOrCallback : true;
    const callback = typeof animateOrCallback === 'function' ? animateOrCallback : onComplete;

    this.current = ((index % this.total) + this.total) % this.total;
    const offset = this._calcTargetOffset(this.current);
    this._setOffset(offset, animate ? 350 : 0);
    this._updateIndicators();
    this._loadVisibleSlides();

    if (callback) {
      setTimeout(callback, animate ? 350 : 0);
    }
  }

  pause() { /* 移动端画廊不需要自动轮播，no-op */ }
  resume() { /* no-op */ }

  _updateIndicators() {
    if (this.counterEl) {
      this.counterEl.textContent = `${this.current + 1} / ${this.total}`;
    }
    if (this.dotsEl) {
      const dots = this.dotsEl.querySelectorAll('.mobile-gallery-dot');
      dots.forEach((d, i) => {
        d.classList.toggle('active', i === this.current);
      });
    }
    // 标记当前 slide 为 active（兼容 modal positionBubble）
    this.items.forEach((el, i) => {
      el.classList.toggle('active', i === this.current);
    });
  }

  /* ---------- 事件 ---------- */
  bindEvents() {
    this.track.addEventListener('touchstart', (e) => this._onDown(e), { passive: false });
    this.track.addEventListener('touchmove', (e) => this._onMove(e), { passive: false });
    this.track.addEventListener('touchend', () => this._onUp());

    // 点击事件（轻触无滑动时触发）
    this.track.addEventListener('click', (e) => {
      if (this._swiped) return;
      const slide = e.target.closest('.mobile-gallery-slide');
      if (!slide) return;
      const idx = parseInt(slide.getAttribute('data-index'));
      if (idx === this.current && this.onPhotoClick) {
        this.onPhotoClick(idx);
      }
    });

    // 键盘
    document.addEventListener('keydown', (e) => {
      if (!this.container.offsetParent) return; // 不可见时跳过
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.goTo(this.current - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); this.goTo(this.current + 1); }
    });

    // resize 时重新定位
    window.addEventListener('resize', () => {
      if (this.container.offsetParent) {
        this._setOffset(this._calcTargetOffset(this.current), 0);
      }
    });
  }

  _onDown(e) {
    this._dragging = true;
    this._swiped = false;
    this._startOffset = this._currentOffset || this._calcTargetOffset(this.current);
    this._touchStartX = e.touches[0].clientX;
    this._touchStartY = e.touches[0].clientY;
    this._lastX = this._touchStartX;
    this._lastTime = Date.now();
    this._velocity = 0;
    // 取消过渡动画
    this._setOffset(this._startOffset, 0);
  }

  _onMove(e) {
    if (!this._dragging) return;
    const cx = e.touches[0].clientX;
    const cy = e.touches[0].clientY;
    const dx = cx - this._touchStartX;

    // 水平滑动超过垂直 → 阻止页面滚动
    if (Math.abs(dx) > Math.abs(cy - this._touchStartY)) {
      e.preventDefault();
    }

    if (Math.abs(dx) > 5) {
      this._swiped = true;
    }

    const now = Date.now();
    const dt = now - this._lastTime;
    if (dt > 0) {
      this._velocity = (cx - this._lastX) / dt;
    }
    this._lastX = cx;
    this._lastTime = now;

    this._setOffset(this._startOffset + dx, 0);
  }

  _onUp() {
    if (!this._dragging) return;
    this._dragging = false;

    const slideWidth = this.container.offsetWidth;
    const currentOffset = this._currentOffset || this._startOffset;

    // 惯性滑动或吸附到最近卡片
    let targetIdx = this.current;

    if (Math.abs(this._velocity) > 0.3) {
      // 有足够惯性 → 按方向翻1张
      targetIdx = this._velocity > 0 ? this.current - 1 : this.current + 1;
    } else {
      // 吸附到最近
      const rawIdx = Math.round(-currentOffset / slideWidth);
      targetIdx = Math.max(0, Math.min(this.total - 1, rawIdx));
    }

    this.goTo(targetIdx, true);
  }
}
