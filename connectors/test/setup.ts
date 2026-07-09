// Deterministic environment for the characterization harness.
//
// This runs as a Vitest `setupFile`, BEFORE any app module is imported — which
// matters because `src/config.ts` reads process.env exactly once at load and
// builds the merchant registry then. Everything here must be plain env writes
// with NO app imports.

// Mock NY client (canned auth/places/estimates/quotes, no dispatch), quiet logs.
process.env.NY_MOCK = '1';
process.env.NY_LOG_BODIES = '0';
process.env.NY_LOG_PRETTY = '0';
process.env.SESSION_TTL_SECONDS = '1800';

// No Redis → memory stores (the harness also injects Memory* directly).
delete process.env.REDIS_URL;
delete process.env.REDIS_MODE;
delete process.env.REDIS_CLUSTER_NODES;

// Global flexi defaults, inherited by every merchant that doesn't override them.
process.env.FLEXI_SERVICE_AREA = 'Tumkur';
process.env.FLEXI_SERVICE_RADIUS_KM = '15';
process.env.FLEXI_INTRO_VIDEO_URL = 'https://videos.example/intro.mp4';
process.env.FLEXI_SUPPORT_PHONE = '+91 90000 12345';
process.env.FLEXI_TRACK_ENABLED = 'false'; // the harness drives the tracker manually

// WhatsApp creds (unused by the fake connector, but read at config load).
process.env.WHATSAPP_APP_SECRET = 'test-secret';
process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'pn_default';
process.env.WHATSAPP_VERIFY_TOKEN = 'verify-token';

// Three merchants covering every rideMode: flexi-only, regular-only, both.
process.env.MERCHANT_FLEXI_WHATSAPP_PHONE_NUMBER_ID = 'pn_flexi';
process.env.MERCHANT_FLEXI_WHATSAPP_ACCESS_TOKEN = 'tok_flexi';
process.env.MERCHANT_FLEXI_RIDE_MODE = 'flexi';

process.env.MERCHANT_REG_WHATSAPP_PHONE_NUMBER_ID = 'pn_reg';
process.env.MERCHANT_REG_WHATSAPP_ACCESS_TOKEN = 'tok_reg';
process.env.MERCHANT_REG_RIDE_MODE = 'regular';

process.env.MERCHANT_BOTH_WHATSAPP_PHONE_NUMBER_ID = 'pn_both';
process.env.MERCHANT_BOTH_WHATSAPP_ACCESS_TOKEN = 'tok_both';
process.env.MERCHANT_BOTH_RIDE_MODE = 'both';

// Allowlist gate: every test sender EXCEPT the dedicated blocked one (9999999999).
// Note: 9100000999 contains "00000", which the mock treats as a NEW user.
process.env.ALLOWED_PHONES = '9361176218,9812345678,7411122233,9100000999';
