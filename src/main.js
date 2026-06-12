/**
 * Love Story — 主入口
 * 初始化所有模块
 * 可编辑内容集中管理：src/data/content.json
 */
import content from './data/content.json';
import { WISH_SVG_ICONS } from './data/wish-icons.js';
import { Carousel, PHOTOS, PHOTO_META, PHOTO_FLIP_TEXTS } from './modules/carousel.js';
import { Timeline } from './modules/timeline.js';
import { AudioPlayer } from './modules/audio.js';
import { Particles, FloatingHearts } from './modules/particles.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ---- 关系起始日 ----
const LOVE_START_DATE = new Date(content.site.startDate);

// ---- 暗夜模式切换 ----
initThemeToggle();

function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  // 读取保存的主题
  const saved = localStorage.getItem('love-story-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('love-story-theme', next);
  });
}

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
  // 前5张轮播图
  for (let i = 0; i < Math.min(5, PHOTOS.length); i++) {
    toPreload.add(PHOTOS[i]);
  }
  // 时间线用到的照片
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
    new Promise((r) => setTimeout(r, 1000)), // 最多等1秒
  ]);

  // 阶段1: 内容先淡出 (0.2s)
  entryContent.classList.add('fade-out');
  // 阶段2: 书封裂开 (0.7s)
  setTimeout(() => {
    entryOverlay.classList.add('hidden');
    audio.initPlay();
    // 等遮罩动画完成后再恢复滚动 + 初始化交互
    setTimeout(() => {
      document.body.style.overflow = '';
      initMainContent();
    }, 700);
  }, 200);
}

enterBtn.addEventListener('click', handleEnter);

// 入口页滚轮向下 → 触发进入
entryOverlay.addEventListener('wheel', (e) => {
  if (e.deltaY > 0) {
    e.preventDefault();
    handleEnter();
  }
}, { passive: false });

// 入口页触摸上滑 → 触发进入
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
  // 照片墙恢复自动轮播
  carousel.resume();

  // Hero 逐字动画
  triggerHeroChars();

  // Hero 鼠标视差
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

  // 导航 / 滚动观察器
  initNavDots();
  initScrollReveals();

  // Ending 自动仪式：滚动到结尾页时自动放天灯 + 心形
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

/* ======== Hero 标题逐字动画 ======== */
function triggerHeroChars() {
  const title = document.getElementById('hero-title');
  if (!title) return;
  setTimeout(() => {
    const chars = title.querySelectorAll('.char');
    chars.forEach((char, i) => {
      char.style.transitionDelay = `${i * 0.06}s`;
    });
    title.classList.add('reveal-chars');
  }, 400);
}

/* ======== Hero 鼠标视差 ======== */
function initHeroParallax() {
  const hero = document.getElementById('hero');
  const bow = hero?.querySelector('.hero-bow-large');
  const title = document.getElementById('hero-title');
  const date = hero?.querySelector('.hero-date');
  if (!hero || !bow || !title) return;

  const els = [
    { el: bow, depth: 12 },
    { el: title, depth: -8 },
    { el: date, depth: -5 },
  ];

  hero.addEventListener('mousemove', (e) => {
    const rect = hero.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    els.forEach(({ el, depth }) => {
      el.style.transform = `translate(${x * depth}px, ${y * Math.abs(depth) * 0.6}px)`;
    });
  });

  hero.addEventListener('mouseleave', () => {
    els.forEach(({ el }) => {
      el.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
      el.style.transform = 'translate(0, 0)';
    });
  });
}

/* ======== 跨板块过渡粒子桥 ======== */
function initBridgeSparkles() {
  const sections = document.querySelectorAll('.section');
  if (sections.length < 2) return;

  // 在每对相邻 section 之间生成漂浮光点
  const colors = ['var(--color-accent)', 'var(--color-gold)', 'var(--color-primary)', 'var(--color-rose)'];

  sections.forEach((section, i) => {
    if (i === sections.length - 1) return; // 最后一个 section 不需要

    const count = 8;
    for (let j = 0; j < count; j++) {
      const sparkle = document.createElement('span');
      sparkle.className = 'bridge-sparkle';
      const size = 2.5 + Math.random() * 5;
      sparkle.style.width = size + 'px';
      sparkle.style.height = size + 'px';
      sparkle.style.background = colors[Math.floor(Math.random() * colors.length)];
      sparkle.style.boxShadow = `0 0 ${size * 2}px ${sparkle.style.background}`;
      sparkle.style.animationDelay = (j * 0.6 + Math.random() * 2) + 's';
      sparkle.style.animationDuration = (3 + Math.random() * 4) + 's';

      // 定位在 section 底部区域
      sparkle.style.left = (10 + Math.random() * 80) + '%';
      sparkle.style.top = '92%';

      section.appendChild(sparkle);
    }
  });
}

