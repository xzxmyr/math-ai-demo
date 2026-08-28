/**
 * 离线冒烟测试 (无需真实密钥)
 * 通过 mock fetch 验证整条管线逻辑:
 *   三区切分(题目/图像/解答) → 区域裁剪 → LaTeX/模型可读文档 → 独立解题 → 对比判题
 *
 * 运行: node scripts/smoke-test.mjs
 */
// 必须先设置伪密钥再导入 pipeline (config.js 在导入时读取环境变量)
process.env.DASHSCOPE_API_KEY = 'sk-fake-for-smoke-test';

const { segmentImage, compareAndGrade } = await import('../lib/pipeline.js');

// 一张 8x6 的合法 PNG (用于裁剪测试; sharp 未安装时裁剪自动跳过)
const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAACEP4aZAAAAFElEQVR4nGP8z8Dwn4EIwESMolEACQkCAZq/4R0AAAAASUVORK5CYII=';
const buffer = Buffer.from(TEST_PNG_BASE64, 'base64');

// ---------- 2. mock fetch: 按 URL 返回伪造的模型响应 ----------
let visionCalls = 0;
let textCalls = 0;

global.fetch = async (url, init) => {
  const u = String(url);
  const body = JSON.parse(init?.body || '{}');

  if (u.includes('dashscope') || u.includes('openai') || u.includes('generativelanguage')) {
    if (body.messages?.[0]?.content?.some?.((c) => c.type === 'image_url')) {
      // —— 视觉模型: 三区切分 + LaTeX ——
      visionCalls++;
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                layout: [
                  { type: 'question', bbox: [0.05, 0.02, 0.95, 0.3], text: '已知 f(x)=x^2+2x，求定积分 ∫₀² f(x)dx', latex: '已知 $f(x)=x^{2}+2x$，求 $\\int_{0}^{2} f(x)\\,dx$。' },
                  { type: 'diagram', present: true, bbox: [0.05, 0.32, 0.5, 0.62], description: '抛物线 y=x²+2x，区间 [0,2]', latex: 'y=x^{2}+2x,\\ x\\in[0,2]' },
                  { type: 'solution', bbox: [0.05, 0.65, 0.95, 0.98], text: '解：∫(x^2+2x)dx=1/3x^3+x^2，代入得 20/3', latex: '\\int (x^{2}+2x)\\,dx=\\frac{1}{3}x^{3}+x^{2} \\Rightarrow \\frac{20}{3}' },
                ],
                notes: 'smoke test',
              }),
            },
          },
        ],
      });
    }
    // —— 文本模型: 解题(非JSON) 或 判题(JSON) ——
    textCalls++;
    const prompt = body.messages?.[0]?.content || '';
    if (body.response_format?.type === 'json_object') {
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 85,
                status: 'partial_correct',
                correctSolution: '标准解答: ∫₀² (x²+2x)dx = [⅓x³+x²]₀² = 20/3',
                defects: [
                  { step: '代入步骤', issue: '未写清下限代入过程', severity: 'medium', fix: '补全 F(2)-F(0) 的完整书写' },
                  { step: '书写规范', issue: '未注明牛顿-莱布尼茨公式依据', severity: 'low', fix: '写出定理名称' },
                ],
                strengths: ['原函数求解正确', '最终答案正确'],
                suggestions: '建议补全上下限代入格式。',
              }),
            },
          },
        ],
      });
    }
    return jsonResponse({
      choices: [{ message: { content: '标准解答: ∫₀² (x²+2x)dx = [⅓x³+x²]₀² = 20/3' } }],
    });
  }
  throw new Error(`unexpected url: ${u}`);
};

function jsonResponse(obj) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(obj),
    json: async () => obj,
  };
}

// ---------- 3. 管线 A: 三区切分 ----------
console.log('▶ 管线 A: segmentImage (三区切分 + LaTeX)');
const seg = await segmentImage({ buffer, mime: 'image/png' });

console.log('  question.text  :', seg.regions.question.text);
console.log('  question.latex :', seg.regions.question.latex);
console.log('  diagram        :', JSON.stringify(seg.regions.diagram));
console.log('  solution.latex :', seg.regions.solution.latex);
console.log('  croppedQuestion:', seg.croppedQuestionUrl ? seg.croppedQuestionUrl.slice(0, 30) + '...' : null);
console.log('  croppedAnswer  :', seg.croppedAnswerUrl ? seg.croppedAnswerUrl.slice(0, 30) + '...' : null);
console.log('  croppedDiagram :', seg.croppedDiagramUrl ? seg.croppedDiagramUrl.slice(0, 30) + '...' : null);
console.log('\n  ---- modelReadable ----\n' + seg.modelReadable + '\n');

if (seg.regions.question?.bbox && seg.croppedQuestionUrl) {
  console.log('✓ 裁剪生效 (sharp 已安装)');
} else {
  console.log('⚠ 裁剪未生效 (未安装 sharp 时属正常, 接口仍返回 bbox 坐标)');
}

// ---------- 4. 管线 B: 判题 ----------
console.log('\n▶ 管线 B: compareAndGrade (正确解答 + 缺陷分析)');
const grade = await compareAndGrade(seg);
console.log('  score      :', grade.score, '| status:', grade.status);
console.log('  correct    :', grade.correctSolution);
console.log('  defects    :', JSON.stringify(grade.defects));
console.log('  strengths  :', JSON.stringify(grade.strengths));
console.log('  suggestions:', grade.suggestions);

console.log(`\n✅ 冒烟测试通过 (visionCalls=${visionCalls}, textCalls=${textCalls})`);
