// ============================================================================
// Confirm Screen Component
// Booking confirmation with driver assignment status
// ============================================================================

import React, { useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { RideEstimate, RideBooking } from '../types.js';

interface ConfirmScreenProps {
  selectedEstimate: RideEstimate | null;
  currentBooking: RideBooking | null;
  isLoading: boolean;
  error: string | null;
  onTrack: () => void;
  onNewRide: () => void;
}

export function ConfirmScreen({
  selectedEstimate,
  currentBooking,
  isLoading,
  error,
  onTrack,
  onNewRide,
}: ConfirmScreenProps) {
  useEffect(() => {
    // Auto-transition to tracking when driver is assigned
    if (currentBooking?.driverName) {
      const timer = setTimeout(() => {
        onTrack();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentBooking, onTrack]);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'TRIP_ASSIGNED':
        return 'green';
      case 'INPROGRESS':
        return 'yellow';
      case 'COMPLETED':
        return 'cyan';
      case 'CANCELLED':
        return 'red';
      default:
        return 'white';
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ✅ Booking Confirmed
        </Text>
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
      )}

      {selectedEstimate && (
        <Box flexDirection="column" marginBottom={1} borderStyle="single" paddingX={1}>
          <Box>
            <Text dimColor>Ride: </Text>
            <Text bold>{selectedEstimate.serviceTierName}</Text>
          </Box>
          <Box>
            <Text dimColor>Fare: </Text>
            <Text>
              {selectedEstimate.estimatedTotalFareWithCurrency.currency}{' '}
              {selectedEstimate.estimatedTotalFareWithCurrency.amount}
            </Text>
          </Box>
        </Box>
      )}

      {isLoading && !currentBooking?.driverName && (
        <Box flexDirection="column" marginY={2}>
          <Text color="yellow">
            <Spinner type="dots" /> Looking for nearby drivers...
          </Text>
          <Box marginTop={1}>
            <Text dimColor>This may take up to 60 seconds</Text>
          </Box>
        </Box>
      )}

      {currentBooking && (
        <Box flexDirection="column" marginTop={1} borderStyle="round" paddingX={1}>
          <Box marginBottom={1}>
            <Text bold color={getStatusColor(currentBooking.status)}>
              Status: {currentBooking.status}
            </Text>
          </Box>

          {currentBooking.driverName && (
            <>
              <Box>
                <Text dimColor>Driver: </Text>
                <Text bold>{currentBooking.driverName}</Text>
              </Box>

              {currentBooking.driverNumber && (
                <Box>
                  <Text dimColor>Phone: </Text>
                  <Text>{currentBooking.driverNumber}</Text>
                </Box>
              )}

              {currentBooking.vehicleNumber && (
                <Box>
                  <Text dimColor>Vehicle: </Text>
                  <Text>
                    {currentBooking.vehicleColor} {currentBooking.vehicleModel} ({currentBooking.vehicleVariant})
                  </Text>
                </Box>
              )}

              {currentBooking.vehicleNumber && (
                <Box>
                  <Text dimColor>Number: </Text>
                  <Text bold>{currentBooking.vehicleNumber}</Text>
                </Box>
              )}

              {currentBooking.rideOtp && (
                <Box marginTop={1}>
                  <Text backgroundColor="green" color="white" bold>
                    {' '}OTP: {currentBooking.rideOtp}{' '}
                  </Text>
                </Box>
              )}
            </>
          )}

          {!currentBooking.driverName && (
            <Box>
              <Text dimColor>Waiting for driver assignment...</Text>
            </Box>
          )}
        </Box>
      )}

      <Box marginTop={2}>
        {!currentBooking?.driverName ? (
          <Text dimColor>Press any key to continue tracking...</Text>
        ) : (
          <Box flexDirection="column">
            <Text color="green">✓ Driver assigned! Redirecting to tracking...</Text>
            <Box marginTop={1}>
              <Text dimColor>Press N for new ride, T to track</Text>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default ConfirmScreen;
