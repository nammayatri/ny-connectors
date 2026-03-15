import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Fuse from 'fuse.js';
import { colors, spacing, componentStyles, icons, animation } from '../theme.js';
import type { SavedLocation } from '../../auth/token-store.js';
import { searchPlaces, type PlacePrediction } from '../../api/client.js';

// =============================================================================
// TYPES
// =============================================================================

export interface LocationResult {
  type: 'saved' | 'place';
  savedLocation?: SavedLocation;
  placePrediction?: PlacePrediction;
  displayName: string;
  subtitle?: string;
}

export interface LocationSearchProps {
  /** Placeholder text for the input */
  placeholder?: string;
  /** Saved locations to include in search */
  savedLocations?: SavedLocation[];
  /** Optional source coordinates for proximity search */
  sourceLat?: number;
  sourceLon?: number;
  /** Callback when a location is selected */
  onSelect: (result: LocationResult) => void;
  /** Callback when search is cancelled */
  onCancel?: () => void;
  /** Initial query value */
  initialValue?: string;
  /** Maximum number of results to show */
  maxResults?: number;
  /** Label for the search input */
  label?: string;
}

interface SearchState {
  status: 'idle' | 'searching' | 'done' | 'error';
  error?: string;
}

// =============================================================================
// FUZZY SEARCH FOR SAVED LOCATIONS
// =============================================================================

function createSavedLocationsFuse(locations: SavedLocation[]): Fuse<SavedLocation> {
  return new Fuse(locations, {
    keys: [
      { name: 'tag', weight: 2 },
      { name: 'locationName', weight: 1.5 },
      { name: 'area', weight: 1 },
      { name: 'address.area', weight: 0.8 },
      { name: 'address.city', weight: 0.5 },
    ],
    threshold: 0.4,
    includeScore: true,
    ignoreLocation: true,
    useExtendedSearch: true,
  });
}

