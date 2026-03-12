import fs from 'fs';
import path from 'path';

interface UserAuth {
  nyToken: string;
  phone: string;
  savedLocations?: any[];
  authenticatedAt: string;
}

const TOKEN_FILE = path.join(process.env.TOKEN_STORE_PATH || '.', 'user-tokens.json');

export class TokenStore {
  private tokens: Record<string, UserAuth> = {};

  constructor() {
    this.load();
  }

  get(userId: string): UserAuth | null {
    return this.tokens[userId] || null;
  }

  set(userId: string, auth: UserAuth): void {
    this.tokens[userId] = auth;
    this.save();
  }

  updateLocations(userId: string, locations: any[]): void {
    if (this.tokens[userId]) {
      this.tokens[userId].savedLocations = locations;
      this.save();
    }
  }

  delete(userId: string): void {
    delete this.tokens[userId];
    this.save();
  }

  private load(): void {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        this.tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
        console.log(`[token-store] Loaded ${Object.keys(this.tokens).length} user tokens`);
      }
    } catch (err: any) {
      console.error('[token-store] Failed to load:', err.message);
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(this.tokens, null, 2));
    } catch (err: any) {
      console.error('[token-store] Failed to save:', err.message);
    }
  }
}
