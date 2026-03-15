import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { NyClient, RideStatus as RideStatusType } from '../api/client.js';

// =============================================================================
// Types
// =============================================================================

export type RideStatusView = 'booking' | 'assigning' | 'assigned' | 'in-progress' | 'completed' | 'cancelled' | 'error';

export interface RideStatusProps {
  /** NyClient instance for API calls */
  client: NyClient;
  /** Initial ride data (if already booked) */
  initialRide?: RideStatusType;
  /** Booking ID to fetch status for */
  bookingId?: string;
  /** Called when ride is completed */
  onRideComplete?: (ride: RideStatusType) => void;
  /** Called when ride is cancelled */
  onRideCancel?: (ride: RideStatusType) => void;
  /** Called when user wants to go back */
  onBack?: () => void;
  /** Called on errors */
  onError?: (error: string) => void;
  /** Auto-refresh interval in milliseconds (default: 5000) */
  refreshInterval?: number;
  /** Maximum polling attempts for driver assignment (default: 60) */
  maxPollAttempts?: number;
  /** Show compact view (for embedding in other screens) */
  compact?: boolean;
}

interface CancelConfirmState {
  show: boolean;
  step: 'confirm' | 'cancelling' | 'cancelled';
}

// =============================================================================
// Helper Functions
// =============================================================================

function getStatusColor(status: string): string {
  const s = status.toUpperCase();
  if (s.includes('COMPLETED')) return 'green';
  if (s.includes('CANCELLED')) return 'red';
  if (s.includes('TRIP_STARTED') || s.includes('IN_PROGRESS')) return 'blue';
  if (s.includes('DRIVER_ASSIGNED') || s.includes('TRIP_ASSIGNED')) return 'cyan';
  if (s.includes('CONFIRMED') || s.includes('NEW')) return 'yellow';
  return 'white';
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return isoString;
  }
}

function getViewFromStatus(status: string): RideStatusView {
  const s = status.toUpperCase();
  if (s.includes('COMPLETED')) return 'completed';
  if (s.includes('CANCELLED')) return 'cancelled';
  if (s.includes('TRIP_STARTED') || s.includes('IN_PROGRESS')) return 'in-progress';
  if (s.includes('DRIVER_ASSIGNED') || s.includes('TRIP_ASSIGNED')) return 'assigned';
  if (s.includes('CONFIRMED')) return 'assigning';
  return 'booking';
}

// =============================================================================
// Sub-Components
// =============================================================================

interface StatusBadgeProps {
  status: string;
  size?: 'small' | 'normal';
}

function StatusBadge({ status, size = 'normal' }: StatusBadgeProps) {
  const color = getStatusColor(status);
  const icon = {
    green: '✓',
    red: '✗',
    blue: '🚗',
    cyan: '👤',
    yellow: '⏳',
    white: '○',
  }[color] || '○';

  return (
    <Box>
      <Text color={color} bold={size === 'normal'}>
        {icon} {formatStatus(status)}
      </Text>
    </Box>
  );
}

interface LabeledTextProps {
  label: string;
  children: React.ReactNode;
}

function LabeledText({ label, children }: LabeledTextProps) {
  return (
    <Box>
      <Box width={12}>
        <Text bold>{label}:</Text>
      </Box>
      <Box>
        {typeof children === 'string' ? <Text>{children}</Text> : children}
      </Box>
    </Box>
  );
}

interface DriverDetailsProps {
  ride: RideStatusType;
  compact?: boolean;
}

function DriverDetails({ ride, compact }: DriverDetailsProps) {
  if (compact) {
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">Driver Assigned</Text>
        <Box>
          <Text>{ride.driverName || 'Unknown'}</Text>
          {ride.vehicleNumber && <Text> • {ride.vehicleNumber}</Text>}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">🚕 Driver Details</Text>
      </Box>

      <Box flexDirection="column">
        <LabeledText label="Name">
          <Text>{ride.driverName || 'Not available'}</Text>
        </LabeledText>

        {ride.driverNumber && (
          <LabeledText label="Phone">
            <Text color="yellow">{ride.driverNumber}</Text>
          </LabeledText>
        )}

        {ride.vehicleNumber && (
          <LabeledText label="Vehicle">
            <Text>{ride.vehicleNumber}</Text>
          </LabeledText>
        )}

        {ride.vehicleVariant && (
          <LabeledText label="Type">
            <Text dimColor>{ride.vehicleVariant}</Text>
          </LabeledText>
        )}
      </Box>
    </Box>
  );
}

