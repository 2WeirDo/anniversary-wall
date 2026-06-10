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
    this.container.innerHTML = TIMELINE_EVENTS.map((item, index) => {
      const photoFilename = PHOTOS[item.photoIdx];
      const base = photoFilename.replace(/\.(jpg|jpeg|png)$/i, '');
      const side = index % 2 === 0 ? 'left' : 'right';

      return `
        <div class="timeline-card" data-timeline-index="${index}">
          <div class="timeline-card-inner ${side}">
            <div class="timeline-card-image">
              <picture>
                <source srcset="/photos-optimized/${base}.webp" type="image/webp" />
                <img src="/photos/${photoFilename}" alt="${item.title}" loading="lazy" />
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
      `;
    }).join('');
  }

  setupObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
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
