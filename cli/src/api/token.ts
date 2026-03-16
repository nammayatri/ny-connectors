/**
 * Token Manager
 * Handles persistent storage of authentication tokens and saved locations
 * Compatible with Bash script's ~/.namma-yatri/token.json format
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import type { Person, SavedLocation, TokenData } from './types.js';

// Token storage paths (same as Bash script for compatibility)
const TOKEN_DIR = path.join(os.homedir(), '.namma-yatri');
const TOKEN_FILE = path.join(TOKEN_DIR, 'token.json');

// Token validation settings
const TOKEN_VALIDITY_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_TOKEN_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Token Obfuscator
 * Provides reversible obfuscation for tokens to prevent accidental exposure
 * Algorithm: Every 3rd element swapped with 1st, add random alphanumeric every 4th place
 */
export class TokenObfuscator {
  private static readonly CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  /**
   * Obfuscates a token string
   * Process: group chars in 3s, swap 1st and 3rd in each group, then insert random char every 4th position
   */
  static obfuscate(input: string): string {
    let out = '';
    const len = input.length;
    let i = 0;

    for (; i + 3 <= len; i += 3) {
      const a = input[i];
      const b = input[i + 1];
      const c = input[i + 2];
      // swap 1st and 3rd => [c, b, a]
      out += c + b + a;
      // insert random alphanumeric filler
      out += this.getRandomChar();
    }

    // append remainder (0, 1 or 2 chars) as-is
    if (i < len) {
      out += input.slice(i);
    }

    return out;
  }

  /**
   * Deobfuscates a token string
   * Step 1: Remove random chars (every 4th position)
   * Step 2: Reverse swap (swap 1st and 3rd back in groups of 3)
   */
  static deobfuscate(obf: string): string {
    let out = '';
    const len = obf.length;
    let i = 0;

    // While we have at least 4 characters (3 obf + 1 filler)
    while (i + 4 <= len) {
      const c0 = obf[i];     // was original index 2
      const c1 = obf[i + 1]; // was original index 1
      const c2 = obf[i + 2]; // was original index 0
      // reverse swap: original = c2 + c1 + c0
      out += c2 + c1 + c0;
      // skip filler char at i+3
      i += 4;
    }

    // Append any trailing remainder (1 or 2 chars that were left untouched)
    if (i < len) {
      out += obf.slice(i);
    }

    return out;
  }

  /**
   * Generates a random alphanumeric character
   */
  private static getRandomChar(): string {
    return this.CHARS.charAt(Math.floor(Math.random() * this.CHARS.length));
  }

  /**
   * Check if a string appears to be obfuscated
   * Obfuscated strings have a length pattern of 4n + remainder
   */
  static isObfuscated(str: string): boolean {
    // Simple heuristic: obfuscated tokens are longer than original
    // and have a specific pattern
    if (!str || str.length < 4) return false;
    
    // Try to deobfuscate and re-obfuscate to check
    try {
      const deobfuscated = this.deobfuscate(str);
      const reobfuscated = this.obfuscate(deobfuscated);
      // If re-obfuscation produces same length, it was likely obfuscated
      return reobfuscated.length === str.length;
    } catch {
      return false;
    }
  }
}

/**
 * Token Validation Result
 */
export interface TokenValidationResult {
  valid: boolean;
  expired: boolean;
  error?: string;
  person?: Person;
}

/**
 * Token Refresh Result
 */
export interface TokenRefreshResult {
  success: boolean;
  newToken?: string;
  error?: string;
}

/**
 * Session data for active token usage
 */
interface SessionData {
  realToken: string;
  obfuscatedToken: string;
  lastValidated: number;
  isValid: boolean;
}

/**
 * Manages authentication token storage and retrieval
 * Persists token data to ~/.namma-yatri/token.json
 * 
 * Features:
 * - Token obfuscation for security
 * - Token validation with API
 * - Saved locations caching
 * - Compatibility with Bash script format
 */
export class TokenManager {
  private tokenData: TokenData | null = null;
  private session: SessionData | null = null;
  private lastValidationTime: number = 0;

