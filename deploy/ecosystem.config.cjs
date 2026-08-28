/**
 * PM2 进程守护配置
 * 用法: pm2 start deploy/ecosystem.config.cjs --env production
 * 环境变量: server/.env.production 会被 PM2 自动加载 (env_file 指定)
 */
module.exports = {
  apps: [
    {
      name: 'math-ai-grader-api',
      cwd: './server',
      script: 'index.js',
      instances: 1, // 单实例即可 (模型调用为 IO 密集, 多实例反而放大限流与成本)
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      env_file: './server/.env.production',
      max_memory_restart: '512M',
      time: true, // 日志带时间戳
      error_file: '../logs/grader-error.log',
      out_file: '../logs/grader-out.log',
      merge_logs: true,
    },
  ],
};
