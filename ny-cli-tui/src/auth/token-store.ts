import * as fs from 'node:fs';
import * as path from 'node:path';
import { TOKEN_DIR, TOKEN_FILE, SAVED_LOCATIONS_REFRESH_MS } from '../config.js';

export interface SavedLocation {
  tag: string;
  lat: number;
  lon: number;
  locationName?: string;
  area?: string;
  city?: string;
  placeId?: string;
  address?: {
    area?: string;
    city?: string;
    state?: string;
    country?: string;
    building?: string;
    street?: string;
    door?: string;
    ward?: string;
    placeId?: string;
  };
}

export interface StoredToken {
  token: string;
  savedAt: string;
  savedLocations: SavedLocation[];
  savedLocationsUpdatedAt: string;
  firstName?: string;
  lastName?: string;
}

export function getTokenPath(): string {
  return TOKEN_FILE;
}

export function ensureTokenDir(): void {
  if (!fs.existsSync(TOKEN_DIR)) {
    fs.mkdirSync(TOKEN_DIR, { recursive: true });
  }
}

export function loadToken(): StoredToken | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return null;
    }
    const content = fs.readFileSync(TOKEN_FILE, 'utf-8');
    return JSON.parse(content) as StoredToken;
  } catch {
    return null;
  }
}

export function saveToken(token: string, options?: {
  savedLocations?: SavedLocation[];
  firstName?: string;
  lastName?: string;
}): void {
  ensureTokenDir();
  
  const now = new Date().toISOString();
  const data: StoredToken = {
    token,
    savedAt: now,
    savedLocations: options?.savedLocations ?? [],
    savedLocationsUpdatedAt: now,
    firstName: options?.firstName,
    lastName: options?.lastName,
  };
  
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function updateSavedLocations(locations: SavedLocation[]): void {
  const existing = loadToken();
  if (!existing) {
    return;
  }
  
  const updated: StoredToken = {
    ...existing,
    savedLocations: locations,
    savedLocationsUpdatedAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(updated, null, 2), { mode: 0o600 });
}

export function clearToken(): void {
  if (fs.existsSync(TOKEN_FILE)) {
    fs.unlinkSync(TOKEN_FILE);
  }
}

export function needsLocationRefresh(token: StoredToken): boolean {
  if (!token.savedLocationsUpdatedAt) {
    return true;
  }
  
  const lastUpdate = new Date(token.savedLocationsUpdatedAt).getTime();
  const now = Date.now();
  
  return (now - lastUpdate) > SAVED_LOCATIONS_REFRESH_MS;
}

export function findSavedLocation(token: StoredToken, name: string): SavedLocation | undefined {
  const normalizedName = name.toLowerCase().trim();
  
  return token.savedLocations.find(loc => 
    loc.tag.toLowerCase() === normalizedName ||
    loc.locationName?.toLowerCase().includes(normalizedName) ||
    loc.area?.toLowerCase().includes(normalizedName)
  );
}