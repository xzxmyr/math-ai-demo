<template>
  <div class="space-y-6">
    <!-- 头部说明 -->
    <div class="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">
          <CheckSquare class="w-5 h-5 text-indigo-400"/> 智能判题与作业批改系统
        </h2>
        <p class="text-xs text-slate-400 mt-1">
          上传包含题目与学生解答过程的图片，系统将自动进行视觉区域切分、独立解题对比并给出改进建议。
        </p>
      </div>
      <div v-if="step > 1" class="flex gap-2">
        <button
          @click="resetGrader"
          class="px-3.5 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-all"
        >
          重新上传批改
        </button>
      </div>
    </div>

    <!-- 流程步骤 1: 图片上传与 OCR / 视觉切分预览 -->
    <div v-if="step === 1" class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- 上传文件框 -->
      <div class="lg:col-span-5 bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 backdrop-blur flex flex-col justify-between">
        <div>
          <h3 class="text-sm font-semibold text-slate-300 mb-4">上传解答图片/作业单</h3>
          <div
            @click="triggerFileInput"
            class="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 text-center cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition-all group"
          >
            <input type="file" ref="fileInputRef" accept="image/*" class="hidden" @change="handleFileSelect" />
            <UploadCloud class="w-10 h-10 text-slate-500 group-hover:text-indigo-400 transition-colors mx-auto mb-3"/>
            <div class="text-sm font-medium text-slate-300">点击上传 或 将图片拖拽至此处</div>
            <div class="text-xs text-slate-500 mt-1">支持 PNG, JPG, JPEG (最大 10MB)</div>
          </div>
        </div>

        <div v-if="selectedFile" class="mt-4 p-3 bg-slate-900/80 rounded-xl border border-slate-700 flex items-center justify-between text-xs">
          <span class="truncate text-slate-300 font-mono">{{ selectedFile.name }}</span>
          <span class="text-emerald-400 font-medium">已选择</span>
        </div>

        <button
          @click="startSegmentation"
          :disabled="!selectedFile || loadingSegment"
          class="mt-6 w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25"
        >
          <Loader2 class="w-4 h-4 animate-spin" v-if="loadingSegment"/>
          <span>执行视觉区域切分与识别</span>
        </button>
      </div>

      <!-- 识别与切分挂载区域 -->
      <div class="lg:col-span-7 bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 flex flex-col">
        <h3 class="text-sm font-semibold text-slate-300 mb-4">切分与 OCR 解析挂载点</h3>

        <div v-if="segmentResult" class="space-y-4 flex-1 flex flex-col justify-between">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- ① 题目块 -->
            <div class="p-3 bg-slate-900/90 rounded-xl border border-slate-700/80 space-y-2">
              <span class="text-xs font-semibold text-cyan-400">[① 题目区域]</span>
              <div v-if="segmentResult.regions?.question?.bbox" class="text-[10px] font-mono text-slate-500">
                bbox {{ formatBbox(segmentResult.regions.question.bbox) }}
              </div>
              <img v-if="segmentResult.croppedQuestionUrl" :src="segmentResult.croppedQuestionUrl" class="w-full rounded border border-slate-800" />
              <div class="text-[11px] text-slate-300 bg-slate-950 p-2 rounded leading-relaxed">
                <MathContent :text="segmentResult.questionLatex || segmentResult.extractedQuestionText" />
              </div>
            </div>

            <!-- ② 图像块 -->
            <div class="p-3 bg-slate-900/90 rounded-xl border border-slate-700/80 space-y-2">
              <span class="text-xs font-semibold text-violet-400">[② 图像区域]</span>
              <div v-if="segmentResult.regions?.diagram?.bbox" class="text-[10px] font-mono text-slate-500">
                bbox {{ formatBbox(segmentResult.regions.diagram.bbox) }}
              </div>
              <img v-if="segmentResult.croppedDiagramUrl" :src="segmentResult.croppedDiagramUrl" class="w-full rounded border border-slate-800" />
              <div v-if="!segmentResult.regions?.diagram" class="text-[11px] text-slate-500 bg-slate-950 p-2 rounded">
                图片中未检测到图形区域
              </div>
              <div v-else class="text-[11px] text-slate-300 bg-slate-950 p-2 rounded leading-relaxed space-y-1">
                <div v-if="segmentResult.regions.diagram.description">{{ segmentResult.regions.diagram.description }}</div>
                <MathContent v-if="segmentResult.diagramLatex" :text="segmentResult.diagramLatex" />
              </div>
            </div>

            <!-- ③ 解答块 -->
            <div class="p-3 bg-slate-900/90 rounded-xl border border-slate-700/80 space-y-2">
              <span class="text-xs font-semibold text-purple-400">[③ 手写解答区域]</span>
              <div v-if="segmentResult.regions?.solution?.bbox" class="text-[10px] font-mono text-slate-500">
                bbox {{ formatBbox(segmentResult.regions.solution.bbox) }}
              </div>
              <img v-if="segmentResult.croppedAnswerUrl" :src="segmentResult.croppedAnswerUrl" class="w-full rounded border border-slate-800" />
              <div class="text-[11px] text-slate-300 bg-slate-950 p-2 rounded leading-relaxed">
                <MathContent :text="segmentResult.studentAnswerLatex || segmentResult.extractedStudentAnswerText" />
              </div>
            </div>
          </div>

          <div class="pt-4 border-t border-slate-700/60 flex justify-end">
            <button
              @click="startGrading"
              :disabled="loadingCompare"
              class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              <Loader2 class="w-4 h-4 animate-spin" v-if="loadingCompare"/>
              <span>开始模型对比与判题</span>
            </button>
          </div>
        </div>

        <div v-else class="flex-1 flex flex-col items-center justify-center text-slate-500 py-16">
          <ScanLine class="w-12 h-12 stroke-1 mb-3"/>
          <p>上传图片后，系统将自动切分「题目」「图像」「解答」三个区域并提取 LaTeX 公式</p>
        </div>
      </div>
    </div>

    <!-- 流程步骤 2 & 3: 独立解题、对比评估与结果反馈 -->
    <div v-if="step === 2 && gradeResult" class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- 左侧：题目与模型标准解答 -->
      <div class="lg:col-span-5 space-y-6">
        <div class="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5 space-y-3">
          <h4 class="text-xs font-semibold text-slate-400 uppercase">提取的题目信息</h4>
          <div class="p-3 bg-slate-900 rounded-xl text-xs text-slate-200 leading-relaxed">
            <MathContent :text="segmentResult?.questionLatex || segmentResult?.extractedQuestionText || ''" />
          </div>
        </div>

        <div class="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5 space-y-3">
          <h4 class="text-xs font-semibold text-indigo-400 uppercase flex items-center gap-1.5">
            <Cpu class="w-4 h-4"/> 模型生成的标准推导过程
          </h4>
          <div class="p-4 bg-slate-900/90 rounded-xl border border-slate-800 text-sm text-slate-200 leading-relaxed">
            <MathContent :text="gradeResult.correctSolution || gradeResult.modelStandardAnswer || ''" />
          </div>
        </div>

        <!-- 机器语言文档 (分块 → LaTeX, 供解题模型阅读) -->
        <details v-if="segmentResult?.modelReadable" class="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5">
          <summary class="text-xs font-semibold text-cyan-400 cursor-pointer select-none">
            机器语言文档 (Model-Readable · 分块转 LaTeX，供解题模型阅读)
          </summary>
          <pre class="mt-3 p-3 bg-slate-950 rounded-xl text-[11px] text-cyan-200/80 font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-auto">{{ segmentResult.modelReadable }}</pre>
        </details>
      </div>

      <!-- 右侧：学生作答对比评估与修改建议 -->
      <div class="lg:col-span-7 space-y-6">
        <div class="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 space-y-5">
          <!-- 得分卡片 -->
          <div class="flex items-center justify-between pb-4 border-b border-slate-700/60">
            <div>
              <div class="text-xs text-slate-400">判题结果评估</div>
              <div class="text-2xl font-bold text-slate-100 mt-1 flex items-center gap-2">
                <span>得分: {{ gradeResult.score }} 分</span>
                <span
                  :class="[
                    'text-xs px-2.5 py-0.5 rounded-full border',
                    gradeResult.score >= 90 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  ]"
                >
                  {{ gradeResult.score >= 90 ? '解答优秀' : '部分细节需改进' }}
                </span>
              </div>
            </div>
            <div class="w-12 h-12 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-400">
              {{ gradeResult.score }}
            </div>
          </div>

          <!-- 做得好的地方 -->
          <div v-if="gradeResult.strengths?.length" class="space-y-2.5">
            <h5 class="text-xs font-semibold text-emerald-400">做得好的地方</h5>
            <div
              v-for="(s, idx) in gradeResult.strengths"
              :key="'s' + idx"
              class="p-3 rounded-xl border text-xs flex items-start gap-2.5 bg-emerald-950/20 border-emerald-800/40 text-emerald-300"
            >
              <CheckCircle2 class="w-4 h-4 shrink-0 mt-0.5"/>
              <span>{{ s }}</span>
            </div>
          </div>

          <!-- 解答缺陷明细 -->
          <div v-if="gradeResult.defects?.length" class="space-y-2.5">
            <h5 class="text-xs font-semibold text-rose-400">解答缺陷明细</h5>
            <div
              v-for="(d, idx) in gradeResult.defects"
              :key="'d' + idx"
              class="p-3 rounded-xl border text-xs bg-rose-950/20 border-rose-800/40 space-y-1.5"
            >
              <div class="flex items-center gap-2 flex-wrap">
                <span
                  :class="[
                    'px-2 py-0.5 rounded-full text-[10px] font-bold',
                    d.severity === 'high' ? 'bg-red-500 text-white' : d.severity === 'low' ? 'bg-slate-600 text-slate-200' : 'bg-amber-500 text-slate-900'
                  ]"
                >
                  {{ severityLabel(d.severity) }}
                </span>
                <span v-if="d.step" class="text-slate-400 font-mono">位于: {{ d.step }}</span>
              </div>
              <div class="flex items-start gap-2 text-rose-200">
                <AlertCircle class="w-4 h-4 shrink-0 mt-0.5 text-rose-400"/>
                <span>{{ d.issue }}</span>
              </div>
              <div v-if="d.fix" class="flex items-start gap-2 text-emerald-300">
                <Lightbulb class="w-4 h-4 shrink-0 mt-0.5 text-amber-400"/>
                <span>修正: {{ d.fix }}</span>
              </div>
            </div>
          </div>

          <!-- 兼容旧结构: 无结构化缺陷时的逐点分析 -->
          <div v-if="!gradeResult.defects?.length && !gradeResult.strengths?.length" class="space-y-3">
            <h5 class="text-xs font-semibold text-slate-400">步骤拆解与对比分析</h5>
            <div
              v-for="(item, idx) in gradeResult.analysis"
              :key="idx"
              :class="[
                'p-3 rounded-xl border text-xs flex items-start gap-2.5',
                item.type === 'success' ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' : 'bg-amber-950/20 border-amber-800/40 text-amber-300'
              ]"
            >
              <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" v-if="item.type === 'warning'"/>
              <CheckCircle2 class="w-4 h-4 shrink-0 mt-0.5" v-else/>
              <span>{{ item.text }}</span>
            </div>
          </div>

          <!-- 修改建议 -->
          <div class="p-4 bg-indigo-950/30 border border-indigo-800/40 rounded-xl space-y-2">
            <h5 class="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
              <Lightbulb class="w-4 h-4 text-amber-400"/> 针对性修改指导建议
            </h5>
            <p class="text-xs text-slate-300 leading-relaxed">
              {{ gradeResult.suggestions }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { segmentAndOcrApi, gradeCompareApi } from '@/services/graderService';
import { CheckSquare, UploadCloud, Loader2, ScanLine, Cpu, CheckCircle2, AlertCircle, Lightbulb } from 'lucide-vue-next';
import MathContent from '@/components/MathContent.vue';

const step = ref(1);
const fileInputRef = ref(null);
const selectedFile = ref(null);
const originalImageUrl = ref(null);

const loadingSegment = ref(false);
const segmentResult = ref(null);

const loadingCompare = ref(false);
const gradeResult = ref(null);

const triggerFileInput = () => {
  fileInputRef.value?.click();
};

const handleFileSelect = (event) => {
  const file = event.target.files?.[0];
  if (file) {
    selectedFile.value = file;
    if (originalImageUrl.value) URL.revokeObjectURL(originalImageUrl.value);
    originalImageUrl.value = URL.createObjectURL(file);
  }
};

const startSegmentation = async () => {
  if (!selectedFile.value) return;
  loadingSegment.value = true;
  try {
    const res = await segmentAndOcrApi(selectedFile.value);
    segmentResult.value = res;
  } finally {
    loadingSegment.value = false;
  }
};

const startGrading = async () => {
  if (!segmentResult.value) return;
  loadingCompare.value = true;
  try {
    const res = await gradeCompareApi(segmentResult.value);
    gradeResult.value = res;
    step.value = 2; // 进入判题结果双栏展示
  } finally {
    loadingCompare.value = false;
  }
};

const resetGrader = () => {
  step.value = 1;
  selectedFile.value = null;
  if (originalImageUrl.value) URL.revokeObjectURL(originalImageUrl.value);
  originalImageUrl.value = null;
  segmentResult.value = null;
  gradeResult.value = null;
};

const severityLabel = (v) => ({ high: '严重缺陷', medium: '一般缺陷', low: '轻微瑕疵' })[v] || '缺陷';

/** bbox 归一化坐标格式化 */
const formatBbox = (bbox) =>
  Array.isArray(bbox) && bbox.length === 4
    ? `(${bbox.map((n) => Number(n).toFixed(2)).join(', ')})`
    : '';
</script>
