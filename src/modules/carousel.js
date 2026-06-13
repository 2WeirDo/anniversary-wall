/**
 * 旋转木马照片墙
 * GSAP 驱动 — 连续浮动位置，自由拖拽 + 松手后原地继续轮播
 * 点击照片弹出详情弹窗
 * 内容来源：src/data/content.json
 *
 * 架构（v3 — 消除 GSAP-vs-直写冲突）：
 * - GSAP 只动画 this.current（一个数字），不直接管理任何卡片的 transform
 * - 所有卡片定位统一走 _setCard（直写 style.transform）
 * - tick / 拖拽 / layoutAll onUpdate 全部用同一路径，无矩阵分解偏差
 * - 离屏图片用 data-src 延迟加载
 */

/** 可视窗口半宽 — 图片加载的可见范围（屏幕上实际可见约 ±3，留余量到 ±5） */
const VISIBLE_HALF = 5;
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
    this.current = 0;
    this.items = [];
    this.dotsEl = document.getElementById('carousel-counter');
    this.isDragging = false;
    this.startX = 0;
    this._dragStartCurrent = 0;
    this._swiped = false;
    this._autoTick = null;
    this.paused = false;
    this.SPEED = 1 / 2800;      // ~2.8s/张（提速20%）
    this.SLOW_SPEED = 1 / 4800; // hover 减速 ~4.8s/张（提速20%）
    this._currentSpeed = this.SPEED;
    this._lastTickTime = 0;
    this._isHovering = false;
    this.onPhotoClick = onPhotoClick || null;
    // 布局动画期间阻止 tick 更新
    this._animating = false;
    this._animTL = null;

    this.init();
  }

  init() {
    this.render();
    this._loadVisibleImages();
    this.bindEvents();
    // 初始布局用 _setCard 直设，避免 layoutAll 对 29 张卡同时创建 GSAP tween
    this._positionAll();
    this.scheduleAuto();
    window.addEventListener('resize', () => this._positionAll());
  }

  /** 初始化/resize 时直设所有卡片位置（无 GSAP 开销） */
  _positionAll() {
    this.items.forEach((el, i) => {
      const offset = circularOffset(i, this.current, this.total);
      this._setCard(el, offset);
    });
    this.updateCounter();
  }

  /* ---------- 渲染 ---------- */
  render() {
    this.container.innerHTML = '';
    this.items = [];

    // 计数器初始值
    if (this.dotsEl) {
      this.dotsEl.textContent = `1 / ${this.total}`;
    }

    PHOTOS.forEach((photo, i) => {
      const base = photo.replace(/\.(jpg|jpeg|png)$/i, '');
      const el = document.createElement('div');
      el.className = 'carousel-card';
      el.setAttribute('data-index', i);

      // 首屏可见卡片（偏移 ≤1）直接用 src/srcset，其余用 data-src 延迟加载
      const initOffset = circularOffset(i, 0, this.total);
      const eager = Math.abs(initOffset) <= 1;
      const srcKey = eager ? 'src' : 'data-src';
      const srcsetKey = eager ? 'srcset' : 'data-srcset';

      el.innerHTML = `
        <div class="photo-frame">
          <picture>
            <source ${srcsetKey}="${import.meta.env.BASE_URL}photos-optimized/${base}-small.webp" type="image/webp" />
            <img ${srcKey}="${import.meta.env.BASE_URL}photos-optimized/${base}-small.webp"
              alt="${PHOTO_META[i]?.story || '照片 ' + (i + 1)}" draggable="false"
              onload="this.closest('.photo-frame').classList.add('loaded');this.classList.add('loaded')"
              onerror="this.style.display='none';this.onerror=null"
            />
          </picture>
        </div>
      `;
      // 标记 eagerly-loaded 卡片，避免 _loadVisibleImages 重复处理
      if (eager) el._imageLoaded = true;

      this.container.appendChild(el);
      this.items.push(el);
    });
  }

  /** 触发单张卡片的图片加载（data-src → 真实 src） */
  _loadCardImage(el) {
    if (el._imageLoaded) return;
    el._imageLoaded = true;

    const source = el.querySelector('source');
    const img = el.querySelector('img');

    if (source && source.dataset.srcset) {
      source.srcset = source.dataset.srcset;
      source.removeAttribute('data-srcset');
    }
    if (img && img.dataset.src) {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    }
  }

  /**
   * 渐进式加载可视窗口图片
   * 阶段1（0ms）:   当前 ±1   — 屏幕中央可见（3张）
   * 阶段2（150ms）: 当前 ±3   — 余光可见（7张）
   * 阶段3（400ms）: 当前 ±5   — 窗口边缘（11张）
   */
  _loadVisibleImages() {
    const loadSlab = (maxOffset) => {
      this.items.forEach((el, i) => {
        const offset = circularOffset(i, this.current, this.total);
        if (Math.abs(offset) <= maxOffset) {
          this._loadCardImage(el);
        }
      });
    };
    loadSlab(1);                                    // 立即：3张
    setTimeout(() => loadSlab(3), 150);             // 150ms：7张
    setTimeout(() => loadSlab(VISIBLE_HALF), 400);  // 400ms：11张
  }

  /* ---------- 布局 ---------- */

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

  /**
   * 布局动画。GSAP 只驱动 this.current（数字），_setCard 负责所有卡片定位。
   * 这消除了 GSAP 管理卡片 transform 与 _setCard 直写之间的矩阵分解偏差。
   * @param {number} duration 动画时长（秒），0 = 瞬间定位
   * @param {number} [fromCurrent] 动画起始 current 值，不传则从当前视觉状态开始
   */
  layoutAll(duration = 0.45, fromCurrent, onComplete) {
    // 停掉上一轮动画
    if (this._animTL) { this._animTL.kill(); this._animTL = null; }

    const toCurrent = this.current;

    if (duration <= 0 || fromCurrent === undefined) {
      // 无动画：直接定位
      for (let i = 0; i < this.items.length; i++) {
        const offset = circularOffset(i, toCurrent, this.total);
        this._setCard(this.items[i], offset);
      }
      this.updateCounter();
      if (onComplete) onComplete();
      return;
    }

    // 有动画：GSAP 驱动 this.current，onUpdate 调 _setCard 更新全部卡片
    this._animating = true;
    this.current = fromCurrent;

    const tl = gsap.timeline({
      onComplete: () => {
        this._animating = false;
        this._animTL = null;
        this._lastTickTime = Date.now();
        if (onComplete) onComplete();
      },
    });
    this._animTL = tl;

    tl.to(this, {
      current: toCurrent,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        for (let i = 0; i < this.items.length; i++) {
          const offset = circularOffset(i, this.current, this.total);
          this._setCard(this.items[i], offset);
        }
        this.updateCounter();
      },
    });
  }

  /** 更新照片计数器 */
  updateCounter() {
    if (!this.dotsEl) return;
    const idx = ((Math.round(this.current) % this.total) + this.total) % this.total;
    this.dotsEl.textContent = `${idx + 1} / ${this.total}`;
  }

  /** 高频设值：直接操作 style，不创建 GSAP tween */
  _setCard(el, offset) {
    const c = this._calcCard(offset);
    const inWindow = Math.abs(offset) <= VISIBLE_HALF;
    el.style.transform = `translateX(${c.xPercent}%) rotateY(${c.rotateY}deg) scale(${c.scale})`;
    el.style.opacity = c.opacity;
    el.style.zIndex = c.zIndex;
    el.classList.toggle('active', c.isActive);
    el.style.pointerEvents = c.isActive ? 'auto' : 'none';
    // 进入可视窗口时触发图片加载
    if (inWindow && !el._imageLoaded) {
      this._loadCardImage(el);
    }
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
    if (this.paused) return;
    this.isDragging = true;
    this._swiped = false;
    this.stopAuto();
    this._currentSpeed = this.SPEED;
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
    // 直设全部卡片，避免每帧创建 29 个 GSAP tween
    for (let i = 0; i < this.items.length; i++) {
      const offset = circularOffset(i, this.current, this.total);
      this._setCard(this.items[i], offset);
    }
  }

  onUp() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.stage.classList.remove('dragging');
    this.stage.style.cursor = this._isHovering ? 'grab' : '';
    if (this._isHovering) {
      this._currentSpeed = this.SLOW_SPEED;
    }

    const absVel = Math.abs(this._velocity);

    if (absVel > 0.15) {
      const momentum = this._velocity * 400;
      const target = this.current - momentum / 150;
      const inertiaTween = gsap.to(this, {
        current: target,
        duration: 0.5,
        ease: 'power2.out',
        onUpdate: () => {
          for (let i = 0; i < this.items.length; i++) {
            const offset = circularOffset(i, this.current, this.total);
            this._setCard(this.items[i], offset);
          }
        },
        onComplete: () => {
          this.layoutAll(0);
          this.scheduleAuto();
        },
      });
      this._inertiaTween = inertiaTween;
    } else {
      this.layoutAll(0.2);
      this.scheduleAuto();
    }
  }

  /* ---------- 导航 ---------- */
  prev() {
    const fromCurrent = this.current;
    this.stopAuto();
    this.current = Math.round(fromCurrent) - 1;
    this.layoutAll(0.45, fromCurrent);
    this.scheduleAuto();
  }

  next() {
    const fromCurrent = this.current;
    this.stopAuto();
    this.current = Math.round(fromCurrent) + 1;
    this.layoutAll(0.45, fromCurrent);
    this.scheduleAuto();
  }

  goTo(index, onComplete) {
    const fromCurrent = this.current;
    this.stopAuto();
    const rounded = Math.round(fromCurrent);
    let target = index;
    while (target < rounded - this.total / 2) target += this.total;
    while (target > rounded + this.total / 2) target -= this.total;
    if (Math.abs(target - fromCurrent) > this.total / 2) {
      target = target > fromCurrent ? target - this.total : target + this.total;
    }
    this.current = target;
    this.layoutAll(0.35, fromCurrent, onComplete);
    this.scheduleAuto();
  }

  /* ---------- 自动轮播 ---------- */

  scheduleAuto() {
    this.stopAuto();
    if (this.paused) return;

    this._lastTickTime = Date.now();

    const onTick = () => {
      if (this.paused || this.isDragging || this._animating) return;

      const now = Date.now();
      const dt = now - this._lastTickTime;
      this._lastTickTime = now;
      this.current += dt * this._currentSpeed;

      // 更新全部卡片位置（_animating 锁保证此时无 GSAP 动画冲突）
      for (let i = 0; i < this.items.length; i++) {
        const offset = circularOffset(i, this.current, this.total);
        this._setCard(this.items[i], offset);
      }

      this.updateCounter();
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

  slowDown() {
    if (this.isDragging) return;
    this._currentSpeed = this.SLOW_SPEED;
  }

  speedUp() {
    this._currentSpeed = this.SPEED;
  }
}
