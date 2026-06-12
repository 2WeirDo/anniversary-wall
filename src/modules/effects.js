/**
 * 装饰性视觉效果：粒子桥、照片墙光粒子、花瓣雨
 */

/** 跨板块过渡粒子桥 */
export function initBridgeSparkles() {
  const sections = document.querySelectorAll('.section');
  if (sections.length < 2) return;

  const colors = ['var(--color-accent)', 'var(--color-gold)', 'var(--color-primary)', 'var(--color-rose)'];

  sections.forEach((section, i) => {
    if (i === sections.length - 1) return;

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
      sparkle.style.left = (10 + Math.random() * 80) + '%';
      sparkle.style.top = '92%';
      section.appendChild(sparkle);
    }
  });
}

/** 照片墙悬浮光粒子 */
export function initCarouselSparkles() {
  const stage = document.getElementById('carousel-stage');
  if (!stage) return;

  const count = 18;
  const colors = ['var(--color-gold)', 'var(--color-accent)', 'var(--color-primary)'];
  for (let i = 0; i < count; i++) {
    const sparkle = document.createElement('span');
    sparkle.className = 'carousel-sparkle';
    sparkle.style.left = (-5 + Math.random() * 110) + '%';
    sparkle.style.top = (-10 + Math.random() * 120) + '%';
    const size = (5 + Math.random() * 12);
    sparkle.style.width = sparkle.style.height = size + 'px';
    sparkle.style.animationDelay = Math.random() * 6 + 's';
    sparkle.style.animationDuration = (4 + Math.random() * 6) + 's';
    sparkle.style.opacity = (0.2 + Math.random() * 0.4);
    sparkle.style.background = colors[Math.floor(Math.random() * colors.length)];
    stage.appendChild(sparkle);
  }
}

/** 纪念日花瓣雨（仅每月15号触发） */
export function initPetalRain() {
  const today = new Date();
  if (today.getDate() !== 15) return;

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
      const duration = parseFloat(petal.style.animationDuration) * 1000;
      setTimeout(() => petal.remove(), duration + 200);
    }, i * 250);
  }
}
