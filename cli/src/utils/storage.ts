// ============================================================================
// Token Storage Utilities
// ============================================================================

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { StoredTokenData, SavedReqLocationAPIEntity, PersonAPIEntity } from '../types/index.js';

const TOKEN_DIR = join(homedir(), '.namma-yatri-mcp');
const TOKEN_FILE = join(TOKEN_DIR, 'user-token.json');

/**
 * Ensures the token directory exists
 */
export async function ensureTokenDir(): Promise<void> {
  try {
    await fs.mkdir(TOKEN_DIR, { recursive: true, mode: 0o700 });
  } catch (error) {
    // Directory might already exist
  }
}

/**
 * Reads the stored token data from disk
 */
export async function readTokenData(): Promise<StoredTokenData | null> {
  try {
    const data = await fs.readFile(TOKEN_FILE, 'utf-8');
    return JSON.parse(data) as StoredTokenData;
  } catch {
    return null;
  }
}

/**
 * Writes token data to disk
 */
export async function writeTokenData(data: StoredTokenData): Promise<void> {
  await ensureTokenDir();
  await fs.writeFile(TOKEN_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

/**
 * Clears the stored token
 */
export async function clearToken(): Promise<void> {
  try {
    await fs.unlink(TOKEN_FILE);
  } catch {
    // File might not exist
  }
}

/**
 * Checks if saved locations need refresh (older than 24 hours)
 */
export function needsRefresh(timestamp: string): boolean {
  const lastUpdate = new Date(timestamp).getTime();
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  return now - lastUpdate > twentyFourHours;
}

/**
 * Saves authentication data after successful login
 */
export async function saveAuthData(
  token: string,
  person?: PersonAPIEntity,
  savedLocations: SavedReqLocationAPIEntity[] = []
): Promise<void> {
  const now = new Date().toISOString();
  const data: StoredTokenData = {
    token,
    savedAt: now,
    savedLocations,
    savedLocationsUpdatedAt: now,
    person,
  };
  await writeTokenData(data);
}

/**
 * Updates saved locations in the token file
 */
export async function updateSavedLocations(
  savedLocations: SavedReqLocationAPIEntity[]
): Promise<void> {
  const existing = await readTokenData();
  if (existing) {
    existing.savedLocations = savedLocations;
    existing.savedLocationsUpdatedAt = new Date().toISOString();
    await writeTokenData(existing);
  }
}
