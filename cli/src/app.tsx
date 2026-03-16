// ============================================================================
// Main App Component
// Orchestrates the wizard flow: Auth → Location → Ride Type → Confirm → Track
// ============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { useAuth } from './hooks/useAuth.js';
import { useRide } from './hooks/useRide.js';
import { usePlaces } from './hooks/usePlaces.js';
import {
  Header,
  AuthScreen,
  LocationScreen,
  RideTypeScreen,
  ConfirmScreen,
  TrackScreen,
  ErrorBoundary,
} from './components/index.js';
import { NammaYatriClient } from './api/client.js';
import type { AppScreen, AuthCredentials, SavedLocation } from './types.js';

export function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<AppScreen>('AUTH');
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Custom hooks
  const { auth, login, logout, refreshSavedLocations } = useAuth();
  const {
    ride,
    setOrigin,
    setDestination,
    searchRide,
    selectEstimate,
    cancelSearch,
    trackBooking,
    reset: resetRide,
  } = useRide();
  const {
    places,
    searchPlaces,
    getPlaceDetails,
    selectSavedLocation,
    clearSearch,
  } = usePlaces();

  // Handle global errors
  const handleError = useCallback((error: Error | string) => {
    const message = error instanceof Error ? error.message : error;
    setGlobalError(message);
    setTimeout(() => setGlobalError(null), 5000);
  }, []);

  // Auth handlers
  const handleLogin = useCallback(
    async (credentials: AuthCredentials) => {
      try {
        await login(credentials);
        setScreen('LOCATION');
      } catch (error) {
        handleError(error instanceof Error ? error : 'Login failed');
      }
    },
    [login, handleError]
  );

  const handleLogout = useCallback(async () => {
    await logout();
    resetRide();
    clearSearch();
    setScreen('AUTH');
  }, [logout, resetRide, clearSearch]);

  // Location handlers
  const handleSearchPlaces = useCallback(
    async (query: string) => {
      if (!auth.token) return;
      try {
        await searchPlaces(auth.token, query);
      } catch (error) {
        handleError(error instanceof Error ? error : 'Search failed');
      }
    },
    [auth.token, searchPlaces, handleError]
  );

  const handleSelectPlace = useCallback(
    async (placeId: string) => {
      if (!auth.token) return;
      try {
        await getPlaceDetails(auth.token, placeId);
      } catch (error) {
        handleError(error instanceof Error ? error : 'Failed to get place details');
      }
    },
    [auth.token, getPlaceDetails, handleError]
  );

  const handleSelectSavedLocation = useCallback(
    (location: SavedLocation) => {
      selectSavedLocation(location);
    },
    [selectSavedLocation]
  );

  const handleConfirmLocations = useCallback(async () => {
    if (!auth.token || !places.selectedPlace) return;

    // Set origin or destination based on current state
    if (!ride.origin) {
      setOrigin(places.selectedPlace);
      clearSearch();
    } else if (!ride.destination) {
      setDestination(places.selectedPlace);
      clearSearch();

      // Both locations set, proceed to search
      try {
        await searchRide(auth.token);
        setScreen('RIDE_TYPE');
      } catch (error) {
        handleError(error instanceof Error ? error : 'Ride search failed');
      }
    }
  }, [
    auth.token,
    places.selectedPlace,
    ride.origin,
    ride.destination,
    setOrigin,
    setDestination,
    clearSearch,
    searchRide,
    handleError,
  ]);

  // Ride type handlers
  const handleSelectEstimate = useCallback(
    async (estimateId: string, tipAmount?: number) => {
      if (!auth.token) return;

      try {
        await selectEstimate(auth.token, estimateId, { tipAmount });
        setScreen('CONFIRM');
      } catch (error) {
        handleError(error instanceof Error ? error : 'Failed to select ride');
      }
    },
    [auth.token, selectEstimate, handleError]
  );

  const handleCancelSearch = useCallback(async () => {
    if (!auth.token) return;

    try {
      await cancelSearch(auth.token);
      setScreen('LOCATION');
    } catch (error) {
      handleError(error instanceof Error ? error : 'Cancel failed');
    }
  }, [auth.token, cancelSearch, handleError]);

  // Confirm/Track handlers
  const handleTrack = useCallback(() => {
    setScreen('TRACK');
  }, []);

  const handleRefreshTracking = useCallback(async () => {
    if (!auth.token) return;

    try {
      await trackBooking(auth.token, ride.currentBooking?.id);
    } catch (error) {
      handleError(error instanceof Error ? error : 'Failed to refresh');
    }
  }, [auth.token, ride.currentBooking?.id, trackBooking, handleError]);

  const handleCancelRide = useCallback(async () => {
    if (!auth.token || !ride.currentBooking) return;

    try {
      const client = new NammaYatriClient(auth.token);
      await client.cancelBooking(
        ride.currentBooking.id,
        'CHANGE_OF_MIND',
        ride.currentBooking.status === 'TRIP_ASSIGNED' ? 'OnAssign' : 'OnConfirm'
      );
      handleError('Ride cancelled successfully');
      resetRide();
      setScreen('LOCATION');
    } catch (error) {
      handleError(error instanceof Error ? error : 'Failed to cancel ride');
    }
  }, [auth.token, ride.currentBooking, resetRide, handleError]);

  const handleNewRide = useCallback(() => {
    resetRide();
    clearSearch();
    setScreen('LOCATION');
  }, [resetRide, clearSearch]);

  // Global keyboard shortcuts
  useInput((input, key) => {
    // Global exit: 'q' key or Ctrl+C
    if (input === 'q' || input === 'Q') {
      exit();
      return;
    }

    // Global logout (when authenticated): ESC or Ctrl+L
    if ((key.escape || (key.ctrl && input === 'l')) && auth.isAuthenticated) {
      // Only go back if not on main screens
      if (screen === 'LOCATION') {
        handleLogout();
        return;
      }
      return;
    }

    // Global refresh saved locations: Ctrl+R
    if (key.ctrl && input === 'r' && auth.isAuthenticated) {
      refreshSavedLocations();
      return;
    }
  });

  // Auto-redirect based on auth state
  useEffect(() => {
    if (auth.isAuthenticated && screen === 'AUTH' && !auth.isLoading) {
      setScreen('LOCATION');
    }
  }, [auth.isAuthenticated, auth.isLoading, screen]);

  // Render current screen
  const renderScreen = () => {
    switch (screen) {
      case 'AUTH':
        return (
          <AuthScreen
            isLoading={auth.isLoading}
            error={auth.error}
            onLogin={handleLogin}
            onExit={exit}
          />
        );

      case 'LOCATION':
        return (
          <LocationScreen
            token={auth.token || ''}
            savedLocations={auth.savedLocations}
            origin={ride.origin}
            destination={ride.destination}
            searchResults={places.searchResults}
            isSearching={places.isSearching}
            error={places.error || ride.error}
            onSearchPlaces={handleSearchPlaces}
            onSelectPlace={handleSelectPlace}
            onSelectSavedLocation={handleSelectSavedLocation}
            onConfirmLocations={handleConfirmLocations}
            onBack={handleLogout}
          />
        );

      case 'RIDE_TYPE':
        return (
          <RideTypeScreen
            estimates={ride.estimates}
            isLoading={ride.isSearching}
            error={ride.error}
            onSelectEstimate={handleSelectEstimate}
            onBack={handleCancelSearch}
          />
        );

      case 'CONFIRM':
        return (
          <ConfirmScreen
            selectedEstimate={ride.selectedEstimate}
            currentBooking={ride.currentBooking}
            isLoading={ride.isSelecting || ride.isTracking}
            error={ride.error}
            onTrack={handleTrack}
            onNewRide={handleNewRide}
          />
        );

      case 'TRACK':
        return (
          <TrackScreen
            token={auth.token || ''}
            currentBooking={ride.currentBooking}
            isLoading={ride.isTracking}
            error={ride.error}
            onRefresh={handleRefreshTracking}
            onCancel={handleCancelRide}
            onNewRide={handleNewRide}
            onExit={exit}
          />
        );

      default:
        return (
          <AuthScreen
            isLoading={auth.isLoading}
            error={auth.error}
            onLogin={handleLogin}
            onExit={exit}
          />
        );
    }
  };

  return (
    <ErrorBoundary onReset={handleNewRide}>
      <Box flexDirection="column" height="100%">
        <Header personName={auth.personName} currentScreen={screen} />

        {globalError && (
          <Box paddingX={1} marginBottom={1}>
            <Text color="red">⚠️ {globalError}</Text>
          </Box>
        )}

        <Box flexGrow={1}>{renderScreen()}</Box>

        {/* Footer with shortcuts */}
        {auth.isAuthenticated && (
          <Box paddingX={1} marginTop={1}>
            <Text dimColor>
              Q: Quit • Esc: Back • Ctrl+L: Logout • Ctrl+R: Refresh
            </Text>
          </Box>
        )}
      </Box>
    </ErrorBoundary>
  );
}

export default App;
