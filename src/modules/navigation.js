/**
 * 页面导航：进度条、回到顶部、导航点
 */

/** 顶部阅读进度线 */
export function initProgressBar() {
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

/** 回到顶部按钮 */
export function initBackToTop() {
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

/** 右侧导航点：IntersectionObserver 跟踪当前板块 */
export function initNavDots() {
  const dots = document.querySelectorAll('.nav-dots .dot');
  const sections = document.querySelectorAll('.section');

  const sectionRatios = new Map();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const idx = parseInt(entry.target.getAttribute('data-section'));
        sectionRatios.set(idx, entry.intersectionRatio);
      });

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
