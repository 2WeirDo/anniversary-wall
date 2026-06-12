/**
 * 照片详情弹窗：缩放、拖拽、翻转、键盘/触摸手势
 */
import { PHOTOS, PHOTO_META, PHOTO_FLIP_TEXTS } from './carousel.js';

export function initPhotoModal(getCarousel) {
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

    modalPhoto.srcset = `${import.meta.env.BASE_URL}photos-optimized/${base}-medium.webp 800w, ${import.meta.env.BASE_URL}photos-optimized/${base}-large.webp 1200w, ${import.meta.env.BASE_URL}photos-optimized/${base}.webp 1600w`;
    modalPhoto.sizes = '(max-width: 600px) 100vw, (max-width: 1200px) 80vw, 1200px';
    modalPhoto.src = `${import.meta.env.BASE_URL}photos-optimized/${base}-large.webp`;
    modalPhoto.alt = meta.story || `照片 ${index + 1}`;
    modalPhoto.onerror = function () {
      this.onerror = null;
    };
    modalDate.textContent = meta.date;
    modalStory.textContent = meta.story;
    modalCounter.textContent = `${index + 1} / ${PHOTO_META.length}`;
    modalFlipText.textContent = PHOTO_FLIP_TEXTS[index] || '';
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
    // 将焦点移入弹窗，方便键盘操作
    closeBtn.focus();
  }

  function close() {
    // 关闭前移出焦点，避免 aria-hidden 祖先遮挡 focused 元素的 a11y 警告
    if (modal.contains(document.activeElement)) {
      document.activeElement.blur();
    }
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

  // 移动端触摸滑动关闭
  const modalContent = modal.querySelector('.photo-modal-content');
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
