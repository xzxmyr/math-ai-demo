/**
 * 出题服务 (生成题目模块)
 * 对应前端 src/views/GeneratorView.vue 与数据契约 QuestionResult:
 *   { questionId, difficulty, categories, prompt, content(LaTeX), requiresDiagram, imageUrl? }
 * 真实调用 LLM 生成题目; requiresDiagram 时自动生成 SVG 配图。
 */
import { callTextLLM } from './textllm.js';
import { generateQuestionPrompt } from './prompts.js';

/** 根据 diagramHint 生成 SVG 配图 data URL (坐标系 + 标注) */
function buildDiagramSvg(hint, categories) {
  const label = (hint || (categories.includes('geometry') ? '几何示意图' : '函数/坐标系示意图')).trim();
  const lines = [];
  for (let i = 1; i < 8; i++) {
    lines.push(`<line x1="${40 + i * 42.5}" y1="40" x2="${40 + i * 42.5}" y2="260" />`);
    lines.push(`<line x1="40" y1="${40 + i * 31.4}" x2="380" y2="${40 + i * 31.4}" />`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="300" viewBox="0 0 420 300">
<rect width="100%" height="100%" fill="#1e293b"/>
<g stroke="#334155" stroke-width="1" opacity="0.55">${lines.join('')}</g>
<line x1="40" y1="150" x2="380" y2="150" stroke="#38bdf8" stroke-width="2"/>
<line x1="210" y1="40" x2="210" y2="260" stroke="#38bdf8" stroke-width="2"/>
<polygon points="210,90 290,150 210,210 130,150" fill="none" stroke="#f43f5e" stroke-width="2.5"/>
<text x="210" y="175" fill="#f8fafc" font-size="14" text-anchor="middle" font-family="sans-serif">${label}</text>
</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/**
 * 生成题目
 * @param {{prompt?: string, difficulty: string, categories: string[], forceDiagram?: boolean}} params
 */
export async function generateQuestion({ prompt, difficulty, categories, forceDiagram } = {}) {
  const catList = Array.isArray(categories) ? categories : [];
  const forced = forceDiagram === true;

  const res = await callTextLLM(
    generateQuestionPrompt({ prompt, difficulty, categories: catList, forceDiagram: forced }),
    { json: true }
  );

  const content = String(res?.content || '').trim();
  if (!content) {
    throw Object.assign(new Error('出题模型未返回题目内容，请重试'), { status: 502 });
  }

  const llmSaysDiagram = res?.requiresDiagram === true;
  const requiresDiagram = forced || catList.includes('geometry') || llmSaysDiagram;

  return {
    questionId: 'q_' + Date.now(),
    difficulty,
    categories: catList,
    prompt: prompt?.trim() || undefined,
    content,
    requiresDiagram,
    imageUrl: requiresDiagram ? buildDiagramSvg(res?.diagramHint, catList) : null,
  };
}
