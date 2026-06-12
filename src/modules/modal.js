/**
 * 故事气泡弹窗 — 定位在 active 卡片右上角，不遮挡照片
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
  const arrow = bubble.querySelector('.story-bubble-arrow');

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

  /** 根据 active 卡片位置计算气泡坐标 */
  function positionBubble() {
    const carousel = getCarousel();
    if (!carousel) return;

    // 找到 active 卡片
    const activeCard = carousel.items?.find(el => el.classList.contains('active'));
    if (!activeCard) return;

    const cardRect = activeCard.getBoundingClientRect();
    const bubbleW = bubble.offsetWidth;
    const bubbleH = bubble.offsetHeight;
    const gap = 16;
    const arrowSize = 14;

    // 默认：气泡在卡片右上角外侧
    let left = cardRect.right + gap;
    let top = cardRect.top;

    // 箭头位置（相对于气泡）
    let arrowSide = 'left'; // 箭头在气泡左侧，指向卡片
    let arrowTop = 30;      // 箭头距气泡顶部的距离
    let arrowLeft = -7;     // 箭头左偏移

    // 右侧空间不够 → 放左侧
    if (left + bubbleW > window.innerWidth - 12) {
      left = cardRect.left - bubbleW - gap;
      arrowSide = 'right';
      arrowLeft = bubbleW - arrowSize / 2;
    }

    // 底部空间不够 → 对齐卡片底部
    if (top + bubbleH > window.innerHeight - 12) {
      top = Math.max(8, window.innerHeight - bubbleH - 12);
      arrowTop = cardRect.top + cardRect.height / 2 - top;
    }

    // 顶部空间不够 → 对齐卡片顶部
    if (top < 8) {
      top = 8;
      arrowTop = cardRect.top + cardRect.height / 2 - top;
    }

    // 箭头距顶部范围限制
    arrowTop = Math.max(20, Math.min(bubbleH - 20, arrowTop));

    bubble.style.left = `${Math.round(left)}px`;
    bubble.style.top = `${Math.round(top)}px`;

    // 箭头定位
    arrow.style.cssText = '';
    if (arrowSide === 'left') {
      arrow.style.left = `${arrowLeft}px`;
      arrow.style.top = `${Math.round(arrowTop)}px`;
      arrow.style.transform = 'rotate(45deg)';
    } else {
      arrow.style.left = `${Math.round(arrowLeft)}px`;
      arrow.style.top = `${Math.round(arrowTop)}px`;
      arrow.style.transform = 'rotate(-135deg)';
    }
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

    // 显示时先定位，再显示（避免跳动）
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
    requestAnimationFrame(() => positionBubble());
  }

  function next() {
    const newIndex = (currentIndex + 1) % PHOTO_META.length;
    const carousel = getCarousel();
    if (carousel) carousel.goTo(newIndex);
    updateBubble(newIndex);
    requestAnimationFrame(() => positionBubble());
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

  // 窗口 resize / scroll 时重新定位
  window.addEventListener('resize', () => {
    if (bubble.classList.contains('open')) positionBubble();
  });
  window.addEventListener('scroll', () => {
    if (bubble.classList.contains('open')) positionBubble();
  }, { passive: true });

  return { open, close };
}