  constructor() {
    this.loadToken();
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Ensure the token directory exists
   */
  private ensureTokenDir(): void {
    if (!fs.existsSync(TOKEN_DIR)) {
      fs.mkdirSync(TOKEN_DIR, { recursive: true });
    }
  }

  /**
   * Load token from disk
   */
  private loadToken(): void {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        const content = fs.readFileSync(TOKEN_FILE, 'utf-8');
        const data = JSON.parse(content);
        
        // Validate required fields
        if (data && typeof data.token === 'string') {
          this.tokenData = {
            token: data.token,
            savedAt: data.savedAt || new Date().toISOString(),
            savedLocations: Array.isArray(data.savedLocations) ? data.savedLocations : [],
            savedLocationsUpdatedAt: data.savedLocationsUpdatedAt || data.savedAt || new Date().toISOString(),
            person: data.person,
          };

          // Create session with real token
          const realToken = this.tokenData.token;
          this.session = {
            realToken,
            obfuscatedToken: TokenObfuscator.obfuscate(realToken),
            lastValidated: 0,
            isValid: true, // Assume valid until proven otherwise
          };
        }
      }
    } catch (error) {
      // Corrupted token file - clear it
      console.error('Failed to load token file:', error);
      this.tokenData = null;
      this.session = null;
    }
  }

  /**
   * Save token data to disk
   */
  private saveTokenData(): void {
    if (this.tokenData) {
      this.ensureTokenDir();
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(this.tokenData, null, 2), {
        mode: 0o600, // Read/write for owner only
      });
    }
  }

  /**
   * Check if token is too old (based on savedAt timestamp)
   */
  private isTokenTooOld(): boolean {
    if (!this.tokenData?.savedAt) return true;

    try {
      const savedAt = new Date(this.tokenData.savedAt).getTime();
      const now = Date.now();
      return (now - savedAt) > MAX_TOKEN_AGE_MS;
    } catch {
      return true;
    }
  }

  // =============================================================================
  // Public Methods - Token Management
  // =============================================================================

  /**
   * Get the stored token (real, unobfuscated)
   */
  getToken(): string | null {
    return this.tokenData?.token || null;
  }

  /**
   * Get the obfuscated token for display or logging
   * Use this when you need to show/log the token without exposing the real value
   */
  getObfuscatedToken(): string | null {
    return this.session?.obfuscatedToken || null;
  }

  /**
   * Set the authentication token
   */
  setToken(
    token: string,
    savedLocations: SavedLocation[] = [],
    person?: Person
  ): void {
    const now = new Date().toISOString();
    this.tokenData = {
      token,
      savedAt: now,
      savedLocations,
      savedLocationsUpdatedAt: now,
      person,
    };

    // Update session
    this.session = {
      realToken: token,
      obfuscatedToken: TokenObfuscator.obfuscate(token),
      lastValidated: Date.now(),
      isValid: true,
    };

    this.saveTokenData();
  }

  /**
   * Check if a token is stored
   */
  hasToken(): boolean {
    return !!this.tokenData?.token;
  }

  /**
   * Check if the token appears to be valid (not expired based on age)
   * Note: This is a quick check based on token age, not API validation
   */
  isTokenPossiblyValid(): boolean {
    if (!this.hasToken()) return false;
    if (this.isTokenTooOld()) return false;
    return true;
  }

  /**
   * Clear the stored token
   */
  clearToken(): void {
    this.tokenData = null;
    this.session = null;
    this.lastValidationTime = 0;

    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE);
    }
  }

  /**
   * Get the path to the token file
   */
  static getTokenFilePath(): string {
    return TOKEN_FILE;
  }

  /**
   * Get the path to the token directory
   */
  static getTokenDir(): string {
    return TOKEN_DIR;
  }

  // =============================================================================
  // Public Methods - Token Validation
  // =============================================================================

  /**
   * Validate the token by making an API call
   * Returns validation result with person info if valid
   */
  async validateToken(apiClient: { getRideStatus: (onlyActive: boolean) => Promise<unknown[]> }): Promise<TokenValidationResult> {
    if (!this.hasToken()) {
      return { valid: false, expired: false, error: 'No token stored' };
    }

    // Check if token is too old
    if (this.isTokenTooOld()) {
      return { valid: false, expired: true, error: 'Token is too old (over 30 days)' };
    }

    // Check if we recently validated
    const now = Date.now();
    if (this.session && (now - this.session.lastValidated) < TOKEN_VALIDITY_CHECK_INTERVAL_MS) {
      return {
        valid: this.session.isValid,
        expired: false,
        person: this.tokenData?.person,
      };
    }

    // Make API call to validate
    try {
      await apiClient.getRideStatus(true);
      
      // Token is valid
      if (this.session) {
        this.session.lastValidated = now;
        this.session.isValid = true;
      }

      return {
        valid: true,
        expired: false,
        person: this.tokenData?.person,
      };
    } catch (error: unknown) {
      const apiError = error as { statusCode?: number; isAuthError?: boolean; message?: string };
      
      // Check for auth error (401)
      if (apiError.statusCode === 401 || apiError.isAuthError) {
        if (this.session) {
          this.session.isValid = false;
        }
        return { valid: false, expired: true, error: 'Token expired or invalid' };
      }

      // Other API error - token might still be valid
      return {
        valid: true, // Assume valid on non-auth errors
        expired: false,
        error: apiError.message || 'API error during validation',
        person: this.tokenData?.person,
      };
    }
  }

  /**
   * Check if token needs validation (based on time since last validation)
   */
  needsValidation(): boolean {
    if (!this.hasToken()) return false;
    if (!this.session) return true;
    
    const now = Date.now();
    return (now - this.session.lastValidated) > TOKEN_VALIDITY_CHECK_INTERVAL_MS;
  }

  // =============================================================================
  // Public Methods - Saved Locations
  // =============================================================================

  /**
   * Get saved locations from cache
   */
  getSavedLocations(): SavedLocation[] {
    return this.tokenData?.savedLocations || [];
  }

  /**
   * Update saved locations in cache
   */
  updateSavedLocations(locations: SavedLocation[]): void {
    if (this.tokenData) {
      this.tokenData.savedLocations = locations;
      this.tokenData.savedLocationsUpdatedAt = new Date().toISOString();
      this.saveTokenData();
    }
  }

  /**
   * Check if saved locations should be refreshed (older than 24 hours)
   */
  shouldRefreshSavedLocations(): boolean {
    if (!this.tokenData?.savedLocationsUpdatedAt) {
      return true;
    }

    const lastUpdate = new Date(this.tokenData.savedLocationsUpdatedAt);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return lastUpdate < twentyFourHoursAgo;
  }

  /**
   * Find a saved location by tag (case-insensitive)
   */
  findSavedLocationByTag(tag: string): SavedLocation | null {
    const normalizedTag = tag.toLowerCase().trim();
    const locations = this.getSavedLocations();
    
    return locations.find(loc => 
      loc.tag?.toLowerCase().trim() === normalizedTag
    ) || null;
  }

  /**
   * Check if a location name matches a saved location tag
   */
  isSavedLocationName(name: string): boolean {
    return this.findSavedLocationByTag(name) !== null;
  }

  // =============================================================================
  // Public Methods - Person Info
  // =============================================================================

  /**
   * Get stored person info
   */
  getPerson(): Person | null {
    return this.tokenData?.person || null;
  }

  /**
   * Get the full token data object
   */
  getTokenData(): TokenData | null {
    return this.tokenData;
  }

  // =============================================================================
  // Public Methods - Utility
  // =============================================================================

  /**
   * Export token data for backup or transfer
   * Returns obfuscated token for safety
   */
  exportTokenData(): { token: string; savedAt: string; savedLocations: SavedLocation[] } | null {
    if (!this.tokenData) return null;

    return {
      token: this.session?.obfuscatedToken || TokenObfuscator.obfuscate(this.tokenData.token),
      savedAt: this.tokenData.savedAt,
      savedLocations: this.tokenData.savedLocations,
    };
  }

  /**
   * Import token data from backup
   * Accepts either obfuscated or real token
   */
  importTokenData(data: { token: string; savedAt?: string; savedLocations?: SavedLocation[]; person?: Person }): void {
    let realToken = data.token;

    // Check if token is obfuscated and deobfuscate if needed
    if (TokenObfuscator.isObfuscated(data.token)) {
      realToken = TokenObfuscator.deobfuscate(data.token);
    }

    this.setToken(
      realToken,
      data.savedLocations || [],
      data.person
    );

    // Preserve original savedAt if provided
    if (data.savedAt && this.tokenData) {
      this.tokenData.savedAt = data.savedAt;
      this.saveTokenData();
    }
  }
}

// Export singleton instance for convenience
export const tokenManager = new TokenManager();