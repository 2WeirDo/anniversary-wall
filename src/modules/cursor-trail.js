/**
 * Hello Kitty 光标拖尾 — 淡彩瓷娃娃风格
 * 3只轻盈的 CSS Hello Kitty，直线跟随，触屏跳过
 */
export function initCursorTrail() {
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const TRAIL_COUNT = 3;
  const trails = [];

  // 配色：淡粉瓷色系，柔和克制
  const palette = {
    border:   '#F2C4D0',  // 淡玫瑰粉 — 脸的边框
    bow:      '#EDB8C5',  // 柔粉 — 蝴蝶结
    bowKnot:  '#E8A8B6',  // 稍深 — 蝴蝶结中心结
    earInner: '#FDE4EC',  // 极淡粉 — 耳朵内侧
    eye:      '#C4A0A8',  // 灰粉棕 — 眼睛（不用纯黑）
    nose:     '#F5D0BF',  // 暖杏色 — 鼻子
    whisker:  '#E8D5DA',  // 淡粉灰 — 胡须
    glow:     'rgba(237, 184, 197, 0.22)', // 柔光
  };

  const sizes = [24, 19, 15]; // 小巧不抢眼

  for (let i = 0; i < TRAIL_COUNT; i++) {
    const s = sizes[i];
    const faceH = s * 0.84;

    const wrapper = document.createElement('span');
    wrapper.style.cssText = `
      position: fixed; pointer-events: none; z-index: 9998;
      opacity: 0; transition: opacity 0.35s ease-out;
    `;

    // ── 脸 ──
    const face = document.createElement('span');
    face.style.cssText = `
      display: block; position: relative;
      width: ${s}px; height: ${faceH}px;
      background: rgba(255,255,255,0.92);
      border: 1.5px solid ${palette.border};
      border-radius: 50% 50% 46% 46%;
      box-shadow: 0 0 ${s * 1.2}px ${palette.glow};
    `;

    // ── 耳朵 ──
    const earPositions = [
      { side: 'left',  left: s * 0.0 },
      { side: 'right', left: s * 0.6 },
    ];
    earPositions.forEach(({ left }) => {
      const ear = document.createElement('span');
      ear.style.cssText = `
        position: absolute; top: -${s * 0.28}px; left: ${left}px;
        width: 0; height: 0;
        border-left: ${s * 0.2}px solid transparent;
        border-right: ${s * 0.2}px solid transparent;
        border-bottom: ${s * 0.32}px solid white;
        filter: drop-shadow(0 -0.5px 0 ${palette.border});
      `;
      const inner = document.createElement('span');
      inner.style.cssText = `
        position: absolute;
        top: ${s * 0.11}px; left: -${s * 0.11}px;
        width: 0; height: 0;
        border-left: ${s * 0.11}px solid transparent;
        border-right: ${s * 0.11}px solid transparent;
        border-bottom: ${s * 0.16}px solid ${palette.earInner};
      `;
      ear.appendChild(inner);
      face.appendChild(ear);
    });

    // ── 蝴蝶结 ──
    const bow = document.createElement('span');
    bow.style.cssText = `
      position: absolute;
      top: -${s * 0.42}px; left: ${s * 0.6}px;
      display: flex; gap: 1px;
    `;
    [0, 1].forEach(() => {
      const lobe = document.createElement('span');
      const bw = s * 0.24, bh = s * 0.20;
      lobe.style.cssText = `
        width: ${bw}px; height: ${bh}px;
        background: ${palette.bow};
        border-radius: 50% 50% 50% 50% / 40% 40% 60% 60%;
        box-shadow: 0 0 2px rgba(237,184,197,0.3);
      `;
      bow.appendChild(lobe);
    });
    // 蝴蝶结中心小圆结
    const knot = document.createElement('span');
    const knotSz = s * 0.09;
    knot.style.cssText = `
      position: absolute; top: ${s * 0.12}px; left: 50%;
      transform: translateX(-50%);
      width: ${knotSz}px; height: ${knotSz}px;
      background: ${palette.bowKnot}; border-radius: 50%;
    `;
    face.appendChild(bow);

    // ── 眼睛 ──
    [
      { left: s * 0.28, top: s * 0.33 },
      { left: s * 0.57, top: s * 0.33 },
    ].forEach(({ left, top }) => {
      const eye = document.createElement('span');
      eye.style.cssText = `
        position: absolute; top: ${top}px; left: ${left}px;
        width: ${s * 0.085}px; height: ${s * 0.12}px;
        background: ${palette.eye}; border-radius: 50%;
      `;
      face.appendChild(eye);
    });

    // ── 鼻子（小号省略）──
    if (i < 2) {
      const nose = document.createElement('span');
      nose.style.cssText = `
        position: absolute; top: ${s * 0.47}px; left: 50%;
        transform: translateX(-50%);
        width: ${s * 0.1}px; height: ${s * 0.065}px;
        background: ${palette.nose}; border-radius: 50%;
      `;
      face.appendChild(nose);

      // 胡须
      [-1, 1].forEach(dir => {
        for (let w = 0; w < 3; w++) {
          const whisker = document.createElement('span');
          whisker.style.cssText = `
            position: absolute;
            top: ${s * 0.45 + s * 0.045 * w}px;
            ${dir === -1 ? 'left' : 'right'}: ${dir * s * 0.18}px;
            width: ${s * 0.18}px; height: 0.8px;
            background: ${palette.whisker};
            transform: rotate(${dir * (14 - w * 9)}deg);
          `;
          face.appendChild(whisker);
        }
      });
    }

    wrapper.appendChild(face);
    document.body.appendChild(wrapper);
    trails.push({ el: wrapper, x: 0, y: 0 });
  }

  // ── 跟踪逻辑 ──
  let mouseX = -999, mouseY = -999, hideTimer = null;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    trails.forEach(t => { t.el.style.opacity = '1'; });
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      trails.forEach((t, i) => setTimeout(() => { t.el.style.opacity = '0'; }, i * 90));
    }, 600);
  });

  let rafId = null, idleTimer = null;

  function animate() {
    let lx = mouseX, ly = mouseY;
    trails.forEach((t, i) => {
      const ease = 0.2 - i * 0.06;
      t.x += (lx - t.x) * Math.max(ease, 0.05);
      t.y += (ly - t.y) * Math.max(ease, 0.05);
      t.el.style.left = t.x + 'px';
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
