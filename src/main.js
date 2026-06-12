/**
 * Love Story — 主入口
 * 初始化所有模块，编排页面生命周期
 * 可编辑内容集中管理：src/data/content.json
 */
import content from './data/content.json';
import { WISH_SVG_ICONS } from './data/wish-icons.js';
import { Carousel, PHOTOS, PHOTO_META, PHOTO_FLIP_TEXTS } from './modules/carousel.js';
import { Timeline } from './modules/timeline.js';
import { AudioPlayer } from './modules/audio.js';
import { Particles, FloatingHearts } from './modules/particles.js';
import { initThemeToggle } from './modules/theme.js';
import { triggerHeroChars, initHeroParallax } from './modules/hero.js';
import { initBridgeSparkles, initCarouselSparkles, initPetalRain } from './modules/effects.js';
import { initScrollReveals } from './modules/scroll-reveals.js';
import { initCursorTrail } from './modules/cursor-trail.js';
import { initProgressBar, initBackToTop, initNavDots } from './modules/navigation.js';
import { initEndingCeremony, initEndingCounterRoll, initLanternButton } from './modules/ending.js';
import { initPhotoModal } from './modules/modal.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ---- 关系起始日 ----
const LOVE_START_DATE = new Date(content.site.startDate);

// ---- 暗夜模式切换 ----
initThemeToggle();

// ---- 入场动画 ----
const entryOverlay = document.getElementById('entry-overlay');
const entryContent = entryOverlay.querySelector('.entry-content');
const enterBtn = document.getElementById('enter-btn');
const audio = new AudioPlayer('music-btn');

// 入场前锁定 body 滚动
document.body.style.overflow = 'hidden';

// ============================================================
// 关键：所有影响页面高度的内容在遮罩背后预先渲染
// 入场后只启动动画/交互，不改变布局 → 消除跳动
// ============================================================

// 星愿清单 + 动态文本 + 天数
renderWishes();
initDynamicText();
initDaysCounter();

// 照片弹窗（隐藏态）
let carouselRef = null;
const photoModal = initPhotoModal(() => carouselRef);

// 照片墙（暂停自动轮播，仅渲染 DOM）
const carousel = new Carousel('carousel-container', 'carousel-stage', (i) => photoModal.open(i));
carousel.pause();
carouselRef = carousel;

// 轮播导航箭头
document.getElementById('carousel-prev')?.addEventListener('click', () => carousel.prev());
document.getElementById('carousel-next')?.addEventListener('click', () => carousel.next());

// 恋爱时间线
const timeline = new Timeline('timeline-container');

// 预加载关键图片（前5张 + 时间线用到的照片）
function preloadImages() {
  const toPreload = new Set();
  for (let i = 0; i < Math.min(5, PHOTOS.length); i++) {
    toPreload.add(PHOTOS[i]);
  }
  content.timeline.forEach((t) => {
    if (PHOTOS[t.photoIdx]) toPreload.add(PHOTOS[t.photoIdx]);
  });

  return Promise.all([...toPreload].map((f) => {
    const base = f.replace(/\.(jpg|jpeg|png)$/i, '');
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = `${import.meta.env.BASE_URL}photos-optimized/${base}.webp`;
    });
  }));
}

let _entered = false;

async function handleEnter() {
  if (_entered) return;
  _entered = true;

  // 在用户手势内同步触发 BGM（浏览器自动播放策略要求）
  audio.play();

  // 显示加载状态
  enterBtn.classList.add('loading');
  enterBtn.querySelector('span').textContent = '加载中...';

  // 预加载关键图片
  await Promise.race([
    preloadImages(),
    new Promise((r) => setTimeout(r, 1000)),
  ]);

  // 阶段1: 内容先淡出 (0.2s)
  entryContent.classList.add('fade-out');
  // 阶段2: 书封裂开 (0.7s)
  setTimeout(() => {
    entryOverlay.classList.add('hidden');
    audio.initPlay();
    setTimeout(() => {
      document.body.style.overflow = '';
      initMainContent();
    }, 700);
  }, 200);
}

enterBtn.addEventListener('click', handleEnter);

entryOverlay.addEventListener('wheel', (e) => {
  if (e.deltaY > 0) {
    e.preventDefault();
    handleEnter();
  }
}, { passive: false });

