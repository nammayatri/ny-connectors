// ============================================================================
// Main App Component for Namma Yatri CLI TUI
// ============================================================================
// Renders the appropriate wizard based on current state using Ink

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { useStateMachine } from './hooks/useStateMachine.js';
import {
  AppState,
  AppContext,
  PersonAPIEntity,
  SavedReqLocationAPIEntity,
  GetPlaceDetailsResponse,
  SearchResultsResponse,
  RideBooking,
  RideEstimate,
} from './types/index.js';
import { readTokenData, clearToken } from './utils/storage.js';
import {
  authenticate,
  getSavedLocations,
  searchPlaces,
  getPlaceDetails,
  searchRide,
  pollSearchResults,
  selectEstimate,
  pollForRideAssignment,
  fetchRideStatus,
} from './utils/api.js';

// Import components
import { AuthWizard } from './components/AuthWizard.js';
import { LocationWizard } from './components/LocationWizard.js';
import { MainMenu } from './components/MainMenu.js';
import Header from './components/Header.js';

// ============================================================================
// Initial Context
// ============================================================================

const initialContext: AppContext = {
  token: null,
  user: null,
  savedLocations: [],
  currentSearchId: null,
  currentEstimateId: null,
  currentBooking: null,
  selectedOrigin: null,
  selectedDestination: null,
  searchResults: null,
};

// ============================================================================
// Loading Component
// ============================================================================

const LoadingScreen: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <Box flexDirection="column" padding={1}>
    <Text color="cyan">{message}</Text>
  </Box>
);

// ============================================================================
// Error Component
// ============================================================================

