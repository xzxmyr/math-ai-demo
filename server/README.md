# MathEngine AI —— 智能判题后端 API

对应前端 `src/views/GraderView.vue`（智能判题）的视觉模型与判题链路实现，同时提供
**独立解题接口**（对应前端 `src/views/SolverView.vue` 答题界面）与**临时直测网页**。

## 一、视觉模型管线设计（模型分析）

用户上传一张作业/试卷照片后，后端按以下三段式管线处理：

```
                 ┌──────────────────────────────────────────────┐
                 │ ① 版面三区切分 (Layout Analysis)               │
  用户图片 ──────▶│   question(题目) / diagram(图像) / solution(解答)│
                 │  每区输出归一化 bbox [l,t,r,b]                   │
                 └──────────────────────────────────────────────┘
                                   │
                 ┌─────────────────▼──────────────────────────────┐
                 │ ② 公式化 (Math OCR → LaTeX)                    │
                 │  题目 → text + $LaTeX$                          │
                 │  图像 → description + 图中几何量/方程 LaTeX       │
                 │  解答 → 手写过程 text + $LaTeX$                  │
                 └─────────────────┬──────────────────────────────┘
                                   │
                 ┌─────────────────▼──────────────────────────────┐
                 │ ③ 模型可读文档 (Model-Readable)                 │
                 │  三区汇总为 Markdown + LaTeX 结构化文档,          │
                 │  可直接输入任意数学大模型进行解题/判题             │
                 └────────────────────────────────────────────────┘
```

- **为什么切三区而不是两区**：题目与解答之外，几何/函数图像携带题目关键条件（坐标、边长、方程），若只靠文字 OCR 会丢失条件导致判题误判；图像区单独切分后既可喂给解题模型补充上下文，也可供前端单独展示。
- **公式生成策略**：视觉模型直接输出标准 LaTeX（`\frac`、`\int_{}^{}`、`\sqrt{}`），保证"模型可读"；若配置 Mathpix，会对题目/解答区域裁剪图做二次公式识别，对手写体保真度最高。
- **判题链路**：题目(含图形) → 解题模型独立生成标准解答 → 与 OCR 出的学生解答逐步骤对比打分。

## 二、模型密钥需求

### 必需：视觉模型（三选一，给任意一把即可跑通全部流程）

| 优先级 | 厂商 | 模型 | 环境变量 | 说明 |
|---|---|---|---|---|
| ★ 推荐 | 阿里云百炼 | `qwen-vl-max`（或 `qwen-vl-plus`，账号有权限即可） | `DASHSCOPE_API_KEY` | 中文印刷/手写数学 OCR 最强、LaTeX 输出稳定、国内直连、支持 JSON 结构化输出 |
| 备选 1 | OpenAI | `gpt-4o` / `gpt-4.1` | `OPENAI_API_KEY` | 通用视觉能力强，海外访问 |
| 备选 2 | Google | `gemini-2.5-flash` | `GEMINI_API_KEY` | 免费额度大，性价比高 |

### 可选：解题/判题 LLM（默认复用视觉厂商的文本模型，无需额外密钥）

| 场景 | 推荐 | 环境变量 | 说明 |
|---|---|---|---|
| 标准解答 + 对比判题 | DeepSeek `deepseek-chat` | `DEEPSEEK_API_KEY` + `SOLVER_PROVIDER=deepseek` | 数学推理强、API 便宜；也可用 `qwen-plus` / `gpt-4o-mini` / `gemini-2.5-flash` |
| 数学专用 OCR 增强（可选） | Mathpix | `MATHPIX_APP_ID` + `MATHPIX_APP_KEY` + `MATH_OCR_ENGINE=mathpix` | 手写公式 → LaTeX 保真度最高，适合竞赛解答 |

> **最小可用配置**：**只需 1 把视觉模型密钥**（推荐 `DASHSCOPE_API_KEY`）。密钥填写在 `server/.env`（**请勿把密钥发到聊天/提交到 Git**）。
>
> **常见问题**：如果调用视觉接口返回 `403 Access denied`，通常是所选模型名在当前账号下未开通权限，把 `VISION_MODEL` 换成该账号可用的型号即可（如 `qwen-vl-max`、`qwen-vl-plus`）；密钥有效性可用 `qwen-plus`（文本）验证。

## 三、快速启动

```bash
cd server
cp .env.example .env      # 填入至少一个视觉模型密钥
npm install
npm start                 # 默认 http://localhost:8787
```

启动后浏览器直接打开 **http://localhost:8787/** 即可在**临时直测网页**上试用解题模型（输入文本或上传题目照片，无需构建前端）。

> **可选**：需要"区域裁剪预览图"（`croppedQuestionUrl` / `croppedAnswerUrl` / `croppedDiagramUrl`）时，额外安装图片处理库：
> ```bash
> npm i sharp
> ```
> 不安装 sharp 也不影响主流程——接口仍返回三区归一化 `bbox` 坐标，前端可用 canvas 自行裁剪。

Node.js ≥ 18（推荐 20+）。

## 四、接口文档

### GET /api/v1/health
查看服务与密钥配置状态。

### POST /api/v1/grade/segment （三区切分 + 公式化）
`multipart/form-data`，字段名 **`file`**（与前端 `graderService.segmentAndOcrApi` 一致）。

```bash
curl -X POST http://localhost:8787/api/v1/grade/segment \
  -F "file=@作业照片.jpg"
```

返回示例：

