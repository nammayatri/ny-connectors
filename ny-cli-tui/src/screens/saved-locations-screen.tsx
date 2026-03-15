import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { NyApiClient, SavedLocation } from '../hooks/useApi.js';
import { tokenStorage } from '../utils/token-storage.js';

interface SavedLocationsScreenProps {
  client: NyApiClient;
  savedLocations: SavedLocation[];
  onRefresh: () => Promise<SavedLocation[]>;
  onBack: () => void;
  onError: (error: string) => void;
}

/**
 * SavedLocationsScreen Component
 * 
 * Displays the user's saved locations (Home, Work, etc.) from Namma Yatri.
 * Allows viewing location details and refreshing the list.
 */
export function SavedLocationsScreen({ 
  client, 
  savedLocations: initialLocations,
  onRefresh,
  onBack, 
  onError 
}: SavedLocationsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<SavedLocation[]>(initialLocations);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  /**
   * Fetch saved locations from API
   */
  const fetchLocations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const results = await onRefresh();
      setLocations(results);
    } catch (error: any) {
      onError(`Failed to fetch saved locations: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onRefresh, onError]);

  /**
   * Initialize with provided locations
   */
  useEffect(() => {
    if (initialLocations.length > 0) {
      setLocations(initialLocations);
      setLoading(false);
    } else {
      fetchLocations();
    }
  }, [initialLocations, fetchLocations]);

  /**
   * Update locations when props change
   */
  useEffect(() => {
    if (initialLocations.length > 0) {
      setLocations(initialLocations);
    }
  }, [initialLocations]);

  /**
   * Keyboard handler
   */
  useInput((input, key) => {
    if (loading) return;

    // Navigation
    if (key.upArrow) {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : locations.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => (prev < locations.length - 1 ? prev + 1 : 0));
    }

    // Refresh
    if (input === 'r' && !refreshing) {
      fetchLocations(true);
    }

    // Back
    if (key.escape) {
      onBack();
    }
  });

  // Loading state
  if (loading) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text> Loading saved locations...</Text>
        </Box>
      </Box>
    );
  }

  // No locations
  if (locations.length === 0) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="yellow">📍 Saved Locations</Text>
        </Box>
        
        <Box marginBottom={1}>
          <Text dimColor>No saved locations found.</Text>
        </Box>
        
        <Box marginBottom={1}>
          <Text dimColor>
            Add locations in the Namma Yatri mobile app (Home, Work, etc.)
          </Text>
        </Box>
        
        <Box marginTop={1}>
          <Text dimColor>
            Press <Text bold>ESC</Text> to go back | <Text bold>r</Text> Refresh
          </Text>
        </Box>
      </Box>
    );
  }

  // Main render
  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="yellow">📍 Saved Locations</Text>
        {refreshing && (
          <Box marginLeft={2}>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
            <Text> Refreshing...</Text>
          </Box>
        )}
      </Box>

      {/* Location List */}
      <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
        {locations.map((loc, index) => {
          const isSelected = index === selectedIndex;

          return (
            <Box
              key={loc.tag}
              flexDirection="column"
              paddingY={isSelected ? 1 : 0}
              borderStyle={isSelected ? 'round' : undefined}
              borderColor={isSelected ? 'cyan' : undefined}
            >
              {/* Main row */}
              <Box>
                <Box width={3}>
                  <Text color={isSelected ? 'cyan' : undefined}>
                    {isSelected ? '▶ ' : '  '}
                  </Text>
                </Box>
                <Text bold color={isSelected ? 'white' : 'cyan'}>
                  {loc.tag}
                </Text>
                {loc.locationName && (
                  <Text> - {loc.locationName}</Text>
                )}
              </Box>

              {/* Details row */}
              <Box marginLeft={3}>
                {loc.area && <Text dimColor>{loc.area}</Text>}
                {loc.city && <Text dimColor>, {loc.city}</Text>}
              </Box>

              {/* Coordinates (for selected) */}
              {isSelected && (
                <Box marginLeft={3}>
                  <Text dimColor>
                    📍 {loc.lat.toFixed(6)}, {loc.lon.toFixed(6)}
                  </Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Selected Location Details */}
      {locations.length > 0 && locations[selectedIndex] && (
        <Box marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
          <Box flexDirection="column">
            <Text bold>Selected: {locations[selectedIndex].tag}</Text>
            <Box marginTop={1}>
              <Text dimColor>
                Use this location when booking by selecting it from the saved locations list.
              </Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={2}>
        <Text dimColor>
          <Text bold>↑↓</Text> Navigate | <Text bold>r</Text> Refresh | <Text bold>ESC</Text> Back
        </Text>
        <Text dimColor> | {locations.length} location(s)</Text>
      </Box>
    </Box>
  );
}

export default SavedLocationsScreen;