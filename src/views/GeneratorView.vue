<template>
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
    <!-- 配置与 Prompt 输入面板 -->
    <div class="lg:col-span-5 bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 backdrop-blur space-y-6">
      <h2 class="text-xl font-semibold flex items-center gap-2 text-indigo-400">
        <Sliders class="w-5 h-5"/> 出题配置与 Prompt
      </h2>

      <form @submit.prevent="handleGenerate" class="space-y-6">
        <!-- 自由 Prompt 输入栏 -->
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">
            出题需求描述 (Prompt)
          </label>
          <textarea
            v-model="form.prompt"
            rows="3"
            placeholder="例如：请出一条关于定积分换元法的竞赛难度计算题，要求结合三角函数..."
            class="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all resize-none"
          ></textarea>
        </div>

        <!-- 模板快捷选项 -->
        <div class="pt-2 border-t border-slate-700/50 space-y-4">
          <div class="text-xs font-semibold uppercase tracking-wider text-slate-400">快捷模板与参数预设</div>

          <!-- 难度选择 -->
          <div>
            <label class="block text-xs text-slate-400 mb-2">题目难度</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="diff in difficulties"
                :key="diff.value"
                type="button"
                @click="form.difficulty = diff.value"
                :class="[
                  'py-2 px-3 rounded-lg text-xs font-medium border transition-all',
                  form.difficulty === diff.value
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                    : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                ]"
              >
                {{ diff.label }}
              </button>
            </div>
          </div>

          <!-- 题目类型 -->
          <div>
            <label class="block text-xs text-slate-400 mb-2">题目类型 (多选)</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="cat in categoryOptions"
                :key="cat.value"
                type="button"
                @click="toggleCategory(cat.value)"
                :class="[
                  'py-1.5 px-3 rounded-lg text-xs border transition-all',
                  form.categories.includes(cat.value)
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                    : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                ]"
              >
                {{ cat.label }}
              </button>
            </div>
          </div>

          <!-- 快捷填入 Prompt 示例按钮 -->
          <div>
            <label class="block text-xs text-slate-400 mb-1.5">常用 Prompt 模板灵感</label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="(tpl, idx) in quickPrompts"
                :key="idx"
                type="button"
                @click="applyQuickPrompt(tpl)"
                class="text-[11px] px-2.5 py-1 bg-slate-700/40 hover:bg-slate-700 text-slate-300 rounded-md transition-all border border-slate-700/60"
              >
                + {{ tpl.name }}
              </button>
            </div>
          </div>
        </div>

        <!-- 强制作图选项 -->
        <div class="flex items-center justify-between p-3.5 bg-slate-900/60 rounded-xl border border-slate-700/50">
          <div>
            <div class="text-xs font-medium text-slate-200">强制启用作图配图</div>
            <div class="text-[11px] text-slate-400">系统将依据判定自动生成几何画板/SVG</div>
          </div>
          <input
            type="checkbox"
            v-model="form.forceDiagram"
            class="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
          />
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 font-medium rounded-xl text-white shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Loader2 class="w-4 h-4 animate-spin" v-if="loading"/>
          <span v-else>生成题目</span>
        </button>

        <div
          v-if="errorMsg"
          class="p-3 bg-rose-950/30 border border-rose-800/50 rounded-xl text-xs text-rose-300 whitespace-pre-line"
        >
          ❌ {{ errorMsg }}
        </div>
      </form>
    </div>

    <!-- 预览与生成结果 -->
    <div class="lg:col-span-7 bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 flex flex-col">
      <h2 class="text-xl font-semibold mb-6 text-slate-200">生成预览区</h2>

      <div v-if="generatedQuestion" class="flex-1 flex flex-col justify-between space-y-6">
        <div class="space-y-4">
          <div class="flex flex-wrap gap-2">
            <span class="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-full text-xs font-medium">
              难度: {{ getDifficultyLabel(generatedQuestion.difficulty) }}
            </span>
            <span
              v-for="c in generatedQuestion.categories"
              :key="c"
              class="px-3 py-1 bg-slate-700/50 text-slate-300 rounded-full text-xs font-medium"
            >
              {{ getCategoryLabel(c) }}
            </span>
            <span
              v-if="generatedQuestion.requiresDiagram"
              class="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-xs font-medium"
            >
              需绘图判定
            </span>
          </div>

          <div v-if="generatedQuestion.prompt" class="p-3 bg-indigo-950/40 border border-indigo-800/50 rounded-lg text-xs text-indigo-300">
            <span class="font-semibold">要求 Prompt:</span> {{ generatedQuestion.prompt }}
          </div>

          <div class="p-4 bg-slate-900/80 rounded-xl border border-slate-700/50 text-slate-200 leading-relaxed font-mono text-sm whitespace-pre-line">
            <MathContent :text="generatedQuestion.content" />
          </div>

          <div v-if="generatedQuestion.requiresDiagram" class="p-4 bg-slate-900/90 rounded-xl border border-dashed border-slate-700 flex flex-col items-center justify-center">
            <div class="text-xs text-slate-400 mb-2">[ 绘图渲染接口挂载点 ]</div>
            <img :src="generatedQuestion.imageUrl" alt="题目几何图" class="max-h-56 rounded border border-slate-800" />
          </div>
        </div>

        <div class="pt-4 border-t border-slate-700/60 flex justify-end">
          <button
            @click="goToSolver"
            class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            带入当前题前往答题界面 <ArrowRight class="w-4 h-4"/>
          </button>
        </div>
      </div>

      <div v-else class="flex-1 flex flex-col items-center justify-center text-slate-500 py-16">
        <FileCode2 class="w-12 h-12 stroke-1 mb-3"/>
        <p>输入 Prompt 或配置快捷参数后点击“生成题目”</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMathStore } from '@/stores/mathStore';
