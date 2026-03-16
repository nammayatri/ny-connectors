/**
 * Status Screen
 * Display active and past rides
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { apiClient, RideBooking } from '../../api/index.js';

interface StatusScreenProps {
  onBack: () => void;
}

interface SelectItem {
  label: string;
  value: string;
}

export function StatusScreen({ onBack }: StatusScreenProps): React.ReactElement {
  const [rides, setRides] = useState<RideBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRide, setSelectedRide] = useState<RideBooking | null>(null);

  useEffect(() => {
    loadRides();
  }, []);

  const loadRides = async (onlyActive = true): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const results = await apiClient.getRideStatus(onlyActive);
      setRides(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rides');
    } finally {
      setIsLoading(false);
    }
  };

  const rideOptions: SelectItem[] = rides.map((ride) => ({
    label: `${ride.status} - ${ride.createdAt}`,
    value: ride.id,
  }));

  const getStatusColor = (status: string): string => {
    if (status.includes('COMPLETED')) return 'green';
    if (status.includes('CANCELLED')) return 'red';
    if (status.includes('ACTIVE') || status.includes('NEW') || status.includes('CONFIRMED')) {
      return 'yellow';
    }
    return 'white';
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📍 Ride Status
        </Text>
      </Box>

      {isLoading ? (
        <Box>
          <Text color="yellow">
            <Spinner type="dots" /> Loading rides...
          </Text>
        </Box>
      ) : error ? (
        <Box>
          <Text color="red">✗ {error}</Text>
        </Box>
      ) : rides.length === 0 ? (
        <Box flexDirection="column">
          <Text dimColor>No rides found.</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text>Select a ride to view details:</Text>
          <Box marginTop={1}>
            <SelectInput
              items={rideOptions}
              onSelect={(item) => {
                const ride = rides.find((r) => r.id === item.value);
                if (ride) {
                  setSelectedRide(ride);
                }
              }}
            />
          </Box>
        </Box>
      )}

      {selectedRide && (
        <Box marginTop={2} flexDirection="column" borderStyle="round" padding={1}>
          <Text bold>Ride Details:</Text>
          <Box marginTop={1}>
            <Text>
              Status: <Text color={getStatusColor(selectedRide.status)}>{selectedRide.status}</Text>
            </Text>
          </Box>
          <Text>Created: {selectedRide.createdAt}</Text>
          {selectedRide.estimatedFare && <Text>Fare: ₹{selectedRide.estimatedFare}</Text>}
          {selectedRide.driverName && <Text>Driver: {selectedRide.driverName}</Text>}
          {selectedRide.driverNumber && <Text>Driver Phone: {selectedRide.driverNumber}</Text>}
          {selectedRide.vehicleNumber && (
            <Text>Vehicle: {selectedRide.vehicleNumber} ({selectedRide.vehicleVariant})</Text>
          )}
          <Text dimColor>Booking ID: {selectedRide.id}</Text>
        </Box>
      )}

      <Box marginTop={2}>
        <SelectInput
          items={[
            { label: '🔄 Refresh', value: 'refresh' },
            { label: '📋 Show All Rides', value: 'all' },
            { label: '📋 Show Active Only', value: 'active' },
            { label: '← Back', value: 'back' },
          ]}
          onSelect={(item) => {
            switch (item.value) {
              case 'refresh':
                loadRides();
                break;
              case 'all':
                loadRides(false);
                break;
              case 'active':
                loadRides(true);
                break;
              case 'back':
                onBack();
                break;
            }
          }}
        />
      </Box>
    </Box>
  );
}