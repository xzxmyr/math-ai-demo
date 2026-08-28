/**
 * 独立解题服务 (答题界面 / 临时直测网页共用)
 * 支持两种输入:
 *   - questionText: 直接文本/LaTeX 题目
 *   - image: 题目照片 (data URL), 先经视觉模型提取题目, 再交给解题模型
 * 输出结构对齐前端 SolverView: { questionId, questionText, knowledgePoints, steps[] }
 */
import { callVision } from './vision.js';
import { callTextLLM } from './textllm.js';
import { solveStepsPrompt, extractQuestionPrompt } from './prompts.js';

/** 解析 data URL 为 { base64, mime } */
function parseDataUrl(dataUrl) {
  const m = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl || '');
  if (!m) return { base64: dataUrl, mime: 'image/jpeg' };
  return { base64: m[2], mime: m[1] };
}

/**
 * 解题: 题目 → 知识点 + 逐步推导
 * @param {{questionText?: string, image?: string}} input
 */
export async function solveQuestion({ questionText, image } = {}) {
  let qText = (questionText || '').trim();
  let diagram = '';

  // 图片模式: 视觉模型先提取题目
  if (image) {
    const { base64, mime } = parseDataUrl(image);
    const extracted = await callVision(extractQuestionPrompt(), base64, mime, { json: true });
    qText = (extracted?.text || extracted?.latex || '').trim();
    if (extracted?.latex) diagram = extracted.latex;
  }

  if (!qText) {
    throw Object.assign(new Error('未识别到题目内容，请提供题目文本或清晰的题目照片'), {
      status: 400,
    });
  }

  const res = await callTextLLM(solveStepsPrompt({ questionText: qText, diagram }), { json: true });

  const rawSteps = Array.isArray(res.steps) ? res.steps : [];
  const steps = rawSteps.map((s, i) => ({
    stepIndex: Number(s.stepIndex) || i + 1,
    title: s.title || `步骤 ${i + 1}`,
    reason: s.reason || '',
    content: s.content || '',
  }));

  return {
    questionId: 'solve_' + Date.now(),
    questionText: qText,
    knowledgePoints: Array.isArray(res.knowledgePoints) ? res.knowledgePoints : [],
    steps,
  };
}
