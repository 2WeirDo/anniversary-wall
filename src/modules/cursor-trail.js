/**
 * Hello Kitty 光标拖尾 — Canvas 绘制，单元素零卡顿
 * 3只渐小的 Kitty，直线跟随，触屏自动跳过
 */
export function initCursorTrail() {
  if (window.matchMedia('(pointer: coarse)').matches) return;

  // ── 单张 canvas，硬件加速 ──
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.style.cssText = `
    position: fixed; top: 0; left: 0;
    pointer-events: none; z-index: 9998;
  `;
  document.body.appendChild(canvas);

  const dpr = Math.min(window.devicePixelRatio || 1, 2); // 视网膜屏不过度消耗
  let W, H;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // ── 画一只 Hello Kitty ──
  function drawKitty(x, y, size, alpha) {
    const s = size;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);

    // 光晕
    ctx.fillStyle = 'rgba(240, 184, 200, 0.18)';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // 耳朵 — 白色外三角
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#EDB8C5';
    ctx.lineWidth = 1;
    [
      [-s * 0.32, -s * 0.12, -s * 0.38, -s * 0.42, -s * 0.08, -s * 0.22],  // 左耳
      [ s * 0.32, -s * 0.12,  s * 0.38, -s * 0.42,  s * 0.08, -s * 0.22],  // 右耳
    ].forEach(([bx, by, mx, my, ex, ey]) => {
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(mx, my);
      ctx.lineTo(ex, ey);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    // 耳朵内侧粉
    ctx.fillStyle = '#FDE4EC';
    [
      [-s * 0.27, -s * 0.16, -s * 0.32, -s * 0.34, -s * 0.12, -s * 0.21],
      [ s * 0.27, -s * 0.16,  s * 0.32, -s * 0.34,  s * 0.12, -s * 0.21],
    ].forEach(([bx, by, mx, my, ex, ey]) => {
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(mx, my);
      ctx.lineTo(ex, ey);
      ctx.closePath();
      ctx.fill();
    });

    // 脸 — 白色椭圆（宽>高，Hello Kitty 标志性比例）
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.strokeStyle = '#EDB8C5';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.02, s * 0.44, s * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 蝴蝶结 — 右耳上方，这是 Hello Kitty 最标志的元素
    const bx = s * 0.25, by = -s * 0.43;
    ctx.fillStyle = '#EDB8C5';
    ctx.beginPath();
    ctx.ellipse(bx - s * 0.08, by, s * 0.14, s * 0.09, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx + s * 0.12, by, s * 0.14, s * 0.09, 0.35, 0, Math.PI * 2);
    ctx.fill();
    // 蝴蝶结中心
    ctx.fillStyle = '#E8A8B6';
    ctx.beginPath();
    ctx.arc(bx + s * 0.02, by, s * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛 — 黑色小圆点，间距是灵魂
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(-s * 0.1, -s * 0.06, s * 0.045, s * 0.065, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse( s * 0.1, -s * 0.06, s * 0.045, s * 0.065, 0, 0, Math.PI * 2);
    ctx.fill();

    // 鼻子 — 淡黄椭圆
    ctx.fillStyle = '#F5D0BF';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.09, s * 0.05, s * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── 跟踪状态 ──
  const TRAIL_COUNT = 3;
  const sizes  = [26, 20, 15];
  const points = Array.from({ length: TRAIL_COUNT }, () => ({ x: -999, y: -999 }));
  let mouseX = -999, mouseY = -999;
  let visible = false;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    visible = true;
  }, { passive: true });

  // ── 动画循环 ──
  let rafId = null;
  let idleFrames = 0;

  function animate() {
    ctx.clearRect(0, 0, W, H);

    if (!visible && idleFrames > 90) {
      // 完全不可见 + 1.5s 空闲 → 暂停 RAF
      rafId = null;
      return;
    }

    let lx = mouseX, ly = mouseY;
    let allNear = true;

    points.forEach((p, i) => {
      const ease = 0.2 - i * 0.06;
      p.x += (lx - p.x) * Math.max(ease, 0.05);
      p.y += (ly - p.y) * Math.max(ease, 0.05);

      if (Math.abs(p.x - mouseX) > 1 || Math.abs(p.y - mouseY) > 1) allNear = false;

      const alpha = visible ? Math.max(0.25, 1 - i * 0.22) : Math.max(0, (1 - i * 0.22) - idleFrames * 0.008);
      if (alpha > 0.01) {
        // 略微偏移，不遮挡光标
        drawKitty(ctx, p.x + 8, p.y + 8, sizes[i], alpha);
      }

      lx = p.x;
      ly = p.y;
    });

    if (allNear && visible) {
      idleFrames++;
      if (idleFrames > 60) visible = false; // 1s 不动开始淡出
    } else {
      idleFrames = 0;
    }

    rafId = requestAnimationFrame(animate);
  }

  // 鼠标移动时唤醒
  document.addEventListener('mousemove', () => {
    if (!rafId) {
      idleFrames = 0;
      visible = true;
      rafId = requestAnimationFrame(animate);
    }
  }, { passive: true });

  rafId = requestAnimationFrame(animate);
}
