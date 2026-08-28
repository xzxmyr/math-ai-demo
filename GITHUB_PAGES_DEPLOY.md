# GitHub Pages + Render 免费云后端 —— 上线操作手册

> 让其他人通过 GitHub 链接访问你的完整 Demo（真实出题/解题/判题模型）。
> 架构：前端静态托管在 GitHub Pages，后端 Express 部署在 Render 免费云，DashScope 密钥只存在于 Render（不泄露）。

> ⚠️ **执行顺序很重要**：Render 的 Blueprint 要从你的 GitHub 仓库里读取 `server/render.yaml`，
> 所以**必须先建 GitHub 仓库并推送代码，再部署 Render**（见下方步骤）。

## 架构图

```
浏览器 ──▶ https://xzxmyr.github.io/math-ai-demo/   (GitHub Pages, 静态前端)
              │  VITE_API_BASE_URL
              ▼
        https://math-ai-grader-api.onrender.com/api/v1  (Render, Express 后端)
              │  DASHSCOPE_API_KEY
              ▼
        阿里云百炼 (qwen-vl-max / qwen-plus)
```

## 第 1 步：登录 GitHub（一次性）

```bash
gh auth login
# 选择 GitHub.com → HTTPS → 浏览器授权
```

## 第 2 步：创建 GitHub 仓库并推送代码（先做！）

```bash
# 在项目根目录 (math-ai-platform) 执行:
git init
git add -A
git commit -m "feat: MathEngine AI demo (生成/解题/判题)"
gh repo create math-ai-demo --public --source . --remote origin --push
```

> 这一步会把 `server/render.yaml` 一起推上去（Render 稍后靠它识别后端配置）。
> 推送会触发一次 GitHub Actions 自动构建 Pages（此时后端地址 Secret 还没配，先以演示数据构建，不影响后续修正）。

## 第 3 步：在 Render 部署后端

**什么是 Blueprint？** 它是 Render 的"配置文件一键部署"：Render 通过 GitHub 授权连上你的仓库，
自动找到 `server/render.yaml`，按文件里的声明（Node 运行时、`npm install`、`node index.js`、环境变量清单）创建 Web Service。
如果 Blueprint 读取失败，就手动创建 Web Service，指向同一个仓库，Root Directory 填 `server` —— 效果一样。

1. 打开 https://render.com → 注册（免费版无需信用卡）→ 授权 GitHub（Render 需要读取你仓库的权限）
2. **New → Blueprint** → 选择 `math-ai-demo` 仓库 → Render 自动读取 `server/render.yaml` 并开始部署
   - 若失败，改用 **New → Web Service**：选 `math-ai-demo` 仓库 → Root Directory 填 `server` → Build 填 `npm install` → Start 填 `node index.js`
3. 部署完成后，在服务 **Environment** 页填写（`render.yaml` 中标记 `sync: false` 的项需手动填）：
   | 变量 | 值 |
   |---|---|
   | `DASHSCOPE_API_KEY` | 你的百炼密钥 |
   | `ALLOWED_ORIGINS` | `https://xzxmyr.github.io` |
4. 保存后服务会自动重启，复制服务地址（形如 `https://math-ai-grader-api.onrender.com`），验证：
   ```bash
   curl https://<你的服务地址>/api/v1/health
   # 应返回 {"ok":true,...,"vision":{"provider":"qwen",...}}
   ```
   > 免费版 15 分钟无请求会休眠，首次访问冷启动约 1 分钟，属正常现象。

## 第 4 步：配置前端后端地址（仓库 Secret）

```bash
gh secret set VITE_API_BASE_URL --repo xzxmyr/math-ai-demo
# 输入: https://<你的Render服务地址>/api/v1
```

设置后到 GitHub 仓库 **Actions** 页，把第一次构建的任务点开 **Re-run all jobs**（让前端用真实后端地址重新构建）。

## 第 5 步：启用 GitHub Pages

```bash
# 启用 Pages (Source: GitHub Actions)
gh api --method POST repos/xzxmyr/math-ai-demo/pages -f 'build_type=workflow'
```

## 第 6 步：验收

- [ ] 访问 `https://xzxmyr.github.io/math-ai-demo/`，三页导航正常（URL 形如 `/#/generator`）
- [ ] 出题：输入 Prompt → 生成题目 → 公式渲染正常
- [ ] 答题：文字模式解题 → 步骤公式渲染
- [ ] 判题：上传作业照片 → 三块切分 + 判题缺陷
- [ ] 浏览器 Network 里 `/api/v1/*` 请求 200 且非 localhost
- [ ] 后端 `/api/v1/health` 显示 provider=qwen

## 常见问题

| 问题 | 解决 |
|---|---|
| 页面 404 | 确认访问带仓库名路径 `/math-ai-demo/`；路由是 hash 模式 |
| 模型请求 403 | 检查 Render 的 `DASHSCOPE_API_KEY`、`VITE_API_BASE_URL` 是否带 `/api/v1` |
| 跨域报错 | Render 的 `ALLOWED_ORIGINS` 必须包含 `https://xzxmyr.github.io` |
| 首次打开很慢 | Render 免费版休眠冷启动，等 1 分钟刷新 |
| Actions 部署失败 | 确认第 5 步已启用 Pages 且 Source 为 GitHub Actions |

## 注意事项

- **密钥安全**：`server/.env`、`DASHSCOPE_API_KEY` 不要提交到仓库（`.gitignore` 已排除 `.env`）；密钥只在 Render 环境变量中。
- **费用**：Render 免费额度 750 小时/月（单实例足够）；模型费用按百炼实际调用计，建议设费用告警。
- **关闭分享**：删除仓库或 GitHub → Settings → Pages → 取消发布。
