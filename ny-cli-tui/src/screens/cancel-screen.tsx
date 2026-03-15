import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { NyClient, RideStatus } from '../api/client.js';

interface CancelScreenProps {
  client: NyClient;
  onBack: () => void;
  onError: (error: string) => void;
}

/**
 * CancelScreen Component
 * 
 * Displays active rides and allows users to cancel them.
 * Shows ride details including driver info, vehicle, and fare.
 */
export function CancelScreen({ client, onBack, onError }: CancelScreenProps) {
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState<RideStatus[]>([]);
  const [selectedRide, setSelectedRide] = useState<RideStatus | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelResult, setCancelResult] = useState<{ success: boolean; message: string } | null>(null);

  /**
   * Fetch active rides from API
   */
  const fetchRides = useCallback(async () => {
    setLoading(true);
    setCancelResult(null);
    try {
      const results = await client.getRideStatus({ 
        onlyActive: true,
        limit: 20,
      });
      // Filter to only show cancellable rides (not already cancelled or completed)
      const activeRides = results.filter(r => 
        !r.status.includes('CANCELLED') && 
        !r.status.includes('COMPLETED') &&
        !r.status.includes('TRIP_ENDED')
      );
      setRides(activeRides);
    } catch (error: any) {
      onError(`Failed to fetch rides: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [client, onError]);

  useEffect(() => {
    fetchRides();
  }, []);

  /**
   * Keyboard handler
   */
  useInput((input, key) => {
    if (key.escape) {
      if (selectedRide) {
        setSelectedRide(null);
        setCancelResult(null);
      } else if (cancelResult) {
        setCancelResult(null);
        fetchRides();
      } else {
        onBack();
      }
    }
    if (input === 'r' && !loading && !cancelling) {
      fetchRides();
    }
  });

  /**
   * Handle ride selection for cancellation
   */
  const handleRideSelect = (item: { value: string }) => {
    const ride = rides.find(r => r.id === item.value);
    if (ride) {
      setSelectedRide(ride);
      setCancelResult(null);
    }
  };

  /**
   * Handle cancellation confirmation
   */
  const handleCancelConfirm = async () => {
    if (!selectedRide) return;
    
    setCancelling(true);
    try {
      await client.cancelSearch(selectedRide.id);
      setCancelResult({
        success: true,
        message: 'Ride cancelled successfully!',
      });
      setSelectedRide(null);
    } catch (error: any) {
      setCancelResult({
        success: false,
        message: error.message || 'Failed to cancel ride',
      });
    } finally {
      setCancelling(false);
    }
  };

  /**
   * Get color for status display
   */
  const getStatusColor = (status: string): string => {
    if (status.includes('ASSIGNED')) return 'yellow';
    if (status.includes('CONFIRMED')) return 'blue';
    if (status.includes('STARTED')) return 'cyan';
    return 'white';
  };

  /**
   * Format status for display
   */
  const formatStatus = (status: string): string => {
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  // Loading state
  if (loading) {
    return (
      <Box>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text> Loading active rides...</Text>
      </Box>
    );
  }

  // Cancelling state
  if (cancelling) {
    return (
      <Box>
        <Text color="yellow">
          <Spinner type="dots" />
        </Text>
        <Text> Cancelling ride...</Text>
      </Box>
    );
  }

  // Cancel result display
  if (cancelResult) {
    return (
      <Box flexDirection="column">
        <Text bold color={cancelResult.success ? 'green' : 'red'}>
          {cancelResult.success ? '✓ Cancelled!' : '✗ Failed'}
        </Text>
        <Box marginTop={1}>
          <Text>{cancelResult.message}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press ESC to go back</Text>
        </Box>
      </Box>
    );
  }

  // Ride detail view with cancel confirmation
  if (selectedRide) {
    return (
      <Box flexDirection="column">
        <Text bold color="red">⚠ Cancel Ride</Text>
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text bold>Status: </Text>
            <Text color={getStatusColor(selectedRide.status)}>
              {formatStatus(selectedRide.status)}
            </Text>
          </Box>
          
          {selectedRide.driverName && (
            <Box>
              <Text bold>Driver: </Text>
              <Text>{selectedRide.driverName}</Text>
            </Box>
          )}
          
          {selectedRide.driverNumber && (
            <Box>
              <Text bold>Phone: </Text>
              <Text>{selectedRide.driverNumber}</Text>
            </Box>
          )}
          
          {selectedRide.vehicleNumber && (
            <Box>
              <Text bold>Vehicle: </Text>
              <Text>{selectedRide.vehicleNumber}</Text>
              {selectedRide.vehicleVariant && (
                <Text dimColor> ({selectedRide.vehicleVariant})</Text>
              )}
            </Box>
          )}
          
          {selectedRide.estimatedFare && (
            <Box>
              <Text bold>Fare: </Text>
              <Text color="green">₹{selectedRide.estimatedFare}</Text>
            </Box>
          )}
        </Box>

        <Box marginTop={2} flexDirection="column">
          <Text bold>Are you sure you want to cancel this ride?</Text>
          <Box marginTop={1}>
            <SelectInput
              items={[
                { label: 'Yes, cancel ride', value: 'confirm' },
                { label: 'No, go back', value: 'back' },
              ]}
              onSelect={(item) => {
                if (item.value === 'confirm') {
                  handleCancelConfirm();
                } else {
                  setSelectedRide(null);
                }
              }}
            />
          </Box>
        </Box>
      </Box>
    );
  }

  // No active rides
  if (rides.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold color="green">✓ No Active Rides</Text>
        <Box marginTop={1}>
          <Text dimColor>You have no active rides to cancel.</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press ESC to go back | r - Refresh</Text>
        </Box>
      </Box>
    );
  }

  // Ride selection list
  const items = rides.map((ride) => ({
    label: `${formatStatus(ride.status)} - ${ride.driverName || 'No driver'} - ${ride.vehicleNumber || 'N/A'}`,
    value: ride.id,
  }));

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="yellow">Active Rides ({rides.length})</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text dimColor>Select a ride to cancel:</Text>
      </Box>
      
      <SelectInput items={items} onSelect={handleRideSelect} />
      
      <Box marginTop={2}>
        <Text dimColor>ESC - Back | r - Refresh</Text>
      </Box>
    </Box>
  );
}

export default CancelScreen;