/* ======== 照片墙悬浮光粒子 ======== */
function initCarouselSparkles() {
  const stage = document.getElementById('carousel-stage');
  if (!stage) return;

  const count = 18;
  const colors = ['var(--color-gold)', 'var(--color-accent)', 'var(--color-primary)'];
  for (let i = 0; i < count; i++) {
    const sparkle = document.createElement('span');
    sparkle.className = 'carousel-sparkle';
    sparkle.style.left = (-5 + Math.random() * 110) + '%';
    sparkle.style.top = (-10 + Math.random() * 120) + '%';
    const size = (2.5 + Math.random() * 5);
    sparkle.style.width = sparkle.style.height = size + 'px';
    sparkle.style.animationDelay = Math.random() * 6 + 's';
    sparkle.style.animationDuration = (4 + Math.random() * 6) + 's';
    sparkle.style.opacity = (0.2 + Math.random() * 0.4);
    sparkle.style.background = colors[Math.floor(Math.random() * colors.length)];
    stage.appendChild(sparkle);
  }
}

/* ======== 滚动入场动画（GSAP ScrollTrigger 增强） ======== */
function initScrollReveals() {
  // ---- 板块标题统一淡入 ----
  const sectionTitles = document.querySelectorAll('.section-title, .section-sub, .gallery-header');
  sectionTitles.forEach((el) => {
    gsap.fromTo(el,
      { opacity: 0, y: 50 },
      {
        opacity: 1, y: 0,
        duration: 1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      }
    );
  });

  // ---- 时间线卡片：交错侧边滑入 ----
  const timelineCards = document.querySelectorAll('.timeline-card-inner');
  timelineCards.forEach((card) => {
    const isLeft = card.classList.contains('left');
    const fromX = isLeft ? -60 : 60;
    gsap.fromTo(card,
      { opacity: 0, x: fromX },
      {
        opacity: 1, x: 0,
        duration: 0.4,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 88%',
          toggleActions: 'play none none none',
        },
      }
    );
  });

  // ---- 星愿卡片：staggered 弹入 ----
  const wishCards = document.querySelectorAll('.wish-card');
  wishCards.forEach((card, i) => {
    gsap.fromTo(card,
      { opacity: 0, y: 40, scale: 0.92 },
      {
        opacity: 1, y: 0, scale: 1,
        duration: 0.6,
        delay: i * 0.04, // staggered: 每张延迟 40ms
        ease: 'back.out(1.4)',
        scrollTrigger: {
          trigger: card.closest('.wish-group'),
          start: 'top 82%',
          toggleActions: 'play none none none',
        },
      }
    );
  });

  // ---- 时间线中轴线随滚动亮起 ----
  const timelineLine = document.querySelector('.timeline-line-glow');
  if (timelineLine) {
    gsap.fromTo(timelineLine,
      { height: '0%' },
      {
        height: '100%',
        ease: 'none',
        scrollTrigger: {
          trigger: '#timeline-container',
          start: 'top 70%',
          end: 'bottom 60%',
          scrub: 0.4,
        },
      }
    );
  }

  // ---- 时间线钻石连接器逐个亮起 ----
  const gems = document.querySelectorAll('.timeline-connector');
  gems.forEach((gem) => {
    gsap.to(gem, {
      scrollTrigger: {
        trigger: gem,
        start: 'top 85%',
        toggleActions: 'play none none none',
        onEnter: () => gem.classList.add('gem-revealed'),
      },
    });
  });

  // ---- Hero 蝴蝶结滚动视差 ----
  const heroBow = document.querySelector('.hero-bow-large');
  if (heroBow) {
    gsap.to(heroBow, {
      y: -60,
      scale: 0.85,
      opacity: 0.3,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.6,
      },
    });
  }

  // ---- Hero 标题滚动微移 ----
  const heroTitle = document.getElementById('hero-title');
  if (heroTitle) {
    gsap.to(heroTitle, {
      y: -30,
      opacity: 0.5,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.5,
      },
    });
  }
}

