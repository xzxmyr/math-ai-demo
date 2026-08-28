/**
 * 视觉模型客户端 (Vision)
 * 支持三家厂商，统一返回"严格 JSON 对象"：
 *   qwen   -> 阿里云百炼 DashScope OpenAI 兼容接口 (qwen-vl-max / qwen2.5-vl-*)
 *   openai -> OpenAI Chat Completions (gpt-4o / gpt-4.1)
 *   gemini -> Google Generative Language API (gemini-2.5-flash / pro)
 * 使用原生 fetch，无额外 SDK 依赖。
 */
import { env, LLM_TIMEOUT_MS, resolveVisionProvider, visionModelFor } from './config.js';

/** 带超时的 fetch: 超时抛出中文错误 */
export async function fetchWithTimeout(url, options = {}) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(LLM_TIMEOUT_MS) });
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new Error(`模型调用超时(超过 ${Math.round(LLM_TIMEOUT_MS / 1000)}s)，请重试或调大 LLM_TIMEOUT_MS`);
    }
    throw err;
  }
}

/** 去掉模型偶尔输出的 ```json ... ``` 围栏 */
function stripFences(text) {
  if (!text) return text;
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

/** 容错 JSON 解析: 先直接 parse，失败则抽取第一个 {...} 块 */
export function parseModelJson(text) {
  const cleaned = stripFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`模型未返回合法 JSON: ${cleaned.slice(0, 300)}`);
  }
}

async function callOpenAICompat({ baseUrl, model, apiKey, prompt, base64, mime, json }) {
  const messages = base64
    ? [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
          ],
        },
      ]
    : [{ role: 'user', content: prompt }];

  const body = {
    model,
    messages,
    temperature: 0.1,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  };

  const res = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`模型请求失败 (${res.status}): ${raw.slice(0, 500)}`);
  }
  const data = JSON.parse(raw);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`模型返回内容为空: ${raw.slice(0, 300)}`);
  return json ? parseModelJson(content) : content;
}

async function callGemini({ model, apiKey, prompt, base64, mime, json }) {
  const parts = base64
    ? [{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }]
    : [{ text: prompt }];

  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.1,
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    }
  );

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini 请求失败 (${res.status}): ${raw.slice(0, 500)}`);
  }
  const data = JSON.parse(raw);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini 返回内容为空: ${raw.slice(0, 300)}`);
  return json ? parseModelJson(text) : text;
}

/**
 * 调用视觉模型
 * @param {string} prompt 文本指令
 * @param {string} base64 图片 base64 (不含 data: 前缀)
 * @param {string} mime   图片 MIME (image/jpeg / image/png ...)
 * @param {{json?: boolean}} opts 是否要求 JSON 结构化输出
 * @returns {Promise<object|string>}
 */
export async function callVision(prompt, base64, mime, opts = {}) {
  const json = opts.json !== false; // 视觉任务默认要求 JSON
  const provider = resolveVisionProvider();
  const model = visionModelFor(provider);

  switch (provider) {
    case 'qwen':
      return callOpenAICompat({
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model,
        apiKey: env.DASHSCOPE_API_KEY,
        prompt,
        base64,
        mime,
        json,
      });
    case 'openai':
      return callOpenAICompat({
        baseUrl: 'https://api.openai.com/v1',
        model,
        apiKey: env.OPENAI_API_KEY,
        prompt,
        base64,
        mime,
        json,
      });
    case 'gemini':
      return callGemini({ model, apiKey: env.GEMINI_API_KEY, prompt, base64, mime, json });
    default:
      throw new Error(`未知视觉模型厂商: ${provider}`);
  }
}
