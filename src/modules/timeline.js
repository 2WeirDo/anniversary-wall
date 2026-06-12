/**
 * 恋爱时间线 — 瀑布卡片流
 * 左右交替的照片+故事卡片，IntersectionObserver 滚动触发入场
 * 内容来源：src/data/content.json
 */
import content from '../data/content.json';
import { PHOTOS } from './carousel.js';

const TIMELINE_EVENTS = content.timeline;

export class Timeline {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.observer = null;
    this.init();
  }

  init() {
    this.render();
    this.setupObserver();
  }

  render() {
    const fragments = [];
    TIMELINE_EVENTS.forEach((item, index) => {
      const photoFilename = PHOTOS[item.photoIdx];
      const base = photoFilename.replace(/\.(jpg|jpeg|png)$/i, '');
      const side = index % 2 === 0 ? 'left' : 'right';

      // 连接线 — 精致分隔符
      if (index > 0) {
        fragments.push(`<div class="timeline-connector" aria-hidden="true">
          <div class="timeline-connector-line"></div>
          <div class="timeline-connector-gem">
            <svg viewBox="0 0 40 40" fill="none">
              <line x1="20" y1="0" x2="20" y2="14" stroke="currentColor" stroke-width="0.5" opacity="0.25"/>
              <line x1="20" y1="26" x2="20" y2="40" stroke="currentColor" stroke-width="0.5" opacity="0.25"/>
              <polygon points="20,4 24,12 20,20 16,12" fill="currentColor" opacity="0.35"/>
              <polygon points="20,20 24,28 20,36 16,28" fill="currentColor" opacity="0.15"/>
              <circle cx="20" cy="20" r="3" fill="currentColor" opacity="0.5"/>
              <circle cx="20" cy="20" r="7" fill="none" stroke="currentColor" stroke-width="0.4" opacity="0.2"/>
              <circle cx="6" cy="30" r="1.2" fill="currentColor" opacity="0.3"/>
              <circle cx="34" cy="10" r="1" fill="currentColor" opacity="0.25"/>
              <circle cx="8" cy="8" r="0.8" fill="currentColor" opacity="0.2"/>
              <circle cx="33" cy="32" r="0.9" fill="currentColor" opacity="0.2"/>
            </svg>
          </div>
        </div>`);
      }

      fragments.push(`
        <div class="timeline-card" data-timeline-index="${index}">
          <div class="timeline-card-inner ${side}">
            <div class="timeline-card-image">
              <picture>
                <source srcset="${import.meta.env.BASE_URL}photos-optimized/${base}-small.webp" type="image/webp" />
                <img src="${import.meta.env.BASE_URL}photos-optimized/${base}.webp" alt="${item.title}" loading="lazy"
                  onerror="const p=this.closest('picture');if(p){const s=p.querySelector('source');if(s)s.remove();}this.src='${import.meta.env.BASE_URL}photos-optimized/${base}.webp';this.onerror=null"
                />
              </picture>
              <div class="timeline-card-date-badge">${item.date}</div>
            </div>
            <div class="timeline-card-body">
              <span class="timeline-card-date">${item.date}</span>
              <h3 class="timeline-card-title">${item.title}</h3>
              <p class="timeline-card-story">${item.story}</p>
            </div>
          </div>
        </div>
      `);
    });
    // 中轴线（随滚动亮起）
    fragments.push('<div class="timeline-line" aria-hidden="true"><div class="timeline-line-glow"></div></div>');
    this.container.innerHTML = fragments.join('');
  }

  setupObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            this.observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -60px 0px',
      }
    );

    const cards = this.container.querySelectorAll('.timeline-card');
    cards.forEach((card) => this.observer.observe(card));
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}