/* ======== 光标渐变光点拖尾 ======== */
function initCursorTrail() {
  // 触屏设备跳过（无光标）
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const TRAIL_COUNT = 8;
  const trails = [];
  const colors = [
    'rgba(232, 120, 144, 0.6)',
    'rgba(242, 196, 206, 0.5)',
    'rgba(201, 168, 140, 0.45)',
    'rgba(232, 120, 144, 0.35)',
    'rgba(242, 196, 206, 0.3)',
    'rgba(212, 135, 154, 0.22)',
    'rgba(201, 168, 140, 0.16)',
    'rgba(232, 120, 144, 0.08)',
  ];

  // 创建拖尾光点元素
  for (let i = 0; i < TRAIL_COUNT; i++) {
    const el = document.createElement('span');
    el.className = 'cursor-trail-dot';
    const size = 10 - i * 0.8;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.background = colors[i];
    el.style.boxShadow = `0 0 ${size * 2}px ${colors[i]}, 0 0 ${size * 4}px ${colors[Math.min(i + 2, colors.length - 1)]}`;
    el.style.borderRadius = '50%';
    el.style.position = 'fixed';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '9998';
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.4s ease-out';
    el.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(el);
    trails.push({ el, x: 0, y: 0 });
  }

  let mouseX = -999;
  let mouseY = -999;
  let hideTimer = null;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    trails.forEach((t) => { t.el.style.opacity = '1'; });
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      trails.forEach((t, i) => {
        setTimeout(() => { t.el.style.opacity = '0'; }, i * 60);
      });
    }, 800);
  });

  // rAF — 链式跟随: 每个光点追前一个，形成拖尾
  let rafId = null;
  let idleTimer = null;

  function animate() {
    let leaderX = mouseX;
    let leaderY = mouseY;

    trails.forEach((t, i) => {
      const ease = 0.18 - i * 0.018;
      t.x += (leaderX - t.x) * Math.max(ease, 0.03);
      t.y += (leaderY - t.y) * Math.max(ease, 0.03);
      t.el.style.left = t.x + 'px';
      t.el.style.top = t.y + 'px';
      leaderX = t.x;
      leaderY = t.y;
    });

    rafId = requestAnimationFrame(animate);
  }

  function startTrail() {
    if (rafId) return;
    rafId = requestAnimationFrame(animate);
  }

  function stopTrail() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  // 鼠标移动时重启动画，静止 2s 后暂停
  document.addEventListener('mousemove', () => {
    clearTimeout(idleTimer);
    startTrail();
    idleTimer = setTimeout(stopTrail, 2000);
  }, { passive: true });

  startTrail();
}

/* ======== 天数计数器 + 一周年倒计时 ======== */
function initDaysCounter() {
  const heroDaysEl = document.getElementById('hero-days');
  const daysCounterEl = document.getElementById('days-counter');
  const footerDaysEl = document.getElementById('footer-days');
  const countdownEl = document.getElementById('hero-countdown');

  // 一周年日期
  const ANNIVERSARY = new Date(LOVE_START_DATE);
  ANNIVERSARY.setFullYear(ANNIVERSARY.getFullYear() + 1);

  function updateDays() {
    const now = new Date();
    const diffMs = now - LOVE_START_DATE;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (heroDaysEl) heroDaysEl.textContent = days;
    if (daysCounterEl) daysCounterEl.textContent = days;
    if (footerDaysEl) footerDaysEl.textContent = days;

    // 倒计时
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
  // 每分钟更新一次
  setInterval(updateDays, 60000);
}

/* ======== 渲染星愿清单 ======== */
function renderWishes() {
  const { wishes } = content;

  function buildCard(item, status) {
    // 尝试匹配 SVG 图标，失败则回退到 emoji
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
  // Hero
  const heroSub = document.getElementById('hero-sub');
  if (heroSub) heroSub.textContent = content.hero.subtitle;
  // Ending
  const endingTitle = document.getElementById('ending-title');
  if (endingTitle) endingTitle.textContent = content.ending.title;
  const endingText = document.getElementById('ending-text');
  if (endingText) endingText.textContent = content.ending.text;
  const endingTextLarge = document.getElementById('ending-text-large');
  if (endingTextLarge) endingTextLarge.textContent = content.ending.textLarge;
}

/* ======== 顶部阅读进度线 ======== */
function initProgressBar() {
  const fill = document.getElementById('progress-bar-fill');
  if (!fill) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        fill.style.width = Math.min(progress, 100) + '%';
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

/* ======== 放飞天灯 ======== */
/* ======== 回到顶部按钮 ======== */
function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        btn.classList.toggle('visible', window.scrollY > window.innerHeight * 0.8);
        ticking = false;
      });
      ticking = true;
    }
  });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ======== Ending 数字滚动动画 ======== */
