<template>
  <div class="space-y-6">
    <!-- 顶栏与模式选择 -->
    <div class="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <span class="text-xs text-slate-400 font-medium">题目输入来源:</span>
        <div class="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
          <button
            v-for="mode in inputModes"
            :key="mode.value"
            @click="activeMode = mode.value"
            :class="[
              'px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5',
              activeMode === mode.value
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            ]"
          >
            <component :is="mode.icon" class="w-3.5 h-3.5" />
            <span>{{ mode.label }}</span>
          </button>
        </div>
      </div>

      <button
        @click="handleSolve"
        :disabled="!canSolve || loading"
        class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium rounded-lg transition-all flex items-center gap-2 text-sm shadow-md"
      >
        <Loader2 class="w-4 h-4 animate-spin" v-if="loading"/>
        <span v-if="isSolved">重新解析</span>
        <span v-else>解答 (点击分割页面)</span>
      </button>
    </div>

    <!-- 错误提示 -->
    <div
      v-if="errorMsg"
      class="p-4 bg-rose-950/30 border border-rose-800/50 rounded-xl text-xs text-rose-300 whitespace-pre-line"
    >
      ❌ {{ errorMsg }}
    </div>

    <!-- 主展示区: 支持平滑分屏布局 -->
    <div :class="['grid gap-6 transition-all duration-500 ease-in-out', isSolved ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1']">
      
      <!-- 题目展示与输入区 (左侧) -->
      <div :class="['bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 transition-all duration-500 flex flex-col justify-between space-y-4', isSolved ? 'lg:col-span-5' : 'max-w-3xl mx-auto w-full']">
        <div>
          <h3 class="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <BookOpen class="w-5 h-5 text-cyan-400" /> 题目编辑与预览
          </h3>

          <!-- 模式 1: 系统自动带入模式 -->
          <div v-if="activeMode === 'system'" class="space-y-4">
            <div v-if="systemQuestion" class="p-4 bg-slate-900/90 rounded-xl border border-slate-700/60 text-slate-100 font-mono text-sm leading-relaxed whitespace-pre-line">
              <MathContent :text="systemQuestion.content" />
            </div>
            <div v-if="systemQuestion?.imageUrl" class="space-y-2">
              <span class="text-xs text-slate-400 font-medium">题目示意图:</span>
              <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 flex justify-center">
                <img :src="systemQuestion.imageUrl" alt="题目图形" class="max-h-56 rounded" />
              </div>
            </div>
            <div v-if="!systemQuestion" class="p-8 text-center border border-dashed border-slate-700 rounded-xl text-xs text-slate-500">
              暂无系统题目，请先在“出题系统”生成题目，或切换上方“文本输入/照片上传”。
            </div>
          </div>

          <!-- 模式 2: 用户自由文本输入框 -->
          <div v-if="activeMode === 'text'" class="space-y-3">
            <label class="block text-xs text-slate-400 font-medium">在下方输入或粘贴你的数学题目文本/LaTeX:</label>
            <textarea
              v-model="customText"
              rows="6"
              placeholder="例如：已知函数 f(x) = x^3 - 3x，求其极值与单调区间..."
              class="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl p-4 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all resize-none"
            ></textarea>
          </div>

          <!-- 模式 3: 用户插入题目照片框 -->
          <div v-if="activeMode === 'image'" class="space-y-3">
            <label class="block text-xs text-slate-400 font-medium">上传或拖拽题目照片:</label>
            <div
              @click="triggerImageSelect"
              class="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 text-center cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition-all group"
            >
              <input type="file" ref="imageInputRef" accept="image/*" class="hidden" @change="handleImageFile" />
              <UploadCloud class="w-10 h-10 text-slate-500 group-hover:text-indigo-400 transition-colors mx-auto mb-2"/>
              <div class="text-sm font-medium text-slate-300">点击上传题目照片</div>
              <div class="text-xs text-slate-500 mt-1">支持常见照片格式 (PNG, JPG, JPEG)</div>
            </div>

            <!-- 照片预览 -->
            <div v-if="previewImageUrl" class="p-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-col items-center gap-2">
              <span class="text-xs text-emerald-400 self-start">已载入题目照片预览:</span>
              <img :src="previewImageUrl" class="max-h-52 rounded border border-slate-700" />
            </div>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-700/40 text-[11px] text-slate-500 flex justify-between">
          <span>当前输入状态: {{ isReadyToSolve ? '就绪' : '等待题目数据' }}</span>
          <span v-if="activeMode === 'image' && uploadedImageFile">{{ uploadedImageFile.name }}</span>
        </div>
      </div>

      <!-- 右侧：解答与推导步骤区 (平滑分屏展示) -->
      <div v-if="isSolved" class="lg:col-span-7 bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        
        <!-- 考察知识点 -->
        <div>
          <h4 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">考察知识点</h4>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="(kp, index) in solution.knowledgePoints"
              :key="index"
              class="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 rounded-lg text-xs font-medium flex items-center gap-1.5"
            >
              <CheckCircle2 class="w-3.5 h-3.5 text-indigo-400"/> {{ kp }}
            </span>
          </div>
        </div>

        <hr class="border-slate-700/50" />

        <!-- 逐步推导过程 -->
        <div>
          <h4 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">逐步推导过程</h4>
          <div class="space-y-4">
            <div
              v-for="step in visibleSteps"
              :key="step.stepIndex"
              class="p-4 bg-slate-900/70 border border-slate-700/50 rounded-xl space-y-2 relative overflow-hidden transition-all duration-300"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                  Step {{ step.stepIndex }}
                </span>
                <span class="text-xs text-slate-400 italic">依据: {{ step.reason }}</span>
              </div>
              <h5 class="text-sm font-semibold text-slate-200">{{ step.title }}</h5>
              <div class="text-xs font-mono text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800/80">
                <MathContent :text="step.content" />
              </div>
            </div>
          </div>

          <div v-if="solution && currentStepIndex < solution.steps.length" class="mt-4 flex justify-center">
            <button
              @click="nextStep"
              class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition-all"
            >
              显示下一步推导
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useMathStore } from '@/stores/mathStore';
import { fetchSolutionApi } from '@/services/solverService';
import { BookOpen, Loader2, CheckCircle2, Sparkles, Type, Image as ImageIcon, UploadCloud } from 'lucide-vue-next';
import MathContent from '@/components/MathContent.vue';

