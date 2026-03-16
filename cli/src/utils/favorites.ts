/**
 * Favorites Manager
 * Handles persistent storage of user-defined favorite locations
 * Stores favorites in ~/.config/ny-cli/favorites.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * A user-defined favorite location
 */
export interface Favorite {
  /** Unique identifier */
  id: string;
  /** User-defined name for the favorite */
  name: string;
  /** Full address string */
  address: string;
  /** GPS latitude */
  lat: number;
  /** GPS longitude */
  lon: number;
  /** Optional place ID from autocomplete */
  placeId?: string;
  /** When the favorite was created */
  createdAt: string;
  /** When the favorite was last updated */
  updatedAt: string;
}

/**
 * Internal storage format for favorites file
 */
interface FavoritesStorage {
  version: number;
  favorites: Favorite[];
  updatedAt: string;
}

/**
 * Options for adding a new favorite
 */
export interface AddFavoriteOptions {
  name: string;
  address: string;
  lat: number;
  lon: number;
  placeId?: string;
}

/**
 * Options for updating an existing favorite
 */
export interface UpdateFavoriteOptions {
  name?: string;
  address?: string;
  lat?: number;
  lon?: number;
  placeId?: string;
}

// Storage configuration
const CONFIG_DIR = path.join(os.homedir(), '.config', 'ny-cli');
const FAVORITES_FILE = path.join(CONFIG_DIR, 'favorites.json');
const CURRENT_VERSION = 1;

/**
 * Manages user-defined favorite locations
 * Persists favorites to ~/.config/ny-cli/favorites.json
 */
export class FavoritesManager {
  private storage: FavoritesStorage | null = null;

  constructor() {
    this.loadFavorites();
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Ensure the config directory exists
   */
  private ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
  }

