/**
 * Love Story — 主入口
 * 初始化所有模块，编排页面生命周期
 * 可编辑内容集中管理：src/data/content.json
 */
import content from './data/content.json';
import { WISH_SVG_ICONS } from './data/wish-icons.js';
import { Carousel } from './modules/carousel.js';
import { Timeline } from './modules/timeline.js';
import { MusicPlayer } from './modules/music-player.js';
import { Particles, FloatingHearts } from './modules/particles.js';
import { initThemeToggle } from './modules/theme.js';
import { triggerHeroChars, initHeroParallax } from './modules/hero.js';
import { initScrollReveals } from './modules/scroll-reveals.js';
import { initProgressBar, initBackToTop, initNavDots } from './modules/navigation.js';
import { initPhotoModal } from './modules/modal.js';
import { initEntry } from './modules/entry.js';
import { backgroundPreloadAll } from './modules/preloader.js';
import { MobileGallery } from './modules/mobile-gallery.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ---- 关系起始日 ----
const LOVE_START_DATE = new Date(content.site.startDate);

// ---- 暗夜模式切换 ----
initThemeToggle();

// ---- 音乐播放器 ----
const music = new MusicPlayer('music-player');

// 入场前锁定 body 滚动
document.body.style.overflow = 'hidden';

// ============================================================
// 关键：所有影响页面高度的内容在遮罩背后预先渲染
// 入场后只启动动画/交互，不改变布局 → 消除跳动
// ============================================================

// 星愿清单 + 天数
renderWishes();
initDaysCounter();

// 照片弹窗（隐藏态）
let carouselRef = null;
const photoModal = initPhotoModal(() => carouselRef);

// 检测移动端
const isMobile = window.matchMedia('(max-width: 768px)').matches;

// 照片墙 — 移动端用触摸画廊，桌面端用 3D 轮播
let carousel = null;
let mobileGallery = null;

if (isMobile) {
  mobileGallery = new MobileGallery('mobile-gallery', (i) => photoModal.open(i));
  carouselRef = mobileGallery;
} else {
  carousel = new Carousel('carousel-container', 'carousel-stage', (i) => photoModal.open(i));
  carousel.pause();
  carouselRef = carousel;

  // 轮播导航箭头
  document.getElementById('carousel-prev')?.addEventListener('click', () => carousel.prev());
  document.getElementById('carousel-next')?.addEventListener('click', () => carousel.next());
}

// 恋爱时间线
const timeline = new Timeline('timeline-container');

// 入场遮罩期间后台预加载缩略图
const _bgPreload = backgroundPreloadAll();

// ---- 入场动画 ----
const entry = initEntry(async () => {
  await _bgPreload;
  // 等待书封裂开动画完成后初始化主内容
  setTimeout(() => {
    entry.unlock();
    initMainContent();
  }, 700);
});

/**
 * 初始化交互与动画（入场后，不影响布局）
 * 非关键模块使用动态 import() 延迟加载，减少首屏 JS 解析时间
 */
async function initMainContent() {
  if (carousel) carousel.resume();

  triggerHeroChars();
  initHeroParallax();

  // 浮动粒子（首屏关键，静态导入）
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

  // 导航 / 滚动（首屏关键，静态导入）
  initNavDots();
  initScrollReveals();
  initProgressBar();
  initBackToTop();

  // 装饰效果 + Ending 模块：懒加载（入场后异步加载，不阻塞交互）
  // 星图小剧场（同步初始化，利用入场遮罩窗口预渲染）
  let starTheater = null;
  try {
    starTheater = new (await import('./modules/star-theater.js')).StarTheater('ending');
  } catch (e) {
    console.warn('星图小剧场加载失败，跳过', e);
  }

  Promise.all([
    import('./modules/effects.js'),
    import('./modules/ending.js'),
  ]).then(([effects, ending]) => {
    try { effects.initCarouselSparkles(); } catch (e) { console.warn('轮播光粒子初始化失败', e); }
    try { effects.initPetalRain(); } catch (e) { console.warn('花瓣雨初始化失败', e); }
    try { effects.initBridgeSparkles(); } catch (e) { console.warn('桥接光效初始化失败', e); }
    try { ending.initEndingCeremony(); } catch (e) { console.warn('结尾仪式初始化失败', e); }
    try { ending.initEndingCounterRoll(); } catch (e) { console.warn('结尾计数器初始化失败', e); }
    try { ending.initLanternButton(); } catch (e) { console.warn('天灯按钮初始化失败', e); }
  }).catch((e) => {
    console.warn('effects/ending 模块加载失败，跳过装饰效果', e);
  });

  // 光标拖尾：仅精确指针设备（鼠标/触控板），触摸设备跳过
  if (window.matchMedia('(pointer: fine)').matches) {
    import('./modules/cursor-trail.js').then(m => m.initCursorTrail())
      .catch(e => console.warn('光标拖尾加载失败，跳过', e));
  }
}

/* ======== 天数计数器 ======== */
function initDaysCounter() {
  const heroDaysEl = document.getElementById('hero-days');
  const footerDaysEl = document.getElementById('footer-days');

  function updateDays() {
    const now = new Date();
    const diffMs = now - LOVE_START_DATE;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (heroDaysEl) heroDaysEl.textContent = days;
    if (footerDaysEl) footerDaysEl.textContent = days;
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

/* ======== Service Worker 注册（PWA） ======== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/anniversary-wall/sw.js').catch(() => {
      // 静默失败，不影响主功能
    });
  });
}
