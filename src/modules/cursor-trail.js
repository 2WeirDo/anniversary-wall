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

  // ── 椭圆（scale + arc，fill/stroke 在 restore 之前）──
  function ellipse(cx, cy, rx, ry, rot) {
    ctx.save();
    ctx.translate(cx, cy);
    if (rot) ctx.rotate(rot);
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.restore();   // 恢复变换
    // 路径还在！再 save/restore 只是为了 fill/stroke 时变换已撤销
  }

  function fillEllipse(cx, cy, rx, ry, rot) {
    ctx.save();
    ctx.translate(cx, cy);
    if (rot) ctx.rotate(rot);
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();     // 在变换生效时 fill
    ctx.restore();
  }

  function strokeEllipse(cx, cy, rx, ry, rot) {
    ctx.save();
    ctx.translate(cx, cy);
    if (rot) ctx.rotate(rot);
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.stroke();   // 在变换生效时 stroke
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
    ctx.fillStyle = 'rgba(240, 184, 200, 0.15)';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // ── 耳朵（白色三角 + 粉色内侧）──
    const earDefs = [
      { baseX: -s * 0.30, baseY: -s * 0.12, tipX: -s * 0.38, tipY: -s * 0.44,
        endX: -s * 0.08, endY: -s * 0.22, inner: [[-s*0.26,-s*0.16,-s*0.32,-s*0.36,-s*0.12,-s*0.21]] },
      { baseX:  s * 0.30, baseY: -s * 0.12, tipX:  s * 0.38, tipY: -s * 0.44,
        endX:  s * 0.08, endY: -s * 0.22, inner: [[ s*0.26,-s*0.16, s*0.32,-s*0.36, s*0.12,-s*0.21]] },
    ];

    earDefs.forEach(ear => {
      // 白色外耳
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#EDB8C5';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ear.baseX, ear.baseY);
      ctx.lineTo(ear.tipX, ear.tipY);
      ctx.lineTo(ear.endX, ear.endY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 粉色内耳
      ear.inner.forEach(([bx, by, mx, my, ex, ey]) => {
        ctx.fillStyle = '#FDE4EC';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(mx, my);
        ctx.lineTo(ex, ey);
        ctx.closePath();
        ctx.fill();
      });
    });

    // ── 脸（椭圆）──
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = '#EDB8C5';
    ctx.lineWidth = 1.2;
    fillEllipse(0, s * 0.02, s * 0.44, s * 0.36, 0);
    strokeEllipse(0, s * 0.02, s * 0.44, s * 0.36, 0);

    // ── 蝴蝶结（右耳旁）──
    const bx = s * 0.25, by = -s * 0.43;
    ctx.fillStyle = '#EDB8C5';
    fillEllipse(bx - s * 0.08, by, s * 0.14, s * 0.09, -0.35);
    fillEllipse(bx + s * 0.12, by, s * 0.14, s * 0.09,  0.35);
    // 中心结
    ctx.fillStyle = '#E8A8B6';
    ctx.beginPath();
    ctx.arc(bx + s * 0.02, by, s * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // ── 眼睛 ──
    ctx.fillStyle = '#333';
    fillEllipse(-s * 0.1, -s * 0.06, s * 0.045, s * 0.065, 0);
    fillEllipse( s * 0.1, -s * 0.06, s * 0.045, s * 0.065, 0);

    // ── 鼻子 ──
    ctx.fillStyle = '#F5D0BF';
    fillEllipse(0, s * 0.09, s * 0.05, s * 0.035, 0);

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

    if (idleFrames > 130) { rafId = null; return; }

    let lx = mouseX, ly = mouseY;
    const fade = idleFrames > 60 ? Math.max(0, 1 - (idleFrames - 60) / 70) : 1;

    points.forEach((p, i) => {
      const ease = 0.2 - i * 0.06;
      p.x += (lx - p.x) * Math.max(ease, 0.05);
      p.y += (ly - p.y) * Math.max(ease, 0.05);

      if (fade <= 0) return;
      const a = fade * (1 - i * 0.2);
      if (a > 0.01) {
        try { drawKitty(ctx, p.x + 8, p.y + 8, sizes[i], a); } catch (_) {}
      }
      lx = p.x; ly = p.y;
    });

    rafId = requestAnimationFrame(animate);
  }

  rafId = requestAnimationFrame(animate);
}