```json
{
  "croppedQuestionUrl": "data:image/png;base64,...",
  "croppedAnswerUrl": "data:image/png;base64,...",
  "extractedQuestionText": "已知 f(x)=x^2+2x，求定积分 ∫₀² f(x)dx",
  "extractedStudentAnswerText": "解：∫(x^2+2x)dx = 1/3x^3+x^2，代入得 20/3",
  "regions": {
    "question": { "bbox": [0.05, 0.02, 0.96, 0.30], "text": "...", "latex": "已知 $f(x)=x^{2}+2x$，求 $\\int_{0}^{2} f(x)\\,dx$。" },
    "diagram":  { "bbox": [0.05, 0.32, 0.50, 0.62], "description": "...", "latex": "y=x^{2}+2x,\\ x\\in[0,2]" },
    "solution": { "bbox": [0.05, 0.65, 0.96, 0.98], "text": "...", "latex": "\\int (x^{2}+2x)\\,dx=\\frac{1}{3}x^{3}+x^{2}" }
  },
  "questionLatex": "...", "studentAnswerLatex": "...", "diagramLatex": "...", "diagramDescription": "...",
  "modelReadable": "# 数学作业解析文档 ..."
}
```

### POST /api/v1/grade/compare （判题：正确解答 + 缺陷分析）
`application/json`，body 为 segment 返回结果（机器语言优先：`questionLatex` / `studentAnswerLatex` / `diagramLatex`，兼容旧的 `extractedQuestionText` / `extractedStudentAnswerText`）。

流程：题目(含图形 LaTeX) → 解题模型生成**正确解答** → 判题模型逐条对比，输出**缺陷明细**与**亮点**。

返回（与前端 `GraderView` 展示结构一致）：

```json
{
  "score": 85,
  "status": "partial_correct",
  "modelStandardAnswer": "标准解答全文(LaTeX)",
  "correctSolution": "标准解答全文(LaTeX)",
  "defects": [
    { "step": "第2步/最终答案", "issue": "缺陷描述", "severity": "high|medium|low", "fix": "修正写法" }
  ],
  "strengths": ["学生做对的关键点"],
  "analysis": [ { "type": "success|warning", "text": "派生条目(兼容旧前端)" } ],
  "suggestions": "综合改进建议"
}
```

### POST /api/v1/question/solve （独立解题：答题界面 / 临时直测页）
`application/json`。两种输入：
- 文本模式：`{ "questionText": "求函数 f(x)=x^3-3x 的单调区间与极值" }`
- 图片模式：`{ "image": "data:image/png;base64,..." }`（后端先用视觉模型提取题目，再交给解题模型）

```bash
curl -X POST http://localhost:8787/api/v1/question/solve \
  -H "Content-Type: application/json" \
  -d '{"questionText":"求函数 f(x)=x^3-3x 的单调区间与极值"}'
```

返回（结构与前端 `SolverView` 渲染字段一致）：

```json
{
  "questionId": "solve_...",
  "questionText": "求函数 f(x)=x^3-3x 的单调区间与极值",
  "knowledgePoints": ["导数的几何意义", "函数单调性判定定理", "极值的必要条件与充分条件"],
  "steps": [
    {
      "stepIndex": 1,
      "title": "求一阶导数",
      "reason": "利用导数的运算法则（幂函数求导法则）",
      "content": "对 $f(x)=x^3-3x$ 求导，得 $$f'(x)=3x^2-3$$"
    }
  ]
}
```

### POST /api/v1/question/generate （出题：Prompt + 难度 + 题型 → 题目）
`application/json`。请求载荷与前端 `GeneratorView` 一致：

```bash
curl -X POST http://localhost:8787/api/v1/question/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"请出一条关于定积分换元法的竞赛难度计算题，要求结合三角函数","difficulty":"competition","categories":["integration"],"forceDiagram":false}'
```

返回（数据契约 `QuestionResult`，`content` 为含 LaTeX 的题干，`requiresDiagram` 时附带 SVG 配图）：

```json
{
  "questionId": "q_...",
  "difficulty": "competition",
  "categories": ["integration"],
  "prompt": "...",
  "content": "计算定积分 \\[\\int_{0}^{\\frac{\\pi}{2}} \\frac{\\sin x}{1+\\cos^2 x+\\sin x\\cos x}\\,dx\\] ...",
  "requiresDiagram": false,
  "imageUrl": null
}
```

`requiresDiagram` 判定规则：`forceDiagram=true` 或题型含 `geometry` 或模型判定需要配图；为 `true` 时 `imageUrl` 返回 SVG data URL（坐标系 + 图形标注）。

### GET / （临时直测网页）
`server/public/index.html` 由后端直接托管：打开即用，输入文本或上传照片即可调用真实解题模型，无需构建前端。

## 五、前端接入

1. 根目录 `.env`（或 `.env.development`）配置：
   ```env
   VITE_API_BASE_URL=http://localhost:8787/api/v1
   ```
2. `src/services/graderService.js` 已改为：配置了 `VITE_API_BASE_URL` 时走真实后端，未配置时回退 Mock 数据（不破坏现有演示）。

## 六、目录结构

```
server/
├── index.js            # Express 入口与路由
├── .env.example        # 密钥配置模板
├── lib/
│   ├── config.js       # 环境变量与厂商解析
│   ├── prompts.js      # 三区切分 / 解题 / 判题提示词
│   ├── vision.js       # 视觉模型客户端 (qwen/openai/gemini)
│   ├── textllm.js      # 文本判题模型客户端 (deepseek/qwen/openai/gemini)
│   ├── pipeline.js     # 核心管线 (segmentImage / compareAndGrade)
│   ├── crop.js         # 区域裁剪 (可选 sharp)
│   └── mathpix.js      # 数学 OCR 增强 (可选)
```