import { generateQuestionApi } from '@/services/generatorService';
import { Sliders, Loader2, ArrowRight, FileCode2 } from 'lucide-vue-next';
import MathContent from '@/components/MathContent.vue';

const router = useRouter();
const mathStore = useMathStore();

const loading = ref(false);
const generatedQuestion = ref(null);
const errorMsg = ref('');

const difficulties = [
  { label: '初高中', value: 'high_school' },
  { label: '竞赛', value: 'competition' },
  { label: '大学', value: 'university' },
];

const categoryOptions = [
  { label: '组合数学', value: 'combinatorics' },
  { label: '集合', value: 'set' },
  { label: '数论', value: 'number_theory' },
  { label: '积分', value: 'integration' },
  { label: '几何', value: 'geometry' },
];

const quickPrompts = [
  { name: '积分换元竞赛题', prompt: '请出一条利用三角代换求解的高难度定积分题。', diff: 'competition', cat: ['integration'] },
  { name: '几何最值证明题', prompt: '请设计一条结合圆锥曲线与不等式极值的综合几何证明题。', diff: 'high_school', cat: ['geometry'] },
  { name: '组合计数与抽屉原理', prompt: '请出一条大学组合数学题，考查鸽巢原理与容斥原理应用。', diff: 'university', cat: ['combinatorics'] },
];

const form = reactive({
  prompt: '',
  difficulty: 'competition',
  categories: ['geometry'],
  forceDiagram: false,
});

const toggleCategory = (val) => {
  const index = form.categories.indexOf(val);
  if (index > -1) {
    form.categories.splice(index, 1);
  } else {
    form.categories.push(val);
  }
};

const applyQuickPrompt = (tpl) => {
  form.prompt = tpl.prompt;
  form.difficulty = tpl.diff;
  form.categories = [...tpl.cat];
};

const handleGenerate = async () => {
  loading.value = true;
  errorMsg.value = '';
  try {
    const res = await generateQuestionApi(form);
    generatedQuestion.value = res;
    mathStore.setCurrentQuestion(res);
  } catch (err) {
    errorMsg.value = err?.message || String(err);
  } finally {
    loading.value = false;
  }
};

const goToSolver = () => {
  router.push('/solver');
};

const getDifficultyLabel = (val) => difficulties.find((d) => d.value === val)?.label || val;
const getCategoryLabel = (val) => categoryOptions.find((c) => c.value === val)?.label || val;
</script>