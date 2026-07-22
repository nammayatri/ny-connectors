import { createRedisClient, RedisClient } from './redis-client';

// ---------------------------------------------------------------------------
// MessageDedup — at-most-once processing of inbound webhook messages.
//
// The WhatsApp Cloud API delivers webhooks AT LEAST ONCE, so the same message id
// can arrive more than once (and, across replicas, concurrently). Without dedup a
// redelivered "Confirm pickup" re-runs the booking → a duplicate ride/driver.
// `claim(id)` is atomic (Redis SET NX): the first caller for an id gets `true`
// (process it); any later caller within the TTL gets `false` (drop it).
// ---------------------------------------------------------------------------

export interface MessageDedup {
  /** True if `messageId` is newly claimed (process it); false if already seen (drop). */
  claim(messageId: string): Promise<boolean>;
  disconnect(): Promise<void>;
}

const key = (id: string) => `msgseen:${id}`;
// A redelivery window comfortably longer than a message takes to process.
const TTL_SECONDS = 300;

export class RedisMessageDedup implements MessageDedup {
  private redis: RedisClient;

  constructor() {
    this.redis = createRedisClient();
    this.redis.on('error', (err: Error) => console.error('[msg-dedup] Redis error:', err.message));
  }

  async claim(messageId: string): Promise<boolean> {
    // SET key 1 EX ttl NX → 'OK' only if the key did not already exist.
    const res = await this.redis.set(key(messageId), '1', 'EX', TTL_SECONDS, 'NX');
    return res === 'OK';
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

// In-memory fallback for dev / single process. Fine within one process; a
// multi-replica prod MUST use Redis so a redelivery to another pod is also caught
// (createMessageDedup enforces that via requireRedisInProd).
export class MemoryMessageDedup implements MessageDedup {
  private seen = new Map<string, number>(); // id → expiry (ms)

  async claim(messageId: string): Promise<boolean> {
    const now = Date.now();
    // Opportunistic prune so the map can't grow unbounded for the process lifetime.
    if (this.seen.size > 1000) {
      for (const [id, exp] of this.seen) if (exp <= now) this.seen.delete(id);
    }
    const exp = this.seen.get(messageId);
    if (exp != null && exp > now) return false;
    this.seen.set(messageId, now + TTL_SECONDS * 1000);
    return true;
  }

  async disconnect(): Promise<void> {
    this.seen.clear();
  }
}
