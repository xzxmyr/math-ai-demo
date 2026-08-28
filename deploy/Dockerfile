# 后端镜像 (Node 20 LTS)
FROM node:20-alpine AS backend

WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY server/ ./
# 密钥不进入镜像: 通过 --env-file / 环境变量注入
CMD ["node", "index.js"]

EXPOSE 8787
