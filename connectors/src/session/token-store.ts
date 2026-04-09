import { SupportedLanguage } from '../i18n';
import { createRedisClient, RedisClient } from './redis-client';

export interface UserAuth {
  nyToken: string;
  personId?: string;
  phone: string;
  savedLocations?: any[];
  authenticatedAt: string;
  language?: SupportedLanguage;
}

export interface TokenStore {
  get(userId: string): Promise<UserAuth | null>;
  set(userId: string, auth: UserAuth): Promise<void>;
  updateLocations(userId: string, locations: any[]): Promise<void>;
  updateLanguage(userId: string, language: SupportedLanguage): Promise<void>;
  getLanguage(userId: string): Promise<SupportedLanguage | undefined>;
  delete(userId: string): Promise<void>;
  disconnect(): Promise<void>;
}

const TOKEN_PREFIX = 'usertoken:';

export class RedisTokenStore implements TokenStore {
  private redis: RedisClient;

  constructor() {
    this.redis = createRedisClient();
    this.redis.on('error', (err: Error) => {
      console.error('[token-store] Redis error:', err.message);
    });
  }

  async get(userId: string): Promise<UserAuth | null> {
    const data = await this.redis.get(`${TOKEN_PREFIX}${userId}`);
    return data ? (JSON.parse(data) as UserAuth) : null;
  }

  async set(userId: string, auth: UserAuth): Promise<void> {
    await this.redis.set(`${TOKEN_PREFIX}${userId}`, JSON.stringify(auth));
  }

  async updateLocations(userId: string, locations: any[]): Promise<void> {
    const existing = await this.get(userId);
    if (!existing) return;
    existing.savedLocations = locations;
    await this.set(userId, existing);
  }

  async updateLanguage(userId: string, language: SupportedLanguage): Promise<void> {
    const existing = await this.get(userId);
    if (!existing) return;
    existing.language = language;
    await this.set(userId, existing);
  }

  async getLanguage(userId: string): Promise<SupportedLanguage | undefined> {
    const existing = await this.get(userId);
    return existing?.language;
  }

  async delete(userId: string): Promise<void> {
    await this.redis.del(`${TOKEN_PREFIX}${userId}`);
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

// In-memory fallback for dev/no-redis environments. Not persisted across restarts.
export class MemoryTokenStore implements TokenStore {
  private tokens = new Map<string, UserAuth>();

  async get(userId: string): Promise<UserAuth | null> {
    return this.tokens.get(userId) || null;
  }

  async set(userId: string, auth: UserAuth): Promise<void> {
    this.tokens.set(userId, auth);
  }

  async updateLocations(userId: string, locations: any[]): Promise<void> {
    const existing = this.tokens.get(userId);
    if (!existing) return;
    existing.savedLocations = locations;
  }

  async updateLanguage(userId: string, language: SupportedLanguage): Promise<void> {
    const existing = this.tokens.get(userId);
    if (!existing) return;
    existing.language = language;
  }

  async getLanguage(userId: string): Promise<SupportedLanguage | undefined> {
    return this.tokens.get(userId)?.language;
  }

  async delete(userId: string): Promise<void> {
    this.tokens.delete(userId);
  }

  async disconnect(): Promise<void> {
    this.tokens.clear();
  }
}
