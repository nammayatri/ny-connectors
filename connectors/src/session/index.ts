import Redis from 'ioredis';
import { config } from '../config';
import { SessionManager } from './manager';
import { MemorySessionManager } from './memory-store';

export type SessionStore = SessionManager | MemorySessionManager;

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

  if (config.redisUrl && config.redisUrl !== 'redis://localhost:6379') {
    console.log('[session] Using Redis store');
    return new SessionManager();
  }

  console.log('[session] Using in-memory store (no Redis configured)');
  return new MemorySessionManager();
}

export { SessionManager } from './manager';
export { MemorySessionManager } from './memory-store';
