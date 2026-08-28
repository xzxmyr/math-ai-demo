# 算法模型与后端 API 接入指南 (Model Integration Guide)

本前端平台基于 **Vue 3 + Tailwind CSS** 搭建，采用了服务接口层（Service Layer）解耦的设计。所有后端与 AI 算法接口均封装在 `src/services/` 目录下。

待后端模型（包括：微调大模型、视觉切分/Layout Analysis 模型、OCR 提取与判题对比链）训练完毕后，可按照以下步骤快速接入。

---

## 1. 环境变量配置 (`.env.development` / `.env.production`)

在项目根目录下新建 `.env` 文件，配置后端服务器 API 基准地址：

```env
VITE_API_BASE_URL=https://your-backend-api-domain.com/api/v1
```

---

## 2. 接口替换说明

### 接口 1: 出题算法接入 (`src/services/generatorService.js`)

**对应后端功能**：根据用户自然语言 Prompt + 难度 + 题型，调用大模型（LLM）生成 LaTeX 题干，并在需要时调用图形渲染服务。

**修改方案**：取消 `setTimeout` 模拟，替换为真实 HTTP 请求：

```javascript
export async function generateQuestionApi(params) {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/question/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: params.prompt,
      difficulty: params.difficulty,
      categories: params.categories,
      force_diagram: params.forceDiagram
    }),
  });
  
  if (!response.ok) throw new Error('出题模型请求异常');
  return await response.json();
}
```

* **后端期望返回格式**：

```json
{
  "questionId": "q_10029384",
  "difficulty": "competition",
  "categories": ["geometry"],
  "content": "题目 LaTeX 文本",
  "requiresDiagram": true,
  "imageUrl": "https://..." // 或 Base64 / SVG 矢量数据
}
```

---

### 接口 2: 图像视觉切分与 OCR 提取 (`src/services/graderService.js` -> `segmentAndOcrApi`)

**对应后端功能**：接收前端上传的图片文件，传给 Layout Analysis 切分模型与 OCR 引擎，返回切片 URL 和提取的文本。

**修改方案**：使用 `FormData` 传输多媒体/图像二进制文件：

```javascript
export async function segmentAndOcrApi(imageFile) {
  const formData = new FormData();
  formData.append('file', imageFile);

  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/grade/segment`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('图像切分失败');
  return await response.json();
}
```

* **后端期望返回格式**：

```json
{
  "croppedQuestionUrl": "http://.../cropped_q.png",
  "croppedAnswerUrl": "http://.../cropped_ans.png",
  "extractedQuestionText": "OCR提取的题目文本",
  "extractedStudentAnswerText": "OCR提取的学生作答文本"
}
```

---

### 接口 3: 答题与对比判题模型 (`src/services/graderService.js` -> `gradeCompareApi`)

**对应后端功能**：

1. 传入 OCR 提取的题目 -> 调用 **解题模型** 生成标准解答。
2. 将标准解答与学生作答提取文本传入 **对比判题 LLM**，计算得分与修改建议。

**修改方案**：

```javascript
export async function gradeCompareApi(payload) {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/grade/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questionText: payload.extractedQuestionText,
      studentAnswerText: payload.extractedStudentAnswerText
    }),
  });

  if (!response.ok) throw new Error('判题模型评估失败');
  return await response.json();
}
```

* **后端期望返回格式**：

```json
{
  "score": 85,
  "modelStandardAnswer": "模型生成的标准推导步骤",
  "analysis": [
    { "type": "success", "text": "步骤分析1" },
    { "type": "warning", "text": "步骤分析2" }
  ],
  "suggestions": "针对性指导建议"
}
```
