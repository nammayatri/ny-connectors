export type RedisMode = 'standalone' | 'cluster';

// Per-merchant configuration. Each merchant has its own WhatsApp number,
// Namma Yatri credentials, and dashboard settings.
export interface MerchantConfig {
  id: string;
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
  whatsappAppSecret: string;
  whatsappVerifyToken: string;
  nyPreAuthToken: string;
  nyMerchantId: string;
  nyDashboardToken: string;
  nyDashboardMerchant: string;
  nyCity: string;
  nyTrackingUrl: string; // template with {rideId} placeholder
}

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
  nyMerchantId: string;
  nyDashboardUrl: string;
  nyDashboardToken: string;
  nyDashboardMerchant: string;
  nyCity: string;
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
  nyMerchantId: process.env.NY_MERCHANT_ID || '',
  nyDashboardUrl: process.env.NY_DASHBOARD_URL || 'https://dashboard.moving.tech/api/bap',
  nyDashboardToken: process.env.NY_DASHBOARD_TOKEN || '',
  nyDashboardMerchant: process.env.NY_DASHBOARD_MERCHANT || 'NAMMA_YATRI',
  nyCity: process.env.NY_CITY || 'std:080',
};

// ---------------------------------------------------------------------------
// Merchant registry
// ---------------------------------------------------------------------------
// Merchants are loaded from env vars with the pattern MERCHANT_{ID}_{FIELD}.
// If no MERCHANT_* vars are found, a single default merchant is created from
// the legacy (non-prefixed) env vars for backward compatibility.
// ---------------------------------------------------------------------------

const merchantsById = new Map<string, MerchantConfig>();
const merchantsByPhoneNumberId = new Map<string, MerchantConfig>();

function loadMerchants(): void {
  // Discover merchant IDs from env vars (e.g. MERCHANT_1_WHATSAPP_PHONE_NUMBER_ID)
  const ids = new Set<string>();
  for (const key of Object.keys(process.env)) {
    const match = key.match(/^MERCHANT_(\w+)_WHATSAPP_PHONE_NUMBER_ID$/);
    if (match) ids.add(match[1]);
  }

  for (const id of ids) {
    const p = `MERCHANT_${id}_`;
    const cfg: MerchantConfig = {
      id,
      whatsappPhoneNumberId: process.env[`${p}WHATSAPP_PHONE_NUMBER_ID`] || '',
      whatsappAccessToken: process.env[`${p}WHATSAPP_ACCESS_TOKEN`] || '',
      whatsappAppSecret: process.env[`${p}WHATSAPP_APP_SECRET`] || '',
      whatsappVerifyToken: process.env[`${p}WHATSAPP_VERIFY_TOKEN`] || config.whatsappVerifyToken,
      nyPreAuthToken: process.env[`${p}NY_PRE_AUTH_TOKEN`] || '',
      nyMerchantId: process.env[`${p}NY_MERCHANT_ID`] || '',
      nyDashboardToken: process.env[`${p}NY_DASHBOARD_TOKEN`] || '',
      nyDashboardMerchant: process.env[`${p}NY_DASHBOARD_MERCHANT`] || '',
      nyCity: process.env[`${p}NY_CITY`] || '',
      nyTrackingUrl: process.env[`${p}NY_TRACKING_URL`] || 'https://www.nammayatri.in/u?vp=shareRide&rideId={rideId}',
    };
    if (cfg.whatsappPhoneNumberId) {
      merchantsById.set(id, cfg);
      merchantsByPhoneNumberId.set(cfg.whatsappPhoneNumberId, cfg);
    }
  }

  // Backward compat: if no MERCHANT_* vars found, create a default from legacy vars
  if (merchantsById.size === 0 && config.whatsappPhoneNumberId) {
    const fallback: MerchantConfig = {
      id: 'default',
      whatsappPhoneNumberId: config.whatsappPhoneNumberId,
      whatsappAccessToken: config.whatsappAccessToken,
      whatsappAppSecret: config.whatsappAppSecret,
      whatsappVerifyToken: config.whatsappVerifyToken,
      nyPreAuthToken: config.nyPreAuthToken,
      nyMerchantId: config.nyMerchantId,
      nyDashboardToken: config.nyDashboardToken,
      nyDashboardMerchant: config.nyDashboardMerchant,
      nyCity: config.nyCity,
      nyTrackingUrl: 'https://www.nammayatri.in/u?vp=shareRide&rideId={rideId}',
    };
    merchantsById.set('default', fallback);
    merchantsByPhoneNumberId.set(config.whatsappPhoneNumberId, fallback);
  }

  console.log(`[config] Loaded ${merchantsById.size} merchant(s): ${[...merchantsById.keys()].join(', ')}`);
}

loadMerchants();

export function getMerchantByPhoneNumberId(phoneNumberId: string): MerchantConfig | undefined {
  return merchantsByPhoneNumberId.get(phoneNumberId);
}

export function getMerchantById(id: string): MerchantConfig | undefined {
  return merchantsById.get(id);
}

export function getAllMerchants(): MerchantConfig[] {
  return Array.from(merchantsById.values());
}
