// ============================================================================
// Location Selection Wizard Component
// ============================================================================
// Multi-screen wizard for selecting origin and destination locations
// Screens: OriginSelection -> OriginSearch -> OriginConfirm -> DestinationSelection -> DestinationSearch -> DestinationConfirm
// Supports saved locations, search, and quick route buttons

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { useStateMachine } from '../hooks/useStateMachine.js';
import { NammaYatriClient, Place, PlaceDetails } from '../api/client.js';
import { SavedLocation } from '../storage/token.js';

// ============================================================================
// Types
// ============================================================================

export type LocationWizardState =
  | 'ORIGIN_SELECTION'
  | 'ORIGIN_SEARCH'
  | 'ORIGIN_CONFIRM'
  | 'DESTINATION_SELECTION'
  | 'DESTINATION_SEARCH'
  | 'DESTINATION_CONFIRM'
  | 'QUICK_ROUTE_SELECTION'
  | 'LOADING'
  | 'ERROR';

export interface LocationWizardContext {
  origin: PlaceDetails | null;
  destination: PlaceDetails | null;
  searchQuery: string;
  searchResults: Place[];
  selectedPlace: Place | null;
  errorMessage: string | null;
  isSearching: boolean;
}

export interface LocationWizardProps {
  token: string;
  savedLocations: SavedLocation[];
  onComplete: (origin: PlaceDetails, destination: PlaceDetails) => void;
  onCancel: () => void;
}

