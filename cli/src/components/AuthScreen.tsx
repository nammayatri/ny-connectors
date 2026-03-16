// ============================================================================
// Auth Screen Component
// Phone + OTP authentication
// ============================================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { AuthCredentials } from '../types.js';

interface AuthScreenProps {
  isLoading: boolean;
  error: string | null;
  onLogin: (credentials: AuthCredentials) => void;
  onExit: () => void;
}

export function AuthScreen({ isLoading, error, onLogin, onExit }: AuthScreenProps) {
  const [step, setStep] = useState<'mobile' | 'code'>('mobile');
  const [mobileNumber, setMobileNumber] = useState('');
  const [accessCode, setAccessCode] = useState('');

  const handleMobileSubmit = useCallback(() => {
    if (mobileNumber.trim().length >= 10) {
      setStep('code');
    }
  }, [mobileNumber]);

  const handleCodeSubmit = useCallback(() => {
    if (accessCode.trim().length > 0) {
      onLogin({
        mobileNumber: mobileNumber.trim(),
        accessCode: accessCode.trim(),
        country: 'IN',
      });
    }
  }, [accessCode, mobileNumber, onLogin]);

  useInput((input, key) => {
    if (key.escape) {
      onExit();
      return;
    }

    if (key.return) {
      if (step === 'mobile') {
        handleMobileSubmit();
      } else {
        handleCodeSubmit();
      }
      return;
    }

    if (key.tab && step === 'code') {
      // Allow going back to mobile
      setStep('mobile');
      return;
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🔐 Namma Yatri Login
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          Enter your mobile number and access code to continue.
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          Find your access code in the Namma Yatri app under About Us.
        </Text>
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text color={step === 'mobile' ? 'green' : 'white'}>
            {step === 'mobile' ? '❯ ' : '  '}
          </Text>
          <Text>Mobile Number: </Text>
          {step === 'mobile' && !isLoading ? (
            <TextInput
              value={mobileNumber}
              onChange={setMobileNumber}
              onSubmit={handleMobileSubmit}
              placeholder="9876543210"
              focus={true}
            />
          ) : (
            <Text color={mobileNumber ? 'white' : 'gray'}>
              {mobileNumber || '9876543210'}
            </Text>
          )}
        </Box>

        <Box marginTop={1}>
          <Text color={step === 'code' ? 'green' : 'white'}>
            {step === 'code' ? '❯ ' : '  '}
          </Text>
          <Text>Access Code: </Text>
          {step === 'code' && !isLoading ? (
            <TextInput
              value={accessCode}
              onChange={setAccessCode}
              onSubmit={handleCodeSubmit}
              placeholder="Enter code"
              mask="*"
              focus={true}
            />
          ) : (
            <Text color="gray">{step === 'code' ? '' : '••••••'}</Text>
          )}
        </Box>
      </Box>

      {isLoading && (
        <Box marginTop={2}>
          <Text color="yellow">
            <Spinner type="dots" /> Authenticating...
          </Text>
        </Box>
      )}

      <Box marginTop={2}>
        <Text dimColor>
          Press Enter to continue, Tab to go back, Esc to exit
        </Text>
      </Box>
    </Box>
  );
}

export default AuthScreen;
