/**
 * Hero 板块动画：逐字揭示 + 鼠标视差
 */

/** Hero 标题逐字淡入动画 */
export function triggerHeroChars() {
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

/** Hero 背景蝴蝶结 + 标题鼠标视差 */
export function initHeroParallax() {
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
