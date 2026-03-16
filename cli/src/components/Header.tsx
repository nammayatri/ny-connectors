// ============================================================================
// Header Component
// App header with user info and navigation hints
// ============================================================================

import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  personName?: string | null;
  currentScreen: string;
}

export function Header({ personName, currentScreen }: HeaderProps) {
  const getScreenTitle = (screen: string) => {
    switch (screen) {
      case 'AUTH':
        return 'Authentication';
      case 'LOCATION':
        return 'Select Location';
      case 'RIDE_TYPE':
        return 'Choose Ride';
      case 'CONFIRM':
        return 'Confirm Booking';
      case 'TRACK':
        return 'Track Ride';
      default:
        return screen;
    }
  };

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      borderStyle="single"
      paddingX={1}
      marginBottom={1}
    >
      <Box>
        <Text bold color="cyan">
          🛺 Namma Yatri CLI
        </Text>
      </Box>

      <Box>
        <Text dimColor>{getScreenTitle(currentScreen)}</Text>
      </Box>

      <Box>
        {personName ? (
          <Text color="green">👤 {personName}</Text>
        ) : (
          <Text dimColor>Not logged in</Text>
        )}
      </Box>
    </Box>
  );
}

export default Header;
