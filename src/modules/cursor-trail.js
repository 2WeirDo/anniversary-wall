/**
 * Hello Kitty 光标拖尾 — Canvas 单元素渲染
 * 3只渐小的 Kitty，直线跟随，触屏跳过
 */
export function initCursorTrail() {
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  Object.assign(canvas.style, {
    position: 'fixed', top: '0', left: '0',
    pointerEvents: 'none', zIndex: '9998',
  });
  document.body.appendChild(canvas);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W, H;

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

  // ── drawKitty(x, y, size, alpha) ——
  function drawKitty(x, y, size, alpha) {
    if (alpha <= 0.01) return;
    const s = size;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);

    // 光晕
    ctx.fillStyle = 'rgba(240, 184, 200, 0.18)';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // 耳朵（白色三角 + 内侧粉三角）
    const ears = [
      { bx: -0.30, by: -0.12, mx: -0.38, my: -0.44, ex: -0.08, ey: -0.22,
        ibx: -0.26, iby: -0.16, imx: -0.32, imy: -0.36, iex: -0.12, iey: -0.21 },
      { bx:  0.30, by: -0.12, mx:  0.38, my: -0.44, ex:  0.08, ey: -0.22,
        ibx:  0.26, iby: -0.16, imx:  0.32, imy: -0.36, iex:  0.12, iey: -0.21 },
    ];
    ears.forEach(e => {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#EDB8C5';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(e.bx * s, e.by * s);
      ctx.lineTo(e.mx * s, e.my * s);
      ctx.lineTo(e.ex * s, e.ey * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FDE4EC';
      ctx.beginPath();
      ctx.moveTo(e.ibx * s, e.iby * s);
      ctx.lineTo(e.imx * s, e.imy * s);
      ctx.lineTo(e.iex * s, e.iey * s);
      ctx.closePath();
      ctx.fill();
    });

    // 脸（白色椭圆：scale + arc）
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = '#EDB8C5';
    ctx.lineWidth = 1.2;
    ctx.save();
    ctx.translate(0, s * 0.02);
    ctx.scale(1, 0.36 / 0.44);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.44, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 蝴蝶结
    const bx = s * 0.25, by = -s * 0.43;
    ctx.fillStyle = '#EDB8C5';
    ctx.save();
    ctx.translate(bx - s * 0.08, by);
    ctx.rotate(-0.35);
    ctx.scale(1, 0.09 / 0.14);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(bx + s * 0.12, by);
    ctx.rotate(0.35);
    ctx.scale(1, 0.09 / 0.14);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#E8A8B6';
    ctx.beginPath();
    ctx.arc(bx + s * 0.02, by, s * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#333';
    ctx.save();
    ctx.translate(-s * 0.1, -s * 0.06);
    ctx.scale(1, 0.065 / 0.045);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(s * 0.1, -s * 0.06);
    ctx.scale(1, 0.065 / 0.045);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 鼻子
    ctx.fillStyle = '#F5D0BF';
    ctx.save();
    ctx.translate(0, s * 0.09);
    ctx.scale(1, 0.035 / 0.05);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore(); // drawKitty 的 save
  }

  // ── 动画状态 ──
  const N = 3;
  const sizes = [26, 20, 15];
  const pts = Array.from({ length: N }, () => ({ x: 0, y: 0 }));
  let mx = 0, my = 0;
  let active = false;
  let idle = 0;
  let raf = null;

  window.addEventListener('mousemove', (e) => {
    if (!active) {
      active = true;
      mx = e.clientX;
      my = e.clientY;
      for (let i = 0; i < N; i++) { pts[i].x = mx; pts[i].y = my; }
      if (!raf) raf = requestAnimationFrame(loop);
    } else {
      mx = e.clientX;
      my = e.clientY;
    }
    idle = 0;
  }, { passive: true });

  // ── 循环 ──
  function loop() {
    ctx.clearRect(0, 0, W, H);
    if (!active) { raf = null; return; }

    const settled = pts.every(p => Math.abs(p.x - mx) < 1 && Math.abs(p.y - my) < 1);
    if (settled && mx > 0) idle++;
    else idle = 0;

    if (idle > 130) { raf = null; return; }

    const fade = idle > 60 ? Math.max(0, 1 - (idle - 60) / 70) : 1;

    let lx = mx, ly = my;
    for (let i = 0; i < N; i++) {
      const ease = 0.2 - i * 0.06;
      pts[i].x += (lx - pts[i].x) * Math.max(ease, 0.05);
      pts[i].y += (ly - pts[i].y) * Math.max(ease, 0.05);

      const a = fade * (1 - i * 0.2);
      if (a > 0.01) drawKitty(pts[i].x + 8, pts[i].y + 8, sizes[i], a);

      lx = pts[i].x;
      ly = pts[i].y;
    }

    raf = requestAnimationFrame(loop);
  }
}
