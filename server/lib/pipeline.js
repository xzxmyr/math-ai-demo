/**
 * 判题核心管线 (Pipeline)
 *
 * 管线 A: /api/v1/grade/segment —— 图片 → 三区切分(题目/图像/解答) → 每区 LaTeX 公式
 *         → 裁剪预览图 → (可选 Mathpix 增强) → 汇总"模型可读文档"
 * 管线 B: /api/v1/grade/compare —— 题目+学生解答 → 解题模型生成标准解答 → 对比判题打分
 */
import { callVision } from './vision.js';
import { callTextLLM } from './textllm.js';
import { segmentPrompt, solvePrompt, gradePrompt } from './prompts.js';
import { cropRegions } from './crop.js';
import { mathpixEnabled, mathpixLatex } from './mathpix.js';
import { env } from './config.js';

/** 将视觉模型返回的 layout 数组规范化为三区对象 */
function normalizeLayout(result) {
  // 兼容两种返回形态: 直接数组 或 { layout: [...], notes: "..." }
  const layout = Array.isArray(result) ? result : Array.isArray(result?.layout) ? result.layout : [];
  const notes = Array.isArray(result) ? '' : result?.notes || '';

  const pick = (type) => layout.find((r) => r?.type === type);

  const question = pick('question');
  const diagram = pick('diagram');
  const solution = pick('solution');

  const region = (item) =>
    item
      ? {
          bbox: Array.isArray(item.bbox) && item.bbox.length === 4 ? item.bbox : null,
          text: item.text || '',
          latex: item.latex || '',
          description: item.description || '',
        }
      : null;

  return {
    question: region(question),
    diagram: diagram && diagram.present === false ? null : region(diagram),
    solution: region(solution),
    notes,
  };
}

