/**
 * Ending 板块：数字滚动、自动仪式、天灯按钮
 */

/** 放飞一盏天灯 */
function spawnLantern() {
  const lantern = document.createElement('div');
  lantern.className = 'lantern';

  const x = 15 + Math.random() * 70;
  const drift = (Math.random() - 0.5) * 40;

  lantern.style.left = x + '%';
  lantern.style.setProperty('--drift', drift + 'px');
  lantern.style.animationDuration = (7 + Math.random() * 5) + 's';

  const animIdx = Math.floor(Math.random() * 3) + 1;
  lantern.style.animationName = `lanternDrift${animIdx}`;

  lantern.innerHTML = `
    <div class="lantern-glow"></div>
    <div class="lantern-body"></div>
  `;

  document.body.appendChild(lantern);

  const duration = parseFloat(lantern.style.animationDuration) * 1000;
  setTimeout(() => {
    lantern.remove();
  }, duration + 200);
}

/** Ending 天数数字滚动动画 */
export function initEndingCounterRoll() {
  const endingSection = document.getElementById('ending');
  const counterEl = document.getElementById('days-counter');
  if (!endingSection || !counterEl) return;

  let rolled = false;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !rolled) {
        rolled = true;
        const target = parseInt(counterEl.textContent) || 0;
        const duration = 1500;
        const start = performance.now();

        function tick(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = progress >= 1 ? 1 : 1 - Math.pow(2, -10 * progress);
          const current = Math.floor(eased * target);
          counterEl.textContent = current;
          if (progress < 1) {
            requestAnimationFrame(tick);
          } else {
            counterEl.textContent = target;
          }
        }
        requestAnimationFrame(tick);
      }
    });
  }, { threshold: 0.3 });
  observer.observe(endingSection);
}

/** Ending 自动仪式：滚动进入时放天灯 + 心形粒子 */
export function initEndingCeremony() {
  const endingSection = document.getElementById('ending');
  if (!endingSection) return;

  let triggered = false;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !triggered) {
          triggered = true;
          setTimeout(() => {
            for (let i = 0; i < 2; i++) {
              setTimeout(() => spawnLantern(), i * 500);
            }
            const heartsContainer = document.getElementById('ending-particles');
            if (heartsContainer) {
              for (let i = 0; i < 8; i++) {
                setTimeout(() => {
                  const heart = document.createElement('span');
                  heart.className = 'floating-heart';
                  heart.textContent = ['♥', '♡', '❤', '💕', '💖'][Math.floor(Math.random() * 5)];
                  heart.style.left = (10 + Math.random() * 80) + '%';
                  heart.style.animationDuration = (3 + Math.random() * 4) + 's';
                  heart.style.fontSize = (18 + Math.random() * 20) + 'px';
                  heartsContainer.appendChild(heart);
                  const dur = parseFloat(heart.style.animationDuration) * 1000;
                  setTimeout(() => heart.remove(), dur + 200);
                }, i * 150);
              }
            }
          }, 1200);
        }
      });
    },
    { threshold: 0.4 }
  );
  observer.observe(endingSection);
}

/** 天灯按钮（手动触发） */
export function initLanternButton() {
  const btn = document.getElementById('lantern-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const count = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < count; i++) {
      setTimeout(() => spawnLantern(), i * 300);
    }
  });
}
