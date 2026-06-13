/**
 * 入场遮罩 — 书封翻开交互
 * 点击 / 向下滚动 / 上滑手势 触发入场
 */
export function initEntry(onEnter) {
  const overlay = document.getElementById('entry-overlay');
  const content = overlay.querySelector('.entry-content');
  const enterBtn = document.getElementById('enter-btn');

  let _entered = false;

  async function handleEnter() {
    if (_entered) return;
    _entered = true;

    // 显示加载状态
    enterBtn.classList.add('loading');
    enterBtn.querySelector('span').textContent = '加载中...';

    // 等待回调完成（预加载等）
    await onEnter();

    // 阶段1: 内容淡出
    content.classList.add('fade-out');
    // 阶段2: 书封裂开
    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 200);
  }

  enterBtn.addEventListener('click', handleEnter);

  // 向下滚动 = 翻书
  overlay.addEventListener('wheel', (e) => {
    if (e.deltaY > 0) {
      e.preventDefault();
      handleEnter();
    }
  }, { passive: false });

  // 上滑 = 翻书
  let _touchStartY = 0;
  overlay.addEventListener('touchstart', (e) => {
    _touchStartY = e.touches[0].clientY;
  }, { passive: true });
  overlay.addEventListener('touchmove', (e) => {
    if (_entered) return;
    const dy = _touchStartY - e.touches[0].clientY;
    if (dy > 60) {
      e.preventDefault();
      handleEnter();
    }
  }, { passive: false });

  return {
    /** 入场完成后恢复页面滚动 */
    unlock: () => { document.body.style.overflow = ''; },
  };
}
