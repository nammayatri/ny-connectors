export type RedisMode = 'standalone' | 'cluster';
export type RideMode = 'flexi' | 'regular' | 'both';

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
  rideMode?: RideMode;     // which ride types this merchant offers (undefined = neither → unsupported)
  flexiEnabled: boolean;   // derived from rideMode: offers metered Flexi (EasyBooking) rides
  regularEnabled: boolean; // derived from rideMode: offers destination Regular rides
  flexiServiceArea?: string;      // served-city name for the geofence (e.g. "Tumkur")
  flexiServiceRadiusKm?: number;  // serviceable radius around that city center (km)
  flexiIntroVideoUrl?: string;    // how-it-works video (unset → text placeholder)
  flexiSupportPhone?: string;     // contact-support number shown in the "More" drawer
}

export interface Config {
  port: number;
  isProd: boolean;                // NODE_ENV === 'production' — gates the prod-only safety guards
  whatsappVerifyToken: string;
  whatsappAppSecret: string;
  whatsappAccessToken: string;
  whatsappPhoneNumberId: string;
  whatsappSkipVerify: boolean;
  redisMode: RedisMode;
  redisUrl: string;
  redisConfigured: boolean;       // REDIS_URL or REDIS_CLUSTER_NODES was explicitly set (opts into Redis)
  redisClusterNodes: { host: string; port: number }[];
  sessionTtlSeconds: number;
  nyBaseUrl: string;
  nyAuthUrl: string;
  nyPreAuthToken: string;
  nyMerchantId: string;
  nyDashboardUrl: string;
  nyDashboardToken: string;
  nyDashboardMerchant: string;
  nyCity: string;
  nyMock: boolean;
  nyFixedUserToken?: string;      // TEST ONLY: route every user through this fixed NY session token (skips silent auth + OTP). Refused in prod.
  nyLogBodies: boolean;           // log full NY request/response bodies (PII) — disable in prod
  nyLogPretty: boolean;           // pretty-print (indent + cap) NY bodies in logs — set 0 for single-line prod logs
  allowedPhones: string[];        // WhatsApp allowlist (normalized 10-digit); empty = open to all
  rideMode?: RideMode;
  flexiEnabled: boolean;
  regularEnabled: boolean;
  flexiServiceArea?: string;
  flexiServiceRadiusKm?: number;
  flexiTrackEnabled: boolean;     // run the background ride-progress tracker
  flexiTrackPollMs: number;       // how often the tracker polls each active ride
  flexiTrackMaxAgeMs: number;     // stop watching a ride after this age (safety net)
  flexiIntroVideoUrl?: string;    // how-it-works video URL (unset → text placeholder)
  flexiSupportPhone?: string;     // contact-support number (placeholder default)
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

// Which ride types a merchant offers. Explicit RIDE_MODE wins; else fall back to
// the legacy FLEXI_ENABLED flag (truthy → 'flexi'). undefined = offers neither
// Flexi nor Regular (an unsupported merchant — flagged loudly at config load).
export function resolveRideMode(rideModeEnv?: string, flexiEnabledEnv?: string): RideMode | undefined {
  const m = (rideModeEnv || '').trim().toLowerCase();
  if (m === 'flexi' || m === 'regular' || m === 'both') return m;
  return /^(1|true|yes)$/i.test(flexiEnabledEnv || '') ? 'flexi' : undefined;
}
const GLOBAL_RIDE_MODE = resolveRideMode(process.env.RIDE_MODE, process.env.FLEXI_ENABLED);

// Normalizes a phone into the same 10-digit form the flow engine compares against
// (strips non-digits and a leading 91 country code). Used to build the allowlist.
function normalizePhone(raw: string): string {
  let p = (raw || '').replace(/[^0-9]/g, '');
  if (p.startsWith('91') && p.length > 10) p = p.substring(2);
  return p;
}

// Access allowlist for the WhatsApp flow. While the pilot number is private,
// only these numbers get the live flow; everyone else sees "coming soon".
// Comma-separated ALLOWED_PHONES overrides the default. Set ALLOWED_PHONES=""
// (empty) to open access to everyone.
function parseAllowedPhones(raw: string | undefined): string[] {
  if (raw === undefined) return ['9361176218'];
  return raw
    .split(',')
    .map((p) => normalizePhone(p))
    .filter((p) => p.length === 10);
}

const IS_PROD = process.env.NODE_ENV === 'production';

export const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  isProd: IS_PROD,
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET || '',
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  // Dev-only: skip inbound webhook signature verification (use if the app secret
  // is uncertain while testing through a tunnel). Forced FALSE in production so a
  // stray env var can never disable inbound HMAC verification (fail-closed).
  whatsappSkipVerify: !IS_PROD && /^(1|true|yes)$/i.test(process.env.WHATSAPP_SKIP_VERIFY || ''),
  redisMode: resolveRedisMode(
    process.env.REDIS_MODE || '',
    !!process.env.REDIS_CLUSTER_NODES,
  ),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  // Presence-based (not value-based): any explicit REDIS_URL — including localhost —
  // opts into Redis; unset means use in-memory (dev) / fail the prod guard.
  redisConfigured: !!process.env.REDIS_URL || !!process.env.REDIS_CLUSTER_NODES,
  redisClusterNodes: parseClusterNodes(process.env.REDIS_CLUSTER_NODES || ''),
  sessionTtlSeconds: parseInt(process.env.SESSION_TTL_SECONDS || '1800', 10),
  nyBaseUrl: process.env.NY_BASE_URL || 'https://api.moving.tech/pilot/app/v2',
  nyAuthUrl: process.env.NY_AUTH_URL || 'https://api.moving.tech/pilot/app/v2',
  nyPreAuthToken: process.env.NY_PRE_AUTH_TOKEN || '',
  nyMerchantId: process.env.NY_MERCHANT_ID || '',
  nyDashboardUrl: process.env.NY_DASHBOARD_URL || 'https://dashboard.moving.tech/api/bap',
  nyDashboardToken: process.env.NY_DASHBOARD_TOKEN || '',
  nyDashboardMerchant: process.env.NY_DASHBOARD_MERCHANT || 'NAMMA_YATRI',
  nyCity: process.env.NY_CITY || 'std:080',
  // Dev-only: when true, the NY API client is replaced by an in-memory mock
  // (canned auth/places/estimates, no-op booking). No real calls, no dispatch.
  nyMock: /^(1|true|yes)$/i.test(process.env.NY_MOCK || ''),
  // TEST ONLY: if set, the flow engine routes EVERY user through this one NY session
  // token, skipping per-phone silent auth + OTP onboarding. Lets us exercise the real
  // booking flow with a known rider token. Refused in production (see boot guard below).
  nyFixedUserToken: process.env.NY_FIXED_USER_TOKEN || undefined,
  // Logs driver name/phone, OTP, and fare on every API call, so it defaults OFF in
  // production and ON in dev (local debugging). An explicit NY_LOG_BODIES always wins.
  nyLogBodies: process.env.NY_LOG_BODIES !== undefined
    ? /^(1|true|yes)$/i.test(process.env.NY_LOG_BODIES)
    : !IS_PROD,
  // Pretty-print NY request/response bodies in dev logs (indented + length-capped)
  // instead of one giant single-line JSON blob. Default on; set NY_LOG_PRETTY=0 for
  // compact single-line logs (better for prod log aggregators / grep).
  nyLogPretty: /^(1|true|yes)$/i.test(process.env.NY_LOG_PRETTY || 'true'),
  // Restrict the live WhatsApp flow to specific numbers while the pilot line is
  // private (it leaked). Defaults to the owner's number; everyone else gets a
  // "coming soon" reply. Override with ALLOWED_PHONES (comma-separated); set it
  // empty to reopen to all.
  allowedPhones: parseAllowedPhones(process.env.ALLOWED_PHONES),
  // Rollout flag for the location-only Flexi flow. Global default for the legacy
  // single merchant; override per-merchant via MERCHANT_{ID}_FLEXI_ENABLED.
  rideMode: GLOBAL_RIDE_MODE,
  flexiEnabled: GLOBAL_RIDE_MODE === 'flexi' || GLOBAL_RIDE_MODE === 'both',
  regularEnabled: GLOBAL_RIDE_MODE === 'regular' || GLOBAL_RIDE_MODE === 'both',
  // Geofence for the Flexi flow: pins farther than the radius from this served
  // city's center get an "outside service area" reply (E3). Unset = no geofence.
  flexiServiceArea: process.env.FLEXI_SERVICE_AREA || undefined,
  flexiServiceRadiusKm: process.env.FLEXI_SERVICE_RADIUS_KM ? parseFloat(process.env.FLEXI_SERVICE_RADIUS_KM) : undefined,
  // How-it-works intro video (sent once on first contact + in "More"). Unset → a
  // text placeholder is sent instead. Support number is a placeholder for now.
  flexiIntroVideoUrl: process.env.FLEXI_INTRO_VIDEO_URL || undefined,
  flexiSupportPhone: process.env.FLEXI_SUPPORT_PHONE || '+91 80000 00000',
  // Background ride-progress tracker: after a Flexi booking is confirmed, a
  // single timer polls each active ride and pushes arrived/started/ended updates
  // (NY has no rider push channel we can use, so we must poll). Default 12s poll,
  // give up on a ride after 3h (safety net for stuck/abandoned rides).
  flexiTrackEnabled: /^(1|true|yes)$/i.test(process.env.FLEXI_TRACK_ENABLED || 'true'),
  flexiTrackPollMs: Math.max(2000, Math.round((parseFloat(process.env.FLEXI_TRACK_POLL_SEC || '3') || 3) * 1000)),
  // Clamp to < 24h: WhatsApp rejects free-form messages outside the 24h
  // customer-service window, so watching a ride past that can't notify anyway.
  flexiTrackMaxAgeMs: Math.min(23 * 60 * 60 * 1000, Math.max(60000, Math.round((parseFloat(process.env.FLEXI_TRACK_MAX_AGE_MIN || '180') || 180) * 60000))),
};

