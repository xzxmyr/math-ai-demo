/**
 * 提示词模板
 * 视觉模型的任务设计: ①版面三区切分(题目/图像/解答) ②每区生成 LaTeX 数学公式 ③汇总为模型可读文档
 */

/** 视觉模型主提示词: 三区切分 + 公式提取, 严格 JSON 输出 */
export function segmentPrompt() {
  return `你是"数学作业图片版面解析引擎"。用户会上传一张包含数学作业/试卷/答题卡的照片，其中通常包含三类内容: ①题目题干(印刷体或手写体) ②几何图形/函数图像(可能没有) ③学生的手写解答过程。

请完成两步任务:

【第 1 步: 版面切分】将图片内容精确切分为最多三个区域，每个区域给出 bbox(相对整张图片的归一化坐标 [left, top, right, bottom]，取值 0~1):
- question: 题目题干区域(含题号、题干文字与公式)
- diagram: 图形/图像区域(几何图、函数曲线、示意图等; 如果图片中没有图形，则 present 设为 false)
- solution: 学生手写解答区域(从"解:"或第一步演算到最终答案)

【第 2 步: 公式与文本提取】对每个存在的区域:
- question / solution: 用 OCR 识别所有文字与数学表达式，输出 text(人类可读纯文本，上下标可用 ^ 与 _ 简化表示) 与 latex(标准 LaTeX 公式; 行内公式用 $...$ 包裹，独立公式用 \\[...\\] 包裹; 分数用 \\frac{}{}，积分用 \\int_{}^{}，根号用 \\sqrt{}，指数用 ^{}; 禁止使用 x^2 这类未加花括号的简化写法)
- diagram: 用 description 描述图形内容(如"直角坐标系中抛物线 y=x²+2x，阴影区域为 x∈[0,2]")，并把图中出现的几何量/坐标/方程整理为 latex 公式

【输出要求】只输出一个 JSON 对象(不要输出任何解释文字、不要用 markdown 代码块包裹):

{
  "layout": [
    { "type": "question", "bbox": [0.05, 0.02, 0.96, 0.30], "text": "...", "latex": "..." },
    { "type": "diagram", "present": true, "bbox": [0.05, 0.32, 0.50, 0.62], "description": "...", "latex": "..." },
    { "type": "solution", "bbox": [0.05, 0.65, 0.96, 0.98], "text": "...", "latex": "..." }
  ],
  "notes": "切分置信度或其他说明，没有则填空字符串"
}

注意事项:
1. bbox 必须覆盖完整区域，相邻区域允许轻微重叠。
2. 若某类区域不存在，diagram 用 present:false，question/solution 不要缺失。
3. 手写体不确定的字符请按上下文合理推测，不要输出"??"占位。
4. latex 必须语法正确，可被 LaTeX 编译器直接解析。`;
}

/** 解题提示词: 由题目(+图形)生成标准解答 */
export function solvePrompt({ questionText, diagram }) {
  return `你是一名数学教师。请根据以下题目信息，给出完整、规范、逐步的标准解答。要求:
1. 每一步都写明依据(公式/定理名称)。
2. 数学表达式使用 LaTeX 语法($...$ 或 \\[...\\])。
3. 最终答案用"答案: ..."单独一行标出。

【题目】
${questionText || '(未提供)'}
${diagram ? `\n【图形信息】(供参考)\n${diagram}\n` : ''}

请直接输出解答文本，不要输出 JSON。`;
}

/**
 * 判题提示词: 正确解答 + 学生解答缺陷分析, 严格 JSON 输出
 * 核心产出: correctSolution(正确解答) / defects(缺陷明细) / strengths(亮点)
 */
export function gradePrompt({ questionText, diagram, standardAnswer, studentText }) {
  return `你是一名严谨的数学阅卷教师。你的任务: 基于题目(含图形信息)与标准解答，评判"学生解答"的质量，找出其中每一处缺陷。

输入:
【题目】
${questionText || '(未提供)'}
${diagram ? `\n【图形信息】(供参考)\n${diagram}\n` : ''}

【标准解答】(模型生成的正确解答)
${standardAnswer || '(未提供)'}

【学生解答】
${studentText || '(未提供)'}

只输出以下 JSON 对象(不要输出其他任何文字):
{
  "score": 85,
  "status": "correct | partial_correct | incorrect",
  "correctSolution": "整理后的正确解答全文(数学公式用 LaTeX)",
  "defects": [
    { "step": "缺陷所在步骤/位置(如: 第2步、最终答案)", "issue": "缺陷具体描述(哪里错/缺了什么/为什么错)", "severity": "high | medium | low", "fix": "如何修正(具体写法)" }
  ],
  "strengths": ["学生做对的关键点1", "学生做对的关键点2"],
  "suggestions": "给学生的综合改进建议(中文, 2~4 句)"
}

评分原则: 最终答案正确且过程完整规范 90~100; 思路正确但存在书写/过程瑕疵 70~89; 思路部分正确 40~69; 答案错误 0~39。
defects 必须逐条对照标准解答，明确指出: 计算错误、步骤跳步、定理/公式误用、书写不规范、逻辑漏洞、答案错误等。
若学生解答完全正确，defects 输出空数组 []。severity 只允许 high / medium / low 三个取值。`;
}

