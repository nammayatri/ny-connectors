/**
 * Token Store - Backward-compatible wrapper around token-storage
 * 
 * This module provides backward compatibility with the existing TokenStore interface
 * while using the new TokenStorage implementation internally.
 * 
 * @deprecated Use `import { tokenStorage } from '../utils/token-storage.js'` instead
 */

import {
  TokenStorage,
  tokenStorage,
  type TokenData,
  type SavedLocation,
} from '../utils/token-storage.js';

// Re-export types for backward compatibility
export type { TokenData, SavedLocation };

/**
 * Legacy TokenStore class
 * 
 * @deprecated Use TokenStorage from '../utils/token-storage.js' instead
 */
export class TokenStore {
  private storage: TokenStorage;

  constructor() {
    this.storage = tokenStorage;
  }

  async ensureDir(): Promise<void> {
    // No-op - handled internally by TokenStorage
  }

  async hasToken(): Promise<boolean> {
    return this.storage.isValid();
  }

  async getToken(): Promise<string | null> {
    return this.storage.getToken();
  }

  async getTokenData(): Promise<TokenData | null> {
    return this.storage.load();
  }

  async saveToken(token: string, savedLocations: SavedLocation[] = []): Promise<void> {
    return this.storage.save(token, { savedLocations });
  }

  async updateSavedLocations(locations: SavedLocation[]): Promise<void> {
    return this.storage.updateSavedLocations(locations);
  }

  async getSavedLocations(): Promise<SavedLocation[]> {
    return this.storage.getSavedLocations();
  }

  async clearToken(): Promise<void> {
    return this.storage.delete();
  }
}

// Default export for backward compatibility
export default TokenStore;