import { config } from '../config';
import { SupportedLanguage } from '../i18n';
import { MessageSource } from '../connectors/types';
import { createRedisClient, RedisClient } from './redis-client';

// ---------------------------------------------------------------------------
// RideRegistry — a durable index of Flexi bookings that still need watching.
//
// The Flexi flow confirms a booking inside a webhook-triggered async task, but
// the interesting transitions (driver arrived → ride started → ride ended) all
// happen minutes later with NO inbound WhatsApp message to hang work on. The
// RideTracker (a single recurring timer) polls each registered ride and pushes
// updates. This registry is what lets that timer survive a restart: on boot it
// re-reads the registry and keeps watching in-flight rides.
//
// Storage (Redis, keys auto-prefixed by REDIS_KEY_PREFIX):
//   activerides                        → SET of bookingIds still being watched
//   activeride:{bookingId}             → JSON ActiveRide (TTL = maxAge)
//   activeride:sent:{bookingId}:{stage}→ NX claim key so a stage notifies once
// ---------------------------------------------------------------------------

// The last progress stage we have already NOTIFIED the rider about. 'confirmed'
// is the initial state (booking made, driver not yet assigned). Terminal stages
// (completed / cancelled) are never stored — the entry is removed instead.
export type TrackStage = 'confirmed' | 'assigned' | 'arrived' | 'started';

export interface ActiveRide {
  bookingId: string;
  source: MessageSource;
  userKey: string;          // token-store key: "{source}:{merchantId}:{senderId}"
  sessionUserId: string;    // session key part: "{merchantId}:{senderId}"
  chatId: string;           // WhatsApp reply target (the rider's phone)
  phoneNumberId?: string;   // resolves the MerchantConfig for sending
  merchantId?: string;
  language?: SupportedLanguage;
  lastStage: TrackStage;    // highest stage already messaged to the rider
  createdAt: string;        // ISO — for max-age cleanup
}

export interface RideRegistry {
  register(ride: ActiveRide): Promise<void>;
  list(): Promise<ActiveRide[]>;
  update(bookingId: string, patch: Partial<ActiveRide>): Promise<void>;
  remove(bookingId: string): Promise<void>;
  /** Fetch a single tracked ride by bookingId (null if not tracked). Used to
   *  verify a rider owns a booking before revealing its end OTP. */
  get(bookingId: string): Promise<ActiveRide | null>;
  /** Atomically claim the right to notify `stage` for `bookingId`.
   *  Returns true exactly once per (booking, stage) across all pollers. */
  claimStage(bookingId: string, stage: string): Promise<boolean>;
  /** Release a previously-claimed stage so it can be re-claimed and retried
   *  (used when the WhatsApp send failed, so the update isn't lost). */
  releaseStage(bookingId: string, stage: string): Promise<void>;
  disconnect(): Promise<void>;
}

const INDEX_KEY = 'activerides';
const entryKey = (id: string) => `activeride:${id}`;
const claimKey = (id: string, stage: string) => `activeride:sent:${id}:${stage}`;

function ttlSeconds(): number {
  return Math.max(60, Math.round(config.flexiTrackMaxAgeMs / 1000));
}

export class RedisRideRegistry implements RideRegistry {
  private redis: RedisClient;

  constructor() {
    this.redis = createRedisClient();
    this.redis.on('error', (err: Error) => {
      console.error('[ride-registry] Redis error:', err.message);
    });
  }

  async register(ride: ActiveRide): Promise<void> {
    await this.redis.set(entryKey(ride.bookingId), JSON.stringify(ride), 'EX', ttlSeconds());
    await this.redis.sadd(INDEX_KEY, ride.bookingId);
  }

  async list(): Promise<ActiveRide[]> {
    const ids = await this.redis.smembers(INDEX_KEY);
    if (!ids.length) return [];
    const out: ActiveRide[] = [];
    for (const id of ids) {
      const data = await this.redis.get(entryKey(id));
      if (!data) {
        // Entry expired (TTL) but the index still references it — prune.
        await this.redis.srem(INDEX_KEY, id);
        continue;
      }
      try {
        out.push(JSON.parse(data) as ActiveRide);
      } catch {
        await this.redis.srem(INDEX_KEY, id);
      }
    }
    return out;
  }

  async update(bookingId: string, patch: Partial<ActiveRide>): Promise<void> {
    const data = await this.redis.get(entryKey(bookingId));
    if (!data) return;
    const merged = { ...(JSON.parse(data) as ActiveRide), ...patch };
    await this.redis.set(entryKey(bookingId), JSON.stringify(merged), 'EX', ttlSeconds());
  }

  async remove(bookingId: string): Promise<void> {
    await this.redis.srem(INDEX_KEY, bookingId);
    await this.redis.del(entryKey(bookingId));
  }

  async get(bookingId: string): Promise<ActiveRide | null> {
    const data = await this.redis.get(entryKey(bookingId));
    return data ? (JSON.parse(data) as ActiveRide) : null;
  }

  async claimStage(bookingId: string, stage: string): Promise<boolean> {
    const res = await this.redis.set(claimKey(bookingId, stage), '1', 'EX', ttlSeconds(), 'NX');
    return res === 'OK';
  }

  async releaseStage(bookingId: string, stage: string): Promise<void> {
    await this.redis.del(claimKey(bookingId, stage));
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

// In-memory fallback for dev / no-Redis. Survives for the process lifetime only
// (which is enough to walk the whole flow locally with NY_MOCK). Enforces
// max-age in list() since there is no Redis TTL to expire entries.
export class MemoryRideRegistry implements RideRegistry {
  private rides = new Map<string, ActiveRide>();
  private claims = new Set<string>();

  async register(ride: ActiveRide): Promise<void> {
    this.rides.set(ride.bookingId, ride);
  }

  async list(): Promise<ActiveRide[]> {
    const cutoff = Date.now() - config.flexiTrackMaxAgeMs;
    const out: ActiveRide[] = [];
    for (const [id, ride] of this.rides) {
      if (new Date(ride.createdAt).getTime() < cutoff) {
        this.rides.delete(id);
        continue;
      }
      out.push(ride);
    }
    return out;
  }

  async update(bookingId: string, patch: Partial<ActiveRide>): Promise<void> {
    const existing = this.rides.get(bookingId);
    if (!existing) return;
    this.rides.set(bookingId, { ...existing, ...patch });
  }

  async remove(bookingId: string): Promise<void> {
    this.rides.delete(bookingId);
    // Prune this booking's claim keys so the set doesn't grow for the process life.
    for (const key of this.claims) {
      if (key.startsWith(`${bookingId}:`)) this.claims.delete(key);
    }
  }

  async get(bookingId: string): Promise<ActiveRide | null> {
    return this.rides.get(bookingId) ?? null;
  }

  async claimStage(bookingId: string, stage: string): Promise<boolean> {
    const key = `${bookingId}:${stage}`;
    if (this.claims.has(key)) return false;
    this.claims.add(key);
    return true;
  }

  async releaseStage(bookingId: string, stage: string): Promise<void> {
    this.claims.delete(`${bookingId}:${stage}`);
  }

  async disconnect(): Promise<void> {
    this.rides.clear();
    this.claims.clear();
  }
}