function initEndingCounterRoll() {
  const endingSection = document.getElementById('ending');
  const counterEl = document.getElementById('days-counter');
  if (!endingSection || !counterEl) return;

  let rolled = false;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !rolled) {
        rolled = true;
        const target = parseInt(counterEl.textContent) || 0;
        const duration = 1500;
        const start = performance.now();

        function tick(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          // easeOutExpo
          const eased = progress >= 1 ? 1 : 1 - Math.pow(2, -10 * progress);
          const current = Math.floor(eased * target);
          counterEl.textContent = current;
          if (progress < 1) {
            requestAnimationFrame(tick);
          } else {
            counterEl.textContent = target;
          }
        }
        requestAnimationFrame(tick);
      }
    });
  }, { threshold: 0.3 });
  observer.observe(endingSection);
}

/* ======== Ending 自动仪式：滚动进入时放天灯 + 心形粒子 ======== */
function initEndingCeremony() {
  const endingSection = document.getElementById('ending');
  if (!endingSection) return;

  let triggered = false;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !triggered) {
          triggered = true;
          // 延迟一小段，让用户先看到 Ending 内容
          setTimeout(() => {
            // 自动放 2 盏天灯
            for (let i = 0; i < 2; i++) {
              setTimeout(() => spawnLantern(), i * 500);
            }
            // 再加一波心形粒子
            const heartsContainer = document.getElementById('ending-particles');
            if (heartsContainer) {
              for (let i = 0; i < 8; i++) {
                setTimeout(() => {
                  const heart = document.createElement('span');
                  heart.className = 'floating-heart';
                  heart.textContent = ['♥', '♡', '❤', '💕', '💖'][Math.floor(Math.random() * 5)];
                  heart.style.left = (10 + Math.random() * 80) + '%';
                  heart.style.animationDuration = (3 + Math.random() * 4) + 's';
                  heart.style.fontSize = (18 + Math.random() * 20) + 'px';
                  heartsContainer.appendChild(heart);
                  const dur = parseFloat(heart.style.animationDuration) * 1000;
                  setTimeout(() => heart.remove(), dur + 200);
                }, i * 150);
              }
            }
          }, 1200);
        }
      });
    },
    { threshold: 0.4 }
  );
  observer.observe(endingSection);
}

function initLanternButton() {
  const btn = document.getElementById('lantern-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const count = Math.floor(Math.random() * 3) + 1; // 一次放1-3盏
    for (let i = 0; i < count; i++) {
      setTimeout(() => spawnLantern(), i * 300);
    }
  });
}

function spawnLantern() {
  const lantern = document.createElement('div');
  lantern.className = 'lantern';

  const x = 15 + Math.random() * 70; // 15%-85% 水平位置
  const drift = (Math.random() - 0.5) * 40; // 水平飘移量

  lantern.style.left = x + '%';
  lantern.style.setProperty('--drift', drift + 'px');
  lantern.style.animationDuration = (7 + Math.random() * 5) + 's'; // 7-12s

  // 使用预定义的 @keyframes（CSS 中定义了 lanternDrift1/2/3）
  const animIdx = Math.floor(Math.random() * 3) + 1;
  lantern.style.animationName = `lanternDrift${animIdx}`;

  lantern.innerHTML = `
    <div class="lantern-glow"></div>
    <div class="lantern-body"></div>
  `;

  document.body.appendChild(lantern);

  // 动画结束后清理
  const duration = parseFloat(lantern.style.animationDuration) * 1000;
  setTimeout(() => {
    lantern.remove();
  }, duration + 200);
}

