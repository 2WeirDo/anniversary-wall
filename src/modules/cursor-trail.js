/**
 * 光标渐变光点拖尾效果
 * 触屏设备自动跳过
 */
export function initCursorTrail() {
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

  document.addEventListener('mousemove', () => {
    clearTimeout(idleTimer);
    startTrail();
    idleTimer = setTimeout(stopTrail, 2000);
  }, { passive: true });

  startTrail();
}
