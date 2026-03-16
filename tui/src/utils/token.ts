import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { StoredToken, SavedLocation } from '../types/index.js';

const TOKEN_DIR = join(homedir(), '.namma-yatri-mcp');
const TOKEN_FILE = join(TOKEN_DIR, 'user-token.json');

/**
 * Ensures the token directory exists
 */
async function ensureTokenDir(): Promise<void> {
  try {
    await fs.mkdir(TOKEN_DIR, { recursive: true });
  } catch {
    // Directory already exists or creation failed
  }
}

/**
 * Loads the stored token from disk
 */
export async function loadToken(): Promise<StoredToken | null> {
  try {
    await ensureTokenDir();
    const data = await fs.readFile(TOKEN_FILE, 'utf-8');
    return JSON.parse(data) as StoredToken;
  } catch {
    return null;
  }
}

/**
 * Saves the token to disk
 */
export async function saveToken(token: StoredToken): Promise<void> {
  await ensureTokenDir();
  await fs.writeFile(TOKEN_FILE, JSON.stringify(token, null, 2), 'utf-8');
}

/**
 * Clears the stored token
 */
export async function clearToken(): Promise<void> {
  try {
    await fs.unlink(TOKEN_FILE);
  } catch {
    // File doesn't exist
  }
}

/**
 * Checks if saved locations need refresh (older than 24 hours)
 */
export function needsLocationRefresh(savedLocationsUpdatedAt?: string): boolean {
  if (!savedLocationsUpdatedAt) return true;
  
  const lastUpdate = new Date(savedLocationsUpdatedAt).getTime();
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  
  return now - lastUpdate > twentyFourHours;
}

/**
 * Finds a saved location by tag (case-insensitive)
 */
export function findSavedLocation(savedLocations: SavedLocation[], tag: string): SavedLocation | undefined {
  return savedLocations.find(loc => loc.tag.toLowerCase() === tag.toLowerCase());
}

/**
 * Converts a saved location to place details format
 */
export function savedLocationToPlaceDetails(location: SavedLocation): {
  lat: number;
  lon: number;
  placeId: string;
  address: {
    area?: string;
    areaCode?: string;
    building?: string;
    city?: string;
    country?: string;
    door?: string;
    placeId?: string;
    state?: string;
    street?: string;
    title?: string;
    ward?: string;
  };
} {
  return {
    lat: location.lat,
    lon: location.lon,
    placeId: location.placeId || `${location.lat},${location.lon}`,
    address: {
      area: location.area,
      areaCode: location.areaCode,
      building: location.building,
      city: location.city,
      country: location.country,
      door: location.door,
      placeId: location.placeId,
      state: location.state,
      street: location.street,
      title: location.locationName || location.tag,
      ward: location.ward,
    },
  };
}
