/**
 * 智能判题后端 API
 *
 * 接口:
 *   GET  /api/v1/health                  —— 服务与密钥配置状态
 *   POST /api/v1/grade/segment          —— 上传图片 → 三区切分(题目/图像/解答) + LaTeX 公式 + 模型可读文档
 *   POST /api/v1/grade/compare          —— 独立解题 + 对比判题 (接收 segment 返回结果)
 *
 * 与前端契约: src/services/graderService.js (VITE_API_BASE_URL 指向本服务)
 */
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  PORT,
  MAX_UPLOAD_MB,
  PRODUCTION,
  ALLOWED_ORIGINS,
  RATE_LIMIT,
  API_TOKEN,
  providerStatus,
} from './lib/config.js';
import { segmentImage, compareAndGrade } from './lib/pipeline.js';
import { solveQuestion } from './lib/solver.js';
import { generateQuestion } from './lib/generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// CORS: 生产环境必须通过 ALLOWED_ORIGINS 显式声明允许的来源
app.use(
  cors({
    origin: PRODUCTION && ALLOWED_ORIGINS.length === 0 ? false : ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : true,
  })
);

app.use(express.json({ limit: '20mb' })); // 含 base64 图片题目, 需较大上限
app.use(express.static(path.join(__dirname, 'public'))); // 临时直测网页

// API 限流: 防止模型费用被刷爆 (每个 IP 每分钟默认 20 次)
if (PRODUCTION) {
  app.use(
    '/api',
    rateLimit({
      windowMs: RATE_LIMIT.windowMs,
      max: RATE_LIMIT.max,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: '请求过于频繁，请稍后再试' },
    })
  );
}

// 可选 Token 鉴权: 生产配置 API_TOKEN 后, 所有 /api 请求需携带 Authorization: Bearer <token>
if (API_TOKEN) {
  app.use('/api', (req, res, next) => {
    const auth = req.headers.authorization || '';
    if (auth === `Bearer ${API_TOKEN}`) return next();
    res.status(401).json({ error: '未授权: 缺少或错误的 API Token' });
  });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // 只允许图片上传, 防止上传任意文件
    if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) return cb(null, true);
    const err = new Error('仅支持 PNG / JPG / JPEG / WEBP / GIF 图片');
    err.status = 400;
    cb(err);
  },
});

// ---------------- 路由 ----------------

app.get('/api/v1/health', (_req, res) => {
  res.json({ ok: true, service: 'math-ai-grader-api', ...providerStatus() });
});

/** 管线 A: 图片 → 三区切分 + 公式化 */
app.post('/api/v1/grade/segment', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '缺少图片文件，表单字段名应为 file' });
    }
    const mime = req.file.mimetype || 'image/jpeg';
    const result = await segmentImage({ buffer: req.file.buffer, mime });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** 管线 B: 独立解题 + 对比判题 */
app.post('/api/v1/grade/compare', async (req, res, next) => {
  try {
    const result = await compareAndGrade(req.body || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** 独立解题: 题目(文本或图片) → 知识点 + 逐步推导 */
app.post('/api/v1/question/solve', async (req, res, next) => {
  try {
    const { questionText, image } = req.body || {};
    const result = await solveQuestion({ questionText, image });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** 判题直测临时网页 */
app.get('/grader', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'grader.html'));
});

/** 出题: Prompt + 难度 + 题型 → 题目(LaTeX) + 可选 SVG 配图 */
app.post('/api/v1/question/generate', async (req, res, next) => {
  try {
    const { prompt, difficulty, categories, forceDiagram } = req.body || {};
    const result = await generateQuestion({ prompt, difficulty, categories, forceDiagram });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------- 错误处理 ----------------

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  const message = err.code === 'LIMIT_FILE_SIZE'
    ? `图片超过大小限制 (${MAX_UPLOAD_MB}MB)`
    : err.message || '服务器内部错误';
  console.error('[grader-api]', err);
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`\n🧮 MathEngine AI 判题后端已启动: http://localhost:${PORT}`);
  console.log(`  临时直测页 : GET  http://localhost:${PORT}/            (解题模型直接试用)`);
  console.log(`  判题直测页 : GET  http://localhost:${PORT}/grader      (分块切分+缺陷判题)`);
  console.log(`  健康检查   : GET  http://localhost:${PORT}/api/v1/health`);
  console.log(`  三区切分   : POST http://localhost:${PORT}/api/v1/grade/segment (multipart field: file)`);
  console.log(`  对比判题   : POST http://localhost:${PORT}/api/v1/grade/compare`);
  console.log(`  独立解题   : POST http://localhost:${PORT}/api/v1/question/solve (JSON: questionText | image)`);
  console.log(`  生成题目   : POST http://localhost:${PORT}/api/v1/question/generate (JSON: prompt/difficulty/categories/forceDiagram)`);
  console.log(`  密钥状态   : ${JSON.stringify(providerStatus(), null, 2)}\n`);
});
