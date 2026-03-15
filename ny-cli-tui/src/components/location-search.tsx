import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import FuzzySearch from 'fuzzy-search';
import { NyClient, Place, PlaceDetails, SavedLocation } from '../api/client.js';

/**
 * Result item that can be either a place or a saved location
 */
export interface LocationSearchResult {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Subtitle (area, city, etc.) */
  subtitle?: string;
  /** Whether this is a saved location */
  isSaved?: boolean;
  /** The original place data */
  place?: Place;
  /** The original saved location data */
  savedLocation?: SavedLocation;
}

/**
 * Props for the LocationSearch component
 */
export interface LocationSearchProps {
  /** NyClient instance for API calls */
  client: NyClient;
  /** Label displayed above the search input */
  label?: string;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Saved locations to show at the top */
  savedLocations?: SavedLocation[];
  /** Optional source location for proximity search */
  sourceLocation?: { lat: number; lon: number };
  /** Called when a location is selected */
  onSelect: (result: {
    placeDetails: PlaceDetails;
    label: string;
    isSaved: boolean;
  }) => void;
  /** Called when user cancels (ESC) */
  onCancel?: () => void;
  /** Called when an error occurs */
  onError?: (error: string) => void;
  /** Whether the component is in focus */
  isFocused?: boolean;
  /** Minimum characters before searching */
  minSearchLength?: number;
  /** Maximum results to show */
  maxResults?: number;
  /** Show saved locations section */
  showSavedLocations?: boolean;
  /** Title for saved locations section */
  savedLocationsTitle?: string;
}

type SearchState = 'idle' | 'loading' | 'results' | 'error';

/**
 * LocationSearch Component
 * 
 * A self-contained component for searching and selecting locations.
 * Features:
 * - Fuzzy search input with debouncing
 * - Results list with arrow-key navigation
 * - Saved locations integration
 * - Loading and error states
 * - Selection confirmation
 */
