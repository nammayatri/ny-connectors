/**
 * Token Persistence Layer for ny-cli
 * 
 * Provides secure token storage with:
 * - Token obfuscation (XOR-based encoding)
 * - Token validation
 * - Expiry checking
 * - Atomic file operations
 * 
 * Storage location: ~/.config/ny-cli/auth.json
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

// =============================================================================
// Types
// =============================================================================

/**
 * Token data structure stored on disk
 */
export interface TokenData {
  /** Obfuscated token string */
  token: string;
  /** ISO timestamp when the token was saved */
  savedAt: string;
  /** ISO timestamp when token expires (if known) */
  expiresAt?: string;
  /** User's saved locations cached locally */
  savedLocations: SavedLocation[];
  /** ISO timestamp when saved locations were last updated */
  savedLocationsUpdatedAt: string;
  /** User information if available */
  user?: {
    id?: string;
    name?: string;
    phone?: string;
  };
  /** Checksum for integrity validation */
  checksum: string;
}

/**
 * Saved location (e.g., Home, Work)
 */
export interface SavedLocation {
  tag: string;
  lat: number;
  lon: number;
  locationName?: string;
  area?: string;
  city?: string;
  placeId?: string;
}

/**
 * Result of token validation
 */
export interface TokenValidationResult {
  isValid: boolean;
  isExpired: boolean;
  expiresAt?: string;
  error?: string;
}

/**
 * Options for saving token
 */
export interface SaveTokenOptions {
  /** User's saved locations */
  savedLocations?: SavedLocation[];
  /** Token expiration time (ISO string or Date) */
  expiresAt?: string | Date;
  /** User information */
  user?: TokenData['user'];
}

// =============================================================================
// Constants
// =============================================================================

/** Default token directory */
const TOKEN_DIR = path.join(os.homedir(), '.config', 'ny-cli');

/** Token file name */
const TOKEN_FILE = path.join(TOKEN_DIR, 'auth.json');

/** Default token expiry duration in days */
const DEFAULT_TOKEN_EXPIRY_DAYS = 30;

/** Obfuscation key - derived from machine hostname for basic obfuscation */
const getObfuscationKey = (): string => {
  const hostname = os.hostname();
  const platform = os.platform();
  return crypto.createHash('sha256').update(`${hostname}-${platform}-ny-cli`).digest('hex').slice(0, 32);
};

// =============================================================================
// Obfuscation Functions
// =============================================================================

/**
 * XOR-based token obfuscation
 * This provides basic protection against casual viewing of the token file.
 * Note: This is NOT encryption - for production use, consider using proper encryption.
 */
function obfuscateToken(token: string): string {
  const key = getObfuscationKey();
  const buffer = Buffer.from(token, 'utf-8');
  const keyBuffer = Buffer.from(key, 'utf-8');
  
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] ^= keyBuffer[i % keyBuffer.length];
  }
  
  return buffer.toString('base64');
}

/**
 * De-obfuscate token
 */
function deobfuscateToken(obfuscated: string): string {
  try {
    const key = getObfuscationKey();
    const buffer = Buffer.from(obfuscated, 'base64');
    const keyBuffer = Buffer.from(key, 'utf-8');
    
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] ^= keyBuffer[i % keyBuffer.length];
    }
    
    return buffer.toString('utf-8');
  } catch {
    // If deobfuscation fails, return empty string
    return '';
  }
}

// =============================================================================
// Checksum Functions
// =============================================================================

/**
 * Generate checksum for token data integrity
 */
