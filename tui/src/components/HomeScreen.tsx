import React from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import type { HomeScreenProps } from '../types/index.js';

interface MenuItem {
  label: string;
  value: string;
}

export function HomeScreen({ user, savedLocations, onBookRide, onViewStatus }: HomeScreenProps): JSX.Element {
  const items: MenuItem[] = [
    { label: '🚗 Book a Ride', value: 'book' },
    { label: '📋 View Ride Status', value: 'status' },
    { label: '👤 Profile', value: 'profile' },
    { label: '❌ Exit', value: 'exit' },
  ];

  const handleSelect = (item: MenuItem) => {
    if (item.value === 'book') {
      onBookRide();
    } else if (item.value === 'status') {
      onViewStatus();
    } else if (item.value === 'exit') {
      process.exit(0);
    }
  };

  useInput((input, key) => {
    if (key.escape) {
      process.exit(0);
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="green">
        🚗 Namma Yatri
      </Text>

      {user && (
        <Box flexDirection="column">
          <Text>Welcome, {user.firstName || 'Rider'}!</Text>
          {user.maskedMobileNumber && (
            <Text dimColor>{user.maskedMobileNumber}</Text>
          )}
        </Box>
      )}

      {savedLocations.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Saved Locations:</Text>
          <Box flexDirection="column" paddingLeft={2}>
            {savedLocations.slice(0, 5).map((loc) => (
              <Text key={loc.tag} dimColor>
                • {loc.tag}: {loc.locationName || `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`}
              </Text>
            ))}
          </Box>
        </Box>
      )}

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
