import Redis from 'ioredis';
import { config } from '../config';
import { SessionManager } from './manager';
import { MemorySessionManager } from './memory-store';
import { TokenStore, RedisTokenStore, MemoryTokenStore } from './token-store';

export type SessionStore = SessionManager | MemorySessionManager;

function isRedisConfigured(): boolean {
  if (config.redisMode === 'cluster') return config.redisClusterNodes.length > 0;
  return !!config.redisUrl && config.redisUrl !== 'redis://localhost:6379';
}

export function createSessionManager(): SessionStore {
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
  if (isRedisConfigured()) {
    console.log('[token-store] Using Redis store');
    return new RedisTokenStore();
  }
  console.log('[token-store] Using in-memory store (no Redis configured)');
  return new MemoryTokenStore();
}

export { SessionManager } from './manager';
export { MemorySessionManager } from './memory-store';
export { TokenStore, RedisTokenStore, MemoryTokenStore } from './token-store';
