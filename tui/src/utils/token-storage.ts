/**
 * Token storage utilities for Namma Yatri TUI
 * Follows the CLI pattern: stores in ~/.namma-yatri/token.json
 */

import { promises as fs } from "fs";
import { join } from "path";
import { homedir } from "os";

// ============================================================================
// Configuration
// ============================================================================

const TOKEN_DIR = join(homedir(), ".namma-yatri");
const TOKEN_FILE = join(TOKEN_DIR, "token.json");

// ============================================================================
// Type Definitions
// ============================================================================

export interface NYSavedLocation {
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

export interface TokenFile {
  token: string;
  savedAt: string; // ISO timestamp
  savedLocations: NYSavedLocation[];
  savedLocationsUpdatedAt: string; // ISO timestamp
}

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Returns the token directory path (~/.namma-yatri)
 */
export function getTokenDir(): string {
  return TOKEN_DIR;
}

/**
 * Returns the full token file path (~/.namma-yatri/token.json)
 */
export function getTokenFilePath(): string {
  return TOKEN_FILE;
}

// ============================================================================
// Token File Operations
// ============================================================================

/**
 * Ensures the token directory exists
 */
async function ensureTokenDir(): Promise<void> {
  try {
    await fs.mkdir(TOKEN_DIR, { recursive: true, mode: 0o700 });
  } catch (error) {
    throw new Error(
      `Failed to create token directory: ${(error as Error).message}`
    );
  }
}

/**
 * Reads and parses token.json, returns the token string or null if not found
 */
export async function readToken(): Promise<string | null> {
  try {
    const data = await fs.readFile(TOKEN_FILE, "utf-8");
    const parsed: TokenFile = JSON.parse(data);
    return parsed.token || null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw new Error(`Failed to read token: ${(error as Error).message}`);
  }
}

/**
 * Reads the full token file content
 */
export async function readTokenFile(): Promise<TokenFile | null> {
  try {
    const data = await fs.readFile(TOKEN_FILE, "utf-8");
    return JSON.parse(data) as TokenFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw new Error(`Failed to read token file: ${(error as Error).message}`);
  }
}

/**
 * Saves token with timestamp and optional saved locations
 */
export async function saveToken(
  token: string,
  savedLocations: NYSavedLocation[] = []
): Promise<void> {
  await ensureTokenDir();

  const now = new Date().toISOString();
  const tokenData: TokenFile = {
    token,
    savedAt: now,
    savedLocations,
    savedLocationsUpdatedAt: now,
  };

  try {
    await fs.writeFile(TOKEN_FILE, JSON.stringify(tokenData, null, 2), {
      mode: 0o600,
    });
  } catch (error) {
    throw new Error(`Failed to save token: ${(error as Error).message}`);
  }
}

/**
 * Updates just the saved locations in the token file
 * Preserves the existing token and savedAt timestamp
 */
export async function updateSavedLocations(
  locations: NYSavedLocation[]
): Promise<void> {
  const existing = await readTokenFile();
  const now = new Date().toISOString();

  const tokenData: TokenFile = {
    token: existing?.token || "",
    savedAt: existing?.savedAt || now,
    savedLocations: locations,
    savedLocationsUpdatedAt: now,
  };

  await ensureTokenDir();

  try {
    await fs.writeFile(TOKEN_FILE, JSON.stringify(tokenData, null, 2), {
      mode: 0o600,
    });
  } catch (error) {
    throw new Error(
      `Failed to update saved locations: ${(error as Error).message}`
    );
  }
}

/**
 * Removes the token file (logout/clear)
 */
export async function clearToken(): Promise<void> {
  try {
    await fs.unlink(TOKEN_FILE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error(`Failed to clear token: ${(error as Error).message}`);
    }
  }
}

/**
 * Reads token or throws error with helpful message
 * Use this when token is required for an operation
 */
export async function requireToken(): Promise<string> {
  const token = await readToken();
  if (!token) {
    throw new Error(
      "Not authenticated. Please run 'ny-tui auth' or authenticate first."
    );
  }
  return token;
}

/**
 * Checks if a token exists and is valid (not empty)
 */
export async function hasValidToken(): Promise<boolean> {
  const token = await readToken();
  return token !== null && token.length > 0;
}

/**
 * Gets saved locations from the token file
 */
export async function getSavedLocations(): Promise<NYSavedLocation[]> {
  const file = await readTokenFile();
  return file?.savedLocations || [];
}

/**
 * Checks if saved locations need refresh (older than 24 hours)
 */
export async function savedLocationsNeedRefresh(): Promise<boolean> {
  const file = await readTokenFile();
  if (!file?.savedLocationsUpdatedAt) {
    return true;
  }

  const lastUpdate = new Date(file.savedLocationsUpdatedAt);
  const now = new Date();
  const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

  return hoursSinceUpdate >= 24;
}
