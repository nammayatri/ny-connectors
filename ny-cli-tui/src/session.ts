/**
 * Session Manager for ny-cli-tui
 * 
 * Manages user session state including token validation, expiry checking,
 * and session persistence to ~/.ny-cli/session.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadToken, clearToken, type StoredToken } from './auth/token-store.js';

// Session configuration
const SESSION_DIR = process.env.NY_SESSION_DIR ?? path.join(os.homedir(), '.ny-cli');
const SESSION_FILE = path.join(SESSION_DIR, 'session.json');

// Token expiry configuration (tokens typically valid for 30 days)
const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const TOKEN_WARNING_MS = 7 * 24 * 60 * 60 * 1000; // 7 days before expiry

export interface SessionData {
  /** ISO timestamp when session was created */
  createdAt: string;
  /** ISO timestamp of last activity */
  lastActivityAt: string;
  /** ISO timestamp when token was acquired */
  tokenAcquiredAt: string;
  /** Whether session is valid */
  isValid: boolean;
  /** User preferences */
  preferences?: SessionPreferences;
  /** Last used locations for quick access */
  recentLocations?: RecentLocation[];
}

export interface SessionPreferences {
  /** Default country code for authentication */
  defaultCountry?: string;
  /** Preferred vehicle variants */
  preferredVehicles?: string[];
  /** Default tip percentage */
  defaultTipPercent?: number;
  /** Theme preference */
  theme?: 'light' | 'dark' | 'system';
}

export interface RecentLocation {
  name: string;
  lat: number;
  lon: number;
  address?: string;
  lastUsed: string;
}

export interface SessionStatus {
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Whether session is valid */
  isValid: boolean;
  /** Whether token is expired */
  isExpired: boolean;
  /** Whether token is expiring soon (within warning period) */
  isExpiringSoon: boolean;
  /** Days until token expires */
  daysUntilExpiry: number | null;
  /** Session data if exists */
  session: SessionData | null;
  /** Token data if exists */
  token: StoredToken | null;
  /** Error message if session invalid */
  error?: string;
}

/**
 * SessionManager class
 * 
 * Handles session lifecycle including:
 * - Loading and saving session state
 * - Token validation and expiry checking
 * - Session cleanup on logout
 */
export class SessionManager {
  private sessionData: SessionData | null = null;
  private tokenData: StoredToken | null = null;

  constructor() {
    this.load();
  }

  /**
   * Get the session directory path
   */
  static getSessionDir(): string {
    return SESSION_DIR;
  }

  /**
   * Get the session file path
   */
  static getSessionFile(): string {
    return SESSION_FILE;
  }

