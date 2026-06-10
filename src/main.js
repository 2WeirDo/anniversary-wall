/**
 * Love Story — 主入口
 * 初始化所有模块
 * 可编辑内容集中管理：src/data/content.json
 */
import content from './data/content.json';
import { Carousel, PHOTOS, PHOTO_META, PHOTO_FLIP_TEXTS } from './modules/carousel.js';
import { Timeline } from './modules/timeline.js';
import { AudioPlayer } from './modules/audio.js';
import { Particles, FloatingHearts } from './modules/particles.js';

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

enterBtn.addEventListener('click', async () => {
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
  // 阶段2: 门扉推开 (0.7s)
  setTimeout(() => {
    entryOverlay.classList.add('hidden');
    audio.initPlay();
    setTimeout(() => {
      initMainContent();
    }, 500);
  }, 200);
});

/**
 * 初始化主体内容（入场后）
 */
function initMainContent() {
  // ---- Hero 标题逐字动画 ----
  triggerHeroChars();

  // ---- Hero 鼠标视差 ----
  initHeroParallax();

  // ---- 3D 旋转木马 ----
  let carousel;
  const photoModal = initPhotoModal(() => carousel);
  carousel = new Carousel('carousel-container', 'carousel-stage', (photoIndex) => {
    photoModal.open(photoIndex);
  });

  // ---- 恋爱时间线 ----
  const timeline = new Timeline('timeline-container');

  // ---- 浮动粒子（Hero 区域）----
  const heroParticles = new Particles('hero-particles', {
    count: 20,
    types: ['dot', 'heart'],
    minSize: 4,
    maxSize: 14,
    minDuration: 10,
    maxDuration: 25,
  });

  // ---- 浮动爱心（Ending 区域）----
  const endingHearts = new FloatingHearts('ending-particles');

  // ---- 页面导航点 ----
  initNavDots();

  // ---- 渲染内容（来自 content.json） ----
  initLetterContent();
  initDynamicText();

  // ---- 情书卡片入场 + 段落逐段淡入 ----
  initLetterReveal();

  // ---- 滚动入场动画 ----
  initScrollReveals();

  // ---- 光标爱心拖尾 ----
  initCursorTrail();

  // ---- 天数计数器 ----
  initDaysCounter();

  // ---- 顶部阅读进度线 ----
  initProgressBar();

  // ---- 放飞天灯 ----
  initLanternButton();

  // ---- 照片墙悬浮光粒子 ----
  initCarouselSparkles();

  // ---- 纪念日花瓣雨 ----
  initPetalRain();
}