/* ======== 纪念日花瓣雨 ======== */
function initPetalRain() {
  const today = new Date();
  if (today.getDate() !== 15) return; // 仅每月15号触发

  const PETALS = ['🌸', '💮', '🌷', '🩷', '✿', '❀'];
  const totalPetals = 40;

  for (let i = 0; i < totalPetals; i++) {
    setTimeout(() => {
      const petal = document.createElement('span');
      petal.className = 'petal';
      petal.textContent = PETALS[Math.floor(Math.random() * PETALS.length)];
      petal.style.left = Math.random() * 100 + '%';
      petal.style.fontSize = (18 + Math.random() * 22) + 'px';
      petal.style.animationDuration = (6 + Math.random() * 8) + 's';
      petal.style.animationDelay = '0s';

      document.body.appendChild(petal);

      // 动画结束后清理
      const duration = parseFloat(petal.style.animationDuration) * 1000;
      setTimeout(() => petal.remove(), duration + 200);
    }, i * 250); // stagger: 每250ms放一个花瓣，10秒放完
  }
}

/* ======== 照片详情弹窗 ======== */
function initPhotoModal(getCarousel) {
  const modal = document.getElementById('photo-modal');
  const modalPhoto = document.getElementById('modal-photo');
  const modalDate = document.getElementById('modal-date');
  const modalStory = document.getElementById('modal-story');
  const modalCounter = document.getElementById('modal-counter');
  const closeBtn = document.getElementById('modal-close');
  const prevBtn = document.getElementById('modal-prev');
  const nextBtn = document.getElementById('modal-next');
  const overlay = modal.querySelector('.photo-modal-overlay');

  let currentIndex = 0;

  const modalFlipContainer = document.getElementById('photo-flip-container');
  const modalFlipText = document.getElementById('modal-flip-text');
  const modalPhotoWrapper = document.getElementById('modal-photo-wrapper');

  function updateModal(index) {
    currentIndex = index;
    const meta = PHOTO_META[index];
    const photoFilename = PHOTOS[index];
    const base = photoFilename.replace(/\.(jpg|jpeg|png)$/i, '');

    modalPhoto.src = `${import.meta.env.BASE_URL}photos-optimized/${base}.webp`;
    modalPhoto.alt = meta.story || `照片 ${index + 1}`;
    modalPhoto.onerror = function () {
      this.src = `${import.meta.env.BASE_URL}photos/${photoFilename}`;
    };
    modalDate.textContent = meta.date;
    modalStory.textContent = meta.story;
    modalCounter.textContent = `${index + 1} / ${PHOTO_META.length}`;
    modalFlipText.textContent = PHOTO_FLIP_TEXTS[index] || '';
    // 重置翻转状态
    modalFlipContainer.classList.remove('flipped');
  }

  // 双击翻转
  modalPhotoWrapper.addEventListener('dblclick', () => {
    modalFlipContainer.classList.toggle('flipped');
  });

  // ---- 缩放与拖拽 ----
  let scale = 1;
  let panX = 0, panY = 0;
  let isPanning = false;
  let panStartX = 0, panStartY = 0;
  let panStartPanX = 0, panStartPanY = 0;
  let pinchStartDist = 0;
  let pinchStartScale = 1;

  function applyTransform() {
    modalPhoto.style.transform = `scale(${scale}) translate(${panX}px, ${panY}px)`;
    modalPhoto.style.cursor = scale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default';
  }

  function resetZoom() {
    scale = 1;
    panX = 0;
    panY = 0;
    applyTransform();
  }

  // 滚轮缩放
  modalPhotoWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    const newScale = Math.max(1, Math.min(4, scale + delta));
    scale = newScale;
    if (scale <= 1) { panX = 0; panY = 0; }
    applyTransform();
  }, { passive: false });

  // 拖拽平移（缩放后）
  modalPhoto.addEventListener('mousedown', (e) => {
    if (scale <= 1) return;
    e.preventDefault();
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    panStartPanX = panX;
    panStartPanY = panY;
    applyTransform();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    panX = panStartPanX + (e.clientX - panStartX) / scale;
    panY = panStartPanY + (e.clientY - panStartY) / scale;
    applyTransform();
  });

  window.addEventListener('mouseup', () => {
    isPanning = false;
    applyTransform();
  });

  // 捏合缩放（移动端）
  modalPhoto.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      pinchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartScale = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      isPanning = true;
      panStartX = e.touches[0].clientX;
      panStartY = e.touches[0].clientY;
      panStartPanX = panX;
      panStartPanY = panY;
    }
  }, { passive: false });

  modalPhoto.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      scale = Math.max(1, Math.min(4, pinchStartScale * (dist / pinchStartDist)));
      if (scale <= 1) { panX = 0; panY = 0; }
      applyTransform();
    } else if (e.touches.length === 1 && isPanning) {
      panX = panStartPanX + (e.touches[0].clientX - panStartX) / scale;
      panY = panStartPanY + (e.touches[0].clientY - panStartY) / scale;
      applyTransform();
    }
  }, { passive: false });

  modalPhoto.addEventListener('touchend', () => {
    isPanning = false;
    applyTransform();
  });

  // ---- 动态模糊：鼠标靠近弹窗内容时减少背景模糊 ----
  let modalBlurHandler = null;

  function open(index) {
    const carousel = getCarousel();
    if (carousel) {
      carousel.pause();
      carousel.goTo(index);
    }
    updateModal(index);
    resetZoom();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    resetZoom();
    overlay.style.backdropFilter = '';
    overlay.style.WebkitBackdropFilter = '';
    const carousel = getCarousel();
    if (carousel) {
      carousel.resume();
    }
  }

  function prev() {
    const newIndex = (currentIndex - 1 + PHOTO_META.length) % PHOTO_META.length;
    updateModal(newIndex);
  }

  function next() {
    const newIndex = (currentIndex + 1) % PHOTO_META.length;
    updateModal(newIndex);
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      close();
    }
  });

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  });

  // 移动端触摸滑动关闭（仅在内容未滚动时生效）
  const modalContent = modal.querySelector('.photo-modal-content');
  let touchStartY = 0, touchStartScrollTop = 0;
  modalContent.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    touchStartScrollTop = modalContent.scrollTop;
  }, { passive: true });
  modalContent.addEventListener('touchmove', (e) => {
    const dy = e.touches[0].clientY - touchStartY;
    // 仅当触发起始时内容在顶部 + 下滑超过阈值 → 关闭
    if (dy > 80 && touchStartScrollTop <= 0 && modalContent.scrollTop <= 0) {
      close();
    }
  }, { passive: true });

  return { open, close };
}

