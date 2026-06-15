/**
 * Service Worker — 离线缓存
 * 缓存关键资源，支持离线访问
 */
const CACHE = 'love-story-v6';

const PRECACHE = [
  '/anniversary-wall/',
  '/anniversary-wall/index.html',
  '/anniversary-wall/favicon.svg',
  '/anniversary-wall/manifest.json',
  '/anniversary-wall/og-cover.jpg',
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

// 消息：页面可主动请求新版 SW 立即激活
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 请求策略
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const swURL = new URL(event.request.url);

  // API 代理：将同源 /api/music/ 请求转发到 GDStudio 音乐 API（绕过 CORS）
  // 匹配路径：/anniversary-wall/api/music/...
  const API_PROXY_PREFIX = '/anniversary-wall/api/music/';
  if (swURL.pathname.startsWith(API_PROXY_PREFIX)) {
    const apiPath = swURL.pathname.slice(API_PROXY_PREFIX.length); // e.g. "api.php"
    const targetUrl = `https://music-api.gdstudio.xyz/${apiPath}${swURL.search}`;
    event.respondWith(fetch(targetUrl));
    return;
  }

  // 图片 / 照片 / 音频：不拦截，让浏览器 HTTP 缓存 + CDN 原生处理
  // SW 缓存大文件到 IndexedDB 极慢且浪费存储配额
  const url = new URL(event.request.url);
  if (/\.(png|jpg|jpeg|webp|gif|svg|ico|flac|mp3|wav|ogg|aac|m4a)$/i.test(url.pathname) ||
      url.pathname.includes('/photos-optimized/') ||
      url.pathname.includes('/photos/') ||
      url.pathname.includes('/bgm/')) {
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
