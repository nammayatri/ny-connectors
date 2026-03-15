import React, { useCallback, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { AuthFlow } from '../components/AuthFlow.js';

interface AuthScreenProps {
  onSuccess: () => void;
  onError: (error: string) => void;
}

/**
 * AuthScreen - Screen wrapper for the AuthFlow component
 * 
 * This screen wraps the AuthFlow component and handles:
 * - Success callback propagation
 * - Error display
 * - Navigation hints
 */
export function AuthScreen({ onSuccess, onError }: AuthScreenProps) {
  const [lastError, setLastError] = useState<string | null>(null);

  const handleSuccess = useCallback(() => {
    setLastError(null);
    onSuccess();
  }, [onSuccess]);

  const handleError = useCallback((error: string) => {
    setLastError(error);
    onError(error);
  }, [onError]);

  // Global keyboard handler for the screen
  useInput((input, key) => {
    // Ctrl+C is handled by ink automatically
    if (key.escape) {
      // Could navigate back if we had a parent screen
    }
  });

  return (
    <Box flexDirection="column">
      <AuthFlow
        onSuccess={handleSuccess}
        onError={handleError}
        showHeader={true}
        headerTitle="Authentication Required"
      />
      
      {lastError && (
        <Box marginTop={1} borderStyle="round" borderColor="red" paddingX={1}>
          <Text dimColor>
            Tip: Make sure you have the latest access code from the Namma Yatri app.
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default AuthScreen;