  /**
   * Ensure session directory exists
   */
  private ensureSessionDir(): void {
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Load session and token data from disk
   */
  load(): void {
    // Load token from token-store
    this.tokenData = loadToken();

    // Load session data
    try {
      if (fs.existsSync(SESSION_FILE)) {
        const content = fs.readFileSync(SESSION_FILE, 'utf-8');
        this.sessionData = JSON.parse(content) as SessionData;
      }
    } catch {
      this.sessionData = null;
    }
  }

  /**
   * Save session data to disk
   */
  save(): void {
    this.ensureSessionDir();

    if (this.sessionData) {
      this.sessionData.lastActivityAt = new Date().toISOString();
      fs.writeFileSync(
        SESSION_FILE,
        JSON.stringify(this.sessionData, null, 2),
        { mode: 0o600 }
      );
    }
  }

  /**
   * Create a new session after successful authentication
   */
  createSession(tokenAcquiredAt?: string): void {
    const now = new Date().toISOString();
    
    this.sessionData = {
      createdAt: now,
      lastActivityAt: now,
      tokenAcquiredAt: tokenAcquiredAt ?? now,
      isValid: true,
      preferences: this.sessionData?.preferences, // Preserve preferences
      recentLocations: this.sessionData?.recentLocations ?? [],
    };

    this.save();
  }

  /**
   * Get current session data
   */
  getSession(): SessionData | null {
    return this.sessionData;
  }

  /**
   * Get current token data
   */
  getToken(): StoredToken | null {
    return this.tokenData;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(): boolean {
    if (!this.tokenData?.savedAt) {
      return true;
    }

    const savedAt = new Date(this.tokenData.savedAt).getTime();
    const now = Date.now();

    return (now - savedAt) > TOKEN_EXPIRY_MS;
  }

  /**
   * Check if token is expiring soon (within warning period)
   */
  isTokenExpiringSoon(): boolean {
    if (!this.tokenData?.savedAt) {
      return false;
    }

    const savedAt = new Date(this.tokenData.savedAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = (savedAt + TOKEN_EXPIRY_MS) - now;

    return timeUntilExpiry > 0 && timeUntilExpiry <= TOKEN_WARNING_MS;
  }

  /**
   * Get days until token expires
   */
  getDaysUntilExpiry(): number | null {
    if (!this.tokenData?.savedAt) {
      return null;
    }

    const savedAt = new Date(this.tokenData.savedAt).getTime();
    const now = Date.now();
    const msUntilExpiry = (savedAt + TOKEN_EXPIRY_MS) - now;

    if (msUntilExpiry <= 0) {
      return 0;
    }

    return Math.ceil(msUntilExpiry / (24 * 60 * 60 * 1000));
  }

  /**
   * Validate the current session
   * 
   * Checks:
   * - Token exists
   * - Token is not expired
   * - Session data is valid
   */
  validate(): { valid: boolean; error?: string } {
    // Check if token exists
    if (!this.tokenData) {
      return { valid: false, error: 'Not authenticated. Run `ny-cli auth` to login.' };
    }

    // Check if token string exists
    if (!this.tokenData.token) {
      return { valid: false, error: 'Invalid token. Please re-authenticate.' };
    }

    // Check if token is expired
    if (this.isTokenExpired()) {
      return { valid: false, error: 'Token expired. Run `ny-cli auth` to login again.' };
    }

    // Check if session data exists
    if (!this.sessionData) {
      // Create session if token exists but session doesn't
      this.createSession(this.tokenData.savedAt);
    }

    return { valid: true };
  }

  /**
   * Get comprehensive session status
   */
  getStatus(): SessionStatus {
    const validation = this.validate();
    const daysUntilExpiry = this.getDaysUntilExpiry();

    return {
      isAuthenticated: !!this.tokenData,
      isValid: validation.valid,
      isExpired: this.isTokenExpired(),
      isExpiringSoon: this.isTokenExpiringSoon(),
      daysUntilExpiry,
      session: this.sessionData,
      token: this.tokenData,
      error: validation.error,
    };
  }

  /**
   * Update session preferences
   */
  updatePreferences(preferences: Partial<SessionPreferences>): void {
    if (!this.sessionData) {
      this.sessionData = {
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        tokenAcquiredAt: new Date().toISOString(),
        isValid: true,
      };
    }

    this.sessionData.preferences = {
      ...this.sessionData.preferences,
      ...preferences,
    };

    this.save();
  }

  /**
   * Add a location to recent locations
   */
  addRecentLocation(location: Omit<RecentLocation, 'lastUsed'>): void {
    if (!this.sessionData) {
      return;
    }

    const recentLocations = this.sessionData.recentLocations ?? [];
    
    // Remove existing entry with same name
    const filtered = recentLocations.filter(
      loc => loc.name.toLowerCase() !== location.name.toLowerCase()
    );

    // Add new entry at the beginning
    filtered.unshift({
      ...location,
      lastUsed: new Date().toISOString(),
    });

    // Keep only last 10 locations
    this.sessionData.recentLocations = filtered.slice(0, 10);
    
    this.save();
  }

  /**
   * Get recent locations
   */
  getRecentLocations(): RecentLocation[] {
    return this.sessionData?.recentLocations ?? [];
  }

  /**
   * Update last activity timestamp
   */
  touch(): void {
    if (this.sessionData) {
      this.sessionData.lastActivityAt = new Date().toISOString();
      this.save();
    }
  }

  /**
   * Clear session (logout)
   * 
   * Removes:
   * - Session file
   * - Token file
   * - In-memory data
   */
  clear(): void {
    // Clear token from token-store
    clearToken();

    // Clear session file
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }

    // Clear in-memory data
    this.sessionData = null;
    this.tokenData = null;
  }

  /**
   * Check if session exists (regardless of validity)
   */
  exists(): boolean {
    return fs.existsSync(SESSION_FILE) || !!this.tokenData;
  }

  /**
   * Get a human-readable session summary
   */
  getSummary(): string {
    const status = this.getStatus();

    if (!status.isAuthenticated) {
      return 'Not logged in. Run `ny-cli auth` to authenticate.';
    }

    if (status.isExpired) {
      return 'Session expired. Run `ny-cli auth` to login again.';
    }

    const lines: string[] = ['Session active'];

    if (status.daysUntilExpiry !== null) {
      if (status.isExpiringSoon) {
        lines.push(`⚠ Token expires in ${status.daysUntilExpiry} days`);
      } else {
        lines.push(`Token valid for ${status.daysUntilExpiry} more days`);
      }
    }

    if (status.token?.firstName) {
      lines.push(`User: ${status.token.firstName}${status.token.lastName ? ` ${status.token.lastName}` : ''}`);
    }

    if (status.token?.savedLocations?.length) {
      lines.push(`Saved locations: ${status.token.savedLocations.length}`);
    }

    if (status.session?.recentLocations?.length) {
      lines.push(`Recent locations: ${status.session.recentLocations.length}`);
    }

    return lines.join('\n');
  }
}

// Singleton instance for convenience
let sessionManagerInstance: SessionManager | null = null;

/**
 * Get the singleton SessionManager instance
 */
export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetSessionManager(): void {
  sessionManagerInstance = null;
}

// Export convenience functions
export function isValidSession(): boolean {
  return getSessionManager().validate().valid;
}

export function clearSession(): void {
  getSessionManager().clear();
}

export function getSessionStatus(): SessionStatus {
  return getSessionManager().getStatus();
}