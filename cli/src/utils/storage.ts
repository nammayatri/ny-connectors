// ============================================================================
// Token & State Storage
// Handles persistence of auth tokens and app state
// Stores token at ~/.namma-yatri/token.json (same as bash CLI for compatibility)
// ============================================================================

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { SavedLocation } from '../types.js';

const TOKEN_DIR = join(homedir(), '.namma-yatri');
const TOKEN_FILE = join(TOKEN_DIR, 'token.json');

export interface StoredToken {
  token: string;
  savedAt: string;
  savedLocations: SavedLocation[];
  savedLocationsUpdatedAt?: string;
  // Optional fields for backward compatibility with existing code
  personId?: string;
  personName?: string;
}

/**
 * Ensure the token directory exists with proper permissions
 */
async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(TOKEN_DIR, { recursive: true, mode: 0o700 });
  } catch (error) {
    // Directory might already exist
  }
}

/**
 * Save token and associated data to storage
 */
export async function saveToken(data: StoredToken): Promise<void> {
  await ensureDir();
  await fs.writeFile(
    TOKEN_FILE,
    JSON.stringify(data, null, 2),
    { mode: 0o600 }
  );
}

/**
 * Load token from storage
 * @returns StoredToken or null if not found
 */
export async function loadToken(): Promise<StoredToken | null> {
  try {
    const content = await fs.readFile(TOKEN_FILE, 'utf-8');
    return JSON.parse(content) as StoredToken;
  } catch (error) {
    return null;
  }
}

/**
 * Clear/delete the stored token
 */
export async function clearToken(): Promise<void> {
  try {
    await fs.unlink(TOKEN_FILE);
  } catch (error) {
    // File might not exist
  }
}

/**
 * Update saved locations in the stored token
 */
export async function updateSavedLocations(savedLocations: SavedLocation[]): Promise<void> {
  const token = await loadToken();
  if (token) {
    token.savedLocations = savedLocations;
    token.savedLocationsUpdatedAt = new Date().toISOString();
    await saveToken(token);
  }
}

/**
 * Check if a valid token exists and is not expired (30 days)
 */
export async function isTokenValid(): Promise<boolean> {
  const token = await loadToken();
  if (!token) return false;

  // Check if token is older than 30 days (optional expiry check)
  const savedAt = new Date(token.savedAt);
  const now = new Date();
  const daysDiff = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60 * 24);

  // Tokens older than 30 days might be expired
  return daysDiff < 30;
}

// ============================================================================
// Backward-compatible TokenStorage class (for existing code)
// ============================================================================

export class TokenStorage {
  static async ensureDir(): Promise<void> {
    return ensureDir();
  }

  static async saveToken(data: StoredToken): Promise<void> {
    return saveToken(data);
  }

  static async loadToken(): Promise<StoredToken | null> {
    return loadToken();
  }

  static async clearToken(): Promise<void> {
    return clearToken();
  }

  static async updateSavedLocations(savedLocations: SavedLocation[]): Promise<void> {
    return updateSavedLocations(savedLocations);
  }

  static async isTokenValid(): Promise<boolean> {
    return isTokenValid();
  }
}

export default TokenStorage;
