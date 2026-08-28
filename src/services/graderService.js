/**
 * 判题服务 (步骤 1: 三区切分+公式化 / 步骤 2: 独立解题+对比判题)
 *
 * 当配置了 VITE_API_BASE_URL 时调用真实后端 (server/ 目录);
 * 未配置时回退为本地 Mock 数据, 保证纯前端演示可运行。
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL;

/**
 * [接口 1] 图片三区切分(题目/图像/解答) + OCR + LaTeX 公式化
 * @param {File | string} imageFile 上传的图片
 * @returns {Promise<Object>} 切分结果: croppedQuestionUrl / croppedAnswerUrl /
 *                            extractedQuestionText / extractedStudentAnswerText /
 *                            regions / questionLatex / studentAnswerLatex / diagramLatex / modelReadable
 */
export async function segmentAndOcrApi(imageFile) {
  if (API_BASE) {
    const formData = new FormData();
    formData.append('file', imageFile);
    const response = await fetch(`${API_BASE}/grade/segment`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || '图像切分失败');
    }
    return await response.json();
  }

  // ---- Mock 回退 ----
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        croppedQuestionUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100"><rect width="100%" height="100%" fill="%230f172a"/><text x="20" y="50" fill="%2338bdf8" font-size="12">切分区域 A: 题目切片</text></svg>',
        croppedAnswerUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150" viewBox="0 0 300 150"><rect width="100%" height="100%" fill="%230f172a"/><text x="20" y="70" fill="%23a855f7" font-size="12">切分区域 B: 学生手写解答</text></svg>',
        extractedQuestionText: '已知 $f(x) = x^2 + 2x$，求在区间 $[0, 2]$ 上的定积分。',
        extractedStudentAnswerText: '解：∫(x^2 + 2x)dx = [1/3 x^3 + x^2]，代入上限 2 得 8/3 + 4 = 20/3。',
        regions: {
          question: { bbox: [0.05, 0.02, 0.96, 0.3], text: '已知 f(x)=x^2+2x，求在区间[0,2]上的定积分。', latex: '已知 $f(x)=x^{2}+2x$，求 $\\int_{0}^{2} f(x)\\,dx$。' },
          diagram: null,
          solution: { bbox: [0.05, 0.65, 0.96, 0.98], text: '解：∫(x^2+2x)dx=[1/3x^3+x^2]，代入上限2得8/3+4=20/3。', latex: '\\int (x^{2}+2x)\\,dx=[\\frac{1}{3}x^{3}+x^{2}] \\Rightarrow \\frac{20}{3}' },
        },
        questionLatex: '已知 $f(x)=x^{2}+2x$，求 $\\int_{0}^{2} f(x)\\,dx$。',
        studentAnswerLatex: '\\int (x^{2}+2x)\\,dx=[\\frac{1}{3}x^{3}+x^{2}] \\Rightarrow \\frac{20}{3}',
        diagramLatex: '',
        diagramDescription: '',
        modelReadable: '## 一、题目 (Question)\n已知 $f(x)=x^{2}+2x$，求 $\\int_{0}^{2} f(x)\\,dx$。\n\n## 三、学生解答 (Student Solution)\n\\int (x^{2}+2x)\\,dx=[\\frac{1}{3}x^{3}+x^{2}] \\Rightarrow \\frac{20}{3}',
      });
    }, 800);
  });
}

/**
 * [接口 2] 独立解题 + 对比判题
 * @param {Object} payload 切分提取出的数据 (segment 返回结果)
 * @returns {Promise<Object>} score / status / modelStandardAnswer / analysis / suggestions
 */
export async function gradeCompareApi(payload) {
  if (API_BASE) {
    const response = await fetch(`${API_BASE}/grade/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || '判题模型评估失败');
    }
    return await response.json();
  }

  // ---- Mock 回退 ----
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        score: 85,
        status: 'partial_correct', // 'correct' | 'partial_correct' | 'incorrect'
        modelStandardAnswer: '标准解法：\n∫₀² (x² + 2x) dx = [⅓x³ + x²]₀² = (⅓(8) + 4) - 0 = 20/3。',
        correctSolution: '标准解法：\n∫₀² (x² + 2x) dx = [⅓x³ + x²]₀² = (⅓(8) + 4) - 0 = 20/3。',
        strengths: ['积分原函数求解正确：⅓x³ + x²', '最终数值结果正确：20/3'],
        defects: [
          { step: '代入步骤', issue: '未明确写出下限 0 的带入过程，直接跳到结果。', severity: 'low', fix: '补全牛顿-莱布尼茨公式上下限代入格式：F(2)-F(0)。' },
          { step: '书写规范', issue: '没有分步展示原函数求导验证。', severity: 'low', fix: '写出 F\'(x)=f(x) 的验证。' },
        ],
        analysis: [
          { type: 'success', text: '积分原函数求解正确：⅓x³ + x²' },
          { type: 'warning', text: '步骤书写规范提醒：未明确写出下限 0 的带入过程，建议写出完整区间代入。' },
        ],
        suggestions: '计算结果正确。建议在书写定积分计算时补全牛顿-莱布尼茨公式的上下限带入格式，避免在竞赛中被扣除步骤分。',
      });
    }, 1000);
  });
}
