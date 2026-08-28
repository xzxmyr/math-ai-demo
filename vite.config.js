import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// base: 部署到 GitHub Pages 子路径时通过环境变量注入, 如 VITE_BASE_PATH=/math-ai-demo/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  base: process.env.VITE_BASE_PATH || '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
