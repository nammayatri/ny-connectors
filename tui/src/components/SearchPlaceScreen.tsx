import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import type { SearchPlaceScreenProps, Prediction, PlaceDetailsResponse, SavedLocation } from '../types/index.js';
import { usePlaces } from '../hooks/usePlaces.js';
import { loadToken, findSavedLocation, savedLocationToPlaceDetails } from '../utils/token.js';

interface PlaceItem {
  label: string;
  value: string;
  prediction?: Prediction;
  savedLocation?: SavedLocation;
}

export function SearchPlaceScreen({ title, onSelect, onCancel, savedLocations }: SearchPlaceScreenProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetailsResponse | null>(null);
  const { isLoading, predictions, error, search, getDetails, clearPredictions, clearError } = usePlaces();

  // Load token on mount
  useEffect(() => {
    async function init() {
      const stored = await loadToken();
      if (stored?.token) {
        setToken(stored.token);
      }
    }
    init();
  }, []);

  // Debounced search
  useEffect(() => {
    if (!token || !query.trim()) {
      clearPredictions();
      return;
    }

    // Check if query matches a saved location
    const savedLoc = findSavedLocation(savedLocations || [], query);
    if (savedLoc) {
      // Don't auto-select, but we could show it prominently
    }

    const timeout = setTimeout(() => {
      search(token, query);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, token, search, clearPredictions, savedLocations]);

  const handleSelect = useCallback(async (item: PlaceItem) => {
    if (!token) return;

    if (item.savedLocation) {
      const details = savedLocationToPlaceDetails(item.savedLocation);
      onSelect(details as PlaceDetailsResponse);
      return;
    }

    if (item.prediction) {
      const details = await getDetails(token, item.prediction.placeId);
      if (details) {
        onSelect(details);
      }
    }
  }, [token, getDetails, onSelect]);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  // Build items list: saved locations first, then predictions
  const items: PlaceItem[] = [];

  // Add matching saved locations
  if (savedLocations && query.trim()) {
    const matchingSaved = savedLocations.filter(loc =>
      loc.tag.toLowerCase().includes(query.toLowerCase()) ||
      (loc.locationName && loc.locationName.toLowerCase().includes(query.toLowerCase()))
    );
    items.push(...matchingSaved.map(loc => ({
      label: `⭐ ${loc.tag}${loc.locationName ? `: ${loc.locationName}` : ''}`,
      value: `saved:${loc.tag}`,
      savedLocation: loc,
    })));
  }

  // Add predictions
  items.push(...predictions.map(pred => ({
    label: pred.distanceWithUnit
      ? `${pred.description} (${pred.distanceWithUnit.value} ${pred.distanceWithUnit.unit})`
      : pred.description,
    value: pred.placeId,
    prediction: pred,
  })));

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="green">{title}</Text>

      <Box flexDirection="column" gap={1}>
        <Text>Search for a place:</Text>
        <TextInput
          value={query}
          onChange={(value) => {
            setQuery(value);
            clearError();
          }}
          placeholder="Type to search..."
        />
      </Box>

      {isLoading && (
        <Text color="yellow">Searching...</Text>
      )}

      {error && (
        <Text color="red">Error: {error}</Text>
      )}

      {items.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Select a location:</Text>
          <SelectInput items={items} onSelect={handleSelect} />
        </Box>
      )}

      {query.trim() && !isLoading && items.length === 0 && !error && (
        <Text dimColor>No places found. Try a different search.</Text>
      )}

      <Text dimColor marginTop={1}>
        Press Esc to cancel
      </Text>
    </Box>
  );
}
