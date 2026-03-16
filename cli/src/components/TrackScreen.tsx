// ============================================================================
// Track Screen Component
// Live ride tracking with status updates, cancel option, and fare breakdown
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import SelectInput from 'ink-select-input';
import type { RideBooking, RideStatus } from '../types.js';

// ============================================================================
// Types
// ============================================================================

type RideState = 
  | 'CONFIRMED' 
  | 'TRIP_ASSIGNED' 
  | 'DRIVER_ARRIVED' 
  | 'INPROGRESS' 
  | 'RIDE_STARTED'
  | 'COMPLETED' 
  | 'CANCELLED';

type TrackScreenMode = 'tracking' | 'cancel_reason' | 'cancel_confirm' | 'fare_breakdown';

interface CancelReason {
  code: string;
  label: string;
  description: string;
}

interface TrackScreenProps {
  token: string;
  currentBooking: RideBooking | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onCancel: (reasonCode: string, additionalInfo?: string) => void;
  onNewRide: () => void;
  onExit: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const CANCEL_REASONS: CancelReason[] = [
  { code: 'CHANGE_OF_PLANS', label: 'Change of Plans', description: 'My plans changed' },
  { code: 'DRIVER_NOT_MOVING', label: 'Driver Not Moving', description: 'Driver is not moving towards pickup' },
  { code: 'DRIVER_ASKED_TO_CANCEL', label: 'Driver Asked', description: 'Driver asked me to cancel' },
  { code: 'WRONG_PICKUP_LOCATION', label: 'Wrong Pickup', description: 'Wrong pickup location selected' },
  { code: 'ALTERNATIVE_ARRANGED', label: 'Alternative Arranged', description: 'Found alternative transport' },
  { code: 'WAITING_TOO_LONG', label: 'Waiting Too Long', description: 'Waiting for too long' },
  { code: 'OTHER', label: 'Other', description: 'Other reason' },
];

const POLLING_INTERVAL_MS = 5000; // Poll every 5 seconds for more responsive updates

// ============================================================================
// Helper Functions
// ============================================================================

const getStatusColor = (status?: string): string => {
  switch (status) {
    case 'CONFIRMED':
      return 'yellow';
    case 'TRIP_ASSIGNED':
    case 'DRIVER_ARRIVED':
      return 'cyan';
    case 'INPROGRESS':
    case 'RIDE_STARTED':
      return 'blue';
    case 'COMPLETED':
      return 'green';
    case 'CANCELLED':
      return 'red';
    default:
      return 'white';
  }
};

const getStatusIcon = (status?: string): string => {
  switch (status) {
    case 'CONFIRMED':
      return '⏳';
    case 'TRIP_ASSIGNED':
      return '🚗';
    case 'DRIVER_ARRIVED':
      return '📍';
    case 'INPROGRESS':
    case 'RIDE_STARTED':
      return '🚀';
    case 'COMPLETED':
      return '✅';
    case 'CANCELLED':
      return '❌';
    default:
      return '○';
  }
};

const getStatusDescription = (status?: string): string => {
  switch (status) {
    case 'CONFIRMED':
      return 'Looking for a driver...';
    case 'TRIP_ASSIGNED':
      return 'Driver is on the way';
    case 'DRIVER_ARRIVED':
      return 'Driver has arrived at pickup';
    case 'INPROGRESS':
    case 'RIDE_STARTED':
      return 'Ride in progress';
    case 'COMPLETED':
      return 'Ride completed';
    case 'CANCELLED':
      return 'Ride cancelled';
    default:
      return 'Unknown status';
  }
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatDuration = (startTime?: string): string => {
  if (!startTime) return '0:00';
  const start = new Date(startTime).getTime();
  const now = Date.now();
  const diffMs = now - start;
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);
  return `${diffMins}:${diffSecs.toString().padStart(2, '0')}`;
};

// ============================================================================
// Component
// ============================================================================

export function TrackScreen({
  token,
  currentBooking,
  isLoading,
  error,
  onRefresh,
  onCancel,
  onNewRide,
  onExit,
}: TrackScreenProps) {
  const { exit } = useApp();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [mode, setMode] = useState<TrackScreenMode>('tracking');
  const [selectedReason, setSelectedReason] = useState<CancelReason | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Auto-refresh polling
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      onRefresh();
      setLastUpdated(new Date());
    }, POLLING_INTERVAL_MS);

    const timerInterval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(refreshInterval);
      clearInterval(timerInterval);
    };
  }, [onRefresh]);

  // Auto-show fare breakdown when ride completes
  useEffect(() => {
    if (currentBooking?.status === 'COMPLETED' && mode === 'tracking') {
      setMode('fare_breakdown');
    }
  }, [currentBooking?.status, mode]);

  const handleCancelConfirm = useCallback(() => {
    if (selectedReason) {
      onCancel(selectedReason.code, additionalInfo || undefined);
      setMode('tracking');
      setSelectedReason(null);
      setAdditionalInfo('');
    }
  }, [selectedReason, additionalInfo, onCancel]);

  const handleReasonSelect = useCallback((item: { value: string; label: string }) => {
    const reason = CANCEL_REASONS.find((r) => r.code === item.value);
    if (reason) {
      setSelectedReason(reason);
      setMode('cancel_confirm');
    }
  }, []);

  useInput((input, key) => {
    // Global exit
    if (key.escape || input === 'q') {
      if (mode !== 'tracking') {
        setMode('tracking');
        setSelectedReason(null);
        setAdditionalInfo('');
      } else {
        onExit();
      }
      return;
    }

    // Tracking mode controls
    if (mode === 'tracking') {
      if (input === 'r' || input === 'R') {
        onRefresh();
        setLastUpdated(new Date());
        return;
      }

      if ((input === 'c' || input === 'C') && currentBooking) {
        const cancellableStatuses = ['CONFIRMED', 'TRIP_ASSIGNED', 'DRIVER_ARRIVED'];
        if (cancellableStatuses.includes(currentBooking.status)) {
          setMode('cancel_reason');
        }
        return;
      }

      if (input === 'n' || input === 'N') {
        onNewRide();
        return;
      }

      if (input === 'f' || input === 'F') {
        if (currentBooking?.status === 'COMPLETED') {
          setMode('fare_breakdown');
        }
        return;
      }
    }

    // Cancel reason selection mode
    if (mode === 'cancel_reason') {
      if (key.return && selectedReason) {
        setMode('cancel_confirm');
        return;
      }
    }

    // Cancel confirmation mode
    if (mode === 'cancel_confirm') {
      if (input === 'y' || input === 'Y') {
        handleCancelConfirm();
        return;
      }
      if (input === 'n' || input === 'N') {
        setMode('cancel_reason');
        setSelectedReason(null);
        return;
      }
    }

    // Fare breakdown mode
    if (mode === 'fare_breakdown') {
      if (input === 'n' || input === 'N') {
        onNewRide();
        return;
      }
      if (key.return || input === ' ') {
        setMode('tracking');
        return;
      }
    }
  });

  const cancelReasonItems = CANCEL_REASONS.map((reason) => ({
    label: `${reason.label} — ${reason.description}`,
    value: reason.code,
  }));

  const canCancel = currentBooking && 
    ['CONFIRMED', 'TRIP_ASSIGNED', 'DRIVER_ARRIVED'].includes(currentBooking.status);

  const isCompleted = currentBooking?.status === 'COMPLETED';
  const isCancelled = currentBooking?.status === 'CANCELLED';

  // ============================================================================
  // Render: Cancel Reason Selection
  // ============================================================================
  if (mode === 'cancel_reason') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="yellow">
            ⚠️ Cancel Ride
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text>Please select a reason for cancellation:</Text>
        </Box>

        <Box marginTop={1}>
          <SelectInput items={cancelReasonItems} onSelect={handleReasonSelect} />
        </Box>

        <Box marginTop={2}>
          <Text dimColor>↑↓ Navigate • Enter: Select • Esc: Back</Text>
        </Box>
      </Box>
    );
  }

  // ============================================================================
  // Render: Cancel Confirmation
  // ============================================================================
  if (mode === 'cancel_confirm' && selectedReason) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="yellow">
            ⚠️ Confirm Cancellation
          </Text>
        </Box>

        <Box marginBottom={1} borderStyle="single" paddingX={1} borderColor="yellow">
          <Box>
            <Text dimColor>Reason: </Text>
            <Text bold>{selectedReason.label}</Text>
          </Box>
          <Box>
            <Text dimColor>Description: </Text>
            <Text>{selectedReason.description}</Text>
          </Box>
        </Box>

        <Box marginY={1}>
          <Text>Are you sure you want to cancel this ride?</Text>
        </Box>

        <Box marginTop={1}>
          <Text color="green">[Y]</Text>
          <Text> Yes, cancel ride  </Text>
          <Text color="red">[N]</Text>
          <Text> No, go back</Text>
        </Box>

        <Box marginTop={2}>
          <Text dimColor>Y: Confirm • N: Back • Esc: Cancel</Text>
        </Box>
      </Box>
    );
  }

  // ============================================================================
  // Render: Fare Breakdown
  // ============================================================================
  if (mode === 'fare_breakdown' && currentBooking) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="green">
            ✅ Ride Completed — Fare Breakdown
          </Text>
        </Box>

        <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={2} paddingY={1}>
          {/* Ride summary */}
          <Box marginBottom={1}>
            <Text bold>Ride Summary</Text>
          </Box>

          {currentBooking.fromLocation && (
            <Box>
              <Text dimColor>From: </Text>
              <Text>
                {currentBooking.fromLocation.address?.area || 
                  `${currentBooking.fromLocation.gps?.lat}, ${currentBooking.fromLocation.gps?.lon}`}
              </Text>
            </Box>
          )}

          {currentBooking.toLocation && (
            <Box>
              <Text dimColor>To: </Text>
              <Text>
                {currentBooking.toLocation.address?.area || 
                  `${currentBooking.toLocation.gps?.lat}, ${currentBooking.toLocation.gps?.lon}`}
              </Text>
            </Box>
          )}

          <Box marginY={1}>
            <Text dimColor>Duration: </Text>
            <Text>{formatDuration(currentBooking.createdAt)}</Text>
          </Box>

          {/* Fare breakdown */}
          <Box marginTop={1} marginBottom={1}>
            <Text bold>Fare Details</Text>
          </Box>

          <Box>
            <Text dimColor>Base Fare: </Text>
            <Text>₹{currentBooking.estimatedFare || '—'}</Text>
          </Box>

          {currentBooking.estimatedFare && (
            <>
              <Box>
                <Text dimColor>Taxes & Fees: </Text>
                <Text>Included</Text>
              </Box>
              <Box marginTop={1} borderStyle="single" paddingX={1}>
                <Text bold>Total Paid: </Text>
                <Text bold color="green">₹{currentBooking.estimatedFare}</Text>
              </Box>
            </>
          )}

          {/* Driver info */}
          {currentBooking.driverName && (
            <Box marginTop={1}>
              <Text dimColor>Driver: </Text>
              <Text>{currentBooking.driverName}</Text>
              {currentBooking.driverRatings && (
                <Text> ⭐ {currentBooking.driverRatings}</Text>
              )}
            </Box>
          )}
        </Box>

        <Box marginTop={2}>
          <Text color="cyan">[N]</Text>
          <Text> New Ride  </Text>
          <Text color="gray">[Enter]</Text>
          <Text> Back to Tracking</Text>
        </Box>
      </Box>
    );
  }

  // ============================================================================
  // Render: Main Tracking View
  // ============================================================================
  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📍 Live Ride Tracking
        </Text>
        <Text dimColor> (Auto-refresh: {POLLING_INTERVAL_MS / 1000}s)</Text>
      </Box>

      {/* Error display */}
      {error && (
        <Box marginBottom={1} borderStyle="single" borderColor="red" paddingX={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
      )}

      {/* Loading state */}
      {isLoading && !currentBooking && (
        <Box marginY={2}>
          <Text color="yellow">
            <Spinner type="dots" /> Loading ride details...
          </Text>
        </Box>
      )}

      {/* No active ride */}
      {!currentBooking && !isLoading && (
        <Box flexDirection="column" marginY={2}>
          <Text dimColor>No active ride to track.</Text>
          <Box marginTop={1}>
            <Text color="cyan">[N]</Text>
            <Text> Book a new ride</Text>
          </Box>
        </Box>
      )}

      {/* Active ride tracking */}
      {currentBooking && (
        <Box flexDirection="column">
          {/* Status header */}
          <Box
            borderStyle="round"
            borderColor={getStatusColor(currentBooking.status)}
            paddingX={2}
            marginBottom={1}
          >
            <Text bold color={getStatusColor(currentBooking.status)}>
              {getStatusIcon(currentBooking.status)} {currentBooking.status}
            </Text>
            <Text dimColor> • {getStatusDescription(currentBooking.status)}</Text>
          </Box>

          {/* Progress indicator for ride states */}
          <Box marginBottom={1}>
            <Text color={['CONFIRMED', 'TRIP_ASSIGNED', 'DRIVER_ARRIVED', 'INPROGRESS', 'RIDE_STARTED', 'COMPLETED'].includes(currentBooking.status) ? 'green' : 'gray'}>
              {['TRIP_ASSIGNED', 'DRIVER_ARRIVED', 'INPROGRESS', 'RIDE_STARTED', 'COMPLETED'].includes(currentBooking.status) ? '✓' : '○'} Confirmed
            </Text>
            <Text> → </Text>
            <Text color={['TRIP_ASSIGNED', 'DRIVER_ARRIVED', 'INPROGRESS', 'RIDE_STARTED', 'COMPLETED'].includes(currentBooking.status) ? 'green' : 'gray'}>
              {['DRIVER_ARRIVED', 'INPROGRESS', 'RIDE_STARTED', 'COMPLETED'].includes(currentBooking.status) ? '✓' : '○'} Assigned
            </Text>
            <Text> → </Text>
            <Text color={['DRIVER_ARRIVED', 'INPROGRESS', 'RIDE_STARTED', 'COMPLETED'].includes(currentBooking.status) ? 'green' : 'gray'}>
              {['INPROGRESS', 'RIDE_STARTED', 'COMPLETED'].includes(currentBooking.status) ? '✓' : '○'} Arrived
            </Text>
            <Text> → </Text>
            <Text color={['INPROGRESS', 'RIDE_STARTED', 'COMPLETED'].includes(currentBooking.status) ? 'green' : 'gray'}>
              {['COMPLETED'].includes(currentBooking.status) ? '✓' : '○'} Complete
            </Text>
          </Box>

          {/* Driver info card */}
          {currentBooking.driverName && (
            <Box flexDirection="column" marginBottom={1} borderStyle="single" paddingX={1} borderColor="cyan">
              <Box marginBottom={1}>
                <Text bold color="cyan">🚗 Driver Information</Text>
              </Box>

              <Box>
                <Text dimColor>Name: </Text>
                <Text bold>{currentBooking.driverName}</Text>
                {currentBooking.driverRatings && (
                  <Text color="yellow"> ⭐ {currentBooking.driverRatings}</Text>
                )}
              </Box>

              {currentBooking.driverNumber && (
                <Box>
                  <Text dimColor>Phone: </Text>
                  <Text>{currentBooking.driverNumber}</Text>
                </Box>
              )}

              {currentBooking.vehicleNumber && (
                <Box marginTop={1}>
                  <Text dimColor>Vehicle: </Text>
                  <Text>
                    {currentBooking.vehicleColor} {currentBooking.vehicleModel}
                  </Text>
                </Box>
              )}

              {currentBooking.vehicleNumber && (
                <Box>
                  <Text dimColor>Number: </Text>
                  <Text bold backgroundColor="white" color="black">
                    {' '}{currentBooking.vehicleNumber}{' '}
                  </Text>
                </Box>
              )}

              {currentBooking.rideOtp && (
                <Box marginTop={1}>
                  <Text backgroundColor="green" color="white" bold>
                    {' '}🔐 Ride OTP: {currentBooking.rideOtp}{' '}
                  </Text>
                </Box>
              )}
            </Box>
          )}

          {/* Location info */}
          {(currentBooking.fromLocation || currentBooking.toLocation) && (
            <Box flexDirection="column" marginBottom={1} borderStyle="single" paddingX={1}>
              <Box marginBottom={1}>
                <Text bold>📍 Trip Details</Text>
              </Box>

              {currentBooking.fromLocation && (
                <Box>
                  <Text dimColor>From: </Text>
                  <Text>
                    {currentBooking.fromLocation.address?.area ||
                      `${currentBooking.fromLocation.gps?.lat}, ${currentBooking.fromLocation.gps?.lon}`}
                  </Text>
                </Box>
              )}

              {currentBooking.toLocation && (
                <Box>
                  <Text dimColor>To: </Text>
                  <Text>
                    {currentBooking.toLocation.address?.area ||
                      `${currentBooking.toLocation.gps?.lat}, ${currentBooking.toLocation.gps?.lon}`}
                  </Text>
                </Box>
              )}
            </Box>
          )}

          {/* Fare info */}
          {currentBooking.estimatedFare && (
            <Box marginBottom={1}>
              <Text dimColor>Estimated Fare: </Text>
              <Text bold>₹{currentBooking.estimatedFare}</Text>
            </Box>
          )}

          {/* Booking ID and tracking time */}
          <Box marginTop={1}>
            <Text dimColor>Booking ID: {currentBooking.id}</Text>
          </Box>
          <Box>
            <Text dimColor>Tracking for: {formatTime(elapsedTime)}</Text>
            <Text dimColor> • Last updated: {lastUpdated.toLocaleTimeString()}</Text>
          </Box>
        </Box>
      )}

      {/* Controls */}
      <Box flexDirection="column" marginTop={2} borderStyle="single" paddingX={1}>
        <Text bold>Controls:</Text>
        <Box marginLeft={2}>
          <Text color="green">[R]</Text>
          <Text dimColor> Refresh now</Text>
        </Box>
        
        {canCancel && (
          <Box marginLeft={2}>
            <Text color="yellow">[C]</Text>
            <Text dimColor> Cancel ride</Text>
          </Box>
        )}
        
        {isCompleted && (
          <Box marginLeft={2}>
            <Text color="cyan">[F]</Text>
            <Text dimColor> View fare breakdown</Text>
          </Box>
        )}
        
        <Box marginLeft={2}>
          <Text color="cyan">[N]</Text>
          <Text dimColor> New ride</Text>
        </Box>
        <Box marginLeft={2}>
          <Text color="red">[Q/Esc]</Text>
          <Text dimColor> Exit</Text>
        </Box>
      </Box>

      {/* Refresh indicator */}
      {isLoading && currentBooking && (
        <Box marginTop={1}>
          <Text color="yellow">
            <Spinner type="dots" /> Refreshing...
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default TrackScreen;
