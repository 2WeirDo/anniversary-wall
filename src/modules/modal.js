/**
 * 故事气泡弹窗 — 固定定位在 carousel-stage 右侧
 * 玻璃质感气泡 + 箭头指示 + 3D 翻转情话
 */
import { PHOTO_META, PHOTO_FLIP_TEXTS } from './carousel.js';

export function initPhotoModal(getCarousel) {
  const bubble = document.getElementById('story-bubble');
  const bubbleDate = document.getElementById('story-bubble-date');
  const bubbleStory = document.getElementById('story-bubble-story');
  const bubbleCounter = document.getElementById('story-bubble-counter');
  const bubbleFlipText = document.getElementById('story-bubble-flip-text');
  const closeBtn = document.getElementById('story-bubble-close');
  const flipBtn = document.getElementById('story-bubble-flip-btn');
  const prevBtn = document.getElementById('story-bubble-prev');
  const nextBtn = document.getElementById('story-bubble-next');
  const flipContainer = document.getElementById('story-bubble-flip');
  const veil = document.getElementById('carousel-veil');

  let currentIndex = 0;

  function updateBubble(index) {
    currentIndex = index;
    const meta = PHOTO_META[index];

    bubbleDate.textContent = meta.date;
    bubbleStory.textContent = meta.story;
    bubbleCounter.textContent = `${index + 1} / ${PHOTO_META.length}`;
    bubbleFlipText.textContent = PHOTO_FLIP_TEXTS[index] || '';
    flipContainer.classList.remove('flipped');
  }

  /** 将气泡固定在 carousel-stage 右侧 — 与 active 卡片无关，位置始终一致 */
  function positionBubble() {
    const carousel = getCarousel();
    if (!carousel) return;

    const stage = carousel.container.parentElement; // .carousel-stage
    if (!stage) return;

    const stageRect = stage.getBoundingClientRect();
    const bubbleW = bubble.offsetWidth;
    const bubbleH = bubble.offsetHeight;
    const gap = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 默认：右侧
    let left = stageRect.right + gap;
    let top = stageRect.top;
    let below = false;

    // 右侧空间不够 → 左侧
    if (left + bubbleW > vw - 12) {
      left = stageRect.left - bubbleW - gap;
    }
    // 左侧也不够 → 放到 stage 下方
    if (left < 8 || left + bubbleW > vw - 12) {
      left = Math.max(8, (vw - bubbleW) / 2);
      top = stageRect.bottom + gap;
      below = true;
    }

    bubble.classList.toggle('below', below);

    // 垂直裁剪保护
    const maxTop = vh - bubbleH - 12;
    top = Math.max(8, Math.min(maxTop, top));

    bubble.style.left = `${Math.round(left)}px`;
    bubble.style.top = `${Math.round(top)}px`;
  }

  /* ---------- 翻转 ---------- */
  function toggleFlip() {
    flipContainer.classList.toggle('flipped');
  }

  flipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFlip();
  });

  // 双击气泡内容翻转
  bubble.addEventListener('dblclick', (e) => {
    if (e.target.closest('button')) return;
    toggleFlip();
  });

  /* ---------- 打开 / 关闭 ---------- */
  function open(index) {
    const carousel = getCarousel();
    if (carousel) {
      carousel.pause();
      carousel.goTo(index);
    }

    updateBubble(index);

    bubble.classList.add('open');
    bubble.setAttribute('aria-hidden', 'false');
    veil.classList.add('active');
    carousel.container.classList.add('carousel-highlight');

    // 等 active class 应用后再定位
    requestAnimationFrame(() => {
      positionBubble();
      closeBtn.focus();
    });

    document.body.style.overflow = 'hidden';
  }

  function close() {
    bubble.classList.remove('open');
    bubble.setAttribute('aria-hidden', 'true');
    veil.classList.remove('active');
    document.body.style.overflow = '';

    const carousel = getCarousel();
    if (carousel) {
      carousel.container.classList.remove('carousel-highlight');
      carousel.resume();
    }
  }

  function prev() {
    const newIndex = (currentIndex - 1 + PHOTO_META.length) % PHOTO_META.length;
    const carousel = getCarousel();
    if (carousel) carousel.goTo(newIndex);
    updateBubble(newIndex);
  }

  function next() {
    const newIndex = (currentIndex + 1) % PHOTO_META.length;
    const carousel = getCarousel();
    if (carousel) carousel.goTo(newIndex);
    updateBubble(newIndex);
  }

  /* ---------- 事件绑定 ---------- */
  closeBtn.addEventListener('click', close);
  veil.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && bubble.classList.contains('open')) {
      close();
    }
  });

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  document.addEventListener('keydown', (e) => {
    if (!bubble.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  });

  // 窗口 resize / scroll 时重新定位（气泡位置基于 stage，stage 可能因滚动而移动）
  window.addEventListener('resize', () => {
    if (bubble.classList.contains('open')) positionBubble();
  });
  window.addEventListener('scroll', () => {
    if (bubble.classList.contains('open')) positionBubble();
  }, { passive: true });

  return { open, close };
}
