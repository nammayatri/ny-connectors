// ============================================================================
// Authentication Wizard Component
// ============================================================================
// Two-screen wizard: PhoneInputScreen and AccessCodeScreen
// Uses ink-text-input for input fields, shows loading state, handles errors

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { NammaYatriClient, APIError } from '../api/client.js';
import { saveToken, SavedLocation } from '../storage/token.js';
import { PersonAPIEntity } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export type AuthWizardState = 'PHONE' | 'CODE' | 'LOADING' | 'ERROR';

export interface AuthWizardContext {
  phoneNumber: string;
  accessCode: string;
  countryCode: string;
  errorMessage: string | null;
}

export interface AuthWizardProps {
  onAuthSuccess: (
    token: string,
    person: PersonAPIEntity | undefined,
    savedLocations: SavedLocation[]
  ) => void;
  onCancel: () => void;
  initialCountryCode?: string;
}

// ============================================================================
// Phone Input Screen
// ============================================================================

interface PhoneInputScreenProps {
  countryCode: string;
  phoneNumber: string;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const PhoneInputScreen: React.FC<PhoneInputScreenProps> = ({
  countryCode,
  phoneNumber,
  onPhoneChange,
  onSubmit,
  onCancel,
}) => {
  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      onSubmit();
    }
  });

  // Only allow numeric input
  const handleChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    onPhoneChange(numericValue);
  };

  const isValid = phoneNumber.length >= 10;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📱 Enter Mobile Number
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          Please enter your 10-digit mobile number registered with Namma Yatri
        </Text>
      </Box>

      <Box>
        <Text color="yellow">+{countryCode} </Text>
        <TextInput
          value={phoneNumber}
          onChange={handleChange}
          placeholder="9876543210"
          focus={true}
          mask={undefined}
        />
      </Box>

      <Box marginTop={1}>
        {isValid ? (
          <Text color="green">✓ Valid mobile number</Text>
        ) : (
          <Text dimColor>Enter 10 digits ({phoneNumber.length}/10)</Text>
        )}
      </Box>

      <Box marginTop={2}>
        <Text dimColor>Press Enter to continue, Esc to cancel</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Access Code Screen
// ============================================================================

interface AccessCodeScreenProps {
  phoneNumber: string;
  countryCode: string;
  accessCode: string;
  onAccessCodeChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}

