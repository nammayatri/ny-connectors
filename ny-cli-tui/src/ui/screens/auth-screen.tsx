import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { authenticateWithApi, fetchSavedLocations } from '../../auth/flow.js';
import type { SavedLocation } from '../../auth/token-store.js';

interface AuthScreenProps {
  mobile: string;
  code: string;
  country: string;
  onComplete: (token: string, locations: SavedLocation[], firstName?: string) => void;
}

type AuthState = 'authenticating' | 'fetching-locations' | 'success' | 'error';

export function AuthScreen({ mobile, code, country, onComplete }: AuthScreenProps): JSX.Element {
  const [state, setState] = useState<AuthState>('authenticating');
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // Step 1: Authenticate
        setState('authenticating');
        const result = await authenticateWithApi({ mobile, code, country });
        
        if (cancelled) return;
        
        setToken(result.token);
        setFirstName(result.firstName);
        
        // Step 2: Fetch saved locations
        setState('fetching-locations');
        const locations = await fetchSavedLocations(result.token);
        
        if (cancelled) return;
        
        // Step 3: Complete
        setState('success');
        onComplete(result.token, locations as SavedLocation[], result.firstName);
        
      } catch (err) {
        if (cancelled) return;
        setState('error');
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    }

    run();

    return () => { cancelled = true; };
  }, [mobile, code, country, onComplete]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Namma Yatri CLI
        </Text>
      </Box>

      {state === 'authenticating' && (
        <Box>
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
          <Text> Authenticating...</Text>
        </Box>
      )}

      {state === 'fetching-locations' && (
        <Box>
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
          <Text> Fetching saved locations...</Text>
        </Box>
      )}

      {state === 'success' && (
        <Box flexDirection="column">
          <Text color="green">✓ Authenticated successfully</Text>
          {firstName && <Text>  Welcome, {firstName}!</Text>}
          <Text dimColor>  Token saved to ~/.namma-yatri/token.json</Text>
        </Box>
      )}

      {state === 'error' && (
        <Box flexDirection="column">
          <Text color="red">✗ Authentication failed</Text>
          {error && <Text dimColor>  {error}</Text>}
        </Box>
      )}
    </Box>
  );
}