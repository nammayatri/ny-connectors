// ============================================================================
// Location Screen Component
// Origin/Destination selection with saved locations and search
// ============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import type { Place, PlaceDetails, SavedLocation } from '../types.js';

interface LocationScreenProps {
  token: string;
  savedLocations: SavedLocation[];
  origin: PlaceDetails | null;
  destination: PlaceDetails | null;
  searchResults: Place[];
  isSearching: boolean;
  error: string | null;
  onSearchPlaces: (query: string) => void;
  onSelectPlace: (placeId: string) => void;
  onSelectSavedLocation: (location: SavedLocation) => void;
  onConfirmLocations: () => void;
  onBack: () => void;
}

type LocationStep = 'origin' | 'destination' | 'confirm';
type InputMode = 'saved' | 'search' | 'results';

export function LocationScreen({
  token,
  savedLocations,
  origin,
  destination,
  searchResults,
  isSearching,
  error,
  onSearchPlaces,
  onSelectPlace,
  onSelectSavedLocation,
  onConfirmLocations,
  onBack,
}: LocationScreenProps) {
  const [step, setStep] = useState<LocationStep>(origin ? 'destination' : 'origin');
  const [mode, setMode] = useState<InputMode>('saved');
  const [searchQuery, setSearchQuery] = useState('');

  const currentLocation = step === 'origin' ? origin : destination;

  useEffect(() => {
    if (origin && destination) {
      setStep('confirm');
    }
  }, [origin, destination]);

  const handleSearchSubmit = useCallback(() => {
    if (searchQuery.trim()) {
      onSearchPlaces(searchQuery.trim());
      setMode('results');
    }
  }, [searchQuery, onSearchPlaces]);

  const handleSelectPlace = useCallback(
    (item: { value: string; label: string }) => {
      onSelectPlace(item.value);
      setMode('saved');
      setSearchQuery('');

      if (step === 'origin') {
        setStep('destination');
      } else if (step === 'destination') {
        setStep('confirm');
      }
    },
    [onSelectPlace, step]
  );

  const handleSelectSaved = useCallback(
    (item: { value: string; label: string }) => {
      const location = savedLocations.find((l) => l.tag === item.value);
      if (location) {
        onSelectSavedLocation(location);
        setMode('saved');

        if (step === 'origin') {
          setStep('destination');
        } else if (step === 'destination') {
          setStep('confirm');
        }
      }
    },
    [savedLocations, onSelectSavedLocation, step]
  );

  const handleConfirm = useCallback(() => {
    onConfirmLocations();
  }, [onConfirmLocations]);

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }

    if (key.tab) {
      if (mode === 'saved') setMode('search');
      else if (mode === 'search') setMode('saved');
      else if (mode === 'results') setMode('search');
      return;
    }

    if (key.return && mode === 'search') {
      handleSearchSubmit();
      return;
    }

    if (key.return && step === 'confirm') {
      handleConfirm();
      return;
    }
  });

  const savedLocationItems = savedLocations.map((loc) => ({
    label: `${loc.tag}${loc.area ? ` — ${loc.area}` : ''}`,
    value: loc.tag,
  }));

  const searchResultItems = searchResults.map((place) => ({
    label: `${place.description}${place.distance ? ` (${Math.round(place.distance)}m)` : ''}`,
    value: place.placeId,
  }));

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📍 Select Locations
        </Text>
      </Box>

      {/* Progress indicator */}
      <Box marginBottom={1}>
        <Text color={origin ? 'green' : 'yellow'}>
          {origin ? '✓' : '○'} Origin
        </Text>
        <Text> → </Text>
        <Text color={destination ? 'green' : step === 'destination' ? 'yellow' : 'gray'}>
          {destination ? '✓' : '○'} Destination
        </Text>
      </Box>

      {/* Current selection display */}
      {origin && (
        <Box marginBottom={1}>
          <Text dimColor>From: </Text>
          <Text>
            {origin.address.area || `${origin.lat.toFixed(4)}, ${origin.lon.toFixed(4)}`}
          </Text>
        </Box>
      )}

      {destination && (
        <Box marginBottom={1}>
          <Text dimColor>To: </Text>
          <Text>
            {destination.address.area || `${destination.lat.toFixed(4)}, ${destination.lon.toFixed(4)}`}
          </Text>
        </Box>
      )}

      {error && (
        <Box marginBottom={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
      )}

      {/* Input section */}
      {step !== 'confirm' && (
        <Box flexDirection="column" marginTop={1}>
          <Box marginBottom={1}>
            <Text bold>
              {step === 'origin' ? 'Select Origin' : 'Select Destination'}
            </Text>
          </Box>

          {/* Mode toggle */}
          <Box marginBottom={1}>
            <Text color={mode === 'saved' ? 'green' : 'gray'}>
              [{mode === 'saved' ? '✓' : ' '}] Saved Locations
            </Text>
            <Text>  </Text>
            <Text color={mode === 'search' || mode === 'results' ? 'green' : 'gray'}>
              [{mode === 'search' || mode === 'results' ? '✓' : ' '}] Search
            </Text>
          </Box>

          {/* Saved locations list */}
          {mode === 'saved' && savedLocationItems.length > 0 && (
            <Box marginTop={1}>
              <SelectInput
                items={savedLocationItems}
                onSelect={handleSelectSaved}
              />
            </Box>
          )}

          {mode === 'saved' && savedLocationItems.length === 0 && (
            <Box marginTop={1}>
              <Text dimColor>No saved locations. Press Tab to search.</Text>
            </Box>
          )}

          {/* Search input */}
          {mode === 'search' && (
            <Box marginTop={1}>
              <Text>Search: </Text>
              <TextInput
                value={searchQuery}
                onChange={setSearchQuery}
                onSubmit={handleSearchSubmit}
                placeholder="Enter location name"
                focus={true}
              />
            </Box>
          )}

          {/* Search results */}
          {mode === 'results' && (
            <Box flexDirection="column" marginTop={1}>
              {isSearching ? (
                <Text color="yellow">
                  <Spinner type="dots" /> Searching...
                </Text>
              ) : searchResultItems.length > 0 ? (
                <>
                  <Box marginBottom={1}>
                    <Text dimColor>Select a location:</Text>
                  </Box>
                  <SelectInput
                    items={searchResultItems}
                    onSelect={handleSelectPlace}
                  />
                </>
              ) : (
                <Text dimColor>No results found. Press Tab to search again.</Text>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Confirm step */}
      {step === 'confirm' && (
        <Box flexDirection="column" marginTop={2}>
          <Box marginBottom={1}>
            <Text bold color="green">✓ Locations confirmed</Text>
          </Box>
          <Box>
            <Text>Press Enter to search for rides, or Esc to go back</Text>
          </Box>
        </Box>
      )}

      <Box marginTop={2}>
        <Text dimColor>
          Tab: switch mode • Enter: confirm • Esc: back
        </Text>
      </Box>
    </Box>
  );
}

export default LocationScreen;
