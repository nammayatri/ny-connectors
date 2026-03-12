import crypto from 'crypto';
import { MessageSource } from '../connectors/types';
import { config } from '../config';

export interface Session {
  sessionId: string;
  source: MessageSource;
  userId: string;
  createdAt: string;
  lastActiveAt: string;
  messageCount: number;
  metadata: any;
  expiresAt: number;
}

const SESSION_PREFIX = 'session:';

export class MemorySessionManager {
  private store = new Map<string, Session>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired sessions every 60s
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async resolveSession(source: MessageSource, userId: string): Promise<Session> {
    const key = `${SESSION_PREFIX}${source}:${userId}`;
    const existing = this.store.get(key);
    const now = Date.now();

    if (existing && existing.expiresAt > now) {
      existing.lastActiveAt = new Date().toISOString();
      existing.messageCount += 1;
      existing.expiresAt = now + config.sessionTtlSeconds * 1000;
      return existing;
    }

    const session: Session = {
      sessionId: crypto.randomUUID(),
      source,
      userId,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      messageCount: 1,
      metadata: {},
      expiresAt: now + config.sessionTtlSeconds * 1000,
    };

    this.store.set(key, session);
    console.log(`[session:mem] New session ${session.sessionId} for ${source}:${userId}`);
    return session;
  }

  async getSession(source: MessageSource, userId: string): Promise<Session | null> {
    const key = `${SESSION_PREFIX}${source}:${userId}`;
    const session = this.store.get(key);
    if (!session || session.expiresAt < Date.now()) return null;
    return session;
  }

  async updateContext(source: MessageSource, userId: string, context: any): Promise<void> {
    const key = `${SESSION_PREFIX}${source}:${userId}`;
    const session = this.store.get(key);
    if (!session) return;
    session.metadata = context;
    session.lastActiveAt = new Date().toISOString();
    session.expiresAt = Date.now() + config.sessionTtlSeconds * 1000;
  }

  async deleteSession(source: MessageSource, userId: string): Promise<void> {
    const key = `${SESSION_PREFIX}${source}:${userId}`;
    this.store.delete(key);
  }

  async disconnect(): Promise<void> {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, session] of this.store) {
      if (session.expiresAt < now) this.store.delete(key);
    }
  }
}
