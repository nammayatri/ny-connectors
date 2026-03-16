/**
 * Footer Component
 * Consistent footer with navigation hints and optional status
 */

import React from 'react';
import { Box, Text } from 'ink';

interface FooterProps {
  hints?: string[];
  error?: string | null;
  success?: string | null;
}

export function Footer({ hints = [], error, success }: FooterProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Error message */}
      {error && (
        <Box marginBottom={1}>
          <Text color="red" bold>✗ {error}</Text>
        </Box>
      )}

      {/* Success message */}
      {success && (
        <Box marginBottom={1}>
          <Text color="green" bold>✓ {success}</Text>
        </Box>
      )}

      {/* Navigation hints */}
      {hints.length > 0 && (
        <Box>
          <Text dimColor>
            {hints.map((hint, index) => (
              index === 0 ? hint : ` | ${hint}`
            ))}
          </Text>
        </Box>
      )}
    </Box>
  );
}