interface OtpDisplayProps {
  otp: string;
}

function OtpDisplay({ otp }: OtpDisplayProps) {
  return (
    <Box 
      flexDirection="column" 
      borderStyle="bold" 
      borderColor="yellow" 
      paddingX={2}
      marginY={1}
    >
      <Box marginBottom={1}>
        <Text bold color="yellow">🔐 Your Ride OTP</Text>
      </Box>
      <Box>
        <Text bold color="yellow" inverse>
          {`  ${otp.split('').join('  ')}  `}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Share this OTP with your driver to start the ride</Text>
      </Box>
    </Box>
  );
}

interface FareDisplayProps {
  estimatedFare?: number;
  finalFare?: number;
  currency?: string;
}

function FareDisplay({ estimatedFare, finalFare, currency = 'INR' }: FareDisplayProps) {
  const fare = finalFare || estimatedFare;
  const symbol = currency === 'INR' ? '₹' : currency;

  if (!fare) return null;

  return (
    <Box flexDirection="column">
      <LabeledText label="Fare">
        <Text color="green" bold>{symbol}{fare}</Text>
        {finalFare && estimatedFare && finalFare !== estimatedFare && (
          <Text dimColor> (estimated: {symbol}{estimatedFare})</Text>
        )}
      </LabeledText>
    </Box>
  );
}

interface CancelDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
  isCancelling: boolean;
}

function CancelDialog({ onConfirm, onCancel, isCancelling }: CancelDialogProps) {
  const items = [
    { label: '✗ No, keep the ride', value: 'no' },
    { label: '⚠ Yes, cancel ride', value: 'yes' },
  ];

  const handleSelect = (item: { value: string }) => {
    if (item.value === 'yes') {
      onConfirm();
    } else {
      onCancel();
    }
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="red">⚠ Cancel Ride?</Text>
      </Box>
      <Box marginBottom={1}>
        <Text>Are you sure you want to cancel this ride?</Text>
      </Box>
      {isCancelling ? (
        <Box>
          <Text color="red">
            <Spinner type="dots" />
          </Text>
          <Text> Cancelling ride...</Text>
        </Box>
      ) : (
        <SelectInput items={items} onSelect={handleSelect} />
      )}
    </Box>
  );
}

interface ProgressBarProps {
  progress: number; // 0-100
  width?: number;
  label?: string;
}

