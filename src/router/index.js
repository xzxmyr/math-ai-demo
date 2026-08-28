import { createRouter, createWebHashHistory } from 'vue-router';
import GeneratorView from '@/views/GeneratorView.vue';
import SolverView from '@/views/SolverView.vue';
import GraderView from '@/views/GraderView.vue';

const routes = [
  { path: '/', redirect: '/generator' },
  { path: '/generator', name: 'Generator', component: GeneratorView },
  { path: '/solver', name: 'Solver', component: SolverView },
  { path: '/grader', name: 'Grader', component: GraderView },
];

// 使用 hash 模式: 兼容 GitHub Pages 等纯静态托管 (无需服务器 404 回退)
export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
