import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import type { NYPlaceDetails, NYSavedLocation } from '../types/index.js';
import { NammaYatriClient } from '../api/client.js';

// ============================================================================
// Types
// ============================================================================

export interface PlaceSearchProps {
  /** Label to display above the search input (e.g., "Select pickup location") */
  label: string;
  /** User's saved locations (Home, Work, etc.) */
  savedLocations: NYSavedLocation[];
  /** Callback when a place is selected */
  onSelect: (place: NYPlaceDetails) => void;
  /** Callback when user cancels/goes back */
  onCancel: () => void;
}

interface SearchResultItem {
  label: string;
  value: string;
  place?: NYPlaceDetails;
  savedLocation?: NYSavedLocation;
  isSavedLocation: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function PlaceSearch({
  label,
  savedLocations,
  onSelect,
  onCancel,
}: PlaceSearchProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<NYPlaceDetails[]>([]);
  const [token, setToken] = useState<string | null>(null);

  // Load token from storage on mount
  useEffect(() => {
    async function loadToken() {
      try {
        const { loadToken: loadStoredToken } = await import('../utils/token.js');
        const stored = await loadStoredToken();
        if (stored?.token) {
          setToken(stored.token);
        } else {
          setError('Not authenticated. Please run auth first.');
        }
      } catch {
        setError('Failed to load authentication token');
      }
    }
    loadToken();
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (!token || !query.trim()) {
      setSearchResults([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const timeoutId = setTimeout(async () => {
      try {
        const client = new NammaYatriClient(token);
        const results = await client.searchPlaces(query);
        
        // Convert NYPlace to NYPlaceDetails (without full address)
        const details: NYPlaceDetails[] = results.map(r => ({
          lat: 0, // Will be fetched when selected
          lon: 0,
          placeId: r.placeId,
          address: {
            title: r.description,
            area: r.description,
          },
        }));
        
        setSearchResults(details);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Search failed';
        setError(message);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, token]);

  // Handle keyboard input (Esc to cancel)
  useInput((_, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  // Handle selection from the list
  const handleSelect = useCallback(async (item: SearchResultItem) => {
    if (!token) return;

    try {
      const client = new NammaYatriClient(token);

      if (item.savedLocation) {
        // Convert saved location to NYPlaceDetails
        const placeDetails: NYPlaceDetails = {
          lat: item.savedLocation.lat,
          lon: item.savedLocation.lon,
          placeId: item.savedLocation.placeId || `${item.savedLocation.lat},${item.savedLocation.lon}`,
          address: {
            area: item.savedLocation.area,
            areaCode: item.savedLocation.areaCode,
            building: item.savedLocation.building,
            city: item.savedLocation.city,
            country: item.savedLocation.country,
            door: item.savedLocation.door,
            placeId: item.savedLocation.placeId,
            state: item.savedLocation.state,
            street: item.savedLocation.street,
            title: item.savedLocation.locationName || item.savedLocation.tag,
            ward: item.savedLocation.ward,
          },
        };
        onSelect(placeDetails);
      } else if (item.place) {
        // Fetch full place details before returning
        const details = await client.getPlaceDetails(item.place.placeId);
        onSelect(details);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get place details';
      setError(message);
    }
  }, [token, onSelect]);

  // Build the list of items: saved locations first, then search results
  const items: SearchResultItem[] = useMemo(() => {
    const result: SearchResultItem[] = [];

    // Add saved locations that match the query (or all if no query)
    const matchingSaved = query.trim()
      ? savedLocations.filter(loc =>
          loc.tag.toLowerCase().includes(query.toLowerCase()) ||
          (loc.locationName && loc.locationName.toLowerCase().includes(query.toLowerCase()))
        )
      : savedLocations;

    result.push(...matchingSaved.map(loc => ({
      label: `⭐ ${loc.tag}${loc.locationName ? `: ${loc.locationName}` : ''}`,
      value: `saved:${loc.tag}`,
      savedLocation: loc,
      isSavedLocation: true,
    })));

    // Add search results (only if there's a query)
    if (query.trim()) {
      result.push(...searchResults.map(place => {
        const distanceText = place.address.extras || '';
        return {
          label: distanceText
            ? `${place.address.title || place.address.area} (${distanceText})`
            : (place.address.title || place.address.area || 'Unknown location'),
          value: place.placeId,
          place,
          isSavedLocation: false,
        };
      }));
    }

    return result;
  }, [savedLocations, searchResults, query]);

  return (
    <Box flexDirection="column" gap={1}>
      {/* Header Label */}
      <Text bold color="green">{label}</Text>

      {/* Search Input */}
      <Box flexDirection="column" gap={1}>
        <Text>Search for a place:</Text>
        <TextInput
          value={query}
          onChange={setQuery}
          placeholder="Type to search..."
        />
      </Box>

      {/* Loading State */}
      {isLoading && (
        <Box marginTop={1}>
          <Text color="yellow">Searching...</Text>
        </Box>
      )}

      {/* Error State */}
      {error && (
        <Box marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {/* Results List */}
      {items.length > 0 && !isLoading && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>
            {query.trim() ? 'Select a location:' : 'Quick picks (saved locations):'}
          </Text>
          <SelectInput
            items={items}
            onSelect={handleSelect}
          />
        </Box>
      )}

      {/* Empty State */}
      {query.trim() && !isLoading && items.length === 0 && !error && (
        <Box marginTop={1}>
          <Text dimColor>No places found. Try a different search.</Text>
        </Box>
      )}

      {/* Footer Help */}
      <Box marginTop={1}>
        <Text dimColor>
          Press Esc to cancel • Use ↑↓ to navigate • Enter to select
        </Text>
      </Box>
    </Box>
  );
}
