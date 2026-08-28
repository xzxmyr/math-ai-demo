/**
 * 文本大模型客户端 (Text LLM)
 * 用于: ①独立解题生成标准解答 ②对比判题打分
 * 厂商: deepseek | qwen | openai | gemini (auto 时复用视觉厂商)
 */
import { env, resolveSolverProvider, solverModelFor } from './config.js';
import { fetchWithTimeout } from './vision.js';
import { parseModelJson } from './vision.js';

async function callOpenAICompat({ baseUrl, model, apiKey, prompt, json }) {
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  };

  const res = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`判题模型请求失败 (${res.status}): ${raw.slice(0, 500)}`);
  const data = JSON.parse(raw);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`判题模型返回内容为空: ${raw.slice(0, 300)}`);
  return json ? parseModelJson(content) : content;
}

async function callGeminiText({ model, apiKey, prompt, json }) {
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    }
  );
  const raw = await res.text();
  if (!res.ok) throw new Error(`Gemini 判题请求失败 (${res.status}): ${raw.slice(0, 500)}`);
  const data = JSON.parse(raw);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini 判题返回内容为空: ${raw.slice(0, 300)}`);
  return json ? parseModelJson(text) : text;
}

/**
 * 调用文本 LLM
 * @param {string} prompt
 * @param {{json?: boolean}} opts json=true 时要求模型返回 JSON 对象
 */
export async function callTextLLM(prompt, opts = {}) {
  const json = opts.json === true;
  const provider = resolveSolverProvider();
  const model = solverModelFor(provider);

  switch (provider) {
    case 'deepseek':
      return callOpenAICompat({
        baseUrl: 'https://api.deepseek.com/v1',
        model,
        apiKey: env.DEEPSEEK_API_KEY,
        prompt,
        json,
      });
    case 'qwen':
      return callOpenAICompat({
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model,
        apiKey: env.DASHSCOPE_API_KEY,
        prompt,
        json,
      });
    case 'openai':
      return callOpenAICompat({
        baseUrl: 'https://api.openai.com/v1',
        model,
        apiKey: env.OPENAI_API_KEY,
        prompt,
        json,
      });
    case 'gemini':
      return callGeminiText({ model, apiKey: env.GEMINI_API_KEY, prompt, json });
    default:
      throw new Error(`未知判题模型厂商: ${provider}`);
  }
}