let _entryTouchStartY = 0;
entryOverlay.addEventListener('touchstart', (e) => {
  _entryTouchStartY = e.touches[0].clientY;
}, { passive: true });
entryOverlay.addEventListener('touchmove', (e) => {
  if (_entered) return;
  const dy = _entryTouchStartY - e.touches[0].clientY;
  if (dy > 60) {
    e.preventDefault();
    handleEnter();
  }
}, { passive: false });

/**
 * 初始化交互与动画（入场后，不影响布局）
 */
function initMainContent() {
  carousel.resume();

  triggerHeroChars();
  initHeroParallax();

  // 浮动粒子
  const heroParticles = new Particles('hero-particles', {
    count: 20, types: ['dot', 'heart'],
    minSize: 4, maxSize: 14, minDuration: 10, maxDuration: 25,
  });

  // FloatingHearts 按需启停：进入结尾区才创建，离开即销毁
  let endingHearts = null;
  const endingSection = document.getElementById('ending');
  if (endingSection) {
    new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !endingHearts) {
          endingHearts = new FloatingHearts('ending-particles');
        } else if (!entry.isIntersecting && endingHearts) {
          endingHearts.destroy();
          endingHearts = null;
        }
      });
    }, { threshold: 0.1 }).observe(endingSection);
  }

  // 导航 / 滚动
  initNavDots();
  initScrollReveals();

  // Ending
  initEndingCeremony();
  initEndingCounterRoll();

  // 装饰效果
  initCursorTrail();
  initProgressBar();
  initBackToTop();
  initLanternButton();
  initCarouselSparkles();
  initPetalRain();
  initBridgeSparkles();
}

/* ======== 天数计数器 + 一周年倒计时 ======== */
function initDaysCounter() {
  const heroDaysEl = document.getElementById('hero-days');
  const daysCounterEl = document.getElementById('days-counter');
  const footerDaysEl = document.getElementById('footer-days');
  const countdownEl = document.getElementById('hero-countdown');

  const ANNIVERSARY = new Date(LOVE_START_DATE);
  ANNIVERSARY.setFullYear(ANNIVERSARY.getFullYear() + 1);

  function updateDays() {
    const now = new Date();
    const diffMs = now - LOVE_START_DATE;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (heroDaysEl) heroDaysEl.textContent = days;
    if (daysCounterEl) daysCounterEl.textContent = days;
    if (footerDaysEl) footerDaysEl.textContent = days;

    if (countdownEl) {
      const remaining = Math.ceil((ANNIVERSARY - now) / (1000 * 60 * 60 * 24));
      if (remaining > 0) {
        countdownEl.textContent = remaining;
      } else if (remaining === 0) {
        countdownEl.textContent = '🎉 就是今天！';
      } else {
        countdownEl.textContent = '已过 ' + Math.abs(remaining);
      }
    }
  }

  updateDays();
  setInterval(updateDays, 60000);
}

/* ======== 渲染星愿清单 ======== */
function renderWishes() {
  const { wishes } = content;

  function buildCard(item, status) {
    const iconKey = item.icon.replace(/️|︎/g, '').trim();
    const svgIcon = WISH_SVG_ICONS[item.icon] || WISH_SVG_ICONS[iconKey] || item.icon;
    return `
      <div class="wish-card ${status}">
        <div class="wish-card-header">
          <span class="wish-card-icon">${svgIcon}</span>
          <span class="wish-card-title">${item.title}</span>
        </div>
        <span class="wish-card-desc">${item.desc}</span>
      </div>`;
  }

  const completedEl = document.getElementById('wish-completed');
  if (completedEl && wishes.completed) {
    completedEl.innerHTML = wishes.completed.map(w => buildCard(w, 'completed')).join('');
  }

  const pendingEl = document.getElementById('wish-pending');
  if (pendingEl && wishes.pending) {
    pendingEl.innerHTML = wishes.pending.map(w => buildCard(w, 'pending')).join('');
  }
}

/* ======== 渲染动态文本（来自 content.json） ======== */
function initDynamicText() {
  const heroSub = document.getElementById('hero-sub');
  if (heroSub) heroSub.textContent = content.hero.subtitle;
  const endingTitle = document.getElementById('ending-title');
  if (endingTitle) endingTitle.textContent = content.ending.title;
  const endingText = document.getElementById('ending-text');
  if (endingText) endingText.textContent = content.ending.text;
  const endingTextLarge = document.getElementById('ending-text-large');
  if (endingTextLarge) endingTextLarge.textContent = content.ending.textLarge;
}

/* ======== Service Worker 注册（PWA） ======== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/anniversary-wall/sw.js').catch(() => {
      // 静默失败，不影响主功能
    });
  });
}