export function LocationSearch({
  client,
  label = 'Search for a location:',
  placeholder = 'Type to search...',
  savedLocations = [],
  sourceLocation,
  onSelect,
  onCancel,
  onError,
  isFocused = true,
  minSearchLength = 2,
  maxResults = 10,
  showSavedLocations = true,
  savedLocationsTitle = 'Saved Locations',
}: LocationSearchProps) {
  // Search state
  const [searchText, setSearchText] = useState('');
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // UI state
  const [mode, setMode] = useState<'saved' | 'search'>(
    showSavedLocations && savedLocations.length > 0 ? 'saved' : 'search'
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Debounce timer
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Fuzzy search through saved locations
  const filteredSavedLocations = useMemo(() => {
    if (!showSavedLocations || savedLocations.length === 0) return [];
    if (!searchText || mode === 'saved') return savedLocations;
    
    const searcher = new FuzzySearch(
      savedLocations,
      ['tag', 'locationName', 'area', 'city'],
      { caseSensitive: false }
    );
    return searcher.search(searchText);
  }, [savedLocations, searchText, showSavedLocations, mode]);

  // Convert saved locations to result items
  const savedLocationItems: LocationSearchResult[] = useMemo(() => {
    return filteredSavedLocations.map(loc => ({
      id: `saved-${loc.tag}`,
      label: `${loc.tag}`,
      subtitle: loc.locationName || loc.area || loc.city || '',
      isSaved: true,
      savedLocation: loc,
    }));
  }, [filteredSavedLocations]);

  // Convert search results to result items
  const searchResultItems: LocationSearchResult[] = useMemo(() => {
    return searchResults.slice(0, maxResults).map(place => ({
      id: place.placeId,
      label: place.description.split(',')[0],
      subtitle: place.description.split(',').slice(1).join(',').trim(),
      isSaved: false,
      place,
    }));
  }, [searchResults, maxResults]);

  // Combined results based on mode
  const displayItems = useMemo(() => {
    if (mode === 'saved') {
      return savedLocationItems;
    }
    return searchResultItems;
  }, [mode, savedLocationItems, searchResultItems]);

  // Search for places
  const performSearch = useCallback(async (query: string) => {
    if (query.length < minSearchLength) {
      setSearchResults([]);
      setSearchState('idle');
      return;
    }

    setSearchState('loading');
    setErrorMessage(null);

    try {
      const results = await client.searchPlaces(query, sourceLocation);
      setSearchResults(results);
      setSearchState(results.length > 0 ? 'results' : 'idle');
      setSelectedIndex(0);
    } catch (error: any) {
      const msg = error.message || 'Failed to search locations';
      setErrorMessage(msg);
      setSearchState('error');
      onError?.(msg);
    }
  }, [client, sourceLocation, minSearchLength, onError]);

  // Handle input change with debouncing
  const handleInputChange = useCallback((value: string) => {
    setSearchText(value);
    
    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // Set new timer
    const timer = setTimeout(() => {
      if (value.length >= minSearchLength) {
        setMode('search');
        performSearch(value);
      } else if (value.length === 0 && showSavedLocations && savedLocations.length > 0) {
        setMode('saved');
        setSearchResults([]);
        setSearchState('idle');
      }
    }, 300);
    
    setDebounceTimer(timer);
  }, [debounceTimer, minSearchLength, performSearch, showSavedLocations, savedLocations.length]);

  // Handle selection
  const handleSelect = useCallback(async (item: LocationSearchResult) => {
    if (item.isSaved && item.savedLocation) {
      // Handle saved location selection
      const loc = item.savedLocation;
      onSelect({
        placeDetails: {
          lat: loc.lat,
          lon: loc.lon,
          placeId: loc.placeId || '',
          address: {
            area: loc.area,
            city: loc.city,
          },
        },
        label: `${loc.tag}${loc.locationName ? ` - ${loc.locationName}` : ''}`,
        isSaved: true,
      });
    } else if (item.place) {
      // Handle place selection - fetch details
      setSearchState('loading');
      try {
        const details = await client.getPlaceDetails(item.place.placeId);
        onSelect({
          placeDetails: details,
          label: item.place.description,
          isSaved: false,
        });
      } catch (error: any) {
        const msg = error.message || 'Failed to get location details';
        setErrorMessage(msg);
        setSearchState('error');
        onError?.(msg);
      }
    }
  }, [client, onSelect, onError]);

  // Handle keyboard navigation
  useInput((input, key) => {
    if (!isFocused) return;

    if (key.escape) {
      onCancel?.();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex(prev => Math.min(displayItems.length - 1, prev + 1));
      return;
    }

    if (key.return && displayItems.length > 0) {
      handleSelect(displayItems[selectedIndex]);
      return;
    }

    // Number shortcuts for quick selection
    const num = parseInt(input);
    if (num >= 1 && num <= Math.min(9, displayItems.length)) {
      handleSelect(displayItems[num - 1]);
    }
  }, { isActive: isFocused });

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [displayItems.length]);

  return (
    <Box flexDirection="column">
      {/* Label */}
      <Box marginBottom={1}>
        <Text bold>{label}</Text>
      </Box>

      {/* Search input */}
      <Box marginBottom={1}>
        <Box marginRight={1}>
          <Text dimColor>{'>'}</Text>
        </Box>
        <TextInput
          value={searchText}
          onChange={handleInputChange}
          placeholder={placeholder}
          showCursor={isFocused}
        />
        {searchState === 'loading' && (
          <Box marginLeft={1}>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
          </Box>
        )}
      </Box>

      {/* Error message */}
      {searchState === 'error' && errorMessage && (
        <Box marginBottom={1}>
          <Text color="red">✗ {errorMessage}</Text>
        </Box>
      )}

      {/* Mode indicator */}
      {mode === 'saved' && savedLocationItems.length > 0 && (
        <Box marginBottom={1}>
          <Text dimColor>📁 {savedLocationsTitle}</Text>
        </Box>
      )}

      {/* Results list */}
      {displayItems.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {displayItems.map((item, index) => (
            <Box key={item.id}>
              <Box width={3}>
                <Text
                  color={index === selectedIndex ? 'cyan' : undefined}
                  bold={index === selectedIndex}
                >
                  {index === selectedIndex ? '▶' : ' '}
                </Text>
              </Box>
              <Box flexDirection="column">
                <Text
                  color={index === selectedIndex ? 'cyan' : undefined}
                  bold={index === selectedIndex}
                >
                  {item.isSaved ? '📍 ' : '🔍 '}
                  {item.label}
                </Text>
                {item.subtitle && (
                  <Text dimColor>    {item.subtitle}</Text>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* No results message */}
      {searchState === 'idle' && searchText.length >= minSearchLength && displayItems.length === 0 && (
        <Box marginTop={1}>
          <Text dimColor>No locations found. Try a different search.</Text>
        </Box>
      )}

      {/* Help text */}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          ↑↓ Navigate | Enter Select | ESC Cancel
          {displayItems.length > 0 && displayItems.length <= 9 && ' | 1-9 Quick select'}
        </Text>
      </Box>
    </Box>
  );
}

/**
 * LocationSearchWithSelect - A variant that uses ink-select-input for navigation
 * This provides a more traditional select input experience
 */
export function LocationSearchWithSelect({
  client,
  label = 'Search for a location:',
  placeholder = 'Type to search...',
  savedLocations = [],
  sourceLocation,
  onSelect,
  onCancel,
  onError,
  isFocused = true,
  minSearchLength = 2,
  maxResults = 10,
  showSavedLocations = true,
  savedLocationsTitle = 'Saved Locations',
}: LocationSearchProps) {
  // Search state
  const [searchText, setSearchText] = useState('');
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // UI state
  const [showResults, setShowResults] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Fuzzy search through saved locations
  const filteredSavedLocations = useMemo(() => {
    if (!showSavedLocations || savedLocations.length === 0) return [];
    if (!searchText) return savedLocations;
    
    const searcher = new FuzzySearch(
      savedLocations,
      ['tag', 'locationName', 'area', 'city'],
      { caseSensitive: false }
    );
    return searcher.search(searchText);
  }, [savedLocations, searchText, showSavedLocations]);

  // Build select items
  const selectItems = useMemo(() => {
    const items: Array<{ label: string; value: string; data: LocationSearchResult }> = [];
    
    // Add saved locations first
    if (filteredSavedLocations.length > 0 && !showResults) {
      filteredSavedLocations.forEach(loc => {
        items.push({
          label: `📍 ${loc.tag}${loc.locationName ? ` - ${loc.locationName}` : ''}`,
          value: `saved-${loc.tag}`,
          data: {
            id: `saved-${loc.tag}`,
            label: loc.tag,
            isSaved: true,
            savedLocation: loc,
          },
        });
      });
    }
    
    // Add search results
    if (showResults && searchResults.length > 0) {
      searchResults.slice(0, maxResults).forEach(place => {
        items.push({
          label: `🔍 ${place.description}`,
          value: place.placeId,
          data: {
            id: place.placeId,
            label: place.description,
            isSaved: false,
            place,
          },
        });
      });
    }
    
    return items;
  }, [filteredSavedLocations, searchResults, showResults, maxResults]);

  // Search for places
  const performSearch = useCallback(async (query: string) => {
    if (query.length < minSearchLength) {
      setSearchResults([]);
      setSearchState('idle');
      setShowResults(false);
      return;
    }

    setSearchState('loading');
    setErrorMessage(null);

    try {
      const results = await client.searchPlaces(query, sourceLocation);
      setSearchResults(results);
      setSearchState(results.length > 0 ? 'results' : 'idle');
      setShowResults(results.length > 0);
    } catch (error: any) {
      const msg = error.message || 'Failed to search locations';
      setErrorMessage(msg);
      setSearchState('error');
      onError?.(msg);
    }
  }, [client, sourceLocation, minSearchLength, onError]);

  // Handle input change with debouncing
  const handleInputChange = useCallback((value: string) => {
    setSearchText(value);
    setShowResults(false);
    
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    const timer = setTimeout(() => {
      performSearch(value);
    }, 300);
    
    setDebounceTimer(timer);
  }, [debounceTimer, performSearch]);

  // Handle selection from SelectInput
  const handleSelect = useCallback(async (item: { value: string }) => {
    const selectItem = selectItems.find(i => i.value === item.value);
    if (!selectItem) return;

    const data = selectItem.data;
    
    if (data.isSaved && data.savedLocation) {
      const loc = data.savedLocation;
      onSelect({
        placeDetails: {
          lat: loc.lat,
          lon: loc.lon,
          placeId: loc.placeId || '',
          address: {
            area: loc.area,
            city: loc.city,
          },
        },
        label: `${loc.tag}${loc.locationName ? ` - ${loc.locationName}` : ''}`,
        isSaved: true,
      });
    } else if (data.place) {
      setSearchState('loading');
      try {
        const details = await client.getPlaceDetails(data.place.placeId);
        onSelect({
          placeDetails: details,
          label: data.place.description,
          isSaved: false,
        });
      } catch (error: any) {
        const msg = error.message || 'Failed to get location details';
        setErrorMessage(msg);
        setSearchState('error');
        onError?.(msg);
      }
    }
  }, [client, selectItems, onSelect, onError]);

  // Handle keyboard for cancel
  useInput((input, key) => {
    if (!isFocused) return;
    
    if (key.escape) {
      if (showResults) {
        setShowResults(false);
        setSearchResults([]);
      } else {
        onCancel?.();
      }
    }
  }, { isActive: isFocused });

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  return (
    <Box flexDirection="column">
      {/* Label */}
      <Box marginBottom={1}>
        <Text bold>{label}</Text>
      </Box>

      {/* Search input */}
      <Box marginBottom={1}>
        <Box marginRight={1}>
          <Text dimColor>{'>'}</Text>
        </Box>
        <TextInput
          value={searchText}
          onChange={handleInputChange}
          onSubmit={() => {
            if (searchResults.length > 0) {
              setShowResults(true);
            }
          }}
          placeholder={placeholder}
          showCursor={isFocused}
        />
        {searchState === 'loading' && (
          <Box marginLeft={1}>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
          </Box>
        )}
      </Box>

      {/* Error message */}
      {searchState === 'error' && errorMessage && (
        <Box marginBottom={1}>
          <Text color="red">✗ {errorMessage}</Text>
        </Box>
      )}

      {/* Results section */}
      {selectItems.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {!showResults && filteredSavedLocations.length > 0 && (
            <Box marginBottom={1}>
              <Text dimColor>📁 {savedLocationsTitle}</Text>
            </Box>
          )}
          
          <SelectInput
            items={selectItems}
            onSelect={handleSelect}
          />
        </Box>
      )}

      {/* No results message */}
      {searchState === 'idle' && searchText.length >= minSearchLength && selectItems.length === 0 && (
        <Box marginTop={1}>
          <Text dimColor>No locations found. Try a different search.</Text>
        </Box>
      )}

      {/* Help text */}
      <Box marginTop={1}>
        <Text dimColor>
          {showResults 
            ? '↑↓ Navigate | Enter Select | ESC Back'
            : 'Type to search | Enter Show results | ESC Cancel'}
        </Text>
      </Box>
    </Box>
  );
}

export default LocationSearch;