// --- Production safety guards (fail fast at boot) ---
// NY_MOCK swaps the real Namma Yatri client for an in-memory stub (no real
// bookings, no dispatch) — never acceptable in production.
if (IS_PROD && config.nyMock) {
  throw new Error(
    '[config] NY_MOCK must not be enabled in production — it replaces the real Namma Yatri client ' +
    'with an in-memory stub (no real bookings). Unset NY_MOCK.',
  );
}
// WHATSAPP_SKIP_VERIFY is already forced false in prod (see above); tell the operator it was ignored.
if (IS_PROD && /^(1|true|yes)$/i.test(process.env.WHATSAPP_SKIP_VERIFY || '')) {
  console.warn('[config] WHATSAPP_SKIP_VERIFY is set but IGNORED in production — inbound webhook signature verification stays ON.');
}
// NY_FIXED_USER_TOKEN routes ALL riders through ONE shared NY account — a test-only
// shortcut that must never reach production (it would conflate every rider's bookings,
// history, and safety events into a single account).
if (config.nyFixedUserToken && IS_PROD) {
  throw new Error(
    '[config] NY_FIXED_USER_TOKEN must not be set in production — it routes every rider through a ' +
    'single shared NY session token (no per-user auth). Unset it before deploying to prod.',
  );
}
if (config.nyFixedUserToken) {
  console.warn(
    '⚠️  [config] TEST MODE: NY_FIXED_USER_TOKEN is set — EVERY user is routed through one fixed NY ' +
    'session token; silent auth + OTP onboarding are skipped. Never use this in production.',
  );
}

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
    // Explicit per-merchant RIDE_MODE / legacy FLEXI_ENABLED. Only inherit the
    // global mode when the merchant sets NEITHER, so an explicit
    // MERCHANT_x_FLEXI_ENABLED=false still forces "neither" (exact back-compat).
    const rmOverride = process.env[`${p}RIDE_MODE`] !== undefined || process.env[`${p}FLEXI_ENABLED`] !== undefined;
    const rm = rmOverride ? resolveRideMode(process.env[`${p}RIDE_MODE`], process.env[`${p}FLEXI_ENABLED`]) : config.rideMode;
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
      rideMode: rm,
      flexiEnabled: rm === 'flexi' || rm === 'both',
      regularEnabled: rm === 'regular' || rm === 'both',
      flexiServiceArea: process.env[`${p}FLEXI_SERVICE_AREA`] || config.flexiServiceArea,
      flexiServiceRadiusKm: process.env[`${p}FLEXI_SERVICE_RADIUS_KM`] ? parseFloat(process.env[`${p}FLEXI_SERVICE_RADIUS_KM`] as string) : config.flexiServiceRadiusKm,
      flexiIntroVideoUrl: process.env[`${p}FLEXI_INTRO_VIDEO_URL`] || config.flexiIntroVideoUrl,
      flexiSupportPhone: process.env[`${p}FLEXI_SUPPORT_PHONE`] || config.flexiSupportPhone,
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
      rideMode: config.rideMode,
      flexiEnabled: config.flexiEnabled,
      regularEnabled: config.regularEnabled,
      flexiServiceArea: config.flexiServiceArea,
      flexiServiceRadiusKm: config.flexiServiceRadiusKm,
      flexiIntroVideoUrl: config.flexiIntroVideoUrl,
      flexiSupportPhone: config.flexiSupportPhone,
    };
    merchantsById.set('default', fallback);
    merchantsByPhoneNumberId.set(config.whatsappPhoneNumberId, fallback);
  }

  console.log(`[config] Loaded ${merchantsById.size} merchant(s): ${[...merchantsById.keys()].join(', ')}`);

  // Every supported merchant must offer at least one ride type (Flexi and/or
  // Regular). A merchant with neither is an unsupported config now that the
  // classic flow is gone — surface it loudly at boot rather than dead-ending a
  // rider mid-flow.
  const misconfigured = [...merchantsById.values()].filter((m) => !m.flexiEnabled && !m.regularEnabled);
  if (misconfigured.length) {
    console.error(
      `[config] ⚠️  ${misconfigured.length} merchant(s) offer NEITHER Flexi nor Regular ` +
      `(${misconfigured.map((m) => m.id).join(', ')}). Set RIDE_MODE / MERCHANT_{id}_RIDE_MODE ` +
      `to flexi | regular | both — these merchants cannot serve any booking.`,
    );
  }
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
