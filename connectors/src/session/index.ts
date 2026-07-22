import Redis from 'ioredis';
import { config } from '../config';
import { SessionManager } from './manager';
import { MemorySessionManager } from './memory-store';
import { TokenStore, RedisTokenStore, MemoryTokenStore } from './token-store';
import { RideRegistry, RedisRideRegistry, MemoryRideRegistry } from './ride-registry';
import { MessageDedup, RedisMessageDedup, MemoryMessageDedup } from './dedup';

export type SessionStore = SessionManager | MemorySessionManager;

function isRedisConfigured(): boolean {
  if (config.redisMode === 'cluster') return config.redisClusterNodes.length > 0;
  // Presence-based: an explicitly-set REDIS_URL (any value) opts into Redis. We
  // deliberately do NOT treat the localhost default as "unconfigured" — that would
  // wrongly lock out an operator who really did set REDIS_URL=redis://localhost.
  return config.redisConfigured;
}

// In production the connector runs multiple replicas AND a durable background
// ride-tracker. In-memory stores would split session/token/ride-registry state
// across pods and lose active-ride tracking on restart, so Redis is mandatory —
// fail fast at boot rather than silently degrade.
function requireRedisInProd(): void {
  if (config.isProd && !isRedisConfigured()) {
    throw new Error(
      '[session] REDIS_URL (or REDIS_CLUSTER_NODES) is required in production. ' +
      'Without it, sessions/tokens/ride-registry are per-pod in-memory and the ride ' +
      'tracker splits across replicas / loses state on restart. Configure Redis and redeploy.',
    );
  }
}

export function createSessionManager(): SessionStore {
  requireRedisInProd();
  // Try Redis, fallback to in-memory
  try {
    const redis = new Redis(config.redisUrl, {
      lazyConnect: true,
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
    });

    // Test connection synchronously isn't possible, so we return Redis manager
    // but wrap it with a fallback check
    redis.disconnect();
  } catch {
    // ignore
  }

  if (isRedisConfigured()) {
    console.log('[session] Using Redis store');
    return new SessionManager();
  }

  console.log('[session] Using in-memory store (no Redis configured)');
  return new MemorySessionManager();
}

export function createTokenStore(): TokenStore {
  requireRedisInProd();
  if (isRedisConfigured()) {
    console.log('[token-store] Using Redis store');
    return new RedisTokenStore();
  }
  console.log('[token-store] Using in-memory store (no Redis configured)');
  return new MemoryTokenStore();
}

export function createRideRegistry(): RideRegistry {
  requireRedisInProd();
  if (isRedisConfigured()) {
    console.log('[ride-registry] Using Redis store');
    return new RedisRideRegistry();
  }
  console.log('[ride-registry] Using in-memory store (no Redis configured)');
  return new MemoryRideRegistry();
}

export function createMessageDedup(): MessageDedup {
  requireRedisInProd();
  if (isRedisConfigured()) {
    console.log('[msg-dedup] Using Redis store');
    return new RedisMessageDedup();
  }
  console.log('[msg-dedup] Using in-memory store (no Redis configured)');
  return new MemoryMessageDedup();
}

export { MessageDedup, RedisMessageDedup, MemoryMessageDedup } from './dedup';
export { SessionManager } from './manager';
export { MemorySessionManager } from './memory-store';
export { TokenStore, RedisTokenStore, MemoryTokenStore } from './token-store';
export { RideRegistry, ActiveRide, TrackStage, RedisRideRegistry, MemoryRideRegistry } from './ride-registry';