interface SelectItem {
  label: string;
  value: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert a SavedLocation to PlaceDetails format
 */
function savedLocationToPlaceDetails(saved: SavedLocation): PlaceDetails {
  return {
    lat: saved.lat,
    lon: saved.lon,
    placeId: saved.placeId || `${saved.lat},${saved.lon}`,
    address: {
      area: saved.area,
      areaCode: saved.areaCode,
      building: saved.building,
      city: saved.city,
      country: saved.country,
      door: saved.door,
      placeId: saved.placeId,
      state: saved.state,
      street: saved.street,
      title: saved.locationName || saved.tag,
      ward: saved.ward,
    },
  };
}

/**
 * Format address for display
 */
function formatAddress(address: PlaceDetails['address']): string {
  const parts = [
    address.building,
    address.street,
    address.area,
    address.city,
  ].filter(Boolean);
  return parts.join(', ') || 'Unknown location';
}

/**
 * Format saved location for display
 */
function formatSavedLocation(saved: SavedLocation): string {
  const parts = [
    saved.building,
    saved.street,
    saved.area,
    saved.city,
  ].filter(Boolean);
  return parts.join(', ') || saved.locationName || saved.tag;
}

// ============================================================================
// Origin Selection Screen
// ============================================================================

interface OriginSelectionScreenProps {
  savedLocations: SavedLocation[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSelectSavedLocation: (location: SavedLocation) => void;
  onSearchSubmit: () => void;
  onCancel: () => void;
  onQuickRoute: () => void;
  hasQuickRoutes: boolean;
}

const OriginSelectionScreen: React.FC<OriginSelectionScreenProps> = ({
  savedLocations,
  searchQuery,
  onSearchQueryChange,
  onSelectSavedLocation,
  onSearchSubmit,
  onCancel,
  onQuickRoute,
  hasQuickRoutes,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Calculate total items: saved locations + search input + quick route (if available) + cancel
  const savedLocationItems = savedLocations.length;
  const searchInputIndex = savedLocationItems;
  const quickRouteIndex = hasQuickRoutes ? searchInputIndex + 1 : -1;
  const cancelIndex = hasQuickRoutes ? quickRouteIndex + 1 : searchInputIndex + 1;
  const totalItems = cancelIndex + 1;

  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
      return;
    }

    if (key.return) {
      if (selectedIndex < savedLocationItems) {
        onSelectSavedLocation(savedLocations[selectedIndex]);
      } else if (selectedIndex === searchInputIndex) {
        if (searchQuery.trim()) {
          onSearchSubmit();
        }
      } else if (hasQuickRoutes && selectedIndex === quickRouteIndex) {
        onQuickRoute();
      } else if (selectedIndex === cancelIndex) {
        onCancel();
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📍 Select Origin Location
        </Text>
      </Box>

      {savedLocations.length > 0 && (
        <Box marginBottom={1} flexDirection="column">
          <Text dimColor>Saved Locations:</Text>
          {savedLocations.map((location, index) => (
            <Box key={location.tag}>
              <Text color={selectedIndex === index ? 'cyan' : undefined}>
                {selectedIndex === index ? '▶ ' : '  '}
                <Text bold>{location.tag}</Text>
                <Text dimColor> - {formatSavedLocation(location)}</Text>
              </Text>
            </Box>
          ))}
        </Box>
      )}

      <Box marginTop={1} marginBottom={1}>
        <Text dimColor>Search for a location:</Text>
      </Box>

      <Box>
        <Text color={selectedIndex === searchInputIndex ? 'cyan' : undefined}>
          {selectedIndex === searchInputIndex ? '▶ ' : '  '}
        </Text>
        <TextInput
          value={searchQuery}
          onChange={onSearchQueryChange}
          placeholder="Type to search..."
          focus={selectedIndex === searchInputIndex}
        />
      </Box>

      {hasQuickRoutes && (
        <Box marginTop={1}>
          <Text color={selectedIndex === quickRouteIndex ? 'green' : undefined}>
            {selectedIndex === quickRouteIndex ? '▶ ' : '  '}
            <Text bold>⚡ Quick Route</Text>
            <Text dimColor> - Book between saved locations</Text>
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={selectedIndex === cancelIndex ? 'red' : undefined}>
          {selectedIndex === cancelIndex ? '▶ ' : '  '}
          <Text bold>❌ Cancel</Text>
        </Text>
      </Box>

      <Box marginTop={2}>
        <Text dimColor>Use ↑↓ to navigate, Enter to select, Esc to cancel</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Origin Search Screen
// ============================================================================

interface OriginSearchScreenProps {
  searchQuery: string;
  searchResults: Place[];
  isSearching: boolean;
  onSelectResult: (place: Place) => void;
  onBack: () => void;
}

const OriginSearchScreen: React.FC<OriginSearchScreenProps> = ({
  searchQuery,
  searchResults,
  isSearching,
  onSelectResult,
  onBack,
}) => {
  useInput((_input, key) => {
    if (key.escape) {
      onBack();
    }
  });

  const items: SelectItem[] = searchResults.map((place) => ({
    label: place.description,
    value: place.placeId,
  }));

  const handleSelect = (item: { value: string }) => {
    const place = searchResults.find((p) => p.placeId === item.value);
    if (place) {
      onSelectResult(place);
    }
  };

  if (isSearching) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="cyan">
            🔍 Searching for "{searchQuery}"
          </Text>
        </Box>
        <Box>
          <Text color="green">
            <Spinner type="dots" />
          </Text>
          <Text> Searching...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🔍 Search Results for "{searchQuery}"
        </Text>
      </Box>

      {searchResults.length === 0 ? (
        <Box flexDirection="column">
          <Text color="yellow">No results found.</Text>
          <Box marginTop={1}>
            <Text dimColor>Press Esc to go back and try again</Text>
          </Box>
        </Box>
      ) : (
        <>
          <Box marginBottom={1}>
            <Text dimColor>Select a location:</Text>
          </Box>
          <SelectInput items={items} onSelect={handleSelect} />
        </>
      )}

      <Box marginTop={1}>
        <Text dimColor>Use ↑↓ to navigate, Enter to select, Esc to go back</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Origin Confirm Screen
// ============================================================================

interface OriginConfirmScreenProps {
  placeDetails: PlaceDetails;
  onConfirm: () => void;
  onBack: () => void;
}

const OriginConfirmScreen: React.FC<OriginConfirmScreenProps> = ({
  placeDetails,
  onConfirm,
  onBack,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const options = ['confirm', 'back'] as const;

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }

    if (key.upArrow || key.leftArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      return;
    }

    if (key.downArrow || key.rightArrow) {
      setSelectedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
      return;
    }

    if (key.return) {
      if (selectedIndex === 0) {
        onConfirm();
      } else {
        onBack();
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ✅ Confirm Origin Location
        </Text>
      </Box>

      <Box marginBottom={1} paddingX={1} borderStyle="single" borderColor="green">
        <Box flexDirection="column">
          <Text bold>{placeDetails.address.title || 'Selected Location'}</Text>
          <Text>{formatAddress(placeDetails.address)}</Text>
          <Text dimColor>
            Coordinates: {placeDetails.lat.toFixed(6)}, {placeDetails.lon.toFixed(6)}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={selectedIndex === 0 ? 'green' : undefined}>
          {selectedIndex === 0 ? '▶ ' : '  '}
          <Text bold>✓ Confirm</Text>
          <Text> - Use this as origin</Text>
        </Text>
      </Box>

      <Box>
        <Text color={selectedIndex === 1 ? 'yellow' : undefined}>
          {selectedIndex === 1 ? '▶ ' : '  '}
          <Text bold>← Back</Text>
          <Text> - Choose a different location</Text>
        </Text>
      </Box>

      <Box marginTop={2}>
        <Text dimColor>Use ↑↓ or ←→ to navigate, Enter to select, Esc to go back</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Destination Selection Screen
// ============================================================================

interface DestinationSelectionScreenProps {
  savedLocations: SavedLocation[];
  origin: PlaceDetails;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSelectSavedLocation: (location: SavedLocation) => void;
  onSearchSubmit: () => void;
  onBack: () => void;
  onCancel: () => void;
}

const DestinationSelectionScreen: React.FC<DestinationSelectionScreenProps> = ({
  savedLocations,
  origin,
  searchQuery,
  onSearchQueryChange,
  onSelectSavedLocation,
  onSearchSubmit,
  onBack,
  onCancel,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Calculate total items
  const savedLocationItems = savedLocations.length;
  const searchInputIndex = savedLocationItems;
  const backIndex = searchInputIndex + 1;
  const cancelIndex = backIndex + 1;
  const totalItems = cancelIndex + 1;

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
      return;
    }

    if (key.return) {
      if (selectedIndex < savedLocationItems) {
        onSelectSavedLocation(savedLocations[selectedIndex]);
      } else if (selectedIndex === searchInputIndex) {
        if (searchQuery.trim()) {
          onSearchSubmit();
        }
      } else if (selectedIndex === backIndex) {
        onBack();
      } else if (selectedIndex === cancelIndex) {
        onCancel();
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🎯 Select Destination Location
        </Text>
      </Box>

      <Box marginBottom={1} paddingX={1} borderStyle="single" borderColor="blue">
        <Box flexDirection="column">
          <Text dimColor>Origin:</Text>
          <Text bold>{origin.address.title || formatAddress(origin.address)}</Text>
        </Box>
      </Box>

      {savedLocations.length > 0 && (
        <Box marginBottom={1} flexDirection="column">
          <Text dimColor>Saved Locations:</Text>
          {savedLocations.map((location, index) => (
            <Box key={location.tag}>
              <Text color={selectedIndex === index ? 'cyan' : undefined}>
                {selectedIndex === index ? '▶ ' : '  '}
                <Text bold>{location.tag}</Text>
                <Text dimColor> - {formatSavedLocation(location)}</Text>
              </Text>
            </Box>
          ))}
        </Box>
      )}

      <Box marginTop={1} marginBottom={1}>
        <Text dimColor>Search for a location:</Text>
      </Box>

      <Box>
        <Text color={selectedIndex === searchInputIndex ? 'cyan' : undefined}>
          {selectedIndex === searchInputIndex ? '▶ ' : '  '}
        </Text>
        <TextInput
          value={searchQuery}
          onChange={onSearchQueryChange}
          placeholder="Type to search..."
          focus={selectedIndex === searchInputIndex}
        />
      </Box>

      <Box marginTop={1}>
        <Text color={selectedIndex === backIndex ? 'yellow' : undefined}>
          {selectedIndex === backIndex ? '▶ ' : '  '}
          <Text bold>← Back to Origin</Text>
        </Text>
      </Box>

      <Box>
        <Text color={selectedIndex === cancelIndex ? 'red' : undefined}>
          {selectedIndex === cancelIndex ? '▶ ' : '  '}
          <Text bold>❌ Cancel</Text>
        </Text>
      </Box>

      <Box marginTop={2}>
        <Text dimColor>Use ↑↓ to navigate, Enter to select, Esc to cancel</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Destination Search Screen
// ============================================================================

interface DestinationSearchScreenProps {
  searchQuery: string;
  searchResults: Place[];
  isSearching: boolean;
  origin: PlaceDetails;
  onSelectResult: (place: Place) => void;
  onBack: () => void;
}

const DestinationSearchScreen: React.FC<DestinationSearchScreenProps> = ({
  searchQuery,
  searchResults,
  isSearching,
  origin,
  onSelectResult,
  onBack,
}) => {
  useInput((_input, key) => {
    if (key.escape) {
      onBack();
    }
  });

  const items: SelectItem[] = searchResults.map((place) => ({
    label: place.description,
    value: place.placeId,
  }));

  const handleSelect = (item: { value: string }) => {
    const place = searchResults.find((p) => p.placeId === item.value);
    if (place) {
      onSelectResult(place);
    }
  };

  if (isSearching) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="cyan">
            🔍 Searching for "{searchQuery}"
          </Text>
        </Box>
        <Box marginBottom={1} paddingX={1} borderStyle="single" borderColor="blue">
          <Text dimColor>From: {origin.address.title || formatAddress(origin.address)}</Text>
        </Box>
        <Box>
          <Text color="green">
            <Spinner type="dots" />
          </Text>
          <Text> Searching...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🔍 Search Results for "{searchQuery}"
        </Text>
      </Box>

      <Box marginBottom={1} paddingX={1} borderStyle="single" borderColor="blue">
        <Text dimColor>From: {origin.address.title || formatAddress(origin.address)}</Text>
      </Box>

      {searchResults.length === 0 ? (
        <Box flexDirection="column">
          <Text color="yellow">No results found.</Text>
          <Box marginTop={1}>
            <Text dimColor>Press Esc to go back and try again</Text>
          </Box>
        </Box>
      ) : (
        <>
          <Box marginBottom={1}>
            <Text dimColor>Select a destination:</Text>
          </Box>
          <SelectInput items={items} onSelect={handleSelect} />
        </>
      )}

      <Box marginTop={1}>
        <Text dimColor>Use ↑↓ to navigate, Enter to select, Esc to go back</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Destination Confirm Screen
// ============================================================================

interface DestinationConfirmScreenProps {
  origin: PlaceDetails;
  destination: PlaceDetails;
  onConfirm: () => void;
  onBack: () => void;
}

const DestinationConfirmScreen: React.FC<DestinationConfirmScreenProps> = ({
  origin,
  destination,
  onConfirm,
  onBack,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const options = ['confirm', 'back'] as const;

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }

    if (key.upArrow || key.leftArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      return;
    }

    if (key.downArrow || key.rightArrow) {
      setSelectedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
      return;
    }

    if (key.return) {
      if (selectedIndex === 0) {
        onConfirm();
      } else {
        onBack();
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ✅ Confirm Route
        </Text>
      </Box>

      <Box marginBottom={1} paddingX={1} borderStyle="single" borderColor="blue">
        <Box flexDirection="column">
          <Text dimColor>From (Origin):</Text>
          <Text bold color="green">
            {origin.address.title || formatAddress(origin.address)}
          </Text>
        </Box>
      </Box>

      <Box marginBottom={1} paddingX={1} borderStyle="single" borderColor="green">
        <Box flexDirection="column">
          <Text dimColor>To (Destination):</Text>
          <Text bold color="yellow">
            {destination.address.title || formatAddress(destination.address)}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={selectedIndex === 0 ? 'green' : undefined}>
          {selectedIndex === 0 ? '▶ ' : '  '}
          <Text bold>✓ Confirm & Search Rides</Text>
        </Text>
      </Box>

      <Box>
        <Text color={selectedIndex === 1 ? 'yellow' : undefined}>
          {selectedIndex === 1 ? '▶ ' : '  '}
          <Text bold>← Back</Text>
          <Text> - Choose a different destination</Text>
        </Text>
      </Box>

      <Box marginTop={2}>
        <Text dimColor>Use ↑↓ or ←→ to navigate, Enter to select, Esc to go back</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Quick Route Selection Screen
// ============================================================================

interface QuickRouteSelectionScreenProps {
  savedLocations: SavedLocation[];
  onSelectRoute: (origin: SavedLocation, destination: SavedLocation) => void;
  onBack: () => void;
}

const QuickRouteSelectionScreen: React.FC<QuickRouteSelectionScreenProps> = ({
  savedLocations,
  onSelectRoute,
  onBack,
}) => {
  // Generate all possible routes between saved locations
  const routes: { origin: SavedLocation; destination: SavedLocation; label: string }[] = [];
  for (let i = 0; i < savedLocations.length; i++) {
    for (let j = 0; j < savedLocations.length; j++) {
      if (i !== j) {
        routes.push({
          origin: savedLocations[i],
          destination: savedLocations[j],
          label: `${savedLocations[i].tag} → ${savedLocations[j].tag}`,
        });
      }
    }
  }

  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }

    if (key.upArrow) {
      setSelectedRouteIndex((prev) => (prev > 0 ? prev - 1 : routes.length - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedRouteIndex((prev) => (prev < routes.length - 1 ? prev + 1 : 0));
      return;
    }

    if (key.return) {
      const route = routes[selectedRouteIndex];
      if (route) {
        onSelectRoute(route.origin, route.destination);
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ⚡ Quick Route Selection
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>Select a pre-defined route between your saved locations:</Text>
      </Box>

      {routes.map((route, index) => (
        <Box key={route.label}>
          <Text color={selectedRouteIndex === index ? 'green' : undefined}>
            {selectedRouteIndex === index ? '▶ ' : '  '}
            <Text bold>{route.origin.tag}</Text>
            <Text> → </Text>
            <Text bold>{route.destination.tag}</Text>
          </Text>
        </Box>
      ))}

      <Box marginTop={1}>
        <Text color={selectedRouteIndex === routes.length ? 'yellow' : undefined}>
          {selectedRouteIndex === routes.length ? '▶ ' : '  '}
          <Text bold>← Back</Text>
        </Text>
      </Box>

      <Box marginTop={2}>
        <Text dimColor>Use ↑↓ to navigate, Enter to select, Esc to go back</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Loading Screen
// ============================================================================

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Loading...' }) => {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ⏳ Please Wait
        </Text>
      </Box>

      <Box>
        <Text color="green">
          <Spinner type="dots" />
        </Text>
        <Text> {message}</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Error Screen
// ============================================================================

interface ErrorScreenProps {
  errorMessage: string;
  onRetry: () => void;
  onBack: () => void;
  onCancel: () => void;
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({
  errorMessage,
  onRetry,
  onBack,
  onCancel,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const options = ['retry', 'back', 'cancel'] as const;

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
      return;
    }

    if (key.return) {
      if (selectedIndex === 0) {
        onRetry();
      } else if (selectedIndex === 1) {
        onBack();
      } else {
        onCancel();
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="red">
          ❌ Error
        </Text>
      </Box>

      <Box marginBottom={1} paddingX={1} borderStyle="single" borderColor="red">
        <Text color="red">{errorMessage}</Text>
      </Box>

      <Box marginTop={1}>
        <Text color={selectedIndex === 0 ? 'green' : undefined}>
          {selectedIndex === 0 ? '▶ ' : '  '}
          <Text bold>[R] Retry</Text>
        </Text>
      </Box>

      <Box>
        <Text color={selectedIndex === 1 ? 'yellow' : undefined}>
          {selectedIndex === 1 ? '▶ ' : '  '}
          <Text bold>[B] Go Back</Text>
        </Text>
      </Box>

      <Box>
        <Text color={selectedIndex === 2 ? 'red' : undefined}>
          {selectedIndex === 2 ? '▶ ' : '  '}
          <Text bold>[Esc] Cancel</Text>
        </Text>
      </Box>

      <Box marginTop={2}>
        <Text dimColor>Use ↑↓ to navigate, Enter to select, Esc to cancel</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Main LocationWizard Component
// ============================================================================

export const LocationWizard: React.FC<LocationWizardProps> = ({
  token,
  savedLocations,
  onComplete,
  onCancel,
}) => {
  const client = new NammaYatriClient(token);
  const hasQuickRoutes = savedLocations.length >= 2;

  const { state, context, transition, updateContext } = useStateMachine<
    LocationWizardState,
    LocationWizardContext
  >({
    initialState: 'ORIGIN_SELECTION',
    initialContext: {
      origin: null,
      destination: null,
      searchQuery: '',
      searchResults: [],
      selectedPlace: null,
      errorMessage: null,
      isSearching: false,
    },
  });

  // Search for places
  const searchPlaces = useCallback(
    async (query: string) => {
      updateContext({ isSearching: true, errorMessage: null });

      try {
        const results = await client.searchPlaces(query);
        updateContext({ searchResults: results, isSearching: false });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Search failed';
        updateContext({ errorMessage, isSearching: false });
        transition('ERROR');
      }
    },
    [client, updateContext, transition]
  );

  // Get place details
  const getPlaceDetails = useCallback(
    async (place: Place) => {
      updateContext({ isSearching: true, errorMessage: null });

      try {
        const details = await client.getPlaceDetails(place.placeId);
        updateContext({ selectedPlace: place, isSearching: false });
        return details;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to get place details';
        updateContext({ errorMessage, isSearching: false });
        transition('ERROR');
        return null;
      }
    },
    [client, updateContext, transition]
  );

  // Handle origin selection from saved locations
  const handleOriginSavedLocation = useCallback(
    (location: SavedLocation) => {
      const details = savedLocationToPlaceDetails(location);
      updateContext({ origin: details });
      transition('ORIGIN_CONFIRM');
    },
    [updateContext, transition]
  );

  // Handle origin search submission
  const handleOriginSearchSubmit = useCallback(() => {
    if (context.searchQuery.trim()) {
      transition('ORIGIN_SEARCH');
      searchPlaces(context.searchQuery);
    }
  }, [context.searchQuery, transition, searchPlaces]);

  // Handle origin search result selection
  const handleOriginSearchSelect = useCallback(
    async (place: Place) => {
      const details = await getPlaceDetails(place);
      if (details) {
        updateContext({ origin: details });
        transition('ORIGIN_CONFIRM');
      }
    },
    [getPlaceDetails, updateContext, transition]
  );

  // Handle origin confirmation
  const handleOriginConfirm = useCallback(() => {
    updateContext({ searchQuery: '', searchResults: [], selectedPlace: null });
    transition('DESTINATION_SELECTION');
  }, [updateContext, transition]);

  // Handle destination selection from saved locations
  const handleDestinationSavedLocation = useCallback(
    (location: SavedLocation) => {
      const details = savedLocationToPlaceDetails(location);
      updateContext({ destination: details });
      transition('DESTINATION_CONFIRM');
    },
    [updateContext, transition]
  );

  // Handle destination search submission
  const handleDestinationSearchSubmit = useCallback(() => {
    if (context.searchQuery.trim()) {
      transition('DESTINATION_SEARCH');
      searchPlaces(context.searchQuery);
    }
  }, [context.searchQuery, transition, searchPlaces]);

  // Handle destination search result selection
  const handleDestinationSearchSelect = useCallback(
    async (place: Place) => {
      const details = await getPlaceDetails(place);
      if (details) {
        updateContext({ destination: details });
        transition('DESTINATION_CONFIRM');
      }
    },
    [getPlaceDetails, updateContext, transition]
  );

  // Handle destination confirmation and complete
  const handleDestinationConfirm = useCallback(() => {
    if (context.origin && context.destination) {
      onComplete(context.origin, context.destination);
    }
  }, [context.origin, context.destination, onComplete]);

  // Handle quick route selection
  const handleQuickRouteSelect = useCallback(
    (origin: SavedLocation, destination: SavedLocation) => {
      const originDetails = savedLocationToPlaceDetails(origin);
      const destDetails = savedLocationToPlaceDetails(destination);
      updateContext({ origin: originDetails, destination: destDetails });
      onComplete(originDetails, destDetails);
    },
    [updateContext, onComplete]
  );

  // Handle error retry
  const handleErrorRetry = useCallback(() => {
    updateContext({ errorMessage: null });
    // Go back to the appropriate selection screen based on current state
    if (context.origin) {
      transition('DESTINATION_SELECTION');
    } else {
      transition('ORIGIN_SELECTION');
    }
  }, [context.origin, updateContext, transition]);

  // Handle error back
  const handleErrorBack = useCallback(() => {
    updateContext({ errorMessage: null });
    if (context.origin) {
      transition('DESTINATION_SELECTION');
    } else {
      transition('ORIGIN_SELECTION');
    }
  }, [context.origin, updateContext, transition]);

  // Render current screen based on state
  const renderScreen = (): JSX.Element => {
    switch (state) {
      case 'ORIGIN_SELECTION':
        return (
          <OriginSelectionScreen
            savedLocations={savedLocations}
            searchQuery={context.searchQuery}
            onSearchQueryChange={(value) => updateContext({ searchQuery: value })}
            onSelectSavedLocation={handleOriginSavedLocation}
            onSearchSubmit={handleOriginSearchSubmit}
            onCancel={onCancel}
            onQuickRoute={() => transition('QUICK_ROUTE_SELECTION')}
            hasQuickRoutes={hasQuickRoutes}
          />
        );

      case 'ORIGIN_SEARCH':
        return (
          <OriginSearchScreen
            searchQuery={context.searchQuery}
            searchResults={context.searchResults}
            isSearching={context.isSearching}
            onSelectResult={handleOriginSearchSelect}
            onBack={() => transition('ORIGIN_SELECTION')}
          />
        );

      case 'ORIGIN_CONFIRM':
        return context.origin ? (
          <OriginConfirmScreen
            placeDetails={context.origin}
            onConfirm={handleOriginConfirm}
            onBack={() => transition('ORIGIN_SELECTION')}
          />
        ) : (
          <Box>
            <Text color="red">Error: No origin selected</Text>
          </Box>
        );

      case 'DESTINATION_SELECTION':
        return context.origin ? (
          <DestinationSelectionScreen
            savedLocations={savedLocations}
            origin={context.origin}
            searchQuery={context.searchQuery}
            onSearchQueryChange={(value) => updateContext({ searchQuery: value })}
            onSelectSavedLocation={handleDestinationSavedLocation}
            onSearchSubmit={handleDestinationSearchSubmit}
            onBack={() => {
              updateContext({ origin: null, searchQuery: '' });
              transition('ORIGIN_SELECTION');
            }}
            onCancel={onCancel}
          />
        ) : (
          <Box>
            <Text color="red">Error: No origin selected</Text>
          </Box>
        );

      case 'DESTINATION_SEARCH':
        return context.origin ? (
          <DestinationSearchScreen
            searchQuery={context.searchQuery}
            searchResults={context.searchResults}
            isSearching={context.isSearching}
            origin={context.origin}
            onSelectResult={handleDestinationSearchSelect}
            onBack={() => transition('DESTINATION_SELECTION')}
          />
        ) : (
          <Box>
            <Text color="red">Error: No origin selected</Text>
          </Box>
        );

      case 'DESTINATION_CONFIRM':
        return context.origin && context.destination ? (
          <DestinationConfirmScreen
            origin={context.origin}
            destination={context.destination}
            onConfirm={handleDestinationConfirm}
            onBack={() => transition('DESTINATION_SELECTION')}
          />
        ) : (
          <Box>
            <Text color="red">Error: Missing origin or destination</Text>
          </Box>
        );

      case 'QUICK_ROUTE_SELECTION':
        return (
          <QuickRouteSelectionScreen
            savedLocations={savedLocations}
            onSelectRoute={handleQuickRouteSelect}
            onBack={() => transition('ORIGIN_SELECTION')}
          />
        );

      case 'LOADING':
        return <LoadingScreen message="Fetching location details..." />;

      case 'ERROR':
        return (
          <ErrorScreen
            errorMessage={context.errorMessage || 'An unknown error occurred'}
            onRetry={handleErrorRetry}
            onBack={handleErrorBack}
            onCancel={onCancel}
          />
        );

      default:
        return (
          <Box>
            <Text color="red">Unknown state: {state}</Text>
          </Box>
        );
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold underline color="cyan">
          Book a Ride
        </Text>
      </Box>

      {renderScreen()}
    </Box>
  );
};

export default LocationWizard;
