// ============================================================================
// History View Component - Shows Past Rides
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { NammaYatriClient, RideBooking } from '../api/client.js';

interface HistoryViewProps {
  token: string;
  onBack: () => void;
  onBookNew: () => void;
}

interface RideWithPrice {
  booking: RideBooking;
  finalPrice?: number;
}

const ITEMS_PER_PAGE = 5;

export const HistoryView: React.FC<HistoryViewProps> = ({ token, onBack, onBookNew }) => {
  const { exit } = useApp();
  const [client] = useState(() => new NammaYatriClient(token));
  const [rides, setRides] = useState<RideWithPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Fetch ride history
  const fetchHistory = useCallback(async (offset: number = 0, append: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const response = await client.getActiveBookings({
        onlyActive: false,
        limit: ITEMS_PER_PAGE,
        offset,
      });

      const bookings = response || [];

      // Fetch price breakdown for completed rides
      const ridesWithPrices: RideWithPrice[] = await Promise.all(
        bookings.map(async (booking) => {
          if (booking.status === 'COMPLETED') {
            try {
              const breakdown = await client.getPriceBreakdown(booking.id);
              const totalPrice = breakdown.quoteBreakup?.reduce(
                (sum, item) => sum + (item.priceWithCurrency?.amount || 0),
                0
              );
              return { booking, finalPrice: totalPrice };
            } catch {
              return { booking };
            }
          }
          return { booking };
        })
      );

      if (append) {
        setRides((prev) => [...prev, ...ridesWithPrices]);
      } else {
        setRides(ridesWithPrices);
      }

      setHasMore(bookings.length === ITEMS_PER_PAGE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch ride history');
    } finally {
      setLoading(false);
    }
  }, [client]);

  // Initial fetch
  useEffect(() => {
    fetchHistory(0, false);
  }, [fetchHistory]);

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
      setPage(0);
      setSelectedIndex(0);
      fetchHistory(0, false);
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

    // Pagination
    if (key.pageDown || input === ' ') {
      if (hasMore && !loading) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchHistory(nextPage * ITEMS_PER_PAGE, true);
      }
    }
    if (key.pageUp) {
      if (page > 0) {
        const prevPage = page - 1;
        setPage(prevPage);
        setSelectedIndex(0);
      }
    }
  });

  // Format status for display
  const formatStatus = (status: string): { text: string; color: string } => {
    const statusMap: Record<string, { text: string; color: string }> = {
      'CONFIRMED': { text: '🟢 Confirmed', color: 'green' },
      'TRIP_ASSIGNED': { text: '🚗 Assigned', color: 'yellow' },
      'TRIP_STARTED': { text: '🔵 Started', color: 'blue' },
      'DRIVER_ARRIVED': { text: '📍 Arrived', color: 'cyan' },
      'IN_PROGRESS': { text: '🚀 In Progress', color: 'magenta' },
      'COMPLETED': { text: '✅ Completed', color: 'green' },
      'CANCELLED': { text: '❌ Cancelled', color: 'red' },
      'REALLOCATED': { text: '🔄 Reallocated', color: 'yellow' },
    };
    return statusMap[status] || { text: status, color: 'white' };
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
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

  // Get vehicle icon
  const getVehicleIcon = (variant?: string): string => {
    if (!variant) return '🚗';
    const variantLower = variant.toLowerCase();
    if (variantLower.includes('auto')) return '🛺';
    if (variantLower.includes('bike')) return '🏍️';
    if (variantLower.includes('cab') || variantLower.includes('taxi')) return '🚕';
    if (variantLower.includes('premium')) return '🚙';
    return '🚗';
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color="cyan">
          📜 Ride History
        </Text>
        {rides.length > 0 && (
          <Text dimColor>
            Page {page + 1} • {rides.length} rides
          </Text>
        )}
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
          <Text> Loading ride history...</Text>
        </Box>
      )}

      {/* No rides */}
      {!loading && rides.length === 0 && (
        <Box flexDirection="column">
          <Text color="yellow">No ride history found.</Text>
          <Box marginTop={1}>
            <Text dimColor>Press 'b' to book your first ride</Text>
          </Box>
        </Box>
      )}

      {/* Ride list */}
      {rides.length > 0 && (
        <Box flexDirection="column">
          {rides.map((ride, index) => {
            const status = formatStatus(ride.booking.status);
            const isSelected = index === selectedIndex;
            const vehicleIcon = getVehicleIcon(ride.booking.vehicleVariant);

            return (
              <Box
                key={`${ride.booking.id}-${index}`}
                flexDirection="column"
                borderStyle={isSelected ? 'double' : 'single'}
                borderColor={isSelected ? 'cyan' : 'gray'}
                paddingX={1}
                paddingY={1}
                marginBottom={1}
              >
                {/* Ride header */}
                <Box justifyContent="space-between">
                  <Box>
                    <Text>{vehicleIcon} </Text>
                    <Text bold>
                      {ride.booking.fromLocation.area || 'Unknown'} →{' '}
                      {ride.booking.toLocation?.area || 'Unknown'}
                    </Text>
                  </Box>
                  <Text color={status.color}>{status.text}</Text>
                </Box>

                {/* Ride details */}
                <Box flexDirection="column" marginTop={1}>
                  <Box>
                    <Text dimColor>Date: </Text>
                    <Text>{formatDate(ride.booking.createdAt)}</Text>
                    <Text dimColor> at </Text>
                    <Text>{formatTime(ride.booking.createdAt)}</Text>
                  </Box>

                  {ride.booking.vehicleVariant && (
                    <Box>
                      <Text dimColor>Vehicle: </Text>
                      <Text>{ride.booking.vehicleVariant}</Text>
                    </Box>
                  )}

                  {ride.booking.driverName && (
                    <Box>
                      <Text dimColor>Driver: </Text>
                      <Text>{ride.booking.driverName}</Text>
                    </Box>
                  )}

                  {/* Price info */}
                  <Box marginTop={1}>
                    {ride.finalPrice ? (
                      <Text bold color="green">
                        Final Price: ₹{ride.finalPrice.toFixed(2)}
                      </Text>
                    ) : ride.booking.estimatedFare > 0 ? (
                      <Text>
                        Est. Fare: ₹{ride.booking.estimatedFare}
                      </Text>
                    ) : (
                      <Text dimColor>No price info</Text>
                    )}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Loading more indicator */}
      {loading && rides.length > 0 && (
        <Box marginTop={1}>
          <Text color="green">
            <Spinner type="dots" />
          </Text>
          <Text> Loading more...</Text>
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1} borderStyle="single" borderTop paddingTop={1}>
        <Text dimColor>
          ↑↓ Navigate • PgUp/PgDn Page • r Refresh • b Book New • q Quit • Esc Back
        </Text>
      </Box>
    </Box>
  );
};

export default HistoryView;
