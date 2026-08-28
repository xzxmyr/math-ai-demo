# 上线准备清单 (Deployment Checklist)

> 面向 MathEngine AI 平台（前端 Vue 3 + 后端 Express + 阿里云百炼模型）的生产上线。
> 已完成的准备项标 ✅，需要你决策/操作的标 ⬜。

---

## 0. 现状盘点（已就绪 ✅）

- ✅ 前端三页（出题系统 / 答题界面 / 智能判题）已接真实模型（qwen-vl-max 视觉 + qwen-plus 文本）
- ✅ 后端 API：`/grade/segment`、`/grade/compare`、`/question/solve`、`/question/generate`、临时直测页 `/` `/grader`
- ✅ 密钥仅存于 `server/.env`（权限 600，已被 `.gitignore` 排除）
- ✅ 已加固：CORS 白名单（生产强制）、API 限流、上传类型校验、LLM 调用超时、可选 Token 鉴权
- ✅ 部署模板：PM2 / Docker / Nginx / 生产 env 模板（见 `deploy/`）

---

## 1. 必需准备（阻塞项，按顺序做）

### 1.1 环境与 Node 版本
- ⬜ 服务器安装 **Node.js 20 LTS**（后端 `engines >=18`，前端 `>=20`；本机 25 可用但生产用 LTS 更稳）
- ⬜ 服务器安装 **PM2**（`npm i -g pm2`）或使用 Docker

### 1.2 域名、备案与 HTTPS（中国内地服务器必读）
- ⬜ 注册域名；若服务器在国内：**ICP 备案**（未备案域名无法绑定国内服务器公网访问；个人备案约 1~2 周）
  - 若不想备案：用**境外服务器**（香港/新加坡）或 Cloudflare Tunnel / 内网穿透，可跳过备案
- ⬜ 申请 HTTPS 证书（Let's Encrypt 免费 / 云厂商免费证书），前端与 API 都必须 HTTPS
  - 浏览器 `FileReader` 上传、`URL.createObjectURL` 等能力在非安全上下文受限

### 1.3 生产环境变量
- ⬜ 后端：复制 `server/.env.production.example` → `server/.env.production`，填写：
  - `DASHSCOPE_API_KEY`（生产专用，建议与开发分开）
  - `ALLOWED_ORIGINS=https://你的域名`（必填，否则跨域全拒）
  - 建议设置 `API_TOKEN=一段随机长字符串`
- ⬜ 前端：复制 `.env.production.example` → `.env.production`，填 `VITE_API_BASE_URL=https://你的域名/api/v1`
- ⬜ `npm run build` 生成 `dist/`（构建产物）

### 1.4 部署运行
- ⬜ 方式 A（推荐，简单）：Nginx 托管 `dist/` + PM2 跑后端（模板见 `deploy/ecosystem.config.cjs`、`deploy/nginx.conf.example`）
- ⬜ 方式 B（容器化）：`docker compose -f deploy/docker-compose.yml up -d --build`

### 1.5 安全确认
- ⬜ 生产 `API_TOKEN` 已设置并让前端请求带上 `Authorization: Bearer <token>`（需在 `src/services/*.js` 统一加请求头）
- ⬜ 限流已生效（每 IP 每分钟 20 次默认，防模型费用刷爆）
- ⬜ 临时直测页 `/` `/grader` 若不想对外，在 Nginx 层加访问密码或仅内网

---

## 2. 强烈建议（成本与稳定性）

| 项 | 说明 |
|---|---|
| ⬜ 模型费用监控 | 百炼控制台设置**费用告警**；每次判题约 2~3 次模型调用，成本大头在视觉 |
| ⬜ 日志与告警 | PM2 日志 + 定时 `curl /api/v1/health` 存活探测（cron 或 UptimeRobot） |
| ⬜ 数据持久化 | 当前无数据库（判题/出题结果不落库）。如需历史记录/题库，接入 SQLite/PostgreSQL |
| ⬜ 性能优化 | 视觉切分 ~10s、判题 ~50s 是模型耗时，可加"结果缓存"（相同图片 hash 命中缓存） |
| ⬜ Git 版本管理 | 当前非 git 仓库，建议 `git init` + 提交（`.gitignore` 已就绪，密钥不会入库） |

---

## 3. 上线步骤 Runbook（复制执行）

```bash
# ① 服务器准备
apt install -y nodejs npm nginx     # 或安装 Node 20 LTS
npm i -g pm2

# ② 代码与依赖
git clone <repo> && cd math-ai-platform
cd server && npm ci --omit=dev       # 或 npm install
cd .. && npm ci && npm run build     # 前端构建 → dist/

# ③ 生产配置
cp server/.env.production.example server/.env.production   # 填写密钥/域名/Token
cp .env.production.example .env.production                 # 填 VITE_API_BASE_URL 后重新 build

# ④ 启动后端 (PM2)
cd server && NODE_ENV=production pm2 start ../deploy/ecosystem.config.cjs
pm2 save && pm2 startup            # 开机自启

# ⑤ 配置 Nginx
cp deploy/nginx.conf.example /etc/nginx/conf.d/math-ai.conf   # 改域名/证书路径
nginx -t && systemctl reload nginx

# ⑥ 验证
curl https://你的域名/api/v1/health        # 应返回 ok + 密钥状态
# 浏览器打开 https://你的域名  → 走通 出题→答题→判题 全流程
```

---

## 4. 上线前验收清单（全部通过再发布）

- [ ] `https://域名` 打开，三页导航正常，无控制台报错
- [ ] 出题：输入 Prompt → 生成题目 → 公式正常渲染 → 带入答题页
- [ ] 答题：文字模式解题 → 步骤带公式渲染
- [ ] 判题：上传真实作业照片 → 三块切分(题目/图像/解答)+LaTeX → 判题出正确解答与缺陷
- [ ] 跨域：浏览器正常请求 `https://域名/api/v1/*`（ALLOWED_ORIGINS 生效）
- [ ] 安全：无 Token 访问 `/api` 返回 401（若已开）；频繁请求被限流
- [ ] 上传：非图片文件被拒绝（400）；超大文件被拒绝（413）
- [ ] HTTPS：证书有效，无混合内容警告
- [ ] 模型：密钥有效，`/health` 显示 provider=qwen
