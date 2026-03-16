import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { AuthScreenProps } from '../types/index.js';
import { useAuth } from '../hooks/useAuth.js';

export function AuthScreen({ onAuthSuccess }: AuthScreenProps): JSX.Element {
  const [step, setStep] = useState<'country' | 'mobile' | 'accessCode'>('country');
  const [country, setCountry] = useState('IN');
  const [mobileNumber, setMobileNumber] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const { isLoading, error, login, clearError } = useAuth();

  const handleSubmit = useCallback(async () => {
    if (step === 'country') {
      setStep('mobile');
    } else if (step === 'mobile') {
      if (mobileNumber.trim()) {
        setStep('accessCode');
      }
    } else if (step === 'accessCode') {
      if (accessCode.trim()) {
        const result = await login({
          country,
          mobileNumber,
          accessCode,
        });
        if (result) {
          onAuthSuccess(result.token, result.user, result.savedLocations);
        }
      }
    }
  }, [step, country, mobileNumber, accessCode, login, onAuthSuccess]);

  useInput((input, key) => {
    if (key.escape) {
      if (step === 'accessCode') {
        setStep('mobile');
        clearError();
      } else if (step === 'mobile') {
        setStep('country');
        clearError();
      }
    } else if (key.return) {
      handleSubmit();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="green">
        🚗 Namma Yatri TUI
      </Text>
      <Text dimColor>
        Book rides from your terminal
      </Text>

      <Box marginTop={1} flexDirection="column" gap={1}>
        <Text bold>Authentication</Text>

        {step === 'country' && (
          <Box flexDirection="column" gap={1}>
            <Text>Enter your country code:</Text>
            <TextInput
              value={country}
              onChange={setCountry}
              onSubmit={handleSubmit}
              placeholder="e.g., IN"
            />
            <Text dimColor>Press Enter to continue, Esc to go back</Text>
          </Box>
        )}

        {step === 'mobile' && (
          <Box flexDirection="column" gap={1}>
            <Text>Enter your mobile number:</Text>
            <TextInput
              value={mobileNumber}
              onChange={setMobileNumber}
              onSubmit={handleSubmit}
              placeholder="e.g., 9876543210"
            />
            <Text dimColor>Press Enter to continue, Esc to go back</Text>
          </Box>
        )}

        {step === 'accessCode' && (
          <Box flexDirection="column" gap={1}>
            <Text>Enter your access code:</Text>
            <TextInput
              value={accessCode}
              onChange={setAccessCode}
              onSubmit={handleSubmit}
              placeholder="Found in Namma Yatri app > About Us"
              mask="*"
            />
            <Text dimColor>Press Enter to login, Esc to go back</Text>
          </Box>
        )}

        {isLoading && (
          <Text color="yellow">Authenticating...</Text>
        )}

        {error && (
          <Text color="red">Error: {error}</Text>
        )}
      </Box>
    </Box>
  );
}
