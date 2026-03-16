import React from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import type { RideAssignedScreenProps } from '../types/index.js';

interface MenuItem {
  label: string;
  value: string;
}

export function RideAssignedScreen({ booking, onViewStatus, onBookAnother }: RideAssignedScreenProps): JSX.Element {
  const items: MenuItem[] = [
    { label: '📋 View Ride Details', value: 'status' },
    { label: '🚗 Book Another Ride', value: 'book' },
    { label: '❌ Exit', value: 'exit' },
  ];

  const handleSelect = (item: MenuItem) => {
    if (item.value === 'status') {
      onViewStatus();
    } else if (item.value === 'book') {
      onBookAnother();
    } else if (item.value === 'exit') {
      process.exit(0);
    }
  };

  useInput((input, key) => {
    if (key.escape) {
      process.exit(0);
    }
  });

  const fromLocation = booking.fromLocation;
  const toLocation = booking.toLocation;

  const fromText = fromLocation?.title || fromLocation?.area || `${fromLocation?.lat?.toFixed(4)}, ${fromLocation?.lon?.toFixed(4)}`;
  const toText = toLocation?.title || toLocation?.area || `${toLocation?.lat?.toFixed(4)}, ${toLocation?.lon?.toFixed(4)}`;

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="green">
        ✓ Driver Assigned!
      </Text>

      <Box flexDirection="column" marginTop={1}>
        <Text bold>Ride Details:</Text>
        <Text>Status: {booking.status}</Text>
        {booking.driverName && (
          <Text>Driver: {booking.driverName}</Text>
        )}
        {booking.vehicleNumber && (
          <Text>Vehicle: {booking.vehicleNumber}</Text>
        )}
        {booking.vehicleVariant && (
          <Text>Type: {booking.vehicleVariant}</Text>
        )}
        <Text dimColor>From: {fromText}</Text>
        <Text dimColor>To: {toText}</Text>
        <Text>Estimated Fare: ₹{booking.estimatedFare}</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>What would you like to do?</Text>
        <SelectInput items={items} onSelect={handleSelect} />
      </Box>

      <Text dimColor marginTop={1}>
        Press Esc to exit
      </Text>
    </Box>
  );
}
