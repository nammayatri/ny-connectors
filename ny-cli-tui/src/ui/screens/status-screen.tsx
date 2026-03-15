import React, { useEffect, useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { Header, Divider, ErrorRow, RideStatus, RideStatusList, mapApiStatus, type RideStatusData, type RideStatusType } from '../components/index.js';
import { fetchRideStatus, type RideBooking } from '../../api/client.js';
import { colors, icons, styleUtils } from '../../theme.js';

interface StatusScreenProps {
  showAll: boolean;
  limit: number;
}

type LoadingState = 'loading' | 'success' | 'error';

/**
 * Transform API RideBooking to RideStatusData for the component
 */
function transformBookingToStatusData(booking: RideBooking): RideStatusData {
  return {
    id: booking.id,
    status: mapApiStatus(booking.status),
    otp: booking.otp,
    driver: booking.driverName ? {
      name: booking.driverName,
      phoneNumber: booking.driverNumber,
      rating: booking.driverRating,
      totalRides: booking.driverTotalRides,
    } : undefined,
    vehicle: booking.vehicleNumber ? {
      number: booking.vehicleNumber,
      model: booking.vehicleModel,
      variant: booking.vehicleVariant ?? 'Auto',
      color: booking.vehicleColor,
    } : undefined,
    estimatedArrival: booking.eta,
    estimatedTripDuration: booking.tripDuration,
    estimatedDistance: booking.distance,
    estimatedFare: booking.estimatedFare,
    fromAddress: booking.fromAddress,
    toAddress: booking.toAddress,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt ?? booking.createdAt,
  };
}

export function StatusScreen({ showAll, limit }: StatusScreenProps): JSX.Element {
  const [rides, setRides] = useState<RideStatusData[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewingDetails, setViewingDetails] = useState<RideStatusData | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const loadRides = useCallback(async () => {
    setLoadingState('loading');
    setError(null);
    
    try {
      const results = await fetchRideStatus({
        onlyActive: !showAll,
        limit,
      });
      const statusData = results.map(transformBookingToStatusData);
      setRides(statusData);
      setLoadingState('success');
      
      // Start polling if there are active rides
      const hasActiveRides = statusData.some(ride => 
        !['COMPLETED', 'CANCELLED'].includes(ride.status)
      );
      setIsPolling(hasActiveRides);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rides');
      setLoadingState('error');
    }
  }, [showAll, limit]);

  // Initial load
  useEffect(() => {
    loadRides();
  }, [loadRides]);

  // Polling for active rides
  useEffect(() => {
    if (!isPolling || loadingState !== 'success') return;

    const pollInterval = setInterval(async () => {
      try {
        const results = await fetchRideStatus({
          onlyActive: true,
          limit: 5,
        });
        const statusData = results.map(transformBookingToStatusData);
        
        // Update rides list with new data
        setRides(prevRides => {
          const updatedRides = [...prevRides];
          
          for (const newRide of statusData) {
            const existingIndex = updatedRides.findIndex(r => r.id === newRide.id);
            if (existingIndex >= 0) {
              updatedRides[existingIndex] = newRide;
            } else {
              // New ride, add to beginning
              updatedRides.unshift(newRide);
            }
          }
          
          return updatedRides;
        });

        // Stop polling if no active rides
        const hasActiveRides = statusData.some(ride => 
          !['COMPLETED', 'CANCELLED'].includes(ride.status)
        );
        if (!hasActiveRides) {
          setIsPolling(false);
        }
      } catch {
        // Silently fail on polling errors
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isPolling, loadingState]);

  // Handle status changes
  const handleStatusChange = useCallback((newStatus: RideStatusType) => {
    if (['COMPLETED', 'CANCELLED'].includes(newStatus)) {
      // Refresh the list when a ride completes or is cancelled
      setTimeout(() => loadRides(), 1000);
    }
  }, [loadRides]);

  useInput((input, key) => {
    if (viewingDetails) {
      if (key.escape || input === 'q') {
        setViewingDetails(null);
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(rides.length - 1, prev + 1));
    } else if (key.return && rides[selectedIndex]) {
      setViewingDetails(rides[selectedIndex]);
    } else if (input === 'r') {
      loadRides();
    } else if (input === 'q' || key.escape) {
      process.exit(0);
    }
  });

  if (loadingState === 'loading') {
    return (
      <Box flexDirection="column" padding={1}>
        <Header title="Ride Status" />
        <Box>
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
          <Text> Loading rides...</Text>
        </Box>
      </Box>
    );
  }

  if (loadingState === 'error') {
    return (
      <Box flexDirection="column" padding={1}>
        <Header title="Ride Status" />
        <ErrorRow text={error ?? 'Unknown error'} />
        <Text dimColor>Press 'r' to retry or 'q' to quit.</Text>
      </Box>
    );
  }

  if (viewingDetails) {
    return (
      <Box flexDirection="column" padding={1}>
        <Header title="Ride Details" subtitle={`Booking ID: ${viewingDetails.id}`} />
        <Divider />
        <Box flexDirection="column" marginLeft={1} marginTop={1}>
          <RideStatus
            ride={viewingDetails}
            isPolling={isPolling && !['COMPLETED', 'CANCELLED'].includes(viewingDetails.status)}
            onStatusChange={handleStatusChange}
            showFullDetails={true}
          />
        </Box>
        <Divider />
        <Box marginTop={1}>
          <Text dimColor>
            {isPolling && !['COMPLETED', 'CANCELLED'].includes(viewingDetails.status) 
              ? `${icons.spinner} Live updates active | ` 
              : ''}
            Press ESC or 'q' to go back
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Header 
        title="Ride Status" 
        subtitle={showAll ? 'All rides' : 'Active rides'} 
      />
      <Divider />

      {rides.length === 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>No rides found.</Text>
          <Text dimColor marginTop={1}>
            Book a ride using `ny-cli book` command.
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <RideStatusList
            rides={rides}
            selectedIndex={selectedIndex}
            onSelect={(index) => setViewingDetails(rides[index])}
          />
        </Box>
      )}

      <Divider />
      <Box>
        <Text dimColor>
          ↑/↓ Navigate | Enter Details | r Refresh | q Quit
        </Text>
        {isPolling && (
          <Box marginLeft={2}>
            <Text color={colors.accent.info}>
              <Spinner type="dots" /> Live
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}