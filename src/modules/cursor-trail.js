/**
 * Hello Kitty 光标拖尾效果
 * 3只 CSS 绘制的 Hello Kitty 小脸，左右交替摇摆
 * 触屏设备自动跳过
 */
export function initCursorTrail() {
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const TRAIL_COUNT = 3;
  const trails = [];

  // 3档尺寸：领头最大，后面依次缩小
  const sizes = [28, 22, 17];

  for (let i = 0; i < TRAIL_COUNT; i++) {
    const s = sizes[i];
    const wrapper = document.createElement('span');
    wrapper.style.cssText = `
      position: fixed; pointer-events: none; z-index: 9998;
      opacity: 0; transition: opacity 0.3s ease-out;
    `;

    // 整张 Hello Kitty 脸拼在一个容器里
    const kitty = document.createElement('span');
    kitty.style.cssText = `
      display: block; position: relative;
      width: ${s}px; height: ${s * 0.85}px;
      background: white;
      border: 2px solid #E8006F;
      border-radius: 50% 50% 48% 48%;
      box-shadow: 0 0 ${s}px rgba(232,0,111,0.35);
    `;

    // ── 耳朵 ──
    [['left', -2], ['right', s - 10]].forEach(([side, left]) => {
      const ear = document.createElement('span');
      ear.style.cssText = `
        position: absolute; top: -${s * 0.3}px; left: ${left}px;
        width: 0; height: 0;
        border-left: ${s * 0.22}px solid transparent;
        border-right: ${s * 0.22}px solid transparent;
        border-bottom: ${s * 0.35}px solid white;
        filter: drop-shadow(0 -1px 0 #E8006F);
      `;
      // 耳朵内粉色填充
      const inner = document.createElement('span');
      inner.style.cssText = `
        position: absolute;
        top: ${s * 0.12}px; left: -${s * 0.12}px;
        width: 0; height: 0;
        border-left: ${s * 0.12}px solid transparent;
        border-right: ${s * 0.12}px solid transparent;
        border-bottom: ${s * 0.18}px solid #FFB0C0;
      `;
      ear.appendChild(inner);
      kitty.appendChild(ear);
    });

    // ── 蝴蝶结（右耳根）──
    const bow = document.createElement('span');
    bow.style.cssText = `
      position: absolute; top: -${s * 0.45}px; left: ${s - 13}px;
      display: flex; gap: 1px;
    `;
    ['left', 'right'].forEach(() => {
      const lobe = document.createElement('span');
      const bw = s * 0.26, bh = s * 0.22;
      lobe.style.cssText = `
        width: ${bw}px; height: ${bh}px;
        background: #E8006F;
        border-radius: 50% 50% 50% 50% / 40% 40% 60% 60%;
      `;
      bow.appendChild(lobe);
    });
    const knot = document.createElement('span');
    knot.style.cssText = `
      position: absolute; top: ${s * 0.13}px; left: 50%;
      transform: translateX(-50%);
      width: ${s * 0.1}px; height: ${s * 0.1}px;
      background: #E8006F; border-radius: 50%;
    `;
    kitty.appendChild(bow);

    // ── 眼睛 ──
    [['left', s * 0.28], ['right', s * 0.58]].forEach(([side, left]) => {
      const eye = document.createElement('span');
      eye.style.cssText = `
        position: absolute; top: ${s * 0.33}px; left: ${left}px;
        width: ${s * 0.09}px; height: ${s * 0.13}px;
        background: #333; border-radius: 50%;
      `;
      kitty.appendChild(eye);
    });

    // ── 鼻子（只有大中号画，小号太密）──
    if (i < 2) {
      const nose = document.createElement('span');
      nose.style.cssText = `
        position: absolute; top: ${s * 0.48}px; left: 50%;
        transform: translateX(-50%);
        width: ${s * 0.1}px; height: ${s * 0.07}px;
        background: #FFD700; border-radius: 50%;
      `;
      kitty.appendChild(nose);

      // ── 胡须（左右各3条）──
      [['left', -1], ['right', 1]].forEach(([side, dir]) => {
        for (let w = 0; w < 3; w++) {
          const whisker = document.createElement('span');
          whisker.style.cssText = `
            position: absolute;
            top: ${s * 0.46 + s * 0.05 * w}px;
            ${side}: ${dir === -1 ? -(s * 0.22) : 'auto'};
            right: ${dir === 1 ? -(s * 0.22) : 'auto'};
            width: ${s * 0.2}px; height: 1px;
            background: #ccc;
            transform: rotate(${dir * (15 - w * 10)}deg);
          `;
          kitty.appendChild(whisker);
        }
      });
    }

    wrapper.appendChild(kitty);
    document.body.appendChild(wrapper);
    trails.push({ el: wrapper, x: 0, y: 0 });
  }

  // ── 鼠标跟踪逻辑 ──
  let mouseX = -999, mouseY = -999, hideTimer = null;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    trails.forEach(t => { t.el.style.opacity = '1'; });
    clearTimeout(hideTimer);
    // 鼠标停下 600ms 后渐隐
    hideTimer = setTimeout(() => {
      trails.forEach((t, i) => setTimeout(() => { t.el.style.opacity = '0'; }, i * 80));
    }, 600);
  });

  let rafId = null, idleTimer = null;

  function animate() {
    let lx = mouseX, ly = mouseY;
    trails.forEach((t, i) => {
      const ease = 0.22 - i * 0.07;
      t.x += (lx - t.x) * Math.max(ease, 0.06);
      t.y += (ly - t.y) * Math.max(ease, 0.06);
      // 直线跟随
      const offsets = [0, 0, 0];
      t.el.style.left = (t.x + offsets[i]) + 'px';
      t.el.style.top = t.y + 'px';
      t.el.style.transform = 'translate(-50%, -50%)';
      lx = t.x; ly = t.y;
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
