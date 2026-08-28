/**
 * 环境配置与模型厂商解析
 * 所有密钥均从 server/.env 读取，不在代码中硬编码。
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const env = process.env;

export const PORT = Number(env.PORT || 8787);
export const MAX_UPLOAD_MB = Number(env.MAX_UPLOAD_MB || 10);
export const NODE_ENV = env.NODE_ENV || 'development';
export const PRODUCTION = NODE_ENV === 'production';

/** CORS 白名单: 逗号分隔的允许来源; 生产环境必须配置, 否则拒绝跨域 */
export const ALLOWED_ORIGINS = (env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** LLM 请求超时(毫秒): 视觉/文本模型单次调用上限 */
export const LLM_TIMEOUT_MS = Number(env.LLM_TIMEOUT_MS || 180000);

/** API 限流: 每个 IP 在窗口内的最大请求数 */
export const RATE_LIMIT = {
  windowMs: Number(env.RATE_LIMIT_WINDOW_MS || 60 * 1000),
  max: Number(env.RATE_LIMIT_MAX || 20),
};

/** 判题/解题 API 是否需要 Token 鉴权 (生产建议开启) */
export const API_TOKEN = (env.API_TOKEN || '').trim();

export const hasKey = (name) => Boolean(env[name] && env[name].trim());

/** 解析视觉模型厂商: auto 时按已有密钥探测 (qwen > openai > gemini) */
export function resolveVisionProvider() {
  const p = (env.VISION_PROVIDER || 'auto').trim().toLowerCase();
  if (p !== 'auto') return p;
  if (hasKey('DASHSCOPE_API_KEY')) return 'qwen';
  if (hasKey('OPENAI_API_KEY')) return 'openai';
  if (hasKey('GEMINI_API_KEY')) return 'gemini';
  throw new Error(
    '未检测到任何视觉模型密钥。请在 server/.env 中至少配置以下之一:\n' +
      '  ① DASHSCOPE_API_KEY (阿里云百炼 Qwen-VL, 推荐)\n' +
      '  ② OPENAI_API_KEY (GPT-4o)\n' +
      '  ③ GEMINI_API_KEY (Gemini 2.5 Flash)'
  );
}

export function visionModelFor(provider) {
  switch (provider) {
    case 'qwen':
      return env.VISION_MODEL || 'qwen-vl-max';
    case 'openai':
      return env.OPENAI_VISION_MODEL || 'gpt-4o';
    case 'gemini':
      return env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';
    default:
      throw new Error(`未知视觉模型厂商: ${provider}`);
  }
}

/** 解析解题/判题 LLM 厂商: auto 时复用视觉厂商(同一把密钥, 零额外成本) */
export function resolveSolverProvider() {
  const p = (env.SOLVER_PROVIDER || 'auto').trim().toLowerCase();
  if (p !== 'auto') {
    if (p === 'deepseek' && !hasKey('DEEPSEEK_API_KEY')) {
      throw new Error('SOLVER_PROVIDER=deepseek 但未配置 DEEPSEEK_API_KEY');
    }
    return p;
  }
  return resolveVisionProvider(); // 复用视觉厂商
}

export function solverModelFor(provider) {
  if (env.SOLVER_MODEL && env.SOLVER_MODEL.trim()) return env.SOLVER_MODEL.trim();
  switch (provider) {
    case 'deepseek':
      return 'deepseek-chat';
    case 'qwen':
      return 'qwen-plus';
    case 'openai':
      return 'gpt-4o-mini';
    case 'gemini':
      return 'gemini-2.5-flash';
    default:
      throw new Error(`未知解题模型厂商: ${provider}`);
  }
}

/** 当前密钥配置概览 (供 /health 与启动日志使用, 只显示是否已配置, 不泄露密钥) */
export function providerStatus() {
  return {
    vision: {
      provider: (() => {
        try {
          return resolveVisionProvider();
        } catch {
          return null;
        }
      })(),
      keys: {
        dashscope: hasKey('DASHSCOPE_API_KEY'),
        openai: hasKey('OPENAI_API_KEY'),
        gemini: hasKey('GEMINI_API_KEY'),
      },
    },
    solver: {
      provider: (() => {
        try {
          return resolveSolverProvider();
        } catch {
          return null;
        }
      })(),
      deepseek: hasKey('DEEPSEEK_API_KEY'),
    },
    mathpix: hasKey('MATHPIX_APP_ID') && hasKey('MATHPIX_APP_KEY'),
  };
}