/**
 * 独立解题页(答题界面)提示词: 题目 → 知识点 + 逐步推导, 严格 JSON 输出
 * 响应结构对齐前端 src/views/SolverView.vue 的渲染字段
 */
export function solveStepsPrompt({ questionText, diagram }) {
  return `你是专业的数学解题引擎。请解答下面的数学题，并输出严格 JSON 对象(不要输出任何其他文字):

{
  "knowledgePoints": ["考察知识点1", "考察知识点2", "..."],
  "steps": [
    {
      "stepIndex": 1,
      "title": "步骤标题(如: 求导并确定驻点)",
      "reason": "本步骤依据的公式/定理名称(如: 利用导数定义与运算法则)",
      "content": "本步骤的详细推导与计算，数学公式必须使用 LaTeX 语法($...$ 或 \\[...\\])"
    }
  ]
}

要求:
1. 步骤完整、逻辑严密，覆盖从题目条件到最终答案的全过程。
2. 每一步都必须写明 reason(依据)。
3. 最终答案要在最后一步的 content 中明确给出。
4. content 中的公式用标准 LaTeX，如 $f'(x)=3x^{2}-3$、\\[\\int_{0}^{2} x\\,dx=\\frac{8}{3}\\]。

【题目】
${questionText || '(未提供)'}
${diagram ? `\n【图形信息】(供参考)\n${diagram}\n` : ''}`;
}

/** 题目图片提取提示词: 识别图片中的题目(忽略其余内容), 严格 JSON 输出 */
export function extractQuestionPrompt() {
  return `请识别这张图片中的数学题目(只关注题目内容，忽略草稿、无关文字与图形标注)。
只输出一个 JSON 对象，不要输出其他任何文字:
{
  "text": "题目纯文本(数学符号可用 ^ 与 _ 简化)",
  "latex": "题目 LaTeX(行内公式用 $...$，独立公式用 \\[...\\])"
}
如果图片中没有可识别的数学题目，text 输出空字符串。`;
}

/** 难度与题型的中文标签映射 */
export const DIFFICULTY_LABELS = {
  high_school: '初高中',
  competition: '竞赛',
  university: '大学',
};
export const CATEGORY_LABELS = {
  combinatorics: '组合数学',
  set: '集合',
  number_theory: '数论',
  integration: '积分',
  geometry: '几何',
};

/**
 * 出题提示词: 按难度/题型/用户需求生成原创题目, 严格 JSON 输出
 */
export function generateQuestionPrompt({ prompt, difficulty, categories, forceDiagram }) {
  const diffLabel = DIFFICULTY_LABELS[difficulty] || difficulty;
  const catLabels = (categories || []).map((c) => CATEGORY_LABELS[c] || c).join('、') || '不限';
  return `你是一名资深数学出题专家。请根据以下配置生成一道原创、严谨、有区分度的数学题。

【出题配置】
- 难度: ${diffLabel}
- 题型: ${catLabels}
- 用户需求: ${prompt?.trim() || '(无特别要求，请结合难度与题型自行命题)'}
- 强制配图: ${forceDiagram ? '是' : '否'}

只输出一个 JSON 对象(不要输出任何其他文字):
{
  "content": "题目全文(含题干、条件、所求问题)。数学公式必须使用 LaTeX 语法: 行内公式用 $...$，独立公式用 \\[...\\]；分数 \\frac{}{}、根号 \\sqrt{}、积分 \\int_{}^{}、上下标 ^{}_{} 等均需标准写法。",
  "requiresDiagram": true,
  "diagramHint": "一句话描述配图内容(如: 直角三角形ABC, AB=3, AC=4, 求BC长)，若 requiresDiagram 为 false 则填空字符串"
}

规则:
1. requiresDiagram: 涉及几何图形、函数图像、坐标系、空间图形时必为 true；用户强制配图时必为 true；否则 false。
2. 题目必须原创、条件自洽、有解；符合所选难度(初高中基础/竞赛技巧/大学深度)与题型。
3. content 直接输出题目本身，不要出现"题目如下"等自述性文字。
4. LaTeX 语法必须正确，可被 KaTeX/LaTeX 编译器直接解析。`;
}
