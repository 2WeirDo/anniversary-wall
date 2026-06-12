/**
 * Service Worker — 离线缓存
 * 缓存关键资源，支持离线访问
 */
const CACHE = 'love-story-v3';

const PRECACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json',
  '/og-cover.jpg',
];

// 复用的 Cache 实例 — 避免每次请求都调用 caches.open()
let _cachePromise = null;
function getCache() {
  if (!_cachePromise) _cachePromise = caches.open(CACHE);
  return _cachePromise;
}

// 安装：预缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    getCache().then((cache) => {
      return cache.addAll(PRECACHE).catch(() => {
        // 某个资源加载失败不影响 SW 安装
      });
    })
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 请求策略
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // 图片 / 照片：不拦截，让浏览器 HTTP 缓存 + CDN 原生处理
  // SW 缓存图片是冗余的 — 每个请求多两次 IndexedDB 磁盘 I/O，硬刷新时极慢
  const url = new URL(event.request.url);
  if (/\.(png|jpg|jpeg|webp|gif|svg|ico)$/i.test(url.pathname) ||
      url.pathname.includes('/photos-optimized/') ||
      url.pathname.includes('/photos/')) {
    return; // 浏览器原生处理，无 SW 开销
  }

  // HTML / navigation 请求：网络优先（确保拿到最新部署）
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          getCache().then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 静态资源：缓存优先，网络回退
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        getCache().then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => new Response('', { status: 503 }));
    })
  );
});