  /**
   * Generate a unique ID for a new favorite
   */
  private generateId(): string {
    return `fav_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Load favorites from disk
   */
  private loadFavorites(): void {
    try {
      if (fs.existsSync(FAVORITES_FILE)) {
        const content = fs.readFileSync(FAVORITES_FILE, 'utf-8');
        const data = JSON.parse(content);
        
        // Handle migration from older versions
        this.storage = this.migrateData(data);
      }
    } catch {
      // If loading fails, start fresh
      this.storage = null;
    }
  }

  /**
   * Migrate data from older storage versions
   */
  private migrateData(data: unknown): FavoritesStorage {
    if (!data || typeof data !== 'object') {
      return this.createEmptyStorage();
    }

    const record = data as Record<string, unknown>;

    // Handle version 0 (no version field - legacy format)
    if (!('version' in record)) {
      // Legacy format: just an array of favorites
      if (Array.isArray(record)) {
        const favorites = record.map((fav: Record<string, unknown>) => ({
          id: (fav.id as string) || this.generateId(),
          name: (fav.name as string) || 'Unnamed',
          address: (fav.address as string) || '',
          lat: (fav.lat as number) || 0,
          lon: (fav.lon as number) || 0,
          placeId: fav.placeId as string | undefined,
          createdAt: (fav.createdAt as string) || new Date().toISOString(),
          updatedAt: (fav.updatedAt as string) || new Date().toISOString(),
        }));
        return {
          version: CURRENT_VERSION,
          favorites,
          updatedAt: new Date().toISOString(),
        };
      }
      return this.createEmptyStorage();
    }

    // Current version
    if (record.version === CURRENT_VERSION) {
      return record as unknown as FavoritesStorage;
    }

    // Future versions - handle migration
    // For now, just return empty storage
    return this.createEmptyStorage();
  }

  /**
   * Create an empty storage object
   */
  private createEmptyStorage(): FavoritesStorage {
    return {
      version: CURRENT_VERSION,
      favorites: [],
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Save favorites to disk
   */
  private saveFavorites(): void {
    if (!this.storage) {
      this.storage = this.createEmptyStorage();
    }

    this.storage.updatedAt = new Date().toISOString();
    this.ensureConfigDir();
    
    fs.writeFileSync(
      FAVORITES_FILE,
      JSON.stringify(this.storage, null, 2),
      { mode: 0o600 } // Read/write for owner only
    );
  }

  /**
   * Get the current storage, initializing if needed
   */
  private getStorage(): FavoritesStorage {
    if (!this.storage) {
      this.storage = this.createEmptyStorage();
    }
    return this.storage;
  }

  // =============================================================================
  // Public CRUD Methods
  // =============================================================================

  /**
   * Add a new favorite location
   * @returns The created favorite with generated ID
   */
  addFavorite(options: AddFavoriteOptions): Favorite {
    const storage = this.getStorage();
    const now = new Date().toISOString();

    const favorite: Favorite = {
      id: this.generateId(),
      name: options.name.trim(),
      address: options.address.trim(),
      lat: options.lat,
      lon: options.lon,
      placeId: options.placeId,
      createdAt: now,
      updatedAt: now,
    };

    storage.favorites.push(favorite);
    this.saveFavorites();

    return favorite;
  }

  /**
   * Remove a favorite by ID
   * @returns true if removed, false if not found
   */
  removeFavorite(id: string): boolean {
    const storage = this.getStorage();
    const index = storage.favorites.findIndex((f) => f.id === id);

    if (index === -1) {
      return false;
    }

    storage.favorites.splice(index, 1);
    this.saveFavorites();

    return true;
  }

  /**
   * Update an existing favorite
   * @returns The updated favorite, or null if not found
   */
  updateFavorite(id: string, options: UpdateFavoriteOptions): Favorite | null {
    const storage = this.getStorage();
    const favorite = storage.favorites.find((f) => f.id === id);

    if (!favorite) {
      return null;
    }

    // Update only provided fields
    if (options.name !== undefined) {
      favorite.name = options.name.trim();
    }
    if (options.address !== undefined) {
      favorite.address = options.address.trim();
    }
    if (options.lat !== undefined) {
      favorite.lat = options.lat;
    }
    if (options.lon !== undefined) {
      favorite.lon = options.lon;
    }
    if (options.placeId !== undefined) {
      favorite.placeId = options.placeId;
    }

    favorite.updatedAt = new Date().toISOString();
    this.saveFavorites();

    return favorite;
  }

  /**
   * Get a favorite by ID
   */
  getFavorite(id: string): Favorite | null {
    const storage = this.getStorage();
    return storage.favorites.find((f) => f.id === id) || null;
  }

  /**
   * Get all favorites
   */
  listFavorites(): Favorite[] {
    const storage = this.getStorage();
    return [...storage.favorites];
  }

  /**
   * Search favorites by name (case-insensitive partial match)
   */
  searchFavorites(query: string): Favorite[] {
    const storage = this.getStorage();
    const normalizedQuery = query.toLowerCase().trim();

    if (!normalizedQuery) {
      return [...storage.favorites];
    }

    return storage.favorites.filter(
      (f) =>
        f.name.toLowerCase().includes(normalizedQuery) ||
        f.address.toLowerCase().includes(normalizedQuery)
    );
  }

  /**
   * Check if a favorite exists
   */
  hasFavorite(id: string): boolean {
    const storage = this.getStorage();
    return storage.favorites.some((f) => f.id === id);
  }

  /**
   * Get the number of favorites
   */
  getFavoriteCount(): number {
    const storage = this.getStorage();
    return storage.favorites.length;
  }

  /**
   * Clear all favorites
   */
  clearFavorites(): void {
    this.storage = this.createEmptyStorage();
    this.saveFavorites();
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  /**
   * Check if favorites file exists
   */
  hasStoredFavorites(): boolean {
    return fs.existsSync(FAVORITES_FILE);
  }

  /**
   * Get the path to the favorites file
   */
  static getFavoritesFilePath(): string {
    return FAVORITES_FILE;
  }

  /**
   * Get the path to the config directory
   */
  static getConfigDir(): string {
    return CONFIG_DIR;
  }

  /**
   * Export favorites to a JSON string
   */
  exportFavorites(): string {
    return JSON.stringify(this.listFavorites(), null, 2);
  }

  /**
   * Import favorites from a JSON string
   * @param merge If true, merge with existing favorites; if false, replace all
   * @returns Number of favorites imported
   */
  importFavorites(jsonString: string, merge = true): number {
    const imported = JSON.parse(jsonString) as Favorite[];

    if (!Array.isArray(imported)) {
      throw new Error('Invalid import data: expected an array of favorites');
    }

    const storage = this.getStorage();

    if (!merge) {
      storage.favorites = [];
    }

    let count = 0;
    const now = new Date().toISOString();

    for (const fav of imported) {
      // Validate required fields
      if (
        typeof fav.name !== 'string' ||
        typeof fav.address !== 'string' ||
        typeof fav.lat !== 'number' ||
        typeof fav.lon !== 'number'
      ) {
        continue; // Skip invalid entries
      }

      const favorite: Favorite = {
        id: fav.id || this.generateId(),
        name: fav.name.trim(),
        address: fav.address.trim(),
        lat: fav.lat,
        lon: fav.lon,
        placeId: fav.placeId,
        createdAt: fav.createdAt || now,
        updatedAt: now,
      };

      // Check for duplicates by name (case-insensitive)
      const existingIndex = storage.favorites.findIndex(
        (f) => f.name.toLowerCase() === favorite.name.toLowerCase()
      );

      if (existingIndex >= 0) {
        // Update existing
        storage.favorites[existingIndex] = favorite;
      } else {
        // Add new
        storage.favorites.push(favorite);
      }

      count++;
    }

    this.saveFavorites();
    return count;
  }
}

// Export singleton instance
export const favoritesManager = new FavoritesManager();