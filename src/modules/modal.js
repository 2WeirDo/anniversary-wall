/**
 * 照片故事弹窗（纯文字卡片 + 3D 翻转情话）
 * 轮播中已展示照片，弹窗聚焦于故事内容，打开即显、无需等待图片加载
 */
import { PHOTO_META, PHOTO_FLIP_TEXTS } from './carousel.js';

export function initPhotoModal(getCarousel) {
  const modal = document.getElementById('photo-modal');
  const modalDate = document.getElementById('modal-date');
  const modalStory = document.getElementById('modal-story');
  const modalCounter = document.getElementById('modal-counter');
  const closeBtn = document.getElementById('modal-close');
  const flipBtn = document.getElementById('modal-flip-btn');
  const prevBtn = document.getElementById('modal-prev');
  const nextBtn = document.getElementById('modal-next');
  const overlay = modal.querySelector('.photo-modal-overlay');
  const flipContainer = document.getElementById('photo-flip-container');
  const flipText = document.getElementById('modal-flip-text');

  let currentIndex = 0;

  function updateModal(index) {
    currentIndex = index;
    const meta = PHOTO_META[index];

    modalDate.textContent = meta.date;
    modalStory.textContent = meta.story;
    modalCounter.textContent = `${index + 1} / ${PHOTO_META.length}`;
    flipText.textContent = PHOTO_FLIP_TEXTS[index] || '';
    flipContainer.classList.remove('flipped');
  }

  /* ---------- 翻转 ---------- */

  function toggleFlip() {
    flipContainer.classList.toggle('flipped');
  }

  // HelloKitty 按钮翻转
  flipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFlip();
  });

  // 双击卡片内容翻转
  const modalContent = modal.querySelector('.photo-modal-content');
  modalContent.addEventListener('dblclick', (e) => {
    // 不在按钮上双击时触发翻转
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
    updateModal(index);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function close() {
    if (modal.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
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

  /* ---------- 事件绑定 ---------- */

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
  let touchStartY = 0, touchStartScrollTop = 0;
  modalContent.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    touchStartScrollTop = modalContent.scrollTop;
  }, { passive: true });
  modalContent.addEventListener('touchmove', (e) => {
    const dy = e.touches[0].clientY - touchStartY;
    if (dy > 80 && touchStartScrollTop <= 0 && modalContent.scrollTop <= 0) {
      close();
    }
  }, { passive: true });

  return { open, close };
}
