import React, { useEffect } from 'react';
import { Box, Text } from 'ink';
import { useBookingFlow } from '../hooks/useBookingFlow.js';
import { AuthScreen } from './AuthScreen.js';
import { PlaceSearch } from './PlaceSearch.js';
import { EstimatesList } from './EstimatesList.js';
import { DriverAssignment } from './DriverAssignment.js';
import { ErrorScreen } from './ErrorScreen.js';
import type { NYPlaceDetails, NYEstimate, RideBooking } from '../types/index.js';

// ============================================================================
// Loading Component
// ============================================================================

function LoadingScreen({ message = 'Loading...' }: { message?: string }): JSX.Element {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color="yellow">{message}</Text>
    </Box>
  );
}

// ============================================================================
// Confirmed Screen Component
// ============================================================================

interface ConfirmedScreenProps {
  booking: RideBooking | null;
  onBookAnother: () => void;
}

function ConfirmedScreen({ booking, onBookAnother }: ConfirmedScreenProps): JSX.Element {
  if (!booking) {
    return (
      <Box flexDirection="column" gap={1} padding={1}>
        <Text bold color="green">
          ✓ Ride Request Confirmed!
        </Text>
        <Text>
          We&apos;re still looking for a driver. You&apos;ll receive a notification when a driver is assigned.
        </Text>
        <Box marginTop={1}>
          <Text dimColor>Press any key to continue...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1} padding={1}>
      <Text bold color="green">
        ✓ Driver Assigned!
      </Text>

      <Box
        borderStyle="round"
        borderColor="green"
        paddingX={2}
        paddingY={1}
        flexDirection="column"
        gap={1}
      >
        {booking.driverName && (
          <Box>
            <Text bold>Driver: </Text>
            <Text>{booking.driverName}</Text>
          </Box>
        )}

        {booking.vehicleNumber && (
          <Box>
            <Text bold>Vehicle: </Text>
            <Text>
              {booking.vehicleNumber}
              {booking.vehicleVariant && ` (${booking.vehicleVariant})`}
            </Text>
          </Box>
        )}

        {booking.rideOtp && (
          <Box>
            <Text bold>OTP: </Text>
            <Text color="yellow" bold>
              {booking.rideOtp}
            </Text>
          </Box>
        )}

        {booking.estimatedFare && (
          <Box>
            <Text bold>Fare: </Text>
            <Text>₹{booking.estimatedFare}</Text>
          </Box>
        )}

        {booking.driverRatings && (
          <Box>
            <Text bold>Rating: </Text>
            <Text>⭐ {booking.driverRatings.toFixed(1)}</Text>
          </Box>
        )}

        {booking.driverNumber && (
          <Box>
            <Text bold>Contact: </Text>
            <Text>{booking.driverNumber}</Text>
          </Box>
        )}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Your ride is on the way! Have a safe journey.</Text>
      </Box>

      <Box marginTop={2}>
        <Text dimColor>Press any key to book another ride...</Text>
      </Box>
    </Box>
  );
}

// ============================================================================
// Main App Component
// ============================================================================

export function App(): JSX.Element {
  const flow = useBookingFlow();

  // Trigger search when entering SEARCHING state
  useEffect(() => {
    if (flow.state === 'SEARCHING') {
      flow.searchRides();
    }
  }, [flow.state, flow.searchRides]);

  // Trigger driver polling when entering POLLING_DRIVER state
  useEffect(() => {
    if (flow.state === 'POLLING_DRIVER') {
      flow.pollForDriver();
    }
  }, [flow.state, flow.pollForDriver]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleAuthSuccess = (
    token: string,
    user: ReturnType<typeof useBookingFlow>['user'],
    savedLocations: ReturnType<typeof useBookingFlow>['savedLocations']
  ) => {
    flow.setAuth(token, user, savedLocations);
  };

  const handleOriginSelect = (place: NYPlaceDetails) => {
    flow.setOrigin(place);
  };

  const handleDestinationSelect = (place: NYPlaceDetails) => {
    flow.setDestination(place);
  };

  const handleEstimateSelect = (
    primaryEstimateId: string,
    additionalIds: string[],
    tipAmount?: number
  ) => {
    flow.selectEstimate(primaryEstimateId, additionalIds, tipAmount);
  };

  const handleDriverAssigned = () => {
    // State is already updated by pollForDriver
  };

  const handleCancel = () => {
    flow.goToHome();
  };

  const handleRetry = () => {
    flow.retry();
  };

  const handleGoHome = () => {
    flow.goToHome();
  };

  const handleBookAnother = () => {
    flow.resetFlow();
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Box flexDirection="column" padding={1}>
      {/* AUTH State */}
      {flow.state === 'AUTH' && (
        <AuthScreen onAuthSuccess={handleAuthSuccess} />
      )}

      {/* ORIGIN State */}
      {flow.state === 'ORIGIN' && flow.token && (
        <PlaceSearch
          label="📍 Select Pickup Location"
          savedLocations={flow.savedLocations}
          onSelect={handleOriginSelect}
          onCancel={handleCancel}
        />
      )}

      {/* DESTINATION State */}
      {flow.state === 'DESTINATION' && flow.token && flow.origin && (
        <PlaceSearch
          label="📍 Select Drop Location"
          savedLocations={flow.savedLocations}
          onSelect={handleDestinationSelect}
          onCancel={handleCancel}
        />
      )}

      {/* SEARCHING State */}
      {flow.state === 'SEARCHING' && flow.origin && flow.destination && (
        <EstimatesList
          estimates={[]}
          origin={flow.origin}
          destination={flow.destination}
          isLoading={true}
          onSelect={() => {}}
          onCancel={handleCancel}
        />
      )}

      {/* ESTIMATES State */}
      {flow.state === 'ESTIMATES' && flow.origin && flow.destination && (
        <EstimatesList
          estimates={flow.estimates}
          origin={flow.origin}
          destination={flow.destination}
          isLoading={false}
          onSelect={handleEstimateSelect}
          onCancel={handleCancel}
        />
      )}

      {/* SELECTING State */}
      {flow.state === 'SELECTING' && flow.origin && flow.destination && flow.selectedEstimate && (
        <EstimatesList
          estimates={flow.estimates}
          origin={flow.origin}
          destination={flow.destination}
          isLoading={true}
          onSelect={() => {}}
          onCancel={handleCancel}
        />
      )}

      {/* POLLING_DRIVER State */}
      {flow.state === 'POLLING_DRIVER' && flow.token && flow.selectedEstimate && (
        <DriverAssignment
          token={flow.token}
          estimate={flow.selectedEstimate}
          onDriverAssigned={handleDriverAssigned}
          onCancel={handleCancel}
          onTimeout={() => {
            // Timeout is handled by pollForDriver - it sets CONFIRMED state
          }}
        />
      )}

      {/* CONFIRMED State */}
      {flow.state === 'CONFIRMED' && (
        <ConfirmedScreen
          booking={flow.currentBooking}
          onBookAnother={handleBookAnother}
        />
      )}

      {/* ERROR State */}
      {flow.state === 'ERROR' && (
        <ErrorScreen
          message={flow.error || 'An unknown error occurred'}
          onRetry={handleRetry}
          onHome={handleGoHome}
        />
      )}
    </Box>
  );
}