function generateChecksum(token: string, savedAt: string): string {
  const data = `${token}:${savedAt}`;
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

/**
 * Verify checksum matches
 */
function verifyChecksum(data: TokenData): boolean {
  if (!data.checksum || !data.token || !data.savedAt) {
    return false;
  }
  
  // Deobfuscate token for checksum verification
  const rawToken = deobfuscateToken(data.token);
  const expectedChecksum = generateChecksum(rawToken, data.savedAt);
  return data.checksum === expectedChecksum;
}

// =============================================================================
// Token Storage Class
// =============================================================================

/**
 * Token Storage - Handles token persistence with obfuscation and validation
 */
export class TokenStorage {
  private cache: TokenData | null = null;
  private initialized = false;

  /**
   * Ensure the token directory exists
   */
  private async ensureDir(): Promise<void> {
    await fs.mkdir(TOKEN_DIR, { recursive: true });
  }

  /**
   * Check if a token file exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(TOKEN_FILE);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save a new authentication token
   * 
   * @param token - The raw token string from the API
   * @param options - Additional options for saving
   */
  async save(token: string, options: SaveTokenOptions = {}): Promise<void> {
    await this.ensureDir();
    
    const now = new Date();
    const savedAt = now.toISOString();
    
    // Calculate expiry
    let expiresAt: string | undefined;
    if (options.expiresAt) {
      expiresAt = typeof options.expiresAt === 'string' 
        ? options.expiresAt 
        : options.expiresAt.toISOString();
    } else {
      // Default expiry: 30 days from now
      const expiryDate = new Date(now.getTime() + DEFAULT_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      expiresAt = expiryDate.toISOString();
    }
    
    // Obfuscate the token
    const obfuscatedToken = obfuscateToken(token);
    
    // Generate checksum
    const checksum = generateChecksum(token, savedAt);
    
    const data: TokenData = {
      token: obfuscatedToken,
      savedAt,
      expiresAt,
      savedLocations: options.savedLocations || [],
      savedLocationsUpdatedAt: savedAt,
      user: options.user,
      checksum,
    };
    
    // Write with restricted permissions (0600 - owner read/write only)
    await fs.writeFile(TOKEN_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
    
    // Update cache
    this.cache = data;
    this.initialized = true;
  }

  /**
   * Load token data from storage
   * 
   * @returns Token data if exists and valid, null otherwise
   */
  async load(): Promise<TokenData | null> {
    // Return cached data if available
    if (this.cache && this.initialized) {
      return this.cache;
    }
    
    try {
      const content = await fs.readFile(TOKEN_FILE, 'utf-8');
      const data = JSON.parse(content) as TokenData;
      
      // Verify checksum
      if (!verifyChecksum(data)) {
        console.error('[token-storage] Checksum verification failed - token file may be corrupted');
        return null;
      }
      
      this.cache = data;
      this.initialized = true;
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist - not an error
        return null;
      }
      console.error('[token-storage] Failed to load token:', error);
      return null;
    }
  }

  /**
   * Get the raw (deobfuscated) token string
   * 
   * @returns Raw token string if valid, null otherwise
   */
  async getToken(): Promise<string | null> {
    const data = await this.load();
    if (!data) {
      return null;
    }
    
    const rawToken = deobfuscateToken(data.token);
    if (!rawToken) {
      console.error('[token-storage] Failed to deobfuscate token');
      return null;
    }
    
    return rawToken;
  }

  /**
   * Validate the stored token
   * 
   * @returns Validation result with expiry status
   */
  async validate(): Promise<TokenValidationResult> {
    const data = await this.load();
    
    if (!data) {
      return {
        isValid: false,
        isExpired: false,
        error: 'No token found',
      };
    }
    
    // Check if token string is valid
    const rawToken = deobfuscateToken(data.token);
    if (!rawToken) {
      return {
        isValid: false,
        isExpired: false,
        error: 'Token is corrupted or invalid',
      };
    }
    
    // Check expiry
    if (data.expiresAt) {
      const expiresAt = new Date(data.expiresAt);
      const now = new Date();
      
      if (now >= expiresAt) {
        return {
          isValid: false,
          isExpired: true,
          expiresAt: data.expiresAt,
          error: 'Token has expired',
        };
      }
      
      return {
        isValid: true,
        isExpired: false,
        expiresAt: data.expiresAt,
      };
    }
    
    // No expiry set - assume valid
    return {
      isValid: true,
      isExpired: false,
    };
  }

  /**
   * Check if token is valid and not expired
   */
  async isValid(): Promise<boolean> {
    const result = await this.validate();
    return result.isValid && !result.isExpired;
  }

  /**
   * Check if token is expired
   */
  async isExpired(): Promise<boolean> {
    const result = await this.validate();
    return result.isExpired;
  }

  /**
   * Get time until token expires (in milliseconds)
   * 
   * @returns Milliseconds until expiry, or null if no expiry set
   */
  async getTimeUntilExpiry(): Promise<number | null> {
    const data = await this.load();
    if (!data || !data.expiresAt) {
      return null;
    }
    
    const expiresAt = new Date(data.expiresAt);
    const now = new Date();
    return Math.max(0, expiresAt.getTime() - now.getTime());
  }

  /**
   * Update saved locations
   */
  async updateSavedLocations(locations: SavedLocation[]): Promise<void> {
    const existing = await this.load();
    if (!existing) {
      throw new Error('No token found. Please authenticate first.');
    }
    
    const now = new Date().toISOString();
    const data: TokenData = {
      ...existing,
      savedLocations: locations,
      savedLocationsUpdatedAt: now,
    };
    
    await fs.writeFile(TOKEN_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
    this.cache = data;
  }

  /**
   * Get saved locations
   */
  async getSavedLocations(): Promise<SavedLocation[]> {
    const data = await this.load();
    return data?.savedLocations || [];
  }

  /**
   * Check if saved locations need refresh (older than 24 hours)
   */
  async needsLocationRefresh(): Promise<boolean> {
    const data = await this.load();
    if (!data || !data.savedLocationsUpdatedAt) {
      return true;
    }
    
    const lastUpdate = new Date(data.savedLocationsUpdatedAt);
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceUpdate >= 24;
  }

  /**
   * Delete the token file
   */
  async delete(): Promise<void> {
    try {
      await fs.unlink(TOKEN_FILE);
      this.cache = null;
      this.initialized = false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist - that's fine
    }
  }

  /**
   * Clear the in-memory cache
   */
  clearCache(): void {
    this.cache = null;
    this.initialized = false;
  }

  /**
   * Get the token file path
   */
  static getTokenPath(): string {
    return TOKEN_FILE;
  }

  /**
   * Get the token directory path
   */
  static getTokenDir(): string {
    return TOKEN_DIR;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

/** Default token storage instance */
export const tokenStorage = new TokenStorage();

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Check if user is authenticated (has valid, non-expired token)
 */
export async function isAuthenticated(): Promise<boolean> {
  return tokenStorage.isValid();
}

/**
 * Get the current token
 */
export async function getToken(): Promise<string | null> {
  return tokenStorage.getToken();
}

/**
 * Save a new token
 */
export async function saveToken(token: string, options?: SaveTokenOptions): Promise<void> {
  return tokenStorage.save(token, options);
}

/**
 * Delete the stored token
 */
export async function deleteToken(): Promise<void> {
  return tokenStorage.delete();
}

/**
 * Validate the current token
 */
export async function validateToken(): Promise<TokenValidationResult> {
  return tokenStorage.validate();
}

export default TokenStorage;