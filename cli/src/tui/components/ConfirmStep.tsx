/**
 * ConfirmStep Component
 * Booking summary screen with confirm/cancel actions
 * Features: booking summary, tip options, API integration, loading states
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { apiClient, RideEstimate, RideBooking } from '../../api/index.js';
import { formatCurrency, formatDuration } from '../../utils/format.js';

// =============================================================================
// Types
// =============================================================================

export interface ConfirmStepProps {
  /** Origin location */
  origin: {
    lat: number;
    lon: number;
    name: string;
    address?: string;
  };
  /** Destination location */
  destination: {
    lat: number;
    lon: number;
    name: string;
    address?: string;
  };
  /** Selected ride estimate */
  estimate: RideEstimate;
  /** Callback when booking is confirmed successfully */
  onConfirm: (booking: RideBooking | null) => void;
  /** Callback to go back */
  onBack: () => void;
  /** Whether this step is focused */
  isFocused?: boolean;
}

type ConfirmState = 'summary' | 'tip' | 'booking' | 'success' | 'error';

interface SelectItem {
  label: string;
  value: string;
}

// =============================================================================
// Constants
// =============================================================================

const DRIVER_POLL_TIMEOUT_MS = 30000;
const POLL_INTERVAL_MS = 2000;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get vehicle icon based on variant
 */
function getVehicleIcon(variant: string): string {
  const v = variant.toLowerCase();
  if (v.includes('auto')) return '🛺';
  if (v.includes('bike')) return '🏍️';
  if (v.includes('suv')) return '🚙';
  if (v.includes('premium') || v.includes('luxury')) return '✨';
  if (v.includes('sedan')) return '🚗';
  if (v.includes('hatchback')) return '🚗';
  return '🚕';
}

/**
 * Format ETA for display
 */
function formatETA(seconds?: number): string {
  if (!seconds) return '--';
  return formatDuration(seconds);
}

/**
 * Truncate text with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// =============================================================================
// Component
// =============================================================================

export function ConfirmStep({
  origin,
  destination,
  estimate,
  onConfirm,
  onBack,
  isFocused = true,
}: ConfirmStepProps): React.ReactElement {
  // State
  const [confirmState, setConfirmState] = useState<ConfirmState>('summary');
  const [selectedTip, setSelectedTip] = useState<number>(0);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState<RideBooking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollingMessage, setPollingMessage] = useState<string>('');

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Fare calculation
  const baseFare = estimate.estimatedTotalFareWithCurrency?.amount ?? estimate.estimatedFare;
  const currency = estimate.estimatedTotalFareWithCurrency?.currency ?? 'INR';
  const totalFare = baseFare + selectedTip;

  // Tip options from estimate or defaults
  const tipOptions = estimate.tipOptions ?? [0, 10, 20, 50];

  // Handle confirm booking
  const handleConfirm = useCallback(async () => {
    setIsBooking(true);
    setConfirmState('booking');
    setError(null);
    setPollingMessage('Initiating booking...');

    abortControllerRef.current = new AbortController();

    try {
      // Add tip if selected
      if (selectedTip > 0) {
        setPollingMessage('Adding tip...');
        await apiClient.addTip(estimate.id, selectedTip, currency);
      } else {
        // Select estimate without tip
        setPollingMessage('Confirming ride...');
        await apiClient.selectEstimate(estimate.id);
      }

      // Poll for driver assignment
      setPollingMessage('Finding a driver...');
      const startTime = Date.now();
      let foundBooking: RideBooking | null = null;

      while (Date.now() - startTime < DRIVER_POLL_TIMEOUT_MS) {
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        try {
          const rides = await apiClient.getRideStatus(true, 1);
          if (rides.length > 0) {
            foundBooking = rides[0];
            // Check if driver is assigned
            if (foundBooking.status !== 'NEW' && foundBooking.status !== 'DRIVER_ASSIGNMENT_PENDING') {
              break;
            }
          }
        } catch (pollErr) {
          // Continue polling on transient errors
          if (pollErr instanceof Error && pollErr.message.includes('401')) {
            throw pollErr;
          }
        }

        // Update polling message with elapsed time
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setPollingMessage(`Finding a driver... (${elapsed}s)`);

        await new Promise((resolve) => {
          pollIntervalRef.current = setTimeout(resolve, POLL_INTERVAL_MS);
        });
      }

      setBookingResult(foundBooking);
      setConfirmState('success');
      onConfirm(foundBooking);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const message = err instanceof Error ? err.message : 'Booking failed';
      setError(message);
      setConfirmState('error');
    } finally {
      setIsBooking(false);
    }
  }, [estimate, selectedTip, currency, onConfirm]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (isBooking && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onBack();
  }, [isBooking, onBack]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setConfirmState('summary');
    setError(null);
    setBookingResult(null);
  }, []);

  // Handle done (after success)
  const handleDone = useCallback(() => {
    onConfirm(bookingResult);
  }, [bookingResult, onConfirm]);

  // Keyboard navigation for summary state
  useInput(
    (input, key) => {
      if (!isFocused || confirmState !== 'summary') return;

      if (key.escape) {
        handleCancel();
      } else if (input === 't' || input === 'T') {
        setConfirmState('tip');
      } else if (key.return) {
        handleConfirm();
      }
    },
    { isActive: isFocused && confirmState === 'summary' }
  );

  // Keyboard navigation for tip state
  useInput(
    (input, key) => {
      if (!isFocused || confirmState !== 'tip') return;

      if (key.escape) {
        setConfirmState('summary');
      }
    },
    { isActive: isFocused && confirmState === 'tip' }
  );

  // Keyboard navigation for error state
  useInput(
    (input) => {
      if (!isFocused || confirmState !== 'error') return;

      if (input === 'r' || input === 'R') {
        handleRetry();
      } else if (input === 'b' || input === 'B') {
        handleCancel();
      }
    },
    { isActive: isFocused && confirmState === 'error' }
  );

  // Main menu items
  const mainMenuItems: SelectItem[] = [
    { label: `✓ Confirm Booking (${formatCurrency(totalFare, currency)})`, value: 'confirm' },
    { label: '💰 Add Tip', value: 'tip' },
    { label: '✗ Cancel', value: 'cancel' },
  ];

  // Tip menu items
  const tipMenuItems: SelectItem[] = tipOptions.map((tip) => ({
    label: tip === 0 ? 'No tip' : formatCurrency(tip, currency),
    value: String(tip),
  }));

  // Render booking state
  if (confirmState === 'booking') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            🚗 Booking Your Ride
          </Text>
        </Box>

        <Box>
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
          <Box marginLeft={1}>
            <Text>{pollingMessage}</Text>
          </Box>
        </Box>

        <Box marginTop={2} flexDirection="column">
          <Text dimColor>Route:</Text>
          <Text dimColor>  From: {truncate(origin.name, 40)}</Text>
          <Text dimColor>  To: {truncate(destination.name, 40)}</Text>
        </Box>

        <Box marginTop={2}>
          <Text dimColor>Please wait... (Ctrl+C to exit)</Text>
        </Box>
      </Box>
    );
  }

  // Render success state
  if (confirmState === 'success') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="green">
            ✓ Ride Booked Successfully!
          </Text>
        </Box>

        {/* Booking details */}
        <Box flexDirection="column" borderStyle="round" borderColor="green" padding={1}>
          <Text bold>Your ride has been confirmed</Text>

          {/* Driver info if available */}
          {bookingResult?.driverName && (
            <Box marginTop={1} flexDirection="column">
              <Text>👤 Driver: {bookingResult.driverName}</Text>
              {bookingResult.driverNumber && (
                <Text>📞 Phone: {bookingResult.driverNumber}</Text>
              )}
              {bookingResult.vehicleNumber && (
                <Text>🚗 Vehicle: {bookingResult.vehicleNumber}</Text>
              )}
              {bookingResult.vehicleModel && (
                <Text dimColor>   Model: {bookingResult.vehicleModel}</Text>
              )}
              {bookingResult.vehicleColor && (
                <Text dimColor>   Color: {bookingResult.vehicleColor}</Text>
              )}
              {bookingResult.otp && (
                <Box marginTop={1}>
                  <Text bold color="yellow">
                    🔐 OTP: {bookingResult.otp}
                  </Text>
                </Box>
              )}
            </Box>
          )}

          {/* Status message if no driver yet */}
          {(!bookingResult || !bookingResult.driverName) && (
            <Box marginTop={1}>
              <Text dimColor>
                Driver assignment in progress. You'll receive a notification shortly.
              </Text>
            </Box>
          )}
        </Box>

        {/* Fare summary */}
        <Box marginTop={1} flexDirection="column">
          <Text>Total Fare: {formatCurrency(totalFare, currency)}</Text>
          {selectedTip > 0 && (
            <Text dimColor>  (includes {formatCurrency(selectedTip, currency)} tip)</Text>
          )}
        </Box>

        {/* Done button */}
        <Box marginTop={2}>
          <SelectInput
            items={[{ label: 'Done', value: 'done' }]}
            onSelect={handleDone}
            isFocused={isFocused}
          />
        </Box>
      </Box>
    );
  }

  // Render error state
  if (confirmState === 'error') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="red">
            ✗ Booking Failed
          </Text>
        </Box>

        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="red"
          padding={1}
          marginTop={1}
        >
          <Text color="red">{error}</Text>
        </Box>

        <Box marginTop={2}>
          <Text dimColor>[r] Retry | [b] Back to variant selection</Text>
        </Box>
      </Box>
    );
  }

  // Render tip selection
  if (confirmState === 'tip') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            💰 Add a Tip for Your Driver
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text dimColor>
            Tips help you get a ride faster during peak hours
          </Text>
        </Box>

        {/* Current selection */}
        {selectedTip > 0 && (
          <Box marginBottom={1}>
            <Text color="green">
              Current tip: {formatCurrency(selectedTip, currency)}
            </Text>
          </Box>
        )}

        {/* Tip options */}
        <Box marginTop={1}>
          <SelectInput
            items={tipMenuItems}
            onSelect={(item) => {
              setSelectedTip(Number(item.value));
              setConfirmState('summary');
            }}
            isFocused={isFocused}
          />
        </Box>

        <Box marginTop={2}>
          <Text dimColor>[Esc] Back to summary</Text>
        </Box>
      </Box>
    );
  }

  // Render summary state (default)
  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ✓ Confirm Your Booking
        </Text>
      </Box>

      {/* Route summary */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="gray"
        padding={1}
        marginBottom={1}
      >
        <Box marginBottom={1}>
          <Text bold>Route</Text>
        </Box>

        {/* Pickup */}
        <Box>
          <Text color="green">🟢 Pickup: </Text>
          <Text>{truncate(origin.name, 35)}</Text>
        </Box>
        {origin.address && (
          <Box marginLeft={3}>
            <Text dimColor>{truncate(origin.address, 40)}</Text>
          </Box>
        )}

        {/* Drop */}
        <Box marginTop={1}>
          <Text color="red">🔴 Drop: </Text>
          <Text>{truncate(destination.name, 35)}</Text>
        </Box>
        {destination.address && (
          <Box marginLeft={3}>
            <Text dimColor>{truncate(destination.address, 40)}</Text>
          </Box>
        )}
      </Box>

      {/* Vehicle details */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="gray"
        padding={1}
        marginBottom={1}
      >
        <Box marginBottom={1}>
          <Text bold>Vehicle</Text>
        </Box>

        <Box>
          <Text>
            {getVehicleIcon(estimate.vehicleVariant)} {estimate.serviceTierName}
          </Text>
        </Box>

        {estimate.providerName && (
          <Box>
            <Text dimColor>Provider: {estimate.providerName}</Text>
          </Box>
        )}

        {estimate.isAirConditioned && (
          <Box>
            <Text dimColor>❄️ Air Conditioned</Text>
          </Box>
        )}

        {estimate.vehicleServiceTierSeatingCapacity && (
          <Box>
            <Text dimColor>👥 Seats: {estimate.vehicleServiceTierSeatingCapacity}</Text>
          </Box>
        )}

        {estimate.estimatedPickupDuration && (
          <Box marginTop={1}>
            <Text>⏱ ETA: {formatETA(estimate.estimatedPickupDuration)}</Text>
          </Box>
        )}
      </Box>

      {/* Fare breakdown */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        padding={1}
        marginBottom={1}
      >
        <Box marginBottom={1}>
          <Text bold>Fare Details</Text>
        </Box>

        <Box justifyContent="space-between">
          <Text>Base Fare:</Text>
          <Text>{formatCurrency(baseFare, currency)}</Text>
        </Box>

        {selectedTip > 0 && (
          <Box justifyContent="space-between">
            <Text>Tip:</Text>
            <Text color="green">+{formatCurrency(selectedTip, currency)}</Text>
          </Box>
        )}

        <Box
          justifyContent="space-between"
          borderStyle="single"
          borderColor="gray"
          paddingTop={1}
          marginTop={1}
        >
          <Text bold>Total:</Text>
          <Text bold color="green">
            {formatCurrency(totalFare, currency)}
          </Text>
        </Box>

        {/* Fare range if available */}
        {estimate.totalFareRange && (
          <Box marginTop={1}>
            <Text dimColor>
              Estimated range:{' '}
              {formatCurrency(estimate.totalFareRange.minFare, currency)} -{' '}
              {formatCurrency(estimate.totalFareRange.maxFare, currency)}
            </Text>
          </Box>
        )}
      </Box>

      {/* Trip terms if available */}
      {estimate.tripTerms && estimate.tripTerms.length > 0 && (
        <Box marginBottom={1}>
          <Text dimColor>Terms: {estimate.tripTerms.join(', ')}</Text>
        </Box>
      )}

      {/* Action menu */}
      <Box marginTop={1}>
        <SelectInput
          items={mainMenuItems}
          onSelect={(item) => {
            switch (item.value) {
              case 'confirm':
                handleConfirm();
                break;
              case 'tip':
                setConfirmState('tip');
                break;
              case 'cancel':
                handleCancel();
                break;
            }
          }}
          isFocused={isFocused}
        />
      </Box>

      {/* Keyboard hints */}
      <Box marginTop={2}>
        <Text dimColor>Enter: Confirm | t: Add Tip | Esc: Back</Text>
      </Box>
    </Box>
  );
}

// =============================================================================
// Hook for managing confirm state
// =============================================================================

export function useConfirmState(): {
  isConfirming: boolean;
  bookingResult: RideBooking | null;
  error: string | null;
  confirm: (estimate: RideEstimate, tip?: number) => Promise<RideBooking | null>;
  reset: () => void;
} {
  const [isConfirming, setIsConfirming] = useState(false);
  const [bookingResult, setBookingResult] = useState<RideBooking | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirm = useCallback(
    async (estimate: RideEstimate, tip = 0): Promise<RideBooking | null> => {
      setIsConfirming(true);
      setError(null);

      try {
        // Add tip if specified
        if (tip > 0) {
          await apiClient.addTip(
            estimate.id,
            tip,
            estimate.estimatedTotalFareWithCurrency?.currency ?? 'INR'
          );
        } else {
          await apiClient.selectEstimate(estimate.id);
        }

        // Poll for driver assignment
        const booking = await apiClient.pollForDriverAssignment();
        setBookingResult(booking);
        return booking;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Booking failed';
        setError(message);
        return null;
      } finally {
        setIsConfirming(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setIsConfirming(false);
    setBookingResult(null);
    setError(null);
  }, []);

  return {
    isConfirming,
    bookingResult,
    error,
    confirm,
    reset,
  };
}