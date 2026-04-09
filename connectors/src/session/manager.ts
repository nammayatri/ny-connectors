import crypto from 'crypto';
import { config } from '../config';
import { MessageSource } from '../connectors/types';
import { createRedisClient, RedisClient } from './redis-client';

export interface Session {
  sessionId: string;
  source: MessageSource;
  userId: string;
  createdAt: string;
  lastActiveAt: string;
  messageCount: number;
  metadata: Record<string, unknown>;
}

const SESSION_PREFIX = 'session:';

export class SessionManager {
  private redis: RedisClient;

  constructor() {
    this.redis = createRedisClient();
    this.redis.on('error', (err: Error) => {
      console.error('[session] Redis error:', err.message);
    });
  }

  async resolveSession(source: MessageSource, userId: string): Promise<Session> {
    const key = `${SESSION_PREFIX}${source}:${userId}`;
    const existing = await this.redis.get(key);

    if (existing) {
      const session: Session = JSON.parse(existing);
      session.lastActiveAt = new Date().toISOString();
      session.messageCount += 1;
      await this.redis.set(key, JSON.stringify(session), 'EX', config.sessionTtlSeconds);
      return session;
    }

    const session: Session = {
      sessionId: crypto.randomUUID(),
      source,
      userId,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      messageCount: 1,
      metadata: {},
    };

    await this.redis.set(key, JSON.stringify(session), 'EX', config.sessionTtlSeconds);
    console.log(`[session] New session ${session.sessionId} for ${source}:${userId}`);
    return session;
  }

  async getSession(source: MessageSource, userId: string): Promise<Session | null> {
    const key = `${SESSION_PREFIX}${source}:${userId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async updateContext(source: MessageSource, userId: string, context: any): Promise<void> {
    const key = `${SESSION_PREFIX}${source}:${userId}`;
    const data = await this.redis.get(key);
    if (!data) return;

    const session: Session = JSON.parse(data);
    session.metadata = context;
    session.lastActiveAt = new Date().toISOString();
    await this.redis.set(key, JSON.stringify(session), 'EX', config.sessionTtlSeconds);
  }

  async deleteSession(source: MessageSource, userId: string): Promise<void> {
    const key = `${SESSION_PREFIX}${source}:${userId}`;
    await this.redis.del(key);
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
