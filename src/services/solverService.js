/**
 * 解题服务 —— 直连真实解题模型 (不再使用模板假数据)
 *
 * 依赖环境变量 VITE_API_BASE_URL (根目录 .env / .env.development):
 *   VITE_API_BASE_URL=http://localhost:8787/api/v1
 *
 * 后端接口: POST /api/v1/question/solve
 *   文本模式 -> { questionText }
 *   图片模式 -> { image: "data:image/...;base64,..." } (后端先视觉提取题目再解题)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL;

/** File → base64 data URL */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * [解题接口] 题目 → 知识点 + 逐步推导
 * @param {Object} payload { mode, questionId, questionContent, customText, imageFile }
 * @returns {Promise<Object>} { questionId, questionText, knowledgePoints, steps[] }
 */
export async function fetchSolutionApi(payload) {
  if (!API_BASE) {
    throw new Error('未配置 VITE_API_BASE_URL，无法调用解题模型。请在项目根目录 .env.development 中设置 VITE_API_BASE_URL=http://localhost:8787/api/v1 后重启前端。');
  }

  // 组装请求体: 图片模式上传 base64, 其余模式上传题目文本
  const body = { mode: payload.mode };
  if (payload.mode === 'image' && payload.imageFile) {
    body.image = await fileToDataUrl(payload.imageFile);
  } else {
    body.questionText = payload.customText?.trim() || payload.questionContent?.trim() || '';
  }
  if (!body.questionText && !body.image) {
    throw new Error('题目为空：请先输入题目或上传题目照片');
  }

  const response = await fetch(`${API_BASE}/question/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || '解题模型请求失败');
  }
  return await response.json();
}