const AccessCodeScreen: React.FC<AccessCodeScreenProps> = ({
  phoneNumber,
  countryCode,
  accessCode,
  onAccessCodeChange,
  onSubmit,
  onBack,
}) => {
  useInput((_input, key) => {
    if (key.escape) {
      onBack();
      return;
    }

    if (key.return) {
      onSubmit();
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🔐 Enter Access Code
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>Mobile: </Text>
        <Text color="green">+{countryCode} {phoneNumber}</Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          Find your access code in the Namma Yatri app under About Us section
        </Text>
      </Box>

      <Box>
        <Text color="yellow">Access Code: </Text>
        <TextInput
          value={accessCode}
          onChange={onAccessCodeChange}
          placeholder="Enter code from app"
          focus={true}
          mask="*"
        />
      </Box>

      <Box marginTop={1}>
        {accessCode.length > 0 ? (
          <Text color="green">✓ Code entered</Text>
        ) : (
          <Text dimColor>Enter the access code from your app</Text>
        )}
      </Box>

      <Box marginTop={2}>
        <Text dimColor>Press Enter to authenticate, Esc to go back</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Loading Screen
// ============================================================================

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Authenticating...' }) => {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ⏳ Please Wait
        </Text>
      </Box>

      <Box>
        <Text color="green">
          <Spinner type="dots" />
        </Text>
        <Text> {message}</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Error Screen
// ============================================================================

interface ErrorScreenProps {
  errorMessage: string;
  onRetry: () => void;
  onBack: () => void;
  onCancel: () => void;
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({
  errorMessage,
  onRetry,
  onBack,
  onCancel,
}) => {
  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (input === 'r' || input === 'R') {
      onRetry();
      return;
    }

    if (input === 'b' || input === 'B') {
      onBack();
      return;
    }
  });

  const isAuthError = errorMessage.toLowerCase().includes('auth') ||
    errorMessage.toLowerCase().includes('token') ||
    errorMessage.toLowerCase().includes('invalid');

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="red">
          ❌ Authentication Failed
        </Text>
      </Box>

      <Box marginBottom={1} paddingX={1} borderStyle="single" borderColor="red">
        <Text color="red">{errorMessage}</Text>
      </Box>

      {isAuthError && (
        <Box marginBottom={1}>
          <Text dimColor>
            Make sure you entered the correct access code from the Namma Yatri app.
          </Text>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text>
          <Text color="yellow">[R]</Text>
          <Text> Retry authentication</Text>
        </Text>
        <Text>
          <Text color="yellow">[B]</Text>
          <Text> Go back to phone number</Text>
        </Text>
        <Text>
          <Text color="yellow">[Esc]</Text>
          <Text> Cancel and exit</Text>
        </Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Main AuthWizard Component
// ============================================================================

export const AuthWizard: React.FC<AuthWizardProps> = ({
  onAuthSuccess,
  onCancel,
  initialCountryCode = '91',
}) => {
  const [state, setState] = useState<AuthWizardState>('PHONE');
  const [context, setContext] = useState<AuthWizardContext>({
    phoneNumber: '',
    accessCode: '',
    countryCode: initialCountryCode,
    errorMessage: null,
  });

  // Update context helper
  const updateContext = useCallback((updates: Partial<AuthWizardContext>) => {
    setContext((prev) => ({ ...prev, ...updates }));
  }, []);

  // Transition to a new state
  const transition = useCallback((newState: AuthWizardState) => {
    setState(newState);
  }, []);

  // Handle phone submission
  const handlePhoneSubmit = useCallback(() => {
    if (context.phoneNumber.length >= 10) {
      transition('CODE');
    }
  }, [context.phoneNumber, transition]);

  // Handle authentication
  const handleAuthenticate = useCallback(async () => {
    if (context.accessCode.length === 0) {
      updateContext({ errorMessage: 'Please enter an access code' });
      transition('ERROR');
      return;
    }

    transition('LOADING');

    try {
      const fullPhoneNumber = `${context.countryCode}${context.phoneNumber}`;
      const response = await NammaYatriClient.authenticate(
        fullPhoneNumber,
        context.accessCode
      );

      if (response.token) {
        // Fetch saved locations
        let savedLocations: SavedLocation[] = [];
        try {
          const client = new NammaYatriClient(response.token);
          savedLocations = await client.getSavedLocations();
        } catch {
          // Ignore saved locations fetch errors - not critical
        }

        // Save token to storage
        saveToken(response.token, savedLocations);

        // Notify parent of success
        onAuthSuccess(response.token, response.person, savedLocations);
      } else {
        updateContext({ errorMessage: 'Authentication failed - no token received from server' });
        transition('ERROR');
      }
    } catch (error) {
      let errorMessage = 'Authentication failed';

      if (error instanceof APIError) {
        errorMessage = error.message;
        if (error.isAuthError) {
          errorMessage = 'Invalid access code. Please check the code in your Namma Yatri app (About Us section).';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      updateContext({ errorMessage });
      transition('ERROR');
    }
  }, [context, updateContext, transition, onAuthSuccess]);

  // Handle retry from error state
  const handleRetry = useCallback(() => {
    updateContext({ errorMessage: null });
    transition('CODE');
  }, [updateContext, transition]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    updateContext({ errorMessage: null, accessCode: '' });
    transition('PHONE');
  }, [updateContext, transition]);

  // Render current screen based on state
  const renderScreen = (): JSX.Element => {
    switch (state) {
      case 'PHONE':
        return (
          <PhoneInputScreen
            countryCode={context.countryCode}
            phoneNumber={context.phoneNumber}
            onPhoneChange={(value) => updateContext({ phoneNumber: value })}
            onSubmit={handlePhoneSubmit}
            onCancel={onCancel}
          />
        );

      case 'CODE':
        return (
          <AccessCodeScreen
            phoneNumber={context.phoneNumber}
            countryCode={context.countryCode}
            accessCode={context.accessCode}
            onAccessCodeChange={(value) => updateContext({ accessCode: value })}
            onSubmit={handleAuthenticate}
            onBack={() => transition('PHONE')}
          />
        );

      case 'LOADING':
        return <LoadingScreen message="Authenticating with Namma Yatri..." />;

      case 'ERROR':
        return (
          <ErrorScreen
            errorMessage={context.errorMessage || 'Unknown error occurred'}
            onRetry={handleRetry}
            onBack={handleBack}
            onCancel={onCancel}
          />
        );

      default:
        return (
          <Box>
            <Text color="red">Unknown state: {state}</Text>
          </Box>
        );
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold underline color="cyan">
          Namma Yatri Authentication
        </Text>
      </Box>

      {renderScreen()}
    </Box>
  );
};

export default AuthWizard;
