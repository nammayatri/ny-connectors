import Fuse from 'fuse.js';
import type { SavedLocation } from '../auth/token-store.js';
import type { PlacePrediction } from '../api/client.js';

export interface LocationResult {
  type: 'saved' | 'place';
  savedLocation?: SavedLocation;
  placePrediction?: PlacePrediction;
  displayName: string;
  subtitle?: string;
}

export function createLocationFuzzySearch(savedLocations: SavedLocation[]): Fuse<SavedLocation> {
  return new Fuse(savedLocations, {
    keys: [
      { name: 'tag', weight: 2 },
      { name: 'locationName', weight: 1.5 },
      { name: 'area', weight: 1 },
      { name: 'address.area', weight: 0.8 },
      { name: 'address.city', weight: 0.5 },
    ],
    threshold: 0.4,
    includeScore: true,
  });
}

export function searchSavedLocations(
  fuse: Fuse<SavedLocation>,
  query: string
): LocationResult[] {
  if (!query.trim()) {
    // Return all saved locations when query is empty
    return fuse.getIndex().docs.map((loc) => ({
      type: 'saved' as const,
      savedLocation: loc,
      displayName: loc.tag,
      subtitle: loc.locationName ?? loc.area,
    }));
  }

  const results = fuse.search(query, { limit: 5 });
  
  return results.map((result) => ({
    type: 'saved' as const,
    savedLocation: result.item,
    displayName: result.item.tag,
    subtitle: result.item.locationName ?? result.item.area,
  }));
}

export function combineResults(
  savedResults: LocationResult[],
  placeResults: PlacePrediction[],
  maxTotal: number = 10
): LocationResult[] {
  const combined: LocationResult[] = [...savedResults];
  
  const savedCount = combined.length;
  const remainingSlots = maxTotal - savedCount;
  
  if (remainingSlots > 0) {
    for (const place of placeResults.slice(0, remainingSlots)) {
      combined.push({
        type: 'place',
        placePrediction: place,
        displayName: place.description,
        subtitle: place.distanceWithUnit 
          ? `${place.distanceWithUnit.value} ${place.distanceWithUnit.unit}`
          : undefined,
      });
    }
  }
  
  return combined;
}

export function formatLocationForDisplay(result: LocationResult): {
  primary: string;
  secondary: string;
  badge?: string;
} {
  if (result.type === 'saved') {
    return {
      primary: result.displayName,
      secondary: result.subtitle ?? 'Saved location',
      badge: 'SAVED',
    };
  }
  
  return {
    primary: result.displayName,
    secondary: result.subtitle ?? 'Search result',
  };
}