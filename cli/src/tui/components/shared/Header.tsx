/**
 * Header Component
 * Consistent header with title and optional status indicator
 */

import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showAuthStatus?: boolean;
  isAuthenticated?: boolean;
  icon?: string;
}

export function Header({
  title,
  subtitle,
  showAuthStatus = false,
  isAuthenticated = false,
  icon,
}: HeaderProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        {icon && <Text>{icon} </Text>}
        <Gradient name="fruit">
          <Text bold>{title}</Text>
        </Gradient>
        {showAuthStatus && (
          <Box marginLeft={2}>
            <Text color={isAuthenticated ? 'green' : 'yellow'}>
              {isAuthenticated ? '✓ Authenticated' : '○ Not authenticated'}
            </Text>
          </Box>
        )}
      </Box>
      {subtitle && (
        <Text dimColor>{subtitle}</Text>
      )}
    </Box>
  );
}