/* ======== Hero 标题逐字动画 ======== */
function triggerHeroChars() {
  const title = document.getElementById('hero-title');
  if (!title) return;
  // 延迟一小段让入场遮罩完全消失
  setTimeout(() => {
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
      el.style.transition = 'none';
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

/* ======== 照片墙悬浮光粒子 ======== */
function initCarouselSparkles() {
  const stage = document.getElementById('carousel-stage');
  if (!stage) return;

  const count = 35;
  const colors = ['var(--color-gold)', 'var(--color-accent)', 'var(--color-primary)'];
  for (let i = 0; i < count; i++) {
    const sparkle = document.createElement('span');
    sparkle.className = 'carousel-sparkle';
    // 范围扩展到 stage 外
    sparkle.style.left = (-5 + Math.random() * 110) + '%';
    sparkle.style.top = (-10 + Math.random() * 120) + '%';
    const size = (3 + Math.random() * 7);
    sparkle.style.width = sparkle.style.height = size + 'px';
    sparkle.style.animationDelay = Math.random() * 5 + 's';
    sparkle.style.animationDuration = (3.5 + Math.random() * 5) + 's';
    sparkle.style.opacity = (0.25 + Math.random() * 0.5);
    // 混色：金/粉/玫瑰
    sparkle.style.background = colors[Math.floor(Math.random() * colors.length)];
    sparkle.style.boxShadow = `0 0 ${size * 2}px ${sparkle.style.background}`;
    stage.appendChild(sparkle);
  }
}

/* ======== 滚动入场动画 ======== */
function initScrollReveals() {
  // 给所有 section 标题和副标题等元素加上 reveal-up
  const targets = document.querySelectorAll('.section-title, .section-sub, .gallery-header, .timeline-section > .section-title');
  targets.forEach((el, i) => {
    el.classList.add('reveal-up');
    if (i % 2 === 1) el.setAttribute('data-delay', '2');
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.25, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.reveal-up').forEach((el) => observer.observe(el));
}

/* ======== 光标爱心拖尾 ======== */
function initCursorTrail() {
  // 触屏设备跳过（无光标）
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const TRAIL_COUNT = 5;
  const trails = [];

  // 创建拖尾元素
  for (let i = 0; i < TRAIL_COUNT; i++) {
    const el = document.createElement('span');
    el.className = 'cursor-heart';
    el.textContent = i % 2 === 0 ? '♥' : '♡';
    el.style.fontSize = `${11 + i * 2.5}px`;
    document.body.appendChild(el);
    trails.push({ el, x: 0, y: 0 });
  }

  let mouseX = -999;
  let mouseY = -999;
  let hideTimer = null;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    trails.forEach((t) => t.el.classList.add('visible'));
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      trails.forEach((t) => t.el.classList.remove('visible'));
    }, 1200);
  });

  // rAF — 链式跟随: 每个爱心追前一个
  function animate() {
    let leaderX = mouseX;
    let leaderY = mouseY;

    trails.forEach((t) => {
      const ease = 0.12 - trails.indexOf(t) * 0.015;
      t.x += (leaderX - t.x) * Math.max(ease, 0.03);
      t.y += (leaderY - t.y) * Math.max(ease, 0.03);
      t.el.style.left = t.x + 'px';
      t.el.style.top = t.y + 'px';
      leaderX = t.x;
      leaderY = t.y;
    });

    requestAnimationFrame(animate);
  }

  animate();
}

/* ======== 情书段落逐段淡入 ======== */
function initLetterReveal() {
  const letterCard = document.querySelector('.letter-card');
  if (!letterCard) return;

  const paragraphs = letterCard.querySelectorAll('.letter-text p');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // 卡片入场
          letterCard.classList.add('revealed');
          // 段落 stagger 淡入
          paragraphs.forEach((p) => p.classList.add('revealed'));
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  observer.observe(letterCard);
}

/* ======== 天数计数器 + 一周年倒计时 ======== */
function initDaysCounter() {
  const heroDaysEl = document.getElementById('hero-days');
  const daysCounterEl = document.getElementById('days-counter');
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

/* ======== 渲染情书内容（来自 content.json） ======== */
function initLetterContent() {
  const letterText = document.querySelector('.letter-text');
  if (!letterText) return;
  const { title, paragraphs, signature, signDate } = content.letter;

  letterText.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join('');
  document.querySelector('.letter-title').textContent = title;
  document.querySelector('.sign-name').textContent = signature;
  document.querySelector('.sign-date').textContent = signDate;
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

  // 加入随机水平飘移
  const keyframes = `
    @keyframes lanternDrift${Date.now()} {
      0% { transform: translateY(0) translateX(0) scale(0.6); opacity: 0; }
      10% { opacity: 1; transform: translateY(-10vh) scale(1); }
      50% { transform: translateY(-50vh) translateX(${drift}px) scale(0.9); }
      80% { opacity: 0.6; transform: translateY(-85vh) translateX(${-drift * 0.5}px) scale(0.7); }
      100% { opacity: 0; transform: translateY(-110vh) translateX(${drift * 0.3}px) scale(0.4); }
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = keyframes;
  document.head.appendChild(styleEl);

  lantern.innerHTML = `
    <div class="lantern-glow"></div>
    <div class="lantern-body"></div>
  `;

  const animName = `lanternDrift${Date.now()}`;
  lantern.style.animationName = animName;

  document.body.appendChild(lantern);

  // 动画结束后清理
  const duration = parseFloat(lantern.style.animationDuration) * 1000;
  setTimeout(() => {
    lantern.remove();
    styleEl.remove();
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
    modalPhoto.alt = `照片 ${index + 1}`;
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

  // 移动端触摸滑动关闭
  let touchStartY = 0;
  modal.querySelector('.photo-modal-content').addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  modal.querySelector('.photo-modal-content').addEventListener('touchmove', (e) => {
    const dy = e.touches[0].clientY - touchStartY;
    if (dy > 80 && modal.querySelector('.photo-modal-content').scrollTop <= 0) {
      close();
    }
  }, { passive: true });

  return { open, close };
}

/* ======== 页面导航点 ======== */
function initNavDots() {
  const dots = document.querySelectorAll('.nav-dots .dot');
  const sections = document.querySelectorAll('.section');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionIndex = parseInt(entry.target.getAttribute('data-section'));
          dots.forEach((dot) => {
            const dotIndex = parseInt(dot.getAttribute('data-section'));
            dot.classList.toggle('active', dotIndex === sectionIndex);
          });
        }
      });
    },
    { threshold: 0.5 }
  );

  sections.forEach((section) => observer.observe(section));

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const sectionIndex = parseInt(dot.getAttribute('data-section'));
      const target = document.querySelector(`[data-section="${sectionIndex}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
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
