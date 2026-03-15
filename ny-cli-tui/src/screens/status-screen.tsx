import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { NyClient, RideStatus } from '../api/client.js';

interface StatusScreenProps {
  client: NyClient;
  onBack: () => void;
  onError: (error: string) => void;
}

export function StatusScreen({ client, onBack, onError }: StatusScreenProps) {
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState<RideStatus[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [selectedRide, setSelectedRide] = useState<RideStatus | null>(null);

  const fetchRides = useCallback(async (all = false) => {
    setLoading(true);
    try {
      const results = await client.getRideStatus({ 
        onlyActive: !all,
        limit: 20,
      });
      setRides(results);
    } catch (error: any) {
      onError(`Failed to fetch rides: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [client, onError]);

  useEffect(() => {
    fetchRides(showAll);
  }, [showAll]);

  useInput((input, key) => {
    if (key.escape) {
      if (selectedRide) {
        setSelectedRide(null);
      } else {
        onBack();
      }
    }
    if (input === 'r' && !loading) {
      fetchRides(showAll);
    }
    if (input === 'a' && !loading) {
      setShowAll(prev => !prev);
    }
  });

  const handleRideSelect = (item: { value: string }) => {
    const ride = rides.find(r => r.id === item.value);
    if (ride) {
      setSelectedRide(ride);
    }
  };

  const getStatusColor = (status: string): string => {
    if (status.includes('COMPLETED')) return 'green';
    if (status.includes('CANCELLED')) return 'red';
    if (status.includes('ACTIVE') || status.includes('NEW') || status.includes('CONFIRMED')) return 'yellow';
    return 'white';
  };

  const formatStatus = (status: string): string => {
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  if (loading) {
    return (
      <Box>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text> Loading rides...</Text>
      </Box>
    );
  }

  if (selectedRide) {
    return (
      <Box flexDirection="column">
        <Text bold>Ride Details</Text>
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text bold>Status: </Text>
            <Text color={getStatusColor(selectedRide.status)} bold>
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
              <Text bold>Driver Phone: </Text>
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
          
          {selectedRide.createdAt && (
            <Box>
              <Text bold>Booked: </Text>
              <Text dimColor>{new Date(selectedRide.createdAt).toLocaleString()}</Text>
            </Box>
          )}
          
          <Box>
            <Text bold>Booking ID: </Text>
            <Text dimColor>{selectedRide.id}</Text>
          </Box>
        </Box>
        
        <Box marginTop={2}>
          <Text dimColor>Press ESC to go back</Text>
        </Box>
      </Box>
    );
  }

  if (rides.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold>No rides found</Text>
        <Box marginTop={1}>
          <Text dimColor>
            {showAll ? 'No ride history available.' : 'No active rides. Press "a" to show all rides.'}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press ESC to go back | r - Refresh | a - Toggle all/active</Text>
        </Box>
      </Box>
    );
  }

  const items = rides.map((ride, index) => ({
    label: `${formatStatus(ride.status)} - ${ride.driverName || 'No driver yet'} - ${ride.vehicleNumber || 'N/A'}`,
    value: ride.id,
  }));

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>{showAll ? 'All Rides' : 'Active Rides'}</Text>
        <Text dimColor> ({rides.length} found)</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text dimColor>Select a ride to view details:</Text>
      </Box>
      
      <SelectInput items={items} onSelect={handleRideSelect} />
      
      <Box marginTop={2}>
        <Text dimColor>ESC - Back | r - Refresh | a - Toggle all/active</Text>
      </Box>
    </Box>
  );
}