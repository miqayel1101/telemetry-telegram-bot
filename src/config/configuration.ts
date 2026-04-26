export const configuration = () => ({
  port: parseInt(process.env.PORT || '3002', 10),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    db: process.env.POSTGRES_DB || 'haydrive',
    user: process.env.POSTGRES_USER || 'haydrive',
    password: process.env.POSTGRES_PASSWORD || '',
  },
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  coreApiUrl: process.env.CORE_API_URL || 'http://localhost:3001',
  coreApiKey: process.env.CORE_API_KEY || '',
});