const mathStore = useMathStore();
const systemQuestion = computed(() => mathStore.currentQuestion);

const activeMode = ref('system'); // 'system' | 'text' | 'image'
const customText = ref('');
const imageInputRef = ref(null);
const uploadedImageFile = ref(null);
const previewImageUrl = ref(null);

const loading = ref(false);
const isSolved = ref(false);
const solution = ref(null);
const currentStepIndex = ref(0);
const errorMsg = ref('');

const inputModes = [
  { label: '系统带入题', value: 'system', icon: Sparkles },
  { label: '文字输入', value: 'text', icon: Type },
  { label: '图片插入', value: 'image', icon: ImageIcon },
];

const triggerImageSelect = () => {
  imageInputRef.value?.click();
};

const handleImageFile = (e) => {
  const file = e.target.files?.[0];
  if (file) {
    uploadedImageFile.value = file;
    previewImageUrl.value = URL.createObjectURL(file);
  }
};

const isReadyToSolve = computed(() => {
  if (activeMode.value === 'system') return !!systemQuestion.value;
  if (activeMode.value === 'text') return customText.value.trim().length > 0;
  if (activeMode.value === 'image') return !!uploadedImageFile.value;
  return false;
});

const canSolve = computed(() => isReadyToSolve.value);

const visibleSteps = computed(() => {
  if (!solution.value) return [];
  return solution.value.steps.slice(0, currentStepIndex.value);
});

const handleSolve = async () => {
  if (!canSolve.value) return;
  loading.value = true;
  errorMsg.value = '';

  const payload = {
    mode: activeMode.value,
    questionId: systemQuestion.value?.questionId,
    questionContent: systemQuestion.value?.content,
    customText: customText.value,
    imageFile: uploadedImageFile.value,
  };

  try {
    const res = await fetchSolutionApi(payload);
    solution.value = res;
    mathStore.setCurrentSolution(res);
    isSolved.value = true;
    currentStepIndex.value = 1;
  } catch (err) {
    errorMsg.value = err?.message || String(err);
    isSolved.value = false;
  } finally {
    loading.value = false;
  }
};

const nextStep = () => {
  if (solution.value && currentStepIndex.value < solution.value.steps.length) {
    currentStepIndex.value++;
  }
};

onMounted(() => {
  if (mathStore.currentSolution) {
    solution.value = mathStore.currentSolution;
    isSolved.value = true;
    currentStepIndex.value = solution.value.steps.length;
  }
});
</script>
