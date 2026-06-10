/**
 * 浮动粒子特效
 * 在 Hero 区域生成粉色圆点和爱心，在 Ending 区域生成爱心
 */

export class Particles {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      count: options.count || 25,
      types: options.types || ['dot', 'heart'],
      minSize: options.minSize || 4,
      maxSize: options.maxSize || 18,
      minDuration: options.minDuration || 8,
      maxDuration: options.maxDuration || 20,
      colors: options.colors || ['#FFD1DC', '#FFB6C1', '#FF69B4', '#FFF0F5'],
      ...options,
    };
    this.particles = [];
    this.init();
  }

  init() {
    if (!this.container) return;

    for (let i = 0; i < this.options.count; i++) {
      this.createParticle();
    }
  }

  createParticle() {
    const el = document.createElement('div');
    const type = this.options.types[Math.floor(Math.random() * this.options.types.length)];

    if (type === 'heart') {
      el.className = 'particle heart';
      el.textContent = ['💕', '💗', '💖', '✨', '🌸'][Math.floor(Math.random() * 5)];
    } else {
      el.className = 'particle dot';
      const size = this.options.minSize + Math.random() * (this.options.maxSize - this.options.minSize);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.background = this.options.colors[Math.floor(Math.random() * this.options.colors.length)];
    }

    el.style.left = `${Math.random() * 100}%`;
    el.style.top = `${Math.random() * 100}%`;
    el.style.animationDuration = `${this.options.minDuration + Math.random() * (this.options.maxDuration - this.options.minDuration)}s`;
    el.style.animationDelay = `${Math.random() * 15}s`;
    el.style.opacity = `${0.2 + Math.random() * 0.5}`;

    this.container.appendChild(el);
    this.particles.push(el);
  }

  destroy() {
    this.particles.forEach((el) => el.remove());
    this.particles = [];
  }
}

/**
 * Ending 区域的浮动爱心
 */
export class FloatingHearts {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.hearts = [];
    this.interval = null;
    this.init();
  }

  init() {
    if (!this.container) return;
    this.interval = setInterval(() => this.spawnHeart(), 600);
  }

  spawnHeart() {
    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    heart.textContent = ['💕', '💗', '💖', '💝', '💘', '🩷'][Math.floor(Math.random() * 6)];
    heart.style.left = `${10 + Math.random() * 80}%`;
    heart.style.bottom = '-30px';
    heart.style.fontSize = `${16 + Math.random() * 24}px`;
    heart.style.animationDuration = `${3 + Math.random() * 4}s`;
    heart.style.animationDelay = '0s';

    this.container.appendChild(heart);
    this.hearts.push(heart);

    // 动画结束后移除
    heart.addEventListener('animationend', () => {
      heart.remove();
      this.hearts = this.hearts.filter((h) => h !== heart);
    });
  }

  destroy() {
    if (this.interval) clearInterval(this.interval);
    this.hearts.forEach((h) => h.remove());
    this.hearts = [];
  }
}
