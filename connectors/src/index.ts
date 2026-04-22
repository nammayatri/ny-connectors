import 'dotenv/config';
import { app, shutdown } from './app';
import { config } from './config';

const server = app.listen(config.port, () => {
  console.log(`[gateway] Message Gateway started on port ${config.port}`);
  console.log(`[gateway] Webhook URL: ${config.webhookUrl || '(not configured)'}`);
  console.log(`[gateway] Redis: ${config.redisUrl}`);
  console.log(`[gateway] Session TTL: ${config.sessionTtlSeconds}s`);
  console.log(`[gateway] Connectors: telegram, whatsapp, slack`);
  console.log(`[gateway] Dashboard token: ${config.nyDashboardToken ? `set (len=${config.nyDashboardToken.length})` : 'NOT SET'}`);
  console.log(`[gateway] Dashboard URL: ${config.nyDashboardUrl}`);
  console.log(`[gateway] City: ${config.nyCity}`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`[gateway] ${signal} received, shutting down...`);
  await shutdown();
  server.close(() => process.exit(0));
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
