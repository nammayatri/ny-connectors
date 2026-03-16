// ============================================================================
// Authentication Components
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { authenticate, getSavedLocations } from '../utils/api.js';
import { saveAuthData } from '../utils/storage.js';
import { AppState, AppContext, PersonAPIEntity, SavedReqLocationAPIEntity } from '../types/index.js';

interface AuthProps {
  onAuthSuccess: (token: string, person: PersonAPIEntity | undefined, savedLocations: SavedReqLocationAPIEntity[]) => void;
  onCancel: () => void;
}

export const AuthPhone: React.FC<AuthProps> = ({ onAuthSuccess, onCancel }) => {
  const [mobile, setMobile] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      if (step === 'phone') {
        if (mobile.length >= 10) {
          setStep('code');
        }
      } else {
        if (accessCode.length > 0) {
          handleAuth();
        }
      }
    }
  });

  const handleAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await authenticate(mobile, accessCode);

      if (response.token) {
        // Fetch saved locations
        let savedLocations: SavedReqLocationAPIEntity[] = [];
        try {
          const savedResponse = await getSavedLocations(response.token);
          savedLocations = savedResponse.list || [];
        } catch {
          // Ignore saved locations fetch errors
        }

        // Save to storage
        await saveAuthData(response.token, response.person, savedLocations);

        onAuthSuccess(response.token, response.person, savedLocations);
      } else {
        setError('Authentication failed - no token received');
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="green">
            <Spinner type="dots" />
          </Text>
          <Text> Authenticating...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold underline color="cyan">
          Namma Yatri Authentication
        </Text>
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      <Box flexDirection="column">
        <Box>
          <Text color={step === 'phone' ? 'yellow' : 'gray'}>
            {step === 'phone' ? '>' : ' '} Mobile Number:{' '}
          </Text>
          <TextInput
            value={mobile}
            onChange={setMobile}
            placeholder="9876543210"
            focus={step === 'phone'}
            mask={step === 'code' ? '*' : undefined}
          />
        </Box>

        <Box>
          <Text color={step === 'code' ? 'yellow' : 'gray'}>
            {step === 'code' ? '>' : ' '} Access Code:{' '}
          </Text>
          <TextInput
            value={accessCode}
            onChange={setAccessCode}
            placeholder="Find in app > About Us"
            focus={step === 'code'}
            mask="*"
          />
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Press Enter to continue, Esc to cancel</Text>
      </Box>
    </Box>
  );
};
