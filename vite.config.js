import { defineConfig } from 'vite';

export default defineConfig({
  base: '/anniversary-wall/',
  server: {
    hmr: {
      // 当 base 非根路径时，显式指定 HMR WebSocket 路径
      path: '/',
    },
    proxy: {
      '/api/music': {
        target: 'https://music-api.gdstudio.xyz',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/music/, ''),
        headers: {
          Referer: 'https://music.gdstudio.xyz/',
        },
      },
    },
  },
});
