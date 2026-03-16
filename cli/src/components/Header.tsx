import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  step: number;
  totalSteps: number;
  title: string;
  userName?: string;
  canGoBack: boolean;
}

export default function Header({
  step,
  totalSteps,
  title,
  userName,
  canGoBack,
}: HeaderProps): JSX.Element {
  const progress = step > 0 ? Math.round((step / totalSteps) * 100) : 0;
  const filledBlocks = Math.round((progress / 100) * 20);
  const emptyBlocks = 20 - filledBlocks;
  const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

  return (
    <Box
      flexDirection="column"
      paddingX={2}
      paddingY={1}
      borderStyle="single"
      borderBottom
    >
      <Box justifyContent="space-between">
        <Text bold color="cyan">
          🚗 Namma Yatri CLI
        </Text>
        {userName && (
          <Text dimColor>
            Hello, {userName}
          </Text>
        )}
      </Box>

      {step > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Box justifyContent="space-between">
            <Text dimColor>{title}</Text>
            <Text dimColor>
              Step {step} of {totalSteps}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="green">{progressBar}</Text>
            <Text dimColor> {progress}%</Text>
          </Box>
        </Box>
      )}

      {canGoBack && (
        <Box marginTop={1}>
          <Text dimColor>Press Esc to go back</Text>
        </Box>
      )}
    </Box>
  );
}
