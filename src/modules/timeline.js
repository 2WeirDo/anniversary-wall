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

      // 连接线（卡片之间）
      if (index > 0) {
        fragments.push(`<div class="timeline-connector" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 21C12 21 3 14 3 8.5C3 5.5 5.5 3.5 8 3.5C10 3.5 12 6 12 6C12 6 14 3.5 16 3.5C18.5 3.5 21 5.5 21 8.5C21 14 12 21 12 21Z" />
          </svg>
        </div>`);
      }

      fragments.push(`
        <div class="timeline-card" data-timeline-index="${index}">
          <div class="timeline-card-inner ${side}">
            <div class="timeline-card-image">
              <picture>
                <source srcset="${import.meta.env.BASE_URL}photos-optimized/${base}.webp" type="image/webp" />
                <img src="${import.meta.env.BASE_URL}photos/${photoFilename}" alt="${item.title}" loading="lazy"
                  onerror="const p=this.closest('picture');if(p){const s=p.querySelector('source');if(s)s.remove();}this.src='${import.meta.env.BASE_URL}photos/${photoFilename}';this.onerror=null"
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
