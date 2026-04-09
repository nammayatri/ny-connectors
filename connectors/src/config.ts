export type RedisMode = 'standalone' | 'cluster';

export interface Config {
  port: number;
  webhookUrl: string;
  telegramBotToken: string;
  whatsappVerifyToken: string;
  whatsappAppSecret: string;
  whatsappAccessToken: string;
  whatsappPhoneNumberId: string;
  slackSigningSecret: string;
  slackBotToken: string;
  redisMode: RedisMode;
  redisUrl: string;
  redisClusterNodes: { host: string; port: number }[];
  sessionTtlSeconds: number;
  nyBaseUrl: string;
  nyAuthUrl: string;
  nyPreAuthToken: string;
  telegramSecretToken: string;
  nyAppSecret: string;
}

// Parses REDIS_CLUSTER_NODES env var: comma-separated host:port pairs.
// Example: "node1.example.com:6379,node2.example.com:6379,node3.example.com:6379"
function parseClusterNodes(raw: string): { host: string; port: number }[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [host, portStr] = entry.split(':');
      return { host, port: parseInt(portStr || '6379', 10) };
    });
}

// Resolves the Redis connection mode. Explicit REDIS_MODE wins; otherwise we
// infer from which env var was provided. Cluster nodes imply cluster mode.
function resolveRedisMode(raw: string, clusterNodesProvided: boolean): RedisMode {
  const value = raw.trim().toLowerCase();
  if (value === 'cluster' || value === 'standalone') return value;
  return clusterNodesProvided ? 'cluster' : 'standalone';
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  webhookUrl: process.env.WEBHOOK_URL || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET || '',
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET || '',
  slackBotToken: process.env.SLACK_BOT_TOKEN || '',
  redisMode: resolveRedisMode(
    process.env.REDIS_MODE || '',
    !!process.env.REDIS_CLUSTER_NODES,
  ),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisClusterNodes: parseClusterNodes(process.env.REDIS_CLUSTER_NODES || ''),
  sessionTtlSeconds: parseInt(process.env.SESSION_TTL_SECONDS || '1800', 10),
  nyBaseUrl: process.env.NY_BASE_URL || 'https://api.moving.tech/pilot/app/v2',
  nyAuthUrl: process.env.NY_AUTH_URL || 'https://api.moving.tech/pilot/app/v2',
  nyPreAuthToken: process.env.NY_PRE_AUTH_TOKEN || '',
  telegramSecretToken: process.env.TELEGRAM_SECRET_TOKEN || '',
  nyAppSecret: process.env.NY_APP_SECRET || '',
};
