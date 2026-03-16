/**
 * Saved Locations Screen
 * Display and manage saved locations (Home, Work, etc.)
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { apiClient, SavedLocation } from '../../api/index.js';

interface SavedLocationsScreenProps {
  onBack: () => void;
}

interface SelectItem {
  label: string;
  value: string;
}

export function SavedLocationsScreen({ onBack }: SavedLocationsScreenProps): React.ReactElement {
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const results = await apiClient.getSavedLocations();
      setLocations(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load saved locations');
    } finally {
      setIsLoading(false);
    }
  };

  const locationOptions: SelectItem[] = locations.map((loc) => ({
    label: `${loc.tag}${loc.locationName ? ` - ${loc.locationName}` : ''}`,
    value: loc.tag,
  }));

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ⭐ Saved Locations
        </Text>
      </Box>

      {isLoading ? (
        <Box>
          <Text color="yellow">
            <Spinner type="dots" /> Loading saved locations...
          </Text>
        </Box>
      ) : error ? (
        <Box>
          <Text color="red">✗ {error}</Text>
        </Box>
      ) : locations.length === 0 ? (
        <Box flexDirection="column">
          <Text dimColor>No saved locations found.</Text>
          <Text dimColor>Add locations in the Namma Yatri mobile app.</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text>Your saved locations:</Text>
          <Box marginTop={1}>
            <SelectInput
              items={locationOptions}
              onSelect={(item) => {
                const loc = locations.find((l) => l.tag === item.value);
                if (loc) {
                  // Could navigate to a detail view or use for booking
                }
              }}
            />
          </Box>
        </Box>
      )}

      {/* Display location details */}
      {locations.length > 0 && (
        <Box marginTop={2} flexDirection="column">
          {locations.map((loc) => (
            <Box key={loc.tag} marginBottom={1} borderStyle="round" padding={1}>
              <Text bold color="cyan">
                {loc.tag}
              </Text>
              {loc.locationName && <Text> - {loc.locationName}</Text>}
              <Text dimColor>
                {' '}
                ({loc.lat.toFixed(4)}, {loc.lon.toFixed(4)})
              </Text>
              {loc.area && (
                <Text dimColor>
                  {' '}
                  - {loc.area}
                  {loc.city ? `, ${loc.city}` : ''}
                </Text>
              )}
            </Box>
          ))}
        </Box>
      )}

      <Box marginTop={2}>
        <SelectInput
          items={[
            { label: '🔄 Refresh', value: 'refresh' },
            { label: '← Back', value: 'back' },
          ]}
          onSelect={(item) => {
            switch (item.value) {
              case 'refresh':
                loadLocations();
                break;
              case 'back':
                onBack();
                break;
            }
          }}
        />
      </Box>
    </Box>
  );
}