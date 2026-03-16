/**
 * Authentication Screen
 * Handles phone + access code authentication with validation and retry logic
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { LoadingSpinner } from './shared/LoadingSpinner.js';
import { apiClient } from '../../api/index.js';
import type { Person } from '../../api/types.js';

// Auth step states
type AuthStep = 'phone' | 'code' | 'authenticating' | 'success' | 'error';

// Validation constants
const PHONE_MIN_LENGTH = 10;
const PHONE_MAX_LENGTH = 10;
const CODE_MIN_LENGTH = 4;
const MAX_RETRY_ATTEMPTS = 3;

// Phone number validation (Indian mobile)
function validatePhoneNumber(phone: string): { valid: boolean; error?: string } {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length < PHONE_MIN_LENGTH) {
    return { valid: false, error: `Phone number must be ${PHONE_MIN_LENGTH} digits` };
  }
  
  if (cleaned.length > PHONE_MAX_LENGTH) {
    return { valid: false, error: `Phone number must be ${PHONE_MAX_LENGTH} digits` };
  }
  
  // Indian mobile numbers start with 6, 7, 8, or 9
  const firstDigit = cleaned[0];
  if (!['6', '7', '8', '9'].includes(firstDigit)) {
    return { valid: false, error: 'Invalid mobile number (must start with 6, 7, 8, or 9)' };
  }
  
  return { valid: true };
}

// Access code validation
function validateAccessCode(code: string): { valid: boolean; error?: string } {
  if (!code || code.length < CODE_MIN_LENGTH) {
    return { valid: false, error: `Access code must be at least ${CODE_MIN_LENGTH} characters` };
  }
  
  return { valid: true };
}

interface AuthScreenProps {
  onAuthSuccess: (person?: Person) => void;
  onBack: () => void;
  initialPhone?: string;
}

interface AuthState {
  step: AuthStep;
  phone: string;
  accessCode: string;
  phoneError: string | null;
  codeError: string | null;
  authError: string | null;
  retryCount: number;
  person: Person | null;
}

const initialState: AuthState = {
  step: 'phone',
  phone: '',
  accessCode: '',
  phoneError: null,
  codeError: null,
  authError: null,
  retryCount: 0,
  person: null,
};

export function AuthScreen({ 
  onAuthSuccess, 
  onBack,
  initialPhone = '',
}: AuthScreenProps): React.ReactElement {
  const [state, setState] = useState<AuthState>({
    ...initialState,
    phone: initialPhone,
  });

  // Keyboard handling
  useInput((input, key) => {
    // Escape - go back or reset to phone step
    if (key.escape) {
      if (state.step === 'code') {
        setState(prev => ({
          ...prev,
          step: 'phone',
          codeError: null,
          authError: null,
        }));
      } else if (state.step === 'error') {
        setState(prev => ({
          ...prev,
          step: prev.retryCount >= MAX_RETRY_ATTEMPTS ? 'phone' : 'code',
          authError: null,
        }));
      } else if (state.step === 'phone') {
        onBack();
      }
    }
    
    // Enter on success - continue
    if (key.return && state.step === 'success') {
      onAuthSuccess(state.person || undefined);
    }
  });

  // Handle phone input change
  const handlePhoneChange = useCallback((value: string) => {
    // Only allow digits
    const cleaned = value.replace(/\D/g, '').slice(0, PHONE_MAX_LENGTH);
    setState(prev => ({
      ...prev,
      phone: cleaned,
      phoneError: null,
    }));
  }, []);

  // Handle phone submit
  const handlePhoneSubmit = useCallback(() => {
    const validation = validatePhoneNumber(state.phone);
    
    if (!validation.valid) {
      setState(prev => ({
        ...prev,
        phoneError: validation.error || 'Invalid phone number',
      }));
      return;
    }
    
    setState(prev => ({
      ...prev,
      step: 'code',
      phoneError: null,
    }));
  }, [state.phone]);

  // Handle access code change
  const handleCodeChange = useCallback((value: string) => {
    setState(prev => ({
      ...prev,
      accessCode: value,
      codeError: null,
      authError: null,
    }));
  }, []);

  // Handle access code submit
  const handleCodeSubmit = useCallback(async () => {
    const validation = validateAccessCode(state.accessCode);
    
    if (!validation.valid) {
      setState(prev => ({
        ...prev,
        codeError: validation.error || 'Invalid access code',
      }));
      return;
    }
    
    setState(prev => ({
      ...prev,
      step: 'authenticating',
      codeError: null,
      authError: null,
    }));
    
    try {
      const response = await apiClient.authenticate(state.phone, state.accessCode);
      
      if (response.token) {
        setState(prev => ({
          ...prev,
          step: 'success',
          person: response.person || null,
        }));
      } else {
        throw new Error('No token received from server');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      
      const isAuthError = (error as any)?.isAuthError === true || 
                          (error as any)?.statusCode === 401;
      
      setState(prev => ({
        ...prev,
        step: 'error',
        authError: isAuthError 
          ? 'Invalid access code. Please check and try again.'
          : errorMessage,
        retryCount: prev.retryCount + 1,
      }));
    }
  }, [state.phone, state.accessCode]);

  // Retry authentication
  const handleRetry = useCallback(() => {
    if (state.retryCount >= MAX_RETRY_ATTEMPTS) {
      // Reset to phone entry after max retries
      setState(prev => ({
        ...initialState,
        phone: prev.phone,
        retryCount: prev.retryCount + 1,
      }));
    } else {
      setState(prev => ({
        ...prev,
        step: 'code',
        authError: null,
      }));
    }
  }, [state.retryCount]);

  // Auto-proceed on success after a short delay
  useEffect(() => {
    if (state.step === 'success') {
      const timer = setTimeout(() => {
        onAuthSuccess(state.person || undefined);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state.step, state.person, onAuthSuccess]);

  // Render phone input step
  const renderPhoneStep = () => (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text dimColor>
          Enter your mobile number (without country code)
        </Text>
      </Box>
      
      <Box>
        <Text color="green" bold>+91 </Text>
        <TextInput
          value={state.phone}
          onChange={handlePhoneChange}
          onSubmit={handlePhoneSubmit}
          placeholder="9876543210"
          focus={state.step === 'phone'}
        />
      </Box>
      
      <Box marginTop={1}>
        <Text dimColor>
          {state.phone.length}/{PHONE_MAX_LENGTH} digits
        </Text>
      </Box>
      
      {state.phoneError && (
        <Box marginTop={1}>
          <Text color="red">✗ {state.phoneError}</Text>
        </Box>
      )}
      
      <Box marginTop={1}>
        <Text dimColor>Press Enter to continue</Text>
      </Box>
    </Box>
  );

  // Render access code step
  const renderCodeStep = () => (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text dimColor>
          Enter your access code
        </Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text dimColor color="cyan">
          Find it in: Namma Yatri app → About Us
        </Text>
      </Box>
      
      <Box>
        <Text color="green" bold>Access Code: </Text>
        <TextInput
          value={state.accessCode}
          onChange={handleCodeChange}
          onSubmit={handleCodeSubmit}
          placeholder="your-secret-code"
          mask="*"
          focus={state.step === 'code'}
        />
      </Box>
      
      <Box marginTop={1}>
        <Text dimColor>Mobile: +91 {state.phone}</Text>
      </Box>
      
      {state.codeError && (
        <Box marginTop={1}>
          <Text color="red">✗ {state.codeError}</Text>
        </Box>
      )}
      
      <Box marginTop={1}>
        <Text dimColor>Press Enter to authenticate | Esc to change number</Text>
      </Box>
    </Box>
  );

  // Render authenticating step
  const renderAuthenticatingStep = () => (
    <Box flexDirection="column">
      <LoadingSpinner message="Authenticating..." />
      <Box marginTop={1}>
        <Text dimColor>Verifying your credentials...</Text>
      </Box>
    </Box>
  );

  // Render success step
  const renderSuccessStep = () => (
    <Box flexDirection="column">
      <Box>
        <Text color="green" bold>✓ Authentication successful!</Text>
      </Box>
      
      {state.person && (
        <Box marginTop={1} flexDirection="column">
          {state.person.firstName && (
            <Text dimColor>Welcome, {state.person.firstName}!</Text>
          )}
          {state.person.maskedMobileNumber && (
            <Text dimColor>Mobile: {state.person.maskedMobileNumber}</Text>
          )}
        </Box>
      )}
      
      <Box marginTop={1}>
        <Text dimColor>Continuing...</Text>
      </Box>
    </Box>
  );

  // Render error step
  const renderErrorStep = () => (
    <Box flexDirection="column">
      <Box>
        <Text color="red" bold>✗ Authentication failed</Text>
      </Box>
      
      <Box marginTop={1}>
        <Text color="red">{state.authError}</Text>
      </Box>
      
      <Box marginTop={1}>
        <Text dimColor>
          Attempt {state.retryCount} of {MAX_RETRY_ATTEMPTS}
        </Text>
      </Box>
      
      {state.retryCount >= MAX_RETRY_ATTEMPTS ? (
        <Box marginTop={1}>
          <Text dimColor>
            Maximum attempts reached. Press Enter to start over.
          </Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text dimColor>
            Press Enter to retry | Esc to change number
          </Text>
        </Box>
      )}
    </Box>
  );

  // Render current step
  const renderCurrentStep = () => {
    switch (state.step) {
      case 'phone':
        return renderPhoneStep();
      case 'code':
        return renderCodeStep();
      case 'authenticating':
        return renderAuthenticatingStep();
      case 'success':
        return renderSuccessStep();
      case 'error':
        return renderErrorStep();
      default:
        return renderPhoneStep();
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🔐 Authentication
        </Text>
      </Box>
      
      {/* Progress indicator */}
      <Box marginBottom={1}>
        <Text dimColor>
          Step {state.step === 'phone' ? '1' : '2'} of 2
        </Text>
      </Box>
      
      {/* Current step content */}
      {renderCurrentStep()}
      
      {/* Footer */}
      <Box marginTop={2}>
        <Text dimColor>[Esc] {state.step === 'phone' ? 'Back to main menu' : 'Go back'}</Text>
      </Box>
    </Box>
  );
}

// Export a simpler wrapper for use in wizard
interface AuthStepProps {
  onComplete: () => void;
  onBack: () => void;
}

export function AuthStep({ onComplete, onBack }: AuthStepProps): React.ReactElement {
  const handleAuthSuccess = useCallback((person?: Person) => {
    // Token is already stored by apiClient.authenticate
    onComplete();
  }, [onComplete]);

  return (
    <AuthScreen
      onAuthSuccess={handleAuthSuccess}
      onBack={onBack}
    />
  );
}

export default AuthScreen;