/** 汇总三区内容为"模型可读文档" (Markdown + LaTeX)，可直接输入任意数学大模型 */
export function buildModelReadable(regions) {
  const lines = [];
  lines.push('# 数学作业解析文档 (Model-Readable)');
  lines.push('');
  lines.push('> 本文件由视觉模型自动生成：题目/图形/解答三区切分 + LaTeX 公式化。可直接作为任意数学大模型的输入。');
  lines.push('');

  if (regions.question) {
    lines.push('## 一、题目 (Question)');
    if (regions.question.text) lines.push(`> ${regions.question.text}`);
    if (regions.question.latex) {
      lines.push('');
      lines.push(regions.question.latex.trim().startsWith('\\[')
        ? regions.question.latex
        : `\\[ ${regions.question.latex} \\]`);
    }
    lines.push('');
  }

  if (regions.diagram) {
    lines.push('## 二、图形 (Diagram)');
    if (regions.diagram.description) lines.push(`> ${regions.diagram.description}`);
    if (regions.diagram.latex) {
      lines.push('');
      lines.push(regions.diagram.latex.trim().startsWith('\\[')
        ? regions.diagram.latex
        : `\\[ ${regions.diagram.latex} \\]`);
    }
    lines.push('');
  } else {
    lines.push('## 二、图形 (Diagram)');
    lines.push('> 本图片未检测到图形区域。');
    lines.push('');
  }

  if (regions.solution) {
    lines.push('## 三、学生解答 (Student Solution)');
    if (regions.solution.text) lines.push(`> ${regions.solution.text}`);
    if (regions.solution.latex) {
      lines.push('');
      lines.push(regions.solution.latex.trim().startsWith('\\[')
        ? regions.solution.latex
        : `\\[ ${regions.solution.latex} \\]`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 管线 A: 图片 → 三区切分 + LaTeX
 * @param {{buffer: Buffer, mime: string}} input
 */
export async function segmentImage({ buffer, mime }) {
  const base64 = buffer.toString('base64');
  const layout = await callVision(segmentPrompt(), base64, mime, { json: true });
  const regions = normalizeLayout(layout);

  // 裁剪三区预览图 (sharp 可用时)
  const crops = await cropRegions(buffer, mime, {
    question: regions.question?.bbox,
    diagram: regions.diagram?.bbox,
    solution: regions.solution?.bbox,
  });

  // 可选: Mathpix 增强公式识别 (对题目与解答区域逐区重识别, 保真度更高)
  if (mathpixEnabled()) {
    for (const key of ['question', 'solution']) {
      if (regions[key] && crops[key]) {
        try {
          const mp = await mathpixLatex(crops[key]);
          if (mp?.latex) regions[key].latex = mp.latex;
        } catch {
          /* Mathpix 失败不阻断主流程 */
        }
      }
    }
  }

  const modelReadable = buildModelReadable(regions);

  return {
    // ---- 前端 GraderView 原有契约 (兼容) ----
    croppedQuestionUrl: crops.question || null,
    croppedAnswerUrl: crops.solution || null,
    extractedQuestionText: regions.question?.text || '',
    extractedStudentAnswerText: regions.solution?.text || '',

    // ---- 新: 三区切分结构化结果 ----
    regions,
    questionLatex: regions.question?.latex || '',
    studentAnswerLatex: regions.solution?.latex || '',
    diagramLatex: regions.diagram?.latex || '',
    diagramDescription: regions.diagram?.description || '',
    croppedDiagramUrl: crops.diagram || null,
    notes: regions.notes || '',

    // ---- 新: 模型可读文档 (可直接喂给解题/判题大模型) ----
    modelReadable,
  };
}

/**
 * 管线 B: 独立解题(生成正确解答) + 缺陷对比判题
 *
 * 输入为 segment 结果(机器语言优先: LaTeX > 纯文本):
 *   questionLatex / extractedQuestionText / diagramLatex / diagramDescription /
 *   studentAnswerLatex / extractedStudentAnswerText
 *
 * 输出(前端兼容 + 新增结构化缺陷):
 *   score / status / modelStandardAnswer(=correctSolution) /
 *   correctSolution / defects[] / strengths[] / analysis[] / suggestions
 */
export async function compareAndGrade(payload = {}) {
  // 机器语言(LaTeX)优先，供解题模型直接阅读
  const questionText =
    payload.questionLatex || payload.extractedQuestionText || payload.questionText || '';
  const studentText =
    payload.studentAnswerLatex || payload.extractedStudentAnswerText || payload.studentText || '';
  const diagram = [payload.diagramLatex, payload.diagramDescription].filter(Boolean).join('\n');

  // 1) 解题模型: 读取机器语言(题目+图形) → 生成正确解答
  const standardAnswer = await callTextLLM(solvePrompt({ questionText, diagram }), { json: false });

  // 2) 判题模型: 正确解答 + 学生解答缺陷明细
  const g = await callTextLLM(
    gradePrompt({ questionText, diagram, standardAnswer, studentText }),
    { json: true }
  );

  const score = Math.max(0, Math.min(100, Math.round(Number(g.score) || 0)));

  // 缺陷明细 (结构化)
  const defects = Array.isArray(g.defects)
    ? g.defects
        .filter((d) => d && (d.issue || d.fix))
        .map((d) => ({
          step: String(d.step || '').trim(),
          issue: String(d.issue || '').trim(),
          severity: normalizeSeverity(d.severity),
          fix: String(d.fix || '').trim(),
        }))
    : [];

  // 亮点
  const strengths = Array.isArray(g.strengths)
    ? g.strengths.filter(Boolean).map(String)
    : [];

  // 兼容前端原有 analysis 列表: 亮点→success, 缺陷→warning
  const analysis = [
    ...strengths.map((s) => ({ type: 'success', text: s })),
    ...defects.map((d) => ({
      type: 'warning',
      text: `${d.step ? `[${d.step}] ` : ''}${d.issue}${d.fix ? ` → ${d.fix}` : ''}`,
    })),
  ];
  if (analysis.length === 0) {
    analysis.push({ type: 'success', text: '未发现明显缺陷，解答完整正确。' });
  }

  const correctSolution = (g.correctSolution || standardAnswer).trim();

  return {
    score,
    status: ['correct', 'partial_correct', 'incorrect'].includes(g.status)
      ? g.status
      : score >= 90
        ? 'correct'
        : score >= 40
          ? 'partial_correct'
          : 'incorrect',
    modelStandardAnswer: correctSolution, // 兼容旧字段
    correctSolution, // 新: 正确解答
    defects, // 新: 解答缺陷明细
    strengths, // 新: 亮点
    analysis,
    suggestions: g.suggestions || '',
  };
}

/** 缺陷严重度归一化: 只保留 high / medium / low */
function normalizeSeverity(v) {
  const s = String(v || '').trim().toLowerCase();
  if (['high', '严重', '高'].some((k) => s.includes(k))) return 'high';
  if (['low', '轻微', '低'].some((k) => s.includes(k))) return 'low';
  return 'medium';
}
