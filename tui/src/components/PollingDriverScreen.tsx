import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { RideEstimate, RideBooking } from '../types/index.js';
import { pollForRideAssignment } from '../utils/api.js';

interface PollingDriverScreenProps {
  token: string;
  estimate: RideEstimate;
  onDriverAssigned: (booking: RideBooking) => void;
  onTimeout: () => void;
  onCancel: () => void;
}

export function PollingDriverScreen({
  token,
  estimate,
  onDriverAssigned,
  onTimeout,
  onCancel,
}: PollingDriverScreenProps): JSX.Element {
  const [dots, setDots] = useState('.');
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<'polling' | 'success' | 'timeout'>('polling');
  const { exit } = useApp();

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '.' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Update elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll for driver
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const booking = await pollForRideAssignment(token, 30000);

      if (cancelled) return;

      if (booking) {
        setStatus('success');
        onDriverAssigned(booking);
      } else {
        setStatus('timeout');
        onTimeout();
      }
    }

    poll();

    return () => {
      cancelled = true;
    };
  }, [token, onDriverAssigned, onTimeout]);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onCancel();
    }
  });

  const fare = estimate.estimatedTotalFareWithCurrency || estimate.estimatedFareWithCurrency;
  const fareText = fare ? `₹${fare.amount}` : `₹${estimate.estimatedTotalFare || estimate.estimatedFare}`;

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="green">Finding Driver</Text>

      <Box flexDirection="column">
        <Text>Selected: {estimate.serviceTierName}</Text>
        <Text>Estimated fare: {fareText}</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        {status === 'polling' && (
          <>
            <Text color="yellow">
              Looking for nearby drivers{dots}
            </Text>
            <Text dimColor>
              Elapsed: {elapsed}s (max 30s)
            </Text>
          </>
        )}

        {status === 'success' && (
          <Text color="green">
            ✓ Driver assigned!
          </Text>
        )}

        {status === 'timeout' && (
          <>
            <Text color="yellow">
              ⏱ Still looking for drivers...
            </Text>
            <Text dimColor>
              You will receive a notification when a driver is assigned.
            </Text>
          </>
        )}
      </Box>

      <Text dimColor marginTop={1}>
        Press Esc or 'q' to cancel
      </Text>
    </Box>
  );
}