function searchSavedLocations(
  fuse: Fuse<SavedLocation> | null,
  query: string
): LocationResult[] {
  if (!fuse) return [];
  
  if (!query.trim()) {
    // Return all saved locations when query is empty
    return fuse.getIndex().docs.slice(0, 5).map((loc) => ({
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

// =============================================================================
// FORMAT ADDRESS FOR DISPLAY
// =============================================================================

function formatAddress(result: LocationResult): { primary: string; secondary: string } {
  if (result.type === 'saved' && result.savedLocation) {
    const loc = result.savedLocation;
    const parts: string[] = [];
    
    if (loc.address?.building) parts.push(loc.address.building);
    if (loc.address?.street) parts.push(loc.address.street);
    if (loc.area && !parts.includes(loc.area)) parts.push(loc.area);
    if (loc.city && !parts.includes(loc.city)) parts.push(loc.city);
    
    return {
      primary: loc.tag,
      secondary: parts.length > 0 ? parts.join(', ') : `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`,
    };
  }
  
  if (result.type === 'place' && result.placePrediction) {
    const place = result.placePrediction;
    // Parse the description - typically "Main text, Secondary text"
    const parts = place.description.split(', ');
    const primary = parts[0] ?? place.description;
    const secondary = parts.length > 1 ? parts.slice(1).join(', ') : '';
    
    return {
      primary,
      secondary: secondary || (place.distanceWithUnit 
        ? `${place.distanceWithUnit.value} ${place.distanceWithUnit.unit}` 
        : ''),
    };
  }
  
  return {
    primary: result.displayName,
    secondary: result.subtitle ?? '',
  };
}

// =============================================================================
// DEBOUNCE HOOK
// =============================================================================

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// =============================================================================
// LOCATION SEARCH COMPONENT
// =============================================================================

export function LocationSearch({
  placeholder = 'Search for a location...',
  savedLocations = [],
  sourceLat,
  sourceLon,
  onSelect,
  onCancel,
  initialValue = '',
  maxResults = 10,
  label = 'Location',
}: LocationSearchProps): JSX.Element {
  const { exit } = useApp();
  
  // State
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle' });
  const [isInputFocused, setIsInputFocused] = useState(true);
  
  // Refs
  const fuseRef = useRef<Fuse<SavedLocation> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Debounced query for API calls
  const debouncedQuery = useDebounce(query, animation.searchDebounce);
  
  // Initialize fuzzy search for saved locations
  useEffect(() => {
    if (savedLocations.length > 0) {
      fuseRef.current = createSavedLocationsFuse(savedLocations);
    } else {
      fuseRef.current = null;
    }
  }, [savedLocations]);
  
  // Search effect - runs when debounced query changes
  useEffect(() => {
    const performSearch = async () => {
      // Cancel previous search
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Search saved locations first (instant)
      const savedResults = searchSavedLocations(fuseRef.current, debouncedQuery);
      
      // If query is empty or very short, just show saved locations
      if (!debouncedQuery.trim() || debouncedQuery.trim().length < 2) {
        setResults(savedResults);
        setSelectedIndex(0);
        setSearchState({ status: 'idle' });
        return;
      }
      
      // Start API search
      setSearchState({ status: 'searching' });
      
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      try {
        const placePredictions = await searchPlaces(debouncedQuery, {
          lat: sourceLat,
          lon: sourceLon,
        });
        
        if (controller.signal.aborted) return;
        
        // Combine saved locations and API results
        const combined: LocationResult[] = [...savedResults];
        
        const remainingSlots = maxResults - combined.length;
        if (remainingSlots > 0) {
          for (const place of placePredictions.slice(0, remainingSlots)) {
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
        
        setResults(combined);
        setSelectedIndex(0);
        setSearchState({ status: 'done' });
      } catch (error) {
        if (controller.signal.aborted) return;
        
        // Still show saved results on error
        setResults(savedResults);
        setSelectedIndex(0);
        setSearchState({ 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Search failed' 
        });
      }
    };
    
    performSearch();
    
    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedQuery, sourceLat, sourceLon, maxResults]);
  
  // Handle selection
  const handleSelect = useCallback((result: LocationResult) => {
    onSelect(result);
  }, [onSelect]);
  
  // Handle cancel
  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    } else {
      exit();
    }
  }, [onCancel, exit]);
  
  // Clear search
  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setSelectedIndex(0);
    setSearchState({ status: 'idle' });
  }, []);
  
  // Keyboard input handling
  useInput((input, key) => {
    // If not focused on input, handle navigation
    if (!isInputFocused) {
      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(results.length - 1, prev + 1));
      } else if (key.return && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      } else if (key.escape) {
        handleCancel();
      } else if (input === 'i' || input === '/') {
        // Refocus input
        setIsInputFocused(true);
      }
      return;
    }
    
    // Input is focused
    if (key.escape) {
      if (query.length > 0) {
        // Clear the search first
        handleClear();
      } else {
        // Cancel if search is empty
        handleCancel();
      }
    } else if (key.upArrow) {
      // Navigate up in results
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      // Navigate down in results
      setSelectedIndex((prev) => Math.min(results.length - 1, prev + 1));
    } else if (key.return && results[selectedIndex]) {
      // Select current result
      handleSelect(results[selectedIndex]);
    } else if (key.tab) {
      // Tab to unfocus input and navigate results
      setIsInputFocused(false);
    }
  }, { isActive: true });
  
  // Render
  return (
    <Box flexDirection="column" padding={spacing.sm}>
      {/* Label */}
      <Box marginBottom={spacing.xs}>
        <Text bold color="cyan">
          {label}
        </Text>
      </Box>
      
      {/* Search Input */}
      <Box 
        borderStyle="single" 
        borderColor={isInputFocused ? colors.primary : colors.gray[600]}
        paddingX={spacing.sm}
      >
        <Text dimColor>{componentStyles.input.prefix} </Text>
        <TextInput
          value={query}
          onChange={setQuery}
          placeholder={placeholder}
          showCursor={isInputFocused}
        />
        {searchState.status === 'searching' && (
          <Box marginLeft={spacing.sm}>
            <Text color="yellow">{icons.spinner}</Text>
          </Box>
        )}
      </Box>
      
      {/* Error message */}
      {searchState.status === 'error' && (
        <Box marginTop={spacing.xs}>
          <Text color="red">
            {icons.warning} {searchState.error}
          </Text>
        </Box>
      )}
      
      {/* Results List */}
      {results.length > 0 && (
        <Box flexDirection="column" marginTop={spacing.md}>
          {results.map((result, index) => {
            const { primary, secondary } = formatAddress(result);
            const isSelected = index === selectedIndex;
            
            return (
              <Box 
                key={`${result.type}-${result.type === 'saved' ? result.savedLocation?.tag : result.placePrediction?.placeId}-${index}`}
                flexDirection="column"
              >
                <Box>
                  <Text
                    color={isSelected ? colors.primary : undefined}
                    bold={isSelected}
                  >
                    {isSelected ? icons.pointer : ' '}{' '}
                  </Text>
                  <Text
                    color={isSelected ? colors.primary : colors.gray[100]}
                    bold={isSelected}
                  >
                    {primary}
                  </Text>
                  {result.type === 'saved' && (
                    <Box marginLeft={spacing.sm}>
                      <Text dimColor color="cyan">
                        [saved]
                      </Text>
                    </Box>
                  )}
                </Box>
                {secondary && (
                  <Box marginLeft={3}>
                    <Text dimColor color={colors.gray[500]}>
                      {secondary}
                    </Text>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}
      
      {/* No results message */}
      {results.length === 0 && query.trim().length >= 2 && searchState.status === 'done' && (
        <Box marginTop={spacing.md}>
          <Text dimColor>No locations found for "{query}"</Text>
        </Box>
      )}
      
      {/* Help text */}
      <Box marginTop={spacing.md} flexDirection="column">
        <Text dimColor>
          {icons.chevron} Type to search
        </Text>
        <Text dimColor>
          {icons.chevron} ↑/↓ Navigate | Enter Select | ESC Clear/Cancel
        </Text>
        {savedLocations.length > 0 && (
          <Text dimColor>
            {icons.chevron} Saved locations shown first
          </Text>
        )}
      </Box>
    </Box>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default LocationSearch;