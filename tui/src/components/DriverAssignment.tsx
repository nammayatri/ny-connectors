import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { NYEstimate, RideBooking } from '../types/index.js';
import { NammaYatriClient } from '../api/client.js';

interface DriverAssignmentProps {
  token: string;
  estimate: NYEstimate;
  onDriverAssigned?: (booking: RideBooking) => void;
  onCancel: () => void;
  onTimeout: () => void;
}

type AssignmentStatus = 'polling' | 'assigned' | 'timeout' | 'cancelled';

export function DriverAssignment({
  token,
  estimate,
  onDriverAssigned,
  onCancel,
  onTimeout,
}: DriverAssignmentProps): JSX.Element {
  const [status, setStatus] = useState<AssignmentStatus>('polling');
  const [elapsed, setElapsed] = useState(0);
  const [booking, setBooking] = useState<RideBooking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spinnerFrame, setSpinnerFrame] = useState(0);

  const client = new NammaYatriClient(token);

  // Spinner animation frames
  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  // Format elapsed time as MM:SS
  const formatElapsed = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Poll for driver assignment
  const pollForDriver = useCallback(async () => {
    const MAX_DURATION_MS = 30000;
    const POLL_INTERVAL_MS = 2000;
    const startTime = Date.now();
    const maxEndTime = startTime + MAX_DURATION_MS;

    try {
      while (Date.now() < maxEndTime) {
        // Check for active bookings
        const activeBookings = await client.getActiveBookings();

        if (activeBookings.length > 0) {
          const assignedBooking = activeBookings[0];
          setBooking(assignedBooking);
          setStatus('assigned');
          onDriverAssigned?.(assignedBooking);
          return;
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      // Timeout reached
      setStatus('timeout');
      onTimeout();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to poll for driver';
      setError(errorMessage);
    }
  }, [client, onDriverAssigned, onTimeout]);

  // Start polling on mount
  useEffect(() => {
    if (status === 'polling') {
      pollForDriver();
    }
  }, [status, pollForDriver]);

  // Update elapsed time timer
  useEffect(() => {
    if (status !== 'polling') return;

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Spinner animation
  useEffect(() => {
    if (status !== 'polling') return;

    const interval = setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % spinnerFrames.length);
    }, 80);

    return () => clearInterval(interval);
  }, [status]);

  // Handle keyboard input
  useInput((input, key) => {
    if (status !== 'polling') return;

    if (key.escape || input === 'q' || input === 'c') {
      setStatus('cancelled');
      onCancel();
    }
  });

  // Get fare display text
  const getFareText = (): string => {
    if (estimate.estimatedTotalFareWithCurrency) {
      return `₹${estimate.estimatedTotalFareWithCurrency.amount}`;
    }
    if (estimate.estimatedFareWithCurrency) {
      return `₹${estimate.estimatedFareWithCurrency.amount}`;
    }
    return `₹${estimate.estimatedTotalFare || estimate.estimatedFare}`;
  };

  // Render polling state
  const renderPolling = () => (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text color="yellow">{spinnerFrames[spinnerFrame]}</Text>
        <Text> </Text>
        <Text bold>Looking for nearby drivers...</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>Service: {estimate.serviceTierName}</Text>
        <Text dimColor>Estimated fare: {getFareText()}</Text>
      </Box>

      <Box marginTop={1}>
        <Text color="cyan">Elapsed: {formatElapsed(elapsed)} / 00:30</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          Press <Text bold color="white">Esc</Text>, <Text bold color="white">q</Text>, or{' '}
          <Text bold color="white">c</Text> to cancel
        </Text>
      </Box>
    </Box>
  );

  // Render assigned state with driver details
  const renderAssigned = () => {
    if (!booking) return null;

    return (
      <Box flexDirection="column" gap={1}>
        <Box>
          <Text color="green" bold>
            ✓ Driver Assigned!
          </Text>
        </Box>

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

          <Box>
            <Text bold>Fare: </Text>
            <Text>{getFareText()}</Text>
          </Box>

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
      </Box>
    );
  };

  // Render timeout state
  const renderTimeout = () => (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text color="yellow" bold>
          ⏱ Still looking for drivers...
        </Text>
      </Box>

      <Box flexDirection="column">
        <Text>We couldn&apos;t find a driver within 30 seconds.</Text>
        <Text>Don&apos;t worry - we&apos;re still searching!</Text>
      </Box>

      <Box marginTop={1} paddingX={2}>
        <Text color="cyan">
          You will receive a phone notification when a driver is assigned.
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Your booking request remains active.</Text>
      </Box>
    </Box>
  );

  // Render cancelled state
  const renderCancelled = () => (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text color="red" bold>
          ✗ Search Cancelled
        </Text>
      </Box>
      <Text>You can try booking again anytime.</Text>
    </Box>
  );

  // Render error state
  const renderError = () => (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text color="red" bold>
          ✗ Error
        </Text>
      </Box>
      <Text>{error}</Text>
    </Box>
  );

  return (
    <Box flexDirection="column" padding={1}>
      {error && renderError()}
      {!error && status === 'polling' && renderPolling()}
      {!error && status === 'assigned' && renderAssigned()}
      {!error && status === 'timeout' && renderTimeout()}
      {!error && status === 'cancelled' && renderCancelled()}
    </Box>
  );
}
