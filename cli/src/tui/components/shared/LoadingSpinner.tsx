/**
 * LoadingSpinner Component
 * Consistent loading indicator with optional message
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface LoadingSpinnerProps {
  message?: string;
  type?: 'dots' | 'dots2' | 'dots3' | 'dots4' | 'dots5' | 'dots6' | 'dots7' | 'dots8' | 'dots9' | 'dots10' | 'dots11' | 'dots12';
  color?: string;
}

export function LoadingSpinner({
  message = 'Loading...',
  type = 'dots',
  color = 'yellow',
}: LoadingSpinnerProps): React.ReactElement {
  return (
    <Box>
      <Text color={color}>
        <Spinner type={type} />
      </Text>
      <Text> {message}</Text>
    </Box>
  );
}