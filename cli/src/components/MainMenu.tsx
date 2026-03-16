// ============================================================================
// Main Menu Component
// ============================================================================

import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { AppState } from '../types/index.js';

interface MainMenuProps {
  userName?: string;
  onSelect: (state: AppState) => void;
}

interface MenuItem {
  label: string;
  value: AppState;
  description?: string;
}

export const MainMenu: React.FC<MainMenuProps> = ({ userName, onSelect }) => {
  const items: MenuItem[] = [
    { label: '🚗 Book a Ride', value: 'SEARCH_ORIGIN', description: 'Search and book a new ride' },
    { label: '📍 Saved Locations', value: 'SAVED_LOCATIONS', description: 'View your saved locations' },
    { label: '📜 Ride History', value: 'RIDE_HISTORY', description: 'View past and active rides' },
    { label: '⚙️  Settings', value: 'SETTINGS', description: 'App settings and logout' },
  ];

  const handleSelect = (item: { value: AppState }) => {
    onSelect(item.value);
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🛺 Namma Yatri CLI
        </Text>
        {userName && (
          <Text color="green"> Welcome, {userName}!</Text>
        )}
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>Select an option:</Text>
      </Box>

      <SelectInput
        items={items.map((item) => ({
          label: item.label,
          value: item.value,
        }))}
        onSelect={(item) => onSelect(item.value as AppState)}
      />

      <Box marginTop={1}>
        <Text dimColor>Use ↑↓ to navigate, Enter to select</Text>
      </Box>
    </Box>
  );
};
