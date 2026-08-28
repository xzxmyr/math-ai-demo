/**
 * 出题服务 —— 真实出题模型 (配置 VITE_API_BASE_URL 时调用后端, 否则回退 Mock)
 *
 * 后端接口: POST /api/v1/question/generate
 *   请求: { prompt?, difficulty, categories[], forceDiagram }
 *   返回: { questionId, difficulty, categories, prompt, content(LaTeX), requiresDiagram, imageUrl? }
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL;

/**
 * [出题接口] Prompt + 难度 + 题型 → 题目
 * @param {Object} params { prompt, difficulty, categories, forceDiagram }
 * @returns {Promise<Object>} QuestionResult
 */
export async function generateQuestionApi(params) {
  if (API_BASE) {
    const response = await fetch(`${API_BASE}/question/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        difficulty: params.difficulty,
        categories: params.categories,
        forceDiagram: params.forceDiagram,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || '出题模型请求异常');
    }
    return await response.json();
  }

  // ---- Mock 回退 (未配置后端时演示用) ----
  return new Promise((resolve) => {
    setTimeout(() => {
      const requiresDiagram = params.categories.includes('geometry') || params.forceDiagram;
      const customPromptText = params.prompt ? `【根据需求: "${params.prompt}"】\n` : '';

      resolve({
        questionId: 'q_' + Date.now(),
        difficulty: params.difficulty,
        categories: params.categories,
        prompt: params.prompt,
        requiresDiagram,
        content: `${customPromptText}已知在 $\\triangle ABC$ 中，边长 $a, b, c$ 满足 $a^2 + b^2 - c^2 = xy$，且 $\\angle C = \\frac{\\pi}{3}$。\n\n(1) 证明：$c = \\sqrt{a^2 + b^2 - ab}$；\n(2) 当 $a = 3,\\ b = 5$ 时，求 $c$ 的值与 $\\triangle ABC$ 的面积 $S$。`,
        imageUrl: requiresDiagram
          ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="100%" height="100%" fill="%231e293b"/><circle cx="200" cy="150" r="80" stroke="%2338bdf8" stroke-width="3" fill="none"/><line x1="120" y1="150" x2="280" y2="150" stroke="%23f43f5e" stroke-width="2"/><text x="180" y="140" fill="%23f8fafc" font-size="14">几何示意图 (占位)</text></svg>'
          : null,
      });
    }, 600);
  });
}