const ErrorScreen: React.FC<{ message: string; onRetry?: () => void; onCancel?: () => void }> = ({
  message,
  onRetry,
  onCancel,
}) => {
  useInput((input, key) => {
    if (key.escape && onCancel) {
      onCancel();
    }
    if ((input === 'r' || input === 'R') && onRetry) {
      onRetry();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="red" bold>
        ❌ Error
      </Text>
      <Box marginY={1} paddingX={1} borderStyle="single" borderColor="red">
        <Text color="red">{message}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {onRetry && (
          <Text>
            <Text color="yellow">[R]</Text>
            <Text> Retry</Text>
          </Text>
        )}
        {onCancel && (
          <Text>
            <Text color="yellow">[Esc]</Text>
            <Text> Go back</Text>
          </Text>
        )}
      </Box>
    </Box>
  );
};

// ============================================================================
// Ride Estimates Component
// ============================================================================

interface EstimatesScreenProps {
  searchResults: SearchResultsResponse;
  onSelect: (estimate: RideEstimate, additionalEstimates: RideEstimate[]) => void;
  onCancel: () => void;
}

const EstimatesScreen: React.FC<EstimatesScreenProps> = ({ searchResults, onSelect, onCancel }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const estimates = searchResults.estimates || [];
  const cancelIndex = estimates.length;

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : cancelIndex));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => (prev < cancelIndex ? prev + 1 : 0));
      return;
    }

    if (key.return) {
      if (selectedIndex === cancelIndex) {
        onCancel();
      } else {
        const selected = estimates[selectedIndex];
        if (selected) {
          // Select additional estimates for better chances (up to 2 more)
          const additional = estimates
            .filter((e, i) => i !== selectedIndex)
            .slice(0, 2);
          onSelect(selected, additional);
        }
      }
    }
  });

  const formatPrice = (price: number, currency: string = 'INR') => {
    if (currency === 'INR') {
      return `₹${price.toFixed(0)}`;
    }
    return `${currency} ${price.toFixed(0)}`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🚗 Select Ride Option
        </Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text dimColor>From: {searchResults.fromLocation.title || searchResults.fromLocation.area}</Text>
        <Text dimColor>To: {searchResults.toLocation?.title || searchResults.toLocation?.area}</Text>
      </Box>

      {estimates.length === 0 ? (
        <Box flexDirection="column">
          <Text color="yellow">No ride options available.</Text>
          <Box marginTop={1}>
            <Text dimColor>Press Esc to go back</Text>
          </Box>
        </Box>
      ) : (
        <>
          <Box marginBottom={1}>
            <Text dimColor>Choose a ride option:</Text>
          </Box>

          {estimates.map((estimate, index) => (
            <Box key={estimate.id}>
              <Text color={selectedIndex === index ? 'green' : undefined}>
                {selectedIndex === index ? '▶ ' : '  '}
                <Text bold>{estimate.serviceTierName}</Text>
                <Text> - {formatPrice(estimate.estimatedTotalFare, estimate.estimatedTotalFareWithCurrency.currency)}</Text>
                <Text dimColor> ({formatDuration(estimate.estimatedPickupDuration)} pickup)</Text>
              </Text>
            </Box>
          ))}

          <Box marginTop={1}>
            <Text color={selectedIndex === cancelIndex ? 'red' : undefined}>
              {selectedIndex === cancelIndex ? '▶ ' : '  '}
              <Text bold>❌ Cancel</Text>
            </Text>
          </Box>
        </>
      )}

      <Box marginTop={2}>
        <Text dimColor>Use ↑↓ to navigate, Enter to select, Esc to cancel</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Booking Status Component
// ============================================================================

interface BookingStatusScreenProps {
  booking: RideBooking;
  onNewRide: () => void;
}

const BookingStatusScreen: React.FC<BookingStatusScreenProps> = ({ booking, onNewRide }) => {
  useInput((input, key) => {
    if (key.return || input === 'n' || input === 'N') {
      onNewRide();
    }
  });

  const getStatusEmoji = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
      case 'rideconfirmed':
        return '✅';
      case 'completed':
        return '🎉';
      case 'cancelled':
        return '❌';
      case 'reallocated':
        return '🔄';
      default:
        return '🚗';
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {getStatusEmoji(booking.status)} Booking Status
        </Text>
      </Box>

      <Box marginBottom={1} paddingX={1} borderStyle="single" borderColor="green">
        <Box flexDirection="column">
          <Text>
            <Text dimColor>Status: </Text>
            <Text bold color="green">
              {booking.status}
            </Text>
          </Text>
          {booking.driverName && (
            <Text>
              <Text dimColor>Driver: </Text>
              <Text bold>{booking.driverName}</Text>
            </Text>
          )}
          {booking.vehicleNumber && (
            <Text>
              <Text dimColor>Vehicle: </Text>
              <Text bold>{booking.vehicleNumber}</Text>
            </Text>
          )}
          {booking.vehicleVariant && (
            <Text>
              <Text dimColor>Type: </Text>
              <Text>{booking.vehicleVariant}</Text>
            </Text>
          )}
          <Text>
            <Text dimColor>Estimated Fare: </Text>
            <Text bold>₹{booking.estimatedFare}</Text>
          </Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text>
          <Text color="yellow">[Enter]</Text>
          <Text> Book another ride</Text>
        </Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Settings Component
// ============================================================================

interface SettingsScreenProps {
  userName?: string;
  onLogout: () => void;
  onBack: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ userName, onLogout, onBack }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const options = ['logout', 'back'] as const;

  useInput((input, key) => {
    if (key.escape) {
      onBack();
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
        onLogout();
      } else {
        onBack();
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ⚙️ Settings
        </Text>
      </Box>

      {userName && (
        <Box marginBottom={1}>
          <Text>
            <Text dimColor>Logged in as: </Text>
            <Text color="green">{userName}</Text>
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={selectedIndex === 0 ? 'red' : undefined}>
          {selectedIndex === 0 ? '▶ ' : '  '}
          <Text bold>🚪 Logout</Text>
        </Text>
      </Box>

      <Box>
        <Text color={selectedIndex === 1 ? 'yellow' : undefined}>
          {selectedIndex === 1 ? '▶ ' : '  '}
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
// Saved Locations Component
// ============================================================================

interface SavedLocationsScreenProps {
  savedLocations: SavedReqLocationAPIEntity[];
  onBack: () => void;
}

const SavedLocationsScreen: React.FC<SavedLocationsScreenProps> = ({ savedLocations, onBack }) => {
  useInput((input, key) => {
    if (key.escape || key.return) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📍 Saved Locations
        </Text>
      </Box>

      {savedLocations.length === 0 ? (
        <Box flexDirection="column">
          <Text color="yellow">No saved locations found.</Text>
          <Text dimColor>Saved locations are synced from your Namma Yatri app.</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {savedLocations.map((location) => (
            <Box key={location.tag} marginBottom={1}>
              <Text>
                <Text bold color="green">
                  {location.tag}
                </Text>
                <Text dimColor>
                  {' '}
                  - {location.locationName || location.area || `${location.lat},${location.lon}`}
                </Text>
              </Text>
            </Box>
          ))}
        </Box>
      )}

      <Box marginTop={2}>
        <Text dimColor>Press Enter or Esc to go back</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Ride History Component
// ============================================================================

interface RideHistoryScreenProps {
  token: string;
  onBack: () => void;
}

const RideHistoryScreen: React.FC<RideHistoryScreenProps> = ({ token, onBack }) => {
  const [bookings, setBookings] = useState<RideBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const loadBookings = async () => {
      try {
        const response = await fetchRideStatus(token, false, 10);
        if (isMountedRef.current) {
          setBookings(response.list || []);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load ride history');
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    loadBookings();

    return () => {
      isMountedRef.current = false;
    };
  }, [token]);

  useInput((input, key) => {
    if (key.escape || key.return) {
      onBack();
    }
  });

  if (loading) {
    return <LoadingScreen message="Loading ride history..." />;
  }

  if (error) {
    return (
      <ErrorScreen
        message={error}
        onCancel={onBack}
        onRetry={() => {
          setLoading(true);
          setError(null);
        }}
      />
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📜 Ride History
        </Text>
      </Box>

      {bookings.length === 0 ? (
        <Box flexDirection="column">
          <Text color="yellow">No ride history found.</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {bookings.slice(0, 10).map((booking) => (
            <Box key={booking.id} marginBottom={1}>
              <Text>
                <Text bold>{booking.status}</Text>
                <Text dimColor> - ₹{booking.estimatedFare}</Text>
                <Text dimColor> ({new Date(booking.createdAt).toLocaleDateString()})</Text>
              </Text>
            </Box>
          ))}
        </Box>
      )}

      <Box marginTop={2}>
        <Text dimColor>Press Enter or Esc to go back</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Main App Component
// ============================================================================

interface AppProps {
  initialToken?: string | null;
}

export default function App({ initialToken }: AppProps): JSX.Element {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [terminalWidth, setTerminalWidth] = useState(stdout.columns || 80);
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);
  const [error, setError] = useState<string | null>(null);

  // Initialize state machine
  const { state, context, transition, updateContext, setContext } = useStateMachine<AppState, AppContext>({
    initialState: initialToken ? 'MAIN_MENU' : 'AUTH_PHONE',
    initialContext: {
      ...initialContext,
      token: initialToken || null,
    },
  });

  // Handle terminal resize
  useEffect(() => {
    const handleResize = () => {
      setTerminalWidth(stdout.columns || 80);
      setTerminalHeight(stdout.rows || 24);
    };

    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  // Load saved token on mount if not provided
  useEffect(() => {
    if (!initialToken && !context.token) {
      const loadToken = async () => {
        try {
          const tokenData = await readTokenData();
          if (tokenData?.token) {
            updateContext({
              token: tokenData.token,
              user: tokenData.person || null,
              savedLocations: tokenData.savedLocations || [],
            });
            transition('MAIN_MENU');
          }
        } catch (err) {
          // No saved token, stay on auth screen
        }
      };
      loadToken();
    }
  }, [initialToken, context.token, updateContext, transition]);

  // Global keyboard shortcuts
  useInput((input, key) => {
    // Ctrl+C to exit
    if (key.ctrl && input === 'c') {
      exit();
    }
  });

  // Handle auth success
  const handleAuthSuccess = useCallback(
    (token: string, person: PersonAPIEntity | undefined, savedLocations: SavedReqLocationAPIEntity[]) => {
      updateContext({
        token,
        user: person || null,
        savedLocations: savedLocations || [],
      });
      transition('MAIN_MENU');
    },
    [updateContext, transition]
  );

  // Handle location selection complete
  const handleLocationComplete = useCallback(
    async (origin: GetPlaceDetailsResponse, destination: GetPlaceDetailsResponse) => {
      updateContext({
        selectedOrigin: origin,
        selectedDestination: destination,
      });
      transition('SEARCH_LOADING');

      try {
        if (!context.token) throw new Error('Not authenticated');

        // Search for rides
        const searchResponse = await searchRide(
          context.token,
          { lat: origin.lat, lon: origin.lon },
          { lat: destination.lat, lon: destination.lon },
          origin.address,
          destination.address
        );

        updateContext({ currentSearchId: searchResponse.searchId });

        // Poll for results
        const results = await pollSearchResults(context.token, searchResponse.searchId);
        updateContext({ searchResults: results });
        transition('SELECT_ESTIMATE');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search for rides');
        transition('MAIN_MENU');
      }
    },
    [context.token, updateContext, transition]
  );

  // Handle estimate selection
  const handleEstimateSelect = useCallback(
    async (estimate: RideEstimate, additionalEstimates: RideEstimate[]) => {
      updateContext({
        currentEstimateId: estimate.id,
      });
      transition('BOOKING_LOADING');

      try {
        if (!context.token) throw new Error('Not authenticated');

        // Select the estimate
        await selectEstimate(
          context.token,
          estimate.id,
          additionalEstimates.map((e) => e.id)
        );

        // Poll for driver assignment
        const booking = await pollForRideAssignment(context.token);
        updateContext({ currentBooking: booking });
        transition('BOOKING_CONFIRMED');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to book ride');
        transition('SELECT_ESTIMATE');
      }
    },
    [context.token, updateContext, transition]
  );

  // Handle logout
  const handleLogout = useCallback(async () => {
    await clearToken();
    setContext(initialContext);
    transition('AUTH_PHONE');
  }, [setContext, transition]);

  // Calculate current step for header
  const getCurrentStep = (): { step: number; totalSteps: number; title: string } => {
    switch (state) {
      case 'AUTH_PHONE':
      case 'AUTH_CODE':
      case 'AUTH_LOADING':
        return { step: 1, totalSteps: 5, title: 'Authentication' };
      case 'MAIN_MENU':
        return { step: 0, totalSteps: 5, title: 'Main Menu' };
      case 'SEARCH_ORIGIN':
      case 'SEARCH_DESTINATION':
        return { step: 2, totalSteps: 5, title: 'Select Locations' };
      case 'SEARCH_LOADING':
        return { step: 3, totalSteps: 5, title: 'Searching Rides' };
      case 'SELECT_ESTIMATE':
        return { step: 3, totalSteps: 5, title: 'Select Ride' };
      case 'BOOKING_LOADING':
        return { step: 4, totalSteps: 5, title: 'Booking' };
      case 'BOOKING_CONFIRMED':
      case 'RIDE_STATUS':
        return { step: 5, totalSteps: 5, title: 'Ride Status' };
      default:
        return { step: 0, totalSteps: 5, title: '' };
    }
  };

  const { step, totalSteps, title } = getCurrentStep();
  const canGoBack = state !== 'AUTH_PHONE' && state !== 'MAIN_MENU' && state !== 'AUTH_LOADING' && state !== 'BOOKING_LOADING' && state !== 'SEARCH_LOADING';

  // Render current screen based on state
  const renderScreen = (): JSX.Element => {
    switch (state) {
      case 'AUTH_PHONE':
        return (
          <AuthWizard
            onAuthSuccess={handleAuthSuccess}
            onCancel={() => exit()}
          />
        );

      case 'MAIN_MENU':
        return (
          <MainMenu
            userName={context.user?.firstName}
            onSelect={(newState) => transition(newState)}
          />
        );

      case 'SEARCH_ORIGIN':
        return context.token ? (
          <LocationWizard
            token={context.token}
            savedLocations={context.savedLocations}
            onComplete={handleLocationComplete}
            onCancel={() => transition('MAIN_MENU')}
          />
        ) : (
          <Box>
            <Text color="red">Error: Not authenticated</Text>
          </Box>
        );

      case 'SEARCH_LOADING':
        return <LoadingScreen message="Searching for available rides..." />;

      case 'SELECT_ESTIMATE':
        return context.searchResults ? (
          <EstimatesScreen
            searchResults={context.searchResults}
            onSelect={handleEstimateSelect}
            onCancel={() => transition('MAIN_MENU')}
          />
        ) : (
          <ErrorScreen
            message="No search results available"
            onCancel={() => transition('MAIN_MENU')}
          />
        );

      case 'BOOKING_LOADING':
        return <LoadingScreen message="Confirming your booking..." />;

      case 'BOOKING_CONFIRMED':
        return context.currentBooking ? (
          <BookingStatusScreen
            booking={context.currentBooking}
            onNewRide={() => {
              updateContext({
                currentSearchId: null,
                currentEstimateId: null,
                currentBooking: null,
                selectedOrigin: null,
                selectedDestination: null,
                searchResults: null,
              });
              transition('MAIN_MENU');
            }}
          />
        ) : (
          <ErrorScreen
            message="No booking information available"
            onCancel={() => transition('MAIN_MENU')}
          />
        );

      case 'SAVED_LOCATIONS':
        return (
          <SavedLocationsScreen
            savedLocations={context.savedLocations}
            onBack={() => transition('MAIN_MENU')}
          />
        );

      case 'RIDE_HISTORY':
        return context.token ? (
          <RideHistoryScreen token={context.token} onBack={() => transition('MAIN_MENU')} />
        ) : (
          <ErrorScreen message="Not authenticated" onCancel={() => transition('MAIN_MENU')} />
        );

      case 'SETTINGS':
        return (
          <SettingsScreen
            userName={context.user?.firstName}
            onLogout={handleLogout}
            onBack={() => transition('MAIN_MENU')}
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
    <Box flexDirection="column" height={terminalHeight} width={terminalWidth}>
      {/* Header */}
      <Header
        step={step}
        totalSteps={totalSteps}
        title={title}
        userName={context.user?.firstName}
        canGoBack={canGoBack}
      />

      {/* Error Message */}
      {error && (
        <Box marginY={1} paddingX={2}>
          <Text color="red">❌ {error}</Text>
        </Box>
      )}

      {/* Main Content */}
      <Box flexDirection="column" flexGrow={1}>
        {renderScreen()}
      </Box>

      {/* Footer */}
      <Box marginTop={1} paddingX={2} borderStyle="single" borderTop>
        <Text dimColor>
          {canGoBack ? 'Press Esc to go back • ' : ''}
          Press Ctrl+C to exit
          {context.token ? ' • Press r in menu to refresh locations' : ''}
        </Text>
      </Box>
    </Box>
  );
}
