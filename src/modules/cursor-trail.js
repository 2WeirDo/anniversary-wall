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

  // ── drawKitty(x, y, size, alpha) —— 淡墨风格 ──
  function drawKitty(x, y, size, alpha) {
    if (alpha <= 0.005) return;
    const s = size;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);

    // ── 光晕：径向渐变，外缘自然消失 ──
    const glow = ctx.createRadialGradient(0, 0, s * 0.12, 0, 0, s * 0.72);
    glow.addColorStop(0, 'rgba(245,198,208,0.20)');
    glow.addColorStop(0.45, 'rgba(245,198,208,0.06)');
    glow.addColorStop(1, 'rgba(245,198,208,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.72, 0, Math.PI * 2);
    ctx.fill();

    // ── 耳朵 ──
    const earOutline = 'rgba(210,175,182,0.50)';
    const earLineW = Math.max(0.6, s * 0.028);

    function drawEar(side /* -1 left, +1 right */) {
      const sx = side;
      // 外耳三角
      const bx = sx * 0.30, by = -0.12;
      const mx = sx * 0.38, my = -0.46;
      const ex = sx * 0.07, ey = -0.23;

      ctx.fillStyle = '#fefdfc';
      ctx.strokeStyle = earOutline;
      ctx.lineWidth = earLineW;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(bx * s, by * s);
      ctx.lineTo(mx * s, my * s);
      ctx.lineTo(ex * s, ey * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 内耳粉三角（略小）
      const ibx = sx * 0.25, iby = -0.15;
      const imx = sx * 0.32, imy = -0.38;
      const iex = sx * 0.10, iey = -0.22;
      const inner = ctx.createLinearGradient(0, my * s, 0, by * s);
      inner.addColorStop(0, '#fde4ec');
      inner.addColorStop(1, '#fef4f7');
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.moveTo(ibx * s, iby * s);
      ctx.lineTo(imx * s, imy * s);
      ctx.lineTo(iex * s, iey * s);
      ctx.closePath();
      ctx.fill();
    }
    drawEar(-1);
    drawEar(+1);

    // ── 脸部：径向渐变珍珠光泽 ──
    const faceGrad = ctx.createRadialGradient(
      -s * 0.04, -s * 0.03, s * 0.03,
      0, s * 0.02, s * 0.44);
    faceGrad.addColorStop(0, '#ffffff');
    faceGrad.addColorStop(0.55, '#fffefe');
    faceGrad.addColorStop(0.85, '#fef7f8');
    faceGrad.addColorStop(1, '#fef0f3');

    ctx.fillStyle = faceGrad;
    ctx.strokeStyle = 'rgba(210,178,184,0.45)';
    ctx.lineWidth = Math.max(0.7, s * 0.032);
    ctx.save();
    ctx.translate(0, s * 0.02);
    ctx.scale(1, 0.38 / 0.44);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.44, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // ── 胡须：6根纤细弧线 ──
    ctx.strokeStyle = 'rgba(190,160,166,0.40)';
    ctx.lineWidth = Math.max(0.4, s * 0.019);
    ctx.lineCap = 'round';
    const wOff = [-0.04, 0, 0.04];
    wOff.forEach(wo => {
      // 左须
      ctx.beginPath();
      ctx.moveTo(-s * 0.30, s * 0.04 + wo * s);
      ctx.quadraticCurveTo(-s * 0.48, s * 0.05 + wo * s, -s * 0.60, s * 0.03 + wo * s * 0.8);
      ctx.stroke();
      // 右须
      ctx.beginPath();
      ctx.moveTo(s * 0.30, s * 0.04 + wo * s);
      ctx.quadraticCurveTo(s * 0.48, s * 0.05 + wo * s, s * 0.60, s * 0.03 + wo * s * 0.8);
      ctx.stroke();
    });

    // ── 蝴蝶结（右耳侧，双色瓣 + 褶皱结心）──
    const bCx = s * 0.27, bCy = -s * 0.16;
    const lobeR = s * 0.15;

    // 左瓣
    const bowL = ctx.createLinearGradient(bCx - s * 0.28, bCy, bCx, bCy);
    bowL.addColorStop(0, '#e8a8b6');
    bowL.addColorStop(0.5, '#f0c0cc');
    bowL.addColorStop(1, '#f5d0db');
    ctx.fillStyle = bowL;
    ctx.save();
    ctx.translate(bCx - s * 0.10, bCy);
    ctx.rotate(-0.38);
    ctx.scale(1, 0.5 / 0.16);
    ctx.beginPath();
    ctx.arc(0, 0, lobeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 右瓣
    const bowR = ctx.createLinearGradient(bCx, bCy, bCx + s * 0.28, bCy);
    bowR.addColorStop(0, '#f5d0db');
    bowR.addColorStop(0.5, '#f0c0cc');
    bowR.addColorStop(1, '#e8a8b6');
    ctx.fillStyle = bowR;
    ctx.save();
    ctx.translate(bCx + s * 0.10, bCy);
    ctx.rotate(0.38);
    ctx.scale(1, 0.5 / 0.16);
    ctx.beginPath();
    ctx.arc(0, 0, lobeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 结心
    const knot = ctx.createRadialGradient(bCx, bCy, 0, bCx, bCy, s * 0.065);
    knot.addColorStop(0, '#f8dde5');
    knot.addColorStop(1, '#d89aab');
    ctx.fillStyle = knot;
    ctx.beginPath();
    ctx.arc(bCx, bCy, s * 0.065, 0, Math.PI * 2);
    ctx.fill();

    // ── 眼睛：深色椭圆 + 白色高光 ──
    function drawEye(ex, ey) {
      const eyeGrad = ctx.createLinearGradient(0, ey * s - s * 0.04, 0, ey * s + s * 0.02);
      eyeGrad.addColorStop(0, '#3a3040');
      eyeGrad.addColorStop(1, '#221a25');
      ctx.fillStyle = eyeGrad;
      ctx.save();
      ctx.translate(ex * s, ey * s);
      ctx.scale(1, 0.07 / 0.05);
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 高光点
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex * s + s * 0.016, ey * s - s * 0.018, s * 0.016, 0, Math.PI * 2);
      ctx.fill();
    }
    drawEye(-0.1, -0.06);
    drawEye( 0.1, -0.06);

    // ── 鼻子：柔和粉椭圆 ──
    const noseGrad = ctx.createRadialGradient(0, s * 0.08, 0, 0, s * 0.09, s * 0.055);
    noseGrad.addColorStop(0, '#f9e2da');
    noseGrad.addColorStop(1, '#f0c5b5');
    ctx.fillStyle = noseGrad;
    ctx.save();
    ctx.translate(0, s * 0.09);
    ctx.scale(1, 0.04 / 0.055);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.055, 0, Math.PI * 2);
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
  let frame = 0; // 呼吸动画帧计数

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

    frame++;
    const t = frame * 16; // 近似毫秒

    let lx = mx, ly = my;
    for (let i = 0; i < N; i++) {
      // 慢速跟随，Kitty 远离光标
      const ease = 0.08 - i * 0.025;
      pts[i].x += (lx - pts[i].x) * Math.max(ease, 0.02);
      pts[i].y += (ly - pts[i].y) * Math.max(ease, 0.02);

      // 基础透明度 + 缓慢呼吸波动（若隐若现）
      const base = 0.7 - i * 0.18;
      const breath = 0.82 + 0.18 * Math.sin(t / 2500 + i * 1.3);
      const a = fade * base * breath;
      if (a > 0.005) drawKitty(pts[i].x + 12, pts[i].y + 12, sizes[i], a);

      lx = pts[i].x;
      ly = pts[i].y;
    }

    raf = requestAnimationFrame(loop);
  }
}
