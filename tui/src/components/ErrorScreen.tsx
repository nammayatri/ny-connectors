import React from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import type { ErrorScreenProps } from '../types/index.js';

interface MenuItem {
  label: string;
  value: string;
}

export function ErrorScreen({ message, onRetry, onHome }: ErrorScreenProps): JSX.Element {
  const items: MenuItem[] = [
    { label: '🔄 Retry', value: 'retry' },
    { label: '🏠 Go Home', value: 'home' },
    { label: '❌ Exit', value: 'exit' },
  ];

  const handleSelect = (item: MenuItem) => {
    if (item.value === 'retry') {
      onRetry();
    } else if (item.value === 'home') {
      onHome();
    } else if (item.value === 'exit') {
      process.exit(1);
    }
  };

  useInput((input, key) => {
    if (key.escape) {
      process.exit(1);
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="red">
        ✗ Error
      </Text>

      <Box flexDirection="column" marginTop={1}>
        <Text>{message}</Text>
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
