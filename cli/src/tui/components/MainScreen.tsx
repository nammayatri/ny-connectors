/**
 * Main Menu Screen
 * Primary navigation hub for the CLI
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';

interface MainScreenProps {
  isAuthenticated: boolean;
  onSelectAuth: () => void;
  onSelectBook: () => void;
  onSelectStatus: () => void;
  onSelectSaved: () => void;
  onLogout: () => void;
}

interface SelectItem {
  label: string;
  value: string;
}

export function MainScreen({
  isAuthenticated,
  onSelectAuth,
  onSelectBook,
  onSelectStatus,
  onSelectSaved,
  onLogout,
}: MainScreenProps): React.ReactElement {
  const items: SelectItem[] = isAuthenticated
    ? [
        { label: '🚗  Book a Ride', value: 'book' },
        { label: '📍  Check Ride Status', value: 'status' },
        { label: '⭐  Saved Locations', value: 'saved' },
        { label: '🚪  Logout', value: 'logout' },
      ]
    : [
        { label: '🔐  Authenticate', value: 'auth' },
        { label: '❓  Help', value: 'help' },
      ];

  const handleSelect = (item: SelectItem): void => {
    switch (item.value) {
      case 'auth':
        onSelectAuth();
        break;
      case 'book':
        onSelectBook();
        break;
      case 'status':
        onSelectStatus();
        break;
      case 'saved':
        onSelectSaved();
        break;
      case 'logout':
        onLogout();
        break;
      case 'help':
        // Show help - could navigate to help screen
        break;
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Gradient name="rainbow">
          <BigText text="ny-cli" font="simple" />
        </Gradient>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>Namma Yatri Terminal Interface</Text>
      </Box>

      {isAuthenticated && (
        <Box marginBottom={1}>
          <Text color="green">✓ Authenticated</Text>
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        <Text bold>Select an option:</Text>
        <Box marginTop={1}>
          <SelectInput items={items} onSelect={handleSelect} />
        </Box>
      </Box>

      <Box marginTop={2}>
        <Text dimColor>Press Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}