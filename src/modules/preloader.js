/**
 * 后台图片预加载器
 * 在入场遮罩期间静默缓存缩略图，利用用户阅读文字的窗口时间
 */
import { PHOTOS } from './carousel.js';

/**
 * 后台全量预加载 — 分批次加载避免瞬间拥塞
 * @param {number} [count=10] 预加载图片数量
 * @returns {Promise<void[]>}
 */
export function backgroundPreloadAll(count = 10) {
  const BATCH = 4;
  const DELAY = 80;
  const bases = PHOTOS.slice(0, count).map((f) => f.replace(/\.(jpg|jpeg|png)$/i, ''));
  const results = [];

  for (let i = 0; i < bases.length; i += BATCH) {
    const batch = bases.slice(i, i + BATCH);
    const delay = (i / BATCH) * DELAY;
    const batchPromise = new Promise((resolve) => {
      setTimeout(() => {
        Promise.all(batch.map((base) => new Promise((r) => {
          const img = new Image();
          img.onload = r;
          img.onerror = r;
          img.src = `${import.meta.env.BASE_URL}photos-optimized/${base}-small.webp`;
        }))).then(resolve);
      }, delay);
    });
    results.push(batchPromise);
  }
  return Promise.all(results);
}
