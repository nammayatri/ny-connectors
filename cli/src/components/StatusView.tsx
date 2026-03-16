// ============================================================================
// Status View Component - Shows Active Rides with Live Polling
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { NammaYatriClient, RideBooking, GetRideStatusResponse } from '../api/client.js';

interface StatusViewProps {
  token: string;
  onBack: () => void;
  onBookNew: () => void;
}

interface RideWithDetails {
  booking: RideBooking;
  rideStatus?: GetRideStatusResponse;
}

const POLLING_INTERVAL_MS = 5000;

export const StatusView: React.FC<StatusViewProps> = ({ token, onBack, onBookNew }) => {
  const { exit } = useApp();
  const client = useMemo(() => new NammaYatriClient(token), [token]);
  const isMountedRef = useRef(true);
  const [rides, setRides] = useState<RideWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Fetch active rides and their details
  const fetchStatus = useCallback(async () => {
    // Don't fetch if component is unmounted or there's an error
    if (!isMountedRef.current) return;

    try {
      setLoading(true);
      setError(null);

      const activeBookings = await client.getActiveBookings({ onlyActive: true });

      // Fetch detailed status for each booking
      const ridesWithDetails: RideWithDetails[] = await Promise.all(
        activeBookings.map(async (booking) => {
          try {
            // Try to get ride status if booking has progressed to ride stage
            const rideStatus = await client.getRideStatus(booking.id);
            return { booking, rideStatus };
          } catch {
            // If ride status fails, just return booking info
            return { booking };
          }
        })
      );

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setRides(ridesWithDetails);
        setLastRefresh(new Date());
      }
    } catch (err) {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch ride status');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [client]);

  // Initial fetch and polling setup
  useEffect(() => {
    isMountedRef.current = true;
    fetchStatus();

    const interval = setInterval(() => {
      // Pause polling when there's an error to reduce unnecessary API calls
      if (!error) {
        fetchStatus();
      }
    }, POLLING_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchStatus, error]);

  // Keyboard handling
  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }

    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
      return;
    }

    if (input === 'r' || input === 'R') {
      fetchStatus();
      return;
    }

    if (input === 'b' || input === 'B') {
      onBookNew();
      return;
    }

    // Navigation
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(rides.length - 1, prev + 1));
    }
  });

  // Format status for display
  const formatStatus = (status: string): { text: string; color: string } => {
    const statusMap: Record<string, { text: string; color: string }> = {
      'CONFIRMED': { text: '🟢 Confirmed', color: 'green' },
      'TRIP_ASSIGNED': { text: '🚗 Driver Assigned', color: 'yellow' },
      'TRIP_STARTED': { text: '🔵 Ride Started', color: 'blue' },
      'DRIVER_ARRIVED': { text: '📍 Driver Arrived', color: 'cyan' },
      'IN_PROGRESS': { text: '🚀 In Progress', color: 'magenta' },
      'COMPLETED': { text: '✅ Completed', color: 'green' },
      'CANCELLED': { text: '❌ Cancelled', color: 'red' },
    };
    return statusMap[status] || { text: status, color: 'white' };
  };

  // Format time
  const formatTime = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Format relative time
  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} mins ago`;
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🚗 Active Rides
        </Text>
        <Text dimColor> (refreshed {formatRelativeTime(lastRefresh)})</Text>
      </Box>

      {/* Error */}
      {error && (
        <Box marginBottom={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {/* Loading */}
      {loading && rides.length === 0 && (
        <Box>
          <Text color="green">
            <Spinner type="dots" />
          </Text>
          <Text> Loading ride status...</Text>
        </Box>
      )}

      {/* No rides */}
      {!loading && rides.length === 0 && (
        <Box flexDirection="column">
          <Text color="yellow">No active rides found.</Text>
          <Box marginTop={1}>
            <Text dimColor>Press 'b' to book a new ride</Text>
          </Box>
        </Box>
      )}

      {/* Ride list */}
      {rides.length > 0 && (
        <Box flexDirection="column">
          {rides.map((ride, index) => {
            const status = formatStatus(ride.booking.status);
            const isSelected = index === selectedIndex;

            return (
              <Box
                key={ride.booking.id}
                flexDirection="column"
                borderStyle={isSelected ? 'double' : 'single'}
                borderColor={isSelected ? 'cyan' : 'gray'}
                paddingX={1}
                paddingY={1}
                marginBottom={1}
              >
                {/* Ride header */}
                <Box justifyContent="space-between">
                  <Text bold>
                    {ride.booking.fromLocation.area || 'Unknown'} →{' '}
                    {ride.booking.toLocation?.area || 'Unknown'}
                  </Text>
                  <Text color={status.color}>{status.text}</Text>
                </Box>

                {/* Ride details */}
                <Box flexDirection="column" marginTop={1}>
                  <Text dimColor>
                    Booked at: {formatTime(ride.booking.createdAt)}
                  </Text>

                  {ride.rideStatus && (
                    <>
                      <Box marginTop={1}>
                        <Text>Driver: {ride.rideStatus.ride.driverName}</Text>
                      </Box>
                      <Box>
                        <Text>Vehicle: {ride.rideStatus.ride.vehicleNumber}</Text>
                        <Text dimColor> ({ride.rideStatus.ride.vehicleVariant})</Text>
                      </Box>
                      {ride.rideStatus.ride.driverRatings && (
                        <Box>
                          <Text>Rating: ⭐ {ride.rideStatus.ride.driverRatings}</Text>
                        </Box>
                      )}
                      {ride.rideStatus.ride.rideOtp && (
                        <Box marginTop={1}>
                          <Text bold color="yellow">
                            OTP: {ride.rideStatus.ride.rideOtp}
                          </Text>
                        </Box>
                      )}
                      {ride.rideStatus.ride.computedPrice && (
                        <Box>
                          <Text>
                            Fare: ₹{ride.rideStatus.ride.computedPrice}
                          </Text>
                        </Box>
                      )}
                    </>
                  )}

                  {!ride.rideStatus && ride.booking.estimatedFare > 0 && (
                    <Box>
                      <Text>Est. Fare: ₹{ride.booking.estimatedFare}</Text>
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1} borderStyle="single" borderTop paddingTop={1}>
        <Text dimColor>
          ↑↓ Navigate • r Refresh • b Book New • q Quit • Esc Back
        </Text>
      </Box>
    </Box>
  );
};

export default StatusView;
