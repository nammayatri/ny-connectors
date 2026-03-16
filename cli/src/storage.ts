// ============================================================================
// Token & State Storage
// Handles persistence of auth tokens and app state
// ============================================================================

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { SavedLocation } from './types.js';

const TOKEN_DIR = join(homedir(), '.namma-yatri');
const TOKEN_FILE = join(TOKEN_DIR, 'token.json');

export interface StoredToken {
  token: string;
  savedAt: string;
  personId?: string;
  personName?: string;
  savedLocations: SavedLocation[];
  savedLocationsUpdatedAt?: string;
}

export class TokenStorage {
  static async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(TOKEN_DIR, { recursive: true, mode: 0o700 });
    } catch (error) {
      // Directory might already exist
    }
  }

  static async saveToken(data: StoredToken): Promise<void> {
    await TokenStorage.ensureDir();
    await fs.writeFile(
      TOKEN_FILE,
      JSON.stringify(data, null, 2),
      { mode: 0o600 }
    );
  }

  static async loadToken(): Promise<StoredToken | null> {
    try {
      const content = await fs.readFile(TOKEN_FILE, 'utf-8');
      return JSON.parse(content) as StoredToken;
    } catch (error) {
      return null;
    }
  }

  static async clearToken(): Promise<void> {
    try {
      await fs.unlink(TOKEN_FILE);
    } catch (error) {
      // File might not exist
    }
  }

  static async updateSavedLocations(savedLocations: SavedLocation[]): Promise<void> {
    const token = await TokenStorage.loadToken();
    if (token) {
      token.savedLocations = savedLocations;
      token.savedLocationsUpdatedAt = new Date().toISOString();
      await TokenStorage.saveToken(token);
    }
  }

  static async isTokenValid(): Promise<boolean> {
    const token = await TokenStorage.loadToken();
    if (!token) return false;

    // Check if token is older than 30 days (optional expiry check)
    const savedAt = new Date(token.savedAt);
    const now = new Date();
    const daysDiff = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60 * 24);

    // Tokens older than 30 days might be expired
    return daysDiff < 30;
  }
}

export default TokenStorage;