function ProgressBar({ progress, width = 30, label }: ProgressBarProps) {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  return (
    <Box flexDirection="column">
      {label && <Text dimColor>{label}</Text>}
      <Box>
        <Text color="cyan">{bar}</Text>
        <Text> {progress}%</Text>
      </Box>
    </Box>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function RideStatus({
  client,
  initialRide,
  bookingId,
  onRideComplete,
  onRideCancel,
  onBack,
  onError,
  refreshInterval = 5000,
  maxPollAttempts = 60,
  compact = false,
}: RideStatusProps) {
  const { exit } = useApp();
  
  // State
  const [ride, setRide] = useState<RideStatusType | null>(initialRide || null);
  const [loading, setLoading] = useState(!initialRide && !bookingId);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<RideStatusView>('booking');
  const [pollAttempt, setPollAttempt] = useState(0);
  const [cancelState, setCancelState] = useState<CancelConfirmState>({ show: false, step: 'confirm' });
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  
  // Refs
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Fetch ride status
  const fetchRideStatus = useCallback(async () => {
    try {
      const rides = await client.getRideStatus({ onlyActive: true, limit: 1 });
      if (rides.length > 0) {
        const currentRide = rides[0];
        setRide(currentRide);
        setView(getViewFromStatus(currentRide.status));
        setError(null);
        return currentRide;
      }
      return null;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to fetch ride status';
      setError(errorMsg);
      onError?.(errorMsg);
      return null;
    }
  }, [client, onError]);

  // Initial fetch
  useEffect(() => {
    if (initialRide) {
      setRide(initialRide);
      setView(getViewFromStatus(initialRide.status));
      setLoading(false);
      return;
    }

    if (bookingId) {
      // Fetch specific booking by ID
      const fetchSpecific = async () => {
        setLoading(true);
        try {
          // Note: API doesn't have a get-by-id endpoint, so we fetch all and filter
          const rides = await client.getRideStatus({ onlyActive: false, limit: 50 });
          const found = rides.find(r => r.id === bookingId);
          if (found) {
            setRide(found);
            setView(getViewFromStatus(found.status));
          } else {
            setError('Ride not found');
          }
        } catch (err: any) {
          setError(err.message || 'Failed to fetch ride');
        } finally {
          setLoading(false);
        }
      };
      fetchSpecific();
    } else {
      // Fetch current active ride
      const fetchActive = async () => {
        setLoading(true);
        await fetchRideStatus();
        setLoading(false);
      };
      fetchActive();
    }
  }, [initialRide, bookingId, client, fetchRideStatus]);

  // Polling for driver assignment
  useEffect(() => {
    if (view !== 'assigning' && view !== 'booking') return;

    const poll = async () => {
      if (!isMountedRef.current) return;
      
      setPollAttempt(prev => {
        const next = prev + 1;
        if (next >= maxPollAttempts) {
          setError('Driver assignment timeout. Please check your ride status later.');
          setView('error');
          return prev;
        }
        return next;
      });

      const currentRide = await fetchRideStatus();
      
      if (currentRide) {
        const newView = getViewFromStatus(currentRide.status);
        if (newView === 'assigned' || newView === 'in-progress') {
          // Driver assigned, stop polling
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }
    };

    pollIntervalRef.current = setInterval(poll, refreshInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [view, fetchRideStatus, refreshInterval, maxPollAttempts]);

  // Live status updates for active rides
  useEffect(() => {
    if (view !== 'assigned' && view !== 'in-progress') return;

    const update = async () => {
      if (!isMountedRef.current) return;
      const currentRide = await fetchRideStatus();
      
      if (currentRide) {
        const newView = getViewFromStatus(currentRide.status);
        if (newView === 'completed') {
          onRideComplete?.(currentRide);
        } else if (newView === 'cancelled') {
          onRideCancel?.(currentRide);
        }
      }
    };

    pollIntervalRef.current = setInterval(update, refreshInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [view, fetchRideStatus, refreshInterval, onRideComplete, onRideCancel]);

  // Cancel ride
  const handleCancelRide = useCallback(async () => {
    if (!ride) return;

    setCancelState({ show: true, step: 'cancelling' });

    try {
      await client.cancelSearch(ride.id);
      setCancelState({ show: true, step: 'cancelled' });
      
      // Update ride status
      setTimeout(async () => {
        const updatedRide = await fetchRideStatus();
        if (updatedRide) {
          onRideCancel?.(updatedRide);
        }
        setShowCancelDialog(false);
        setCancelState({ show: false, step: 'confirm' });
      }, 1000);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to cancel ride';
      setError(errorMsg);
      onError?.(errorMsg);
      setCancelState({ show: false, step: 'confirm' });
      setShowCancelDialog(false);
    }
  }, [ride, client, fetchRideStatus, onRideCancel, onError]);

  // Keyboard input
  useInput((input, key) => {
    if (showCancelDialog) {
      if (key.escape) {
        setShowCancelDialog(false);
      }
      return;
    }

    if (key.escape) {
      onBack?.();
    }

    if (input === 'r' || input === 'R') {
      fetchRideStatus();
    }

    if (input === 'c' || input === 'C') {
      if (ride && (view === 'assigning' || view === 'assigned' || view === 'booking')) {
        setShowCancelDialog(true);
      }
    }

    if (input === 'q' || input === 'Q') {
      exit();
    }
  });

  // Loading state
  if (loading) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text> Loading ride status...</Text>
        </Box>
      </Box>
    );
  }

  // Error state
  if (error && !ride) {
    return (
      <Box flexDirection="column">
        <Text color="red" bold>✗ Error</Text>
        <Box marginTop={1}>
          <Text>{error}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press ESC to go back | r - Retry</Text>
        </Box>
      </Box>
    );
  }

  // No active ride
  if (!ride) {
    return (
      <Box flexDirection="column">
        <Text bold>No Active Ride</Text>
        <Box marginTop={1}>
          <Text dimColor>You don't have any active rides at the moment.</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press ESC to go back</Text>
        </Box>
      </Box>
    );
  }

  // Cancel dialog overlay
  if (showCancelDialog) {
    return (
      <Box flexDirection="column">
        {/* Show current ride info in background */}
        <Box marginBottom={1}>
          <StatusBadge status={ride.status} />
        </Box>
        
        <CancelDialog
          onConfirm={handleCancelRide}
          onCancel={() => setShowCancelDialog(false)}
          isCancelling={cancelState.step === 'cancelling'}
        />
      </Box>
    );
  }

  // Compact view
  if (compact) {
    return (
      <Box flexDirection="column">
        <StatusBadge status={ride.status} />
        {ride.driverName && <DriverDetails ride={ride} compact />}
        <Box marginTop={1}>
          <Text dimColor>r - Refresh | ESC - Back</Text>
        </Box>
      </Box>
    );
  }

  // Full view
  return (
    <Box flexDirection="column">
      {/* Header with status */}
      <Box 
        borderStyle="round" 
        borderColor={getStatusColor(ride.status)} 
        paddingX={1}
        marginBottom={1}
      >
        <Box flexDirection="column">
          <Box>
            <Text bold>Ride Status: </Text>
            <StatusBadge status={ride.status} />
          </Box>
          <Box>
            <Text dimColor>Booking ID: {ride.id}</Text>
          </Box>
        </Box>
      </Box>

      {/* Driver assignment progress */}
      {(view === 'booking' || view === 'assigning') && (
        <Box flexDirection="column" marginBottom={1}>
          <Box>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
            <Text> Waiting for driver assignment...</Text>
          </Box>
          <Box marginTop={1}>
            <ProgressBar 
              progress={Math.min((pollAttempt / maxPollAttempts) * 100, 95)} 
              label={`Attempt ${pollAttempt + 1}/${maxPollAttempts}`}
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>This usually takes 30-60 seconds</Text>
          </Box>
        </Box>
      )}

      {/* Driver details */}
      {(view === 'assigned' || view === 'in-progress') && ride.driverName && (
        <Box marginBottom={1}>
          <DriverDetails ride={ride} />
        </Box>
      )}

      {/* Trip info */}
      <Box flexDirection="column" marginBottom={1}>
        <Box borderStyle="round" borderColor="gray" paddingX={1}>
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text bold color="blue">📍 Trip Details</Text>
            </Box>

            {ride.origin && (
              <LabeledText label="Pickup">
                <Text>
                  {ride.origin.address?.area || ride.origin.address?.building || 'Location set'}
                </Text>
              </LabeledText>
            )}

            {ride.destination && (
              <LabeledText label="Drop">
                <Text>
                  {ride.destination.address?.area || ride.destination.address?.building || 'Location set'}
                </Text>
              </LabeledText>
            )}

            <FareDisplay
              estimatedFare={ride.estimatedFare}
            />

            {ride.createdAt && (
              <LabeledText label="Booked">
                <Text dimColor>{formatTime(ride.createdAt)}</Text>
              </LabeledText>
            )}
          </Box>
        </Box>
      </Box>

      {/* Completed ride info */}
      {view === 'completed' && (
        <Box 
          borderStyle="round" 
          borderColor="green" 
          paddingX={1}
          marginBottom={1}
        >
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text bold color="green">✓ Ride Completed</Text>
            </Box>
            {ride.estimatedFare && (
              <Box>
                <Text bold>Final Fare: </Text>
                <Text color="green" bold>₹{ride.estimatedFare}</Text>
              </Box>
            )}
            {ride.driverName && (
              <Box>
                <Text dimColor>Thank you for riding with {ride.driverName}!</Text>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Cancelled ride info */}
      {view === 'cancelled' && (
        <Box 
          borderStyle="round" 
          borderColor="red" 
          paddingX={1}
          marginBottom={1}
        >
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text bold color="red">✗ Ride Cancelled</Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Error display */}
      {error && (
        <Box marginBottom={1}>
          <Text color="yellow">⚠ {error}</Text>
        </Box>
      )}

      {/* Action buttons */}
      <Box marginTop={1} flexDirection="column">
        {(view === 'booking' || view === 'assigning' || view === 'assigned') && (
          <Box marginBottom={1}>
            <Text color="red" bold dimColor>
              Press 'c' to cancel ride
            </Text>
          </Box>
        )}
        
        <Text dimColor>
          r - Refresh | {view === 'completed' || view === 'cancelled' ? 'ESC - Back' : 'ESC - Back | c - Cancel'} | q - Quit
        </Text>
      </Box>
    </Box>
  );
}

// =============================================================================
// Export additional components for external use
// =============================================================================

export { StatusBadge, DriverDetails, OtpDisplay, FareDisplay, CancelDialog, ProgressBar };