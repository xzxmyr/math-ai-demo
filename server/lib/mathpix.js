/**
 * Mathpix 数学专用 OCR (可选增强)
 * 对手写数学公式 → LaTeX 的识别保真度最高，适合竞赛类手写解答。
 * 仅在 server/.env 配置 MATH_OCR_ENGINE=mathpix 且填写 MATHPIX_APP_ID/KEY 时启用。
 */
import { env } from './config.js';

export const mathpixEnabled = () =>
  (env.MATH_OCR_ENGINE || 'none').trim().toLowerCase() === 'mathpix' &&
  Boolean(env.MATHPIX_APP_ID && env.MATHPIX_APP_KEY);

/**
 * 将一张图片(dataURL)交给 Mathpix 转为 LaTeX
 * @returns {Promise<{latex: string, text: string}|null>} 失败返回 null
 */
export async function mathpixLatex(dataUrl) {
  const res = await fetch('https://api.mathpix.com/v3/latex', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      app_id: env.MATHPIX_APP_ID,
      app_key: env.MATHPIX_APP_KEY,
    },
    body: JSON.stringify({
      src: dataUrl,
      formats: ['latex_simplified', 'text'],
      math_inline_delimiters: ['$', '$'],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return {
    latex: data?.latex_simplified || data?.latex || '',
    text: data?.text || '',
  };
}
