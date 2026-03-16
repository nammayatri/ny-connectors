/**
 * Token Storage Module
 * 
 * Manages authentication tokens for the Namma Yatri CLI.
 * Stores tokens at ~/.namma-yatri/token.json with the same structure as the Bash script:
 * {
 *   token: string,
 *   savedAt: string (ISO timestamp),
 *   savedLocations: SavedLocation[],
 *   savedLocationsUpdatedAt: string (ISO timestamp)
 * }
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// Token storage path (same as Bash script)
const TOKEN_DIR = path.join(os.homedir(), '.namma-yatri');
const TOKEN_FILE = path.join(TOKEN_DIR, 'token.json');

/**
 * Saved location structure from Namma Yatri API
 */
export interface SavedLocation {
  lat: number;
  lon: number;
  tag: string;
  area?: string;
  areaCode?: string;
  building?: string;
  city?: string;
  country?: string;
  door?: string;
  locationName?: string;
  placeId?: string;
  state?: string;
  street?: string;
  ward?: string;
}

/**
 * Token data structure stored on disk
 */
export interface TokenData {
  token: string;
  savedAt: string;
  savedLocations: SavedLocation[];
  savedLocationsUpdatedAt: string;
}

/**
 * Ensure the token directory exists
 */
function ensureTokenDir(): void {
  if (!fs.existsSync(TOKEN_DIR)) {
    fs.mkdirSync(TOKEN_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Read the authentication token from storage
 * @returns The token string, or null if not authenticated
 */
export function readToken(): string | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return null;
    }
    const data = fs.readFileSync(TOKEN_FILE, 'utf-8');
    const parsed: TokenData = JSON.parse(data);
    return parsed.token || null;
  } catch (error) {
    console.error('Error reading token:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Read the full token data from storage
 * @returns The full TokenData object, or null if not authenticated
 */
export function readTokenData(): TokenData | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return null;
    }
    const data = fs.readFileSync(TOKEN_FILE, 'utf-8');
    return JSON.parse(data) as TokenData;
  } catch (error) {
    console.error('Error reading token data:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Save the authentication token to storage
 * @param token - The authentication token
 * @param savedLocations - Optional array of saved locations (defaults to empty array)
 */
export function saveToken(token: string, savedLocations: SavedLocation[] = []): void {
  ensureTokenDir();
  
  const now = new Date().toISOString();
  const tokenData: TokenData = {
    token,
    savedAt: now,
    savedLocations,
    savedLocationsUpdatedAt: now,
  };
  
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2), { mode: 0o600 });
}

/**
 * Clear the authentication token from storage
 */
export function clearToken(): void {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE);
    }
  } catch (error) {
    console.error('Error clearing token:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Update the saved locations in the token file
 * @param savedLocations - Array of saved locations to store
 */
export function updateSavedLocations(savedLocations: SavedLocation[]): void {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      throw new Error('No token file exists. Please authenticate first.');
    }
    
    const data = fs.readFileSync(TOKEN_FILE, 'utf-8');
    const tokenData: TokenData = JSON.parse(data);
    
    tokenData.savedLocations = savedLocations;
    tokenData.savedLocationsUpdatedAt = new Date().toISOString();
    
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2), { mode: 0o600 });
  } catch (error) {
    console.error('Error updating saved locations:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Check if the user is authenticated (token exists)
 * @returns true if authenticated, false otherwise
 */
export function isAuthenticated(): boolean {
  return fs.existsSync(TOKEN_FILE) && readToken() !== null;
}

/**
 * Get the path to the token file
 * @returns The absolute path to the token file
 */
export function getTokenFilePath(): string {
  return TOKEN_FILE;
}

/**
 * Check if saved locations need refresh (older than 24 hours)
 * @returns true if saved locations are stale or don't exist
 */
export function needsSavedLocationsRefresh(): boolean {
  const tokenData = readTokenData();
  if (!tokenData || !tokenData.savedLocationsUpdatedAt) {
    return true;
  }
  
  const lastUpdated = new Date(tokenData.savedLocationsUpdatedAt);
  const now = new Date();
  const diffMs = now.getTime() - lastUpdated.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  return diffHours >= 24;
}

/**
 * Get saved locations from token storage
 * @returns Array of saved locations, or empty array if none exist
 */
export function getSavedLocations(): SavedLocation[] {
  const tokenData = readTokenData();
  return tokenData?.savedLocations || [];
}

/**
 * Find a saved location by tag (case-insensitive)
 * @param tag - The tag to search for (e.g., 'home', 'work')
 * @returns The matching SavedLocation, or null if not found
 */
export function findSavedLocationByTag(tag: string): SavedLocation | null {
  const locations = getSavedLocations();
  const normalizedTag = tag.toLowerCase();
  
  const match = locations.find(loc => loc.tag.toLowerCase() === normalizedTag);
  return match || null;
}