/* ======== 页面导航点 ======== */
function initNavDots() {
  const dots = document.querySelectorAll('.nav-dots .dot');
  const sections = document.querySelectorAll('.section');

  // 跟踪每个 section 的最新可见比例
  const sectionRatios = new Map();

  const observer = new IntersectionObserver(
    (entries) => {
      // 更新各 section 的可见比例
      entries.forEach((entry) => {
        const idx = parseInt(entry.target.getAttribute('data-section'));
        sectionRatios.set(idx, entry.intersectionRatio);
      });

      // 找出可见比例最高的 section
      let maxRatio = 0;
      let activeIdx = -1;
      sectionRatios.forEach((ratio, idx) => {
        if (ratio > maxRatio) { maxRatio = ratio; activeIdx = idx; }
      });

      if (activeIdx >= 0) {
        dots.forEach((dot) => {
          const dotIndex = parseInt(dot.getAttribute('data-section'));
          dot.classList.toggle('active', dotIndex === activeIdx);
        });
      }
    },
    { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
  );

  sections.forEach((section) => observer.observe(section));

  dots.forEach((dot) => {
    const navigate = () => {
      const sectionIndex = parseInt(dot.getAttribute('data-section'));
      const target = document.querySelector(`[data-section="${sectionIndex}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    };
    dot.addEventListener('click', navigate);
    dot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigate();
      }
    });
  });
}

/* ======== Service Worker 注册（PWA） ======== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/anniversary-wall/sw.js').catch(() => {
      // 静默失败，不影响主功能
    });
  });
}
