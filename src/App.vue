<template>
  <div class="min-h-screen flex flex-col bg-slate-900 text-slate-100">
    <header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg">
            <Calculator class="w-6 h-6"/>
          </div>
          <span class="font-bold text-lg tracking-wide bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            MathEngine AI
          </span>
        </div>

        <nav class="flex gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <router-link
            to="/generator"
            class="px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2"
            active-class="bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
          >
            <Sparkles class="w-4 h-4"/> 出题系统
          </router-link>
          <router-link
            to="/solver"
            class="px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2"
            active-class="bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
          >
            <BrainCircuit class="w-4 h-4"/> 答题界面
          </router-link>
          <router-link
            to="/grader"
            class="px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2"
            active-class="bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
          >
            <CheckSquare class="w-4 h-4"/> 智能判题
          </router-link>
        </nav>
      </div>
    </header>

    <!-- 主页面渲染区域 -->
    <main class="flex-1 max-w-7xl w-full mx-auto p-6">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { Calculator, Sparkles, BrainCircuit, CheckSquare } from 'lucide-vue-next';
</script>