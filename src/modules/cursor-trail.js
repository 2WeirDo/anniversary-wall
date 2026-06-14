/**
 * Hello Kitty 光标拖尾 — Canvas 绘制，单元素零卡顿
 * 3只渐小的 Kitty，直线跟随，触屏自动跳过
 */
export function initCursorTrail() {
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.style.cssText = `
    position: fixed; top: 0; left: 0;
    pointer-events: none; z-index: 9998;
  `;
  document.body.appendChild(canvas);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;

  function resize() {
    W = window.innerWidth || 1920;
    H = window.innerHeight || 1080;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // ── 椭圆工具（scale + arc，不用 ctx.ellipse 避免兼容问题）──
  function oval(rx, ry) {
    if (rx <= 0 || ry <= 0) return;
    ctx.save();
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.restore();
  }

  // ── 画一只 Hello Kitty ──
  function drawKitty(x, y, size, alpha) {
    if (alpha <= 0.01 || size <= 0) return;
    if (x < -200 || x > W + 200 || y < -200 || y > H + 200) return;

    const s = size;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);

    // 光晕
    ctx.fillStyle = 'rgba(240, 184, 200, 0.18)';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, s * 0.55), 0, Math.PI * 2);
    ctx.fill();

    // 耳朵 — 白色外三角
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#EDB8C5';
    ctx.lineWidth = 1;
    [
      [-s * 0.32, -s * 0.12, -s * 0.38, -s * 0.42, -s * 0.08, -s * 0.22],
      [ s * 0.32, -s * 0.12,  s * 0.38, -s * 0.42,  s * 0.08, -s * 0.22],
    ].forEach(([bx, by, mx, my, ex, ey]) => {
      ctx.beginPath();
      ctx.moveTo(bx, by); ctx.lineTo(mx, my); ctx.lineTo(ex, ey);
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
      ctx.moveTo(bx, by); ctx.lineTo(mx, my); ctx.lineTo(ex, ey);
      ctx.closePath();
      ctx.fill();
    });

    // 脸
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.strokeStyle = '#EDB8C5';
    ctx.lineWidth = 1.2;
    ctx.save();
    ctx.translate(0, s * 0.02);
    ctx.scale(1, 0.36 / 0.44);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.5, s * 0.44), 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();
    ctx.save();
    ctx.translate(0, s * 0.02);
    ctx.scale(1, 0.36 / 0.44);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.5, s * 0.44), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 蝴蝶结
    const bx = s * 0.25, by = -s * 0.43;
    ctx.fillStyle = '#EDB8C5';
    // 左瓣
    ctx.save();
    ctx.translate(bx - s * 0.08, by);
    ctx.rotate(-0.35);
    ctx.scale(1, 0.09 / 0.14);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.5, s * 0.14), 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();
    // 右瓣
    ctx.save();
    ctx.translate(bx + s * 0.12, by);
    ctx.rotate(0.35);
    ctx.scale(1, 0.09 / 0.14);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.5, s * 0.14), 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();
    // 中心结
    ctx.fillStyle = '#E8A8B6';
    ctx.beginPath();
    ctx.arc(bx + s * 0.02, by, Math.max(0.5, s * 0.05), 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#333';
    ctx.save();
    ctx.translate(-s * 0.1, -s * 0.06);
    ctx.scale(1, 0.065 / 0.045);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.3, s * 0.045), 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();
    ctx.save();
    ctx.translate(s * 0.1, -s * 0.06);
    ctx.scale(1, 0.065 / 0.045);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.3, s * 0.045), 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();

    // 鼻子
    ctx.fillStyle = '#F5D0BF';
    ctx.save();
    ctx.translate(0, s * 0.09);
    ctx.scale(1, 0.035 / 0.05);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.3, s * 0.05), 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();

    ctx.restore();
  }

  // ── 跟踪状态 ──
  const TRAIL_COUNT = 3;
  const sizes  = [26, 20, 15];
  const points = Array.from({ length: TRAIL_COUNT }, () => ({ x: -999, y: -999 }));
  let mouseX = -999, mouseY = -999;
  let idleFrames = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    idleFrames = 0;
  }, { passive: true });

  // ── 动画循环 ──
  let rafId = null;

  function animate() {
    ctx.clearRect(0, 0, W, H);

    // 检测是否停止：所有点接近鼠标
    let allNear = true;
    for (const p of points) {
      if (Math.abs(p.x - mouseX) > 1 || Math.abs(p.y - mouseY) > 1) {
        allNear = false;
        break;
      }
    }

    if (allNear && mouseX > 0) {
      idleFrames++;
    } else {
      idleFrames = 0;
    }

    // 超过 2 秒不动 + 全部淡出 → 停止 RAF
    if (idleFrames > 130) {
      rafId = null;
      return;
    }

    let lx = mouseX, ly = mouseY;
    const baseAlpha = idleFrames > 60
      ? Math.max(0, 1 - (idleFrames - 60) / 70)
      : 1;

    points.forEach((p, i) => {
      const ease = 0.2 - i * 0.06;
      p.x += (lx - p.x) * Math.max(ease, 0.05);
      p.y += (ly - p.y) * Math.max(ease, 0.05);

      if (baseAlpha <= 0) return;

      const a = baseAlpha * (1 - i * 0.2);
      if (a > 0.01) {
        try {
          drawKitty(ctx, p.x + 8, p.y + 8, sizes[i], a);
        } catch (_) { /* 单帧绘制失败不中断整个循环 */ }
      }

      lx = p.x;
      ly = p.y;
    });

    rafId = requestAnimationFrame(animate);
  }

  rafId = requestAnimationFrame(animate);
}
