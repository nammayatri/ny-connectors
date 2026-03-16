/**
 * LocationStep Component
 * Reusable location search component for pickup/drop selection
 * Features: text input, debounced API search, arrow-key navigation,
 * favorite locations quick-select, and save to favorites option
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { apiClient, PlacePrediction, SavedLocation } from '../../api/index.js';
import { favoritesManager, Favorite } from '../../utils/favorites.js';

// =============================================================================
// Types
// =============================================================================

export type LocationType = 'pickup' | 'drop';

export interface LocationStepProps {
  /** Type of location being selected */
  type: LocationType;
  /** Previously selected location (for context) */
  previousLocation?: {
    lat: number;
    lon: number;
    name: string;
  } | null;
  /** Callback when location is selected */
  onSelect: (location: { lat: number; lon: number; name: string; address?: string }) => void;
  /** Callback to go back */
  onBack: () => void;
  /** Saved locations from API */
  savedLocations: SavedLocation[];
  /** Whether this step is focused */
  isFocused?: boolean;
}

interface SearchResult {
  id: string;
  name: string;
  subtitle?: string;
  type: 'saved' | 'favorite' | 'prediction';
  lat: number;
  lon: number;
  placeId?: string;
  address?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 3;
const MAX_RESULTS = 8;

// =============================================================================
// Component
// =============================================================================

export function LocationStep({
  type,
  previousLocation,
  onSelect,
  onBack,
  savedLocations,
  isFocused = true,
}: LocationStepProps): React.ReactElement {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [mode, setMode] = useState<'search' | 'save'>('search');

  // Refs
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const searchAbortController = useRef<AbortController | null>(null);

  // Get user favorites
  const userFavorites = favoritesManager.listFavorites();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
    };
  }, []);

  // Build combined results list
  const buildResults = useCallback(
    (searchPredictions: PlacePrediction[], query: string): SearchResult[] => {
      const combined: SearchResult[] = [];

      // Add saved locations (API) - always show first if no search query
      if (!query || query.length < MIN_SEARCH_LENGTH) {
        for (const loc of savedLocations) {
          combined.push({
            id: `saved:${loc.tag}`,
            name: loc.tag,
            subtitle: loc.locationName || loc.area,
            type: 'saved',
            lat: loc.lat,
            lon: loc.lon,
            placeId: loc.placeId,
            address: loc.locationName,
          });
        }
      }

      // Add user favorites
      const filteredFavorites = query
        ? userFavorites.filter(
            (f) =>
              f.name.toLowerCase().includes(query.toLowerCase()) ||
              f.address.toLowerCase().includes(query.toLowerCase())
          )
        : userFavorites;

      for (const fav of filteredFavorites) {
        combined.push({
          id: `favorite:${fav.id}`,
          name: fav.name,
          subtitle: fav.address,
          type: 'favorite',
          lat: fav.lat,
          lon: fav.lon,
          placeId: fav.placeId,
          address: fav.address,
        });
      }

      // Add predictions from API
      for (const pred of searchPredictions.slice(0, MAX_RESULTS - combined.length)) {
        // Avoid duplicates
        const isDuplicate = combined.some(
          (r) =>
            r.name.toLowerCase() === pred.description.toLowerCase() ||
            (pred.placeId && r.placeId === pred.placeId)
        );

        if (!isDuplicate) {
          combined.push({
            id: `prediction:${pred.placeId}`,
            name: pred.description,
            subtitle: pred.distance ? `${pred.distance}m away` : undefined,
            type: 'prediction',
            lat: 0, // Will be fetched on selection
            lon: 0,
            placeId: pred.placeId,
          });
        }
      }

      return combined.slice(0, MAX_RESULTS);
    },
    [savedLocations, userFavorites]
  );

  // Debounced search
  const performSearch = useCallback(
    async (query: string) => {
      // Cancel previous search
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }

      if (query.length < MIN_SEARCH_LENGTH) {
        setPredictions([]);
        setResults(buildResults([], query));
        setIsSearching(false);
        return;
      }

      searchAbortController.current = new AbortController();
      setIsSearching(true);
      setError(null);

      try {
        // Use previous location as origin for proximity search
        const sourceLat = previousLocation?.lat || 12.9741;
        const sourceLon = previousLocation?.lon || 77.5853;

        const searchPredictions = await apiClient.searchPlaces(query, sourceLat, sourceLon);
        setPredictions(searchPredictions);
        setResults(buildResults(searchPredictions, query));
        setSelectedIndex(0);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return; // Ignore abort errors
        }
        setError(err instanceof Error ? err.message : 'Search failed');
        setPredictions([]);
        setResults(buildResults([], query));
      } finally {
        setIsSearching(false);
      }
    },
    [previousLocation, buildResults]
  );

  // Handle search input change with debounce
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      setSelectedIndex(0);

      // Clear previous timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Set new debounced search
      debounceTimer.current = setTimeout(() => {
        performSearch(value);
      }, DEBOUNCE_MS);
    },
    [performSearch]
  );

  // Initialize results on mount
  useEffect(() => {
    setResults(buildResults([], ''));
  }, [buildResults]);

  // Handle selection
  const handleSelect = useCallback(
    async (result: SearchResult) => {
      if (result.type === 'prediction' && result.placeId) {
        // Need to fetch coordinates for prediction
        setIsSearching(true);
        setError(null);

        try {
          const details = await apiClient.getPlaceDetails(result.placeId);
          onSelect({
            lat: details.lat,
            lon: details.lon,
            name: result.name,
            address: details.address?.title || result.name,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to get location details');
        } finally {
          setIsSearching(false);
        }
      } else {
        // Saved location or favorite - already has coordinates
        onSelect({
          lat: result.lat,
          lon: result.lon,
          name: result.name,
          address: result.address,
        });
      }
    },
    [onSelect]
  );

  // Handle save to favorites
  const handleSaveFavorite = useCallback(() => {
    if (!selectedResult || !saveName.trim()) return;

    favoritesManager.addFavorite({
      name: saveName.trim(),
      address: selectedResult.address || selectedResult.name,
      lat: selectedResult.lat,
      lon: selectedResult.lon,
      placeId: selectedResult.placeId,
    });

    setShowSavePrompt(false);
    setSaveName('');
    setSelectedResult(null);
    setMode('search');

    // Continue with selection
    handleSelect(selectedResult);
  }, [selectedResult, saveName, handleSelect]);

  // Keyboard navigation
  useInput(
    (input, key) => {
      if (!isFocused) return;

      // Handle save mode
      if (mode === 'save') {
        if (key.escape) {
          setMode('search');
          setShowSavePrompt(false);
          setSaveName('');
        }
        return; // Let TextInput handle other keys
      }

      // Navigation
      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(results.length - 1, prev + 1));
      } else if (key.return && results.length > 0) {
        const selected = results[selectedIndex];
        if (selected) {
          // Check if it's a prediction that needs coordinates
          if (selected.type === 'prediction' && selected.placeId) {
            handleSelect(selected);
          } else {
            // For saved/favorites, ask if they want to save
            setSelectedResult(selected);
            setShowSavePrompt(true);
          }
        }
      } else if (key.escape) {
        onBack();
      } else if (input === 's' && results.length > 0 && results[selectedIndex]?.type !== 'saved') {
        // 's' to save current selection to favorites
        const selected = results[selectedIndex];
        if (selected && selected.lat !== 0) {
          setSelectedResult(selected);
          setMode('save');
        }
      }
    },
    { isActive: isFocused && mode === 'search' }
  );

  // Get type label
  const typeLabel = type === 'pickup' ? 'Pickup' : 'Drop';
  const typeIcon = type === 'pickup' ? '🟢' : '🔴';

  // Render save prompt
  if (mode === 'save' && selectedResult) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            ⭐ Save to Favorites
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text dimColor>Location: {selectedResult.name}</Text>
        </Box>

        <Box marginBottom={1}>
          <Text>Enter a name for this favorite:</Text>
        </Box>

        <Box>
          <Text color="green">Name: </Text>
          <TextInput
            value={saveName}
            onChange={setSaveName}
            onSubmit={handleSaveFavorite}
            placeholder="e.g., Office, Gym, Mom's place"
            focus={true}
          />
        </Box>

        {error && (
          <Box marginTop={1}>
            <Text color="red">{error}</Text>
          </Box>
        )}

        <Box marginTop={2}>
          <Text dimColor>[Enter] Save | [Esc] Cancel</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {typeIcon} {typeLabel} Location
        </Text>
      </Box>

      {/* Previous location context */}
      {previousLocation && type === 'drop' && (
        <Box marginBottom={1}>
          <Text dimColor>From: {previousLocation.name}</Text>
        </Box>
      )}

      {/* Search input */}
      <Box marginBottom={1}>
        <Text color="green">Search: </Text>
        <TextInput
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Type to search or select below..."
          focus={isFocused && mode === 'search'}
        />
        {isSearching && (
          <Box marginLeft={1}>
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>
          </Box>
        )}
      </Box>

      {/* Results list */}
      {results.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {results.map((result, index) => (
            <Box key={result.id}>
              <Text
                color={index === selectedIndex ? 'cyan' : undefined}
                bold={index === selectedIndex}
                inverse={index === selectedIndex}
              >
                {index === selectedIndex ? '❯ ' : '  '}
                {result.type === 'saved' && '⭐ '}
                {result.type === 'favorite' && '💛 '}
                {result.type === 'prediction' && '📍 '}
                {result.name}
                {result.subtitle && (
                  <Text dimColor={index !== selectedIndex}> - {result.subtitle}</Text>
                )}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Empty state */}
      {!isSearching && searchQuery.length >= MIN_SEARCH_LENGTH && results.length === 0 && (
        <Box marginTop={1}>
          <Text dimColor>No results found. Try a different search term.</Text>
        </Box>
      )}

      {/* Quick select hint */}
      {searchQuery.length === 0 && savedLocations.length > 0 && (
        <Box marginTop={1}>
          <Text dimColor>Quick select from saved locations above, or type to search</Text>
        </Box>
      )}

      {/* Error */}
      {error && (
        <Box marginTop={1}>
          <Text color="red">✗ {error}</Text>
        </Box>
      )}

      {/* Save prompt after selection */}
      {showSavePrompt && selectedResult && (
        <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="yellow" padding={1}>
          <Text bold>Save this location to favorites?</Text>
          <Box marginTop={1}>
            <Text dimColor>Location: {selectedResult.name}</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>[y] Yes, save it | [n] No, just select | [Esc] Cancel</Text>
          </Box>
        </Box>
      )}

      {/* Footer hints */}
      <Box marginTop={2} flexDirection="column">
        <Text dimColor>↑↓ Navigate | Enter Select | [s] Save to favorites | Esc Back</Text>
      </Box>
    </Box>
  );
}

// =============================================================================
// Hook for managing save prompt state
// =============================================================================

export function useSavePrompt(): {
  showSavePrompt: boolean;
  locationToSave: { lat: number; lon: number; name: string; address?: string } | null;
  promptSave: (location: { lat: number; lon: number; name: string; address?: string }) => void;
  confirmSave: (name: string) => Favorite | null;
  cancelSave: () => void;
} {
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [locationToSave, setLocationToSave] = useState<{
    lat: number;
    lon: number;
    name: string;
    address?: string;
  } | null>(null);

  const promptSave = useCallback(
    (location: { lat: number; lon: number; name: string; address?: string }) => {
      setLocationToSave(location);
      setShowSavePrompt(true);
    },
    []
  );

  const confirmSave = useCallback((name: string): Favorite | null => {
    if (!locationToSave || !name.trim()) return null;

    const favorite = favoritesManager.addFavorite({
      name: name.trim(),
      address: locationToSave.address || locationToSave.name,
      lat: locationToSave.lat,
      lon: locationToSave.lon,
    });

    setShowSavePrompt(false);
    setLocationToSave(null);

    return favorite;
  }, [locationToSave]);

  const cancelSave = useCallback(() => {
    setShowSavePrompt(false);
    setLocationToSave(null);
  }, []);

  return {
    showSavePrompt,
    locationToSave,
    promptSave,
    confirmSave,
    cancelSave,
  };
}