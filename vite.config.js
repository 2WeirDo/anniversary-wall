import { defineConfig } from 'vite';

export default defineConfig({
  base: '/anniversary-wall/',
  server: {
    hmr: {
      // 当 base 非根路径时，显式指定 HMR WebSocket 路径
      path: '/',
    },
  },
});
