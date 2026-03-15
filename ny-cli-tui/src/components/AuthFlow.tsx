import React, { useState, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { useApi } from '../hooks/useApi.js';
import type { AuthStep, SavedLocation } from '../types/index.js';

/**
 * Props for the AuthFlow component
 */
export interface AuthFlowProps {
  /** Callback when authentication succeeds */
  onSuccess: (token: string) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
  /** Optional initial mobile number (for re-entry after error) */
  initialMobile?: string;
  /** Optional initial country code */
  initialCountry?: string;
  /** Whether to show the header */
  showHeader?: boolean;
  /** Custom header title */
  headerTitle?: string;
}

/**
 * Authentication state
 */
interface AuthState {
  step: AuthStep;
  mobile: string;
  country: string;
  accessCode: string;
  error: string | null;
}

/**
 * Country code option
 */
interface CountryOption {
  code: string;
  dialCode: string;
  name: string;
}

const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'IN', dialCode: '91', name: 'India' },
  { code: 'US', dialCode: '1', name: 'United States' },
  { code: 'UK', dialCode: '44', name: 'United Kingdom' },
  { code: 'AE', dialCode: '971', name: 'UAE' },
  { code: 'SG', dialCode: '65', name: 'Singapore' },
];

/**
 * AuthFlow - A self-contained authentication component for Namma Yatri CLI
 * 
 * Features:
 * - Phone number input with country code selection
 * - Access code input (from Namma Yatri app)
 * - Loading spinners during authentication
 * - Error display with retry capability
 * - Token persistence via useApi hook
 * 
 * @example
 * ```tsx
 * <AuthFlow 
 *   onSuccess={(token) => console.log('Authenticated!', token)}
 *   onError={(err) => console.error('Auth failed:', err)}
 * />
 * ```
 */
export function AuthFlow({
  onSuccess,
  onError,
  initialMobile = '',
  initialCountry = 'IN',
  showHeader = true,
  headerTitle = 'Authentication Required',
}: AuthFlowProps) {
  const { exit } = useApp();
  const { authenticate, isLoading: isApiLoading } = useApi();
  
  const [state, setState] = useState<AuthState>({
    step: 'mobile',
    mobile: initialMobile,
    country: initialCountry,
    accessCode: '',
    error: null,
  });

  const [selectedCountryIndex, setSelectedCountryIndex] = useState(
    COUNTRY_OPTIONS.findIndex(c => c.code === initialCountry) >= 0
      ? COUNTRY_OPTIONS.findIndex(c => c.code === initialCountry)
      : 0
  );
  const [showCountrySelector, setShowCountrySelector] = useState(false);

  // Get the selected country
  const selectedCountry = COUNTRY_OPTIONS[selectedCountryIndex];

  /**
   * Validate mobile number format
   */
  const validateMobile = useCallback((mobile: string, country: string): boolean => {
    const cleanMobile = mobile.replace(/\D/g, '');
    switch (country) {
      case 'IN':
        return cleanMobile.length === 10 && /^[6-9]/.test(cleanMobile);
      case 'US':
        return cleanMobile.length === 10;
      default:
        return cleanMobile.length >= 8 && cleanMobile.length <= 15;
    }
  }, []);

  /**
   * Format mobile number for display
   */
  const formatMobile = useCallback((mobile: string, country: string): string => {
    const cleanMobile = mobile.replace(/\D/g, '');
    switch (country) {
      case 'IN':
        if (cleanMobile.length <= 5) return cleanMobile;
        return `${cleanMobile.slice(0, 5)} ${cleanMobile.slice(5, 10)}`;
      case 'US':
        if (cleanMobile.length <= 3) return cleanMobile;
        if (cleanMobile.length <= 6) return `(${cleanMobile.slice(0, 3)}) ${cleanMobile.slice(3)}`;
        return `(${cleanMobile.slice(0, 3)}) ${cleanMobile.slice(3, 6)}-${cleanMobile.slice(6, 10)}`;
      default:
        return cleanMobile;
    }
  }, []);

  /**
   * Handle mobile number submission
   */
  const handleMobileSubmit = useCallback(() => {
    const cleanMobile = state.mobile.replace(/\D/g, '');
    
    if (!validateMobile(cleanMobile, state.country)) {
      setState(prev => ({
        ...prev,
        error: `Please enter a valid ${selectedCountry.name} mobile number`,
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      mobile: cleanMobile,
      step: 'code',
      error: null,
    }));
  }, [state.mobile, state.country, validateMobile, selectedCountry.name]);

  /**
   * Handle access code submission
   */
  const handleCodeSubmit = useCallback(async () => {
    if (!state.accessCode.trim()) {
      setState(prev => ({
        ...prev,
        error: 'Please enter your access code',
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      step: 'authenticating',
      error: null,
    }));

    try {
      // Use the useApi hook for authentication
      const result = await authenticate({
        country: state.country,
        mobileNumber: state.mobile,
        accessCode: state.accessCode.trim(),
      });

      if (result.authenticated && result.token) {
        setState(prev => ({
          ...prev,
          error: null,
        }));
        onSuccess(result.token);
      } else {
        throw new Error('Authentication failed - no token received');
      }
    } catch (error: any) {
      let errorMsg = 'Authentication failed';
      
      if (error.message?.includes('timeout') || error.code === 'ECONNABORTED') {
        errorMsg = 'Request timed out. Please try again.';
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorMsg = 'Network error. Please check your internet connection.';
      } else if (error.statusCode === 401) {
        errorMsg = 'Invalid access code. Please check and try again.';
      } else if (error.statusCode === 404) {
        errorMsg = 'Mobile number not found. Please verify your number.';
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setState(prev => ({
        ...prev,
        step: 'code',
        error: errorMsg,
      }));
      
      onError?.(errorMsg);
    }
  }, [state.accessCode, state.mobile, state.country, authenticate, onSuccess, onError]);

  /**
   * Handle country selection
   */
  const handleCountrySelect = useCallback((index: number) => {
    if (index >= 0 && index < COUNTRY_OPTIONS.length) {
      setSelectedCountryIndex(index);
      setState(prev => ({
        ...prev,
        country: COUNTRY_OPTIONS[index].code,
        mobile: '', // Clear mobile when changing country
      }));
      setShowCountrySelector(false);
    }
  }, []);

  /**
   * Handle back navigation
   */
  const handleBack = useCallback(() => {
    if (state.step === 'code') {
      setState(prev => ({
        ...prev,
        step: 'mobile',
        error: null,
      }));
    }
  }, [state.step]);

  /**
   * Clear error when user starts typing
   */
  const handleMobileChange = useCallback((value: string) => {
    setState(prev => ({
      ...prev,
      mobile: value,
      error: null,
    }));
  }, []);

  const handleCodeChange = useCallback((value: string) => {
    setState(prev => ({
      ...prev,
      accessCode: value,
      error: null,
    }));
  }, []);

  // Keyboard input handler
  useInput((input, key) => {
    if (state.step === 'authenticating') return; // Don't handle input while authenticating
    
    if (state.step === 'mobile') {
      if (input === 'c' || input === 'C') {
        setShowCountrySelector(prev => !prev);
      }
      // Number keys for country selection
      const num = parseInt(input, 10);
      if (num >= 1 && num <= COUNTRY_OPTIONS.length && showCountrySelector) {
        handleCountrySelect(num - 1);
      }
    } else if (state.step === 'code') {
      if (input === 'b' || input === 'B') {
        handleBack();
      }
    }
  }, { isActive: !isApiLoading });

  // Render header
  const renderHeader = () => {
    if (!showHeader) return null;
    
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">
          🔐 {headerTitle}
        </Text>
        <Box marginTop={1}>
          <Text dimColor>
            Find your access code in the Namma Yatri app under About Us section.
          </Text>
        </Box>
      </Box>
    );
  };

  // Render error message
  const renderError = () => {
    if (!state.error) return null;
    
    return (
      <Box 
        flexDirection="column" 
        borderStyle="round" 
        borderColor="red" 
        paddingX={1}
        marginY={1}
      >
        <Text color="red" bold>
          ⚠ Error
        </Text>
        <Text color="red">
          {state.error}
        </Text>
      </Box>
    );
  };

  // Render country selector
  const renderCountrySelector = () => {
    if (!showCountrySelector) return null;
    
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text bold>Select Country:</Text>
        {COUNTRY_OPTIONS.map((country, index) => (
          <Box key={country.code} marginLeft={2}>
            <Text
              color={index === selectedCountryIndex ? 'green' : 'white'}
              bold={index === selectedCountryIndex}
            >
              {index === selectedCountryIndex ? '→ ' : '  '}
              +{country.dialCode} {country.name}
            </Text>
          </Box>
        ))}
        <Box marginTop={1}>
          <Text dimColor>
            Press number (1-{COUNTRY_OPTIONS.length}) to select
          </Text>
        </Box>
      </Box>
    );
  };

  // Render mobile input step
  const renderMobileStep = () => {
    return (
      <Box flexDirection="column">
        {renderHeader()}
        
        <Box marginBottom={1}>
          <Text>Country: </Text>
          <Text color="cyan" bold>
            +{selectedCountry.dialCode} {selectedCountry.name}
          </Text>
          <Text dimColor> (press 'c' to change)</Text>
        </Box>
        
        {showCountrySelector && renderCountrySelector()}
        
        <Box marginBottom={1}>
          <Text>Mobile Number: </Text>
          <Box marginLeft={1}>
            <Text dimColor>+{selectedCountry.dialCode} </Text>
            <TextInput
              value={state.mobile}
              onChange={handleMobileChange}
              onSubmit={handleMobileSubmit}
              placeholder={selectedCountry.code === 'IN' ? '9876543210' : 'Enter mobile'}
              showCursor={true}
            />
          </Box>
        </Box>
        
        {state.mobile && (
          <Box marginBottom={1}>
            <Text dimColor>
              Formatted: +{selectedCountry.dialCode} {formatMobile(state.mobile, state.country)}
            </Text>
          </Box>
        )}
        
        {renderError()}
        
        <Box marginTop={1}>
          <Text dimColor>Press Enter to continue | Ctrl+C to cancel</Text>
        </Box>
      </Box>
    );
  };

  // Render access code input step
  const renderCodeStep = () => {
    return (
      <Box flexDirection="column">
        {renderHeader()}
        
        <Box marginBottom={1}>
          <Text>Mobile: </Text>
          <Text color="green" bold>
            +{selectedCountry.dialCode} {formatMobile(state.mobile, state.country)}
          </Text>
          <Text dimColor> (press 'b' to change)</Text>
        </Box>
        
        <Box marginBottom={1}>
          <Text>Access Code: </Text>
          <Box marginLeft={1}>
            <TextInput
              value={state.accessCode}
              onChange={handleCodeChange}
              onSubmit={handleCodeSubmit}
              placeholder="Enter your access code"
              showCursor={true}
              mask="*"
            />
          </Box>
        </Box>
        
        {renderError()}
        
        <Box marginTop={1}>
          <Text dimColor>Press Enter to authenticate | 'b' to go back | Ctrl+C to cancel</Text>
        </Box>
      </Box>
    );
  };

  // Render authenticating step
  const renderAuthenticatingStep = () => {
    return (
      <Box flexDirection="column">
        {renderHeader()}
        
        <Box marginBottom={1}>
          <Text>Mobile: </Text>
          <Text color="green" bold>
            +{selectedCountry.dialCode} {formatMobile(state.mobile, state.country)}
          </Text>
        </Box>
        
        <Box marginBottom={1}>
          <Text>Access Code: </Text>
          <Text color="green">••••••••</Text>
        </Box>
        
        <Box marginTop={1}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text> Authenticating with Namma Yatri...</Text>
        </Box>
        
        <Box marginTop={1}>
          <Text dimColor>Please wait...</Text>
        </Box>
      </Box>
    );
  };

  // Main render based on step
  switch (state.step) {
    case 'mobile':
      return renderMobileStep();
    case 'code':
      return renderCodeStep();
    case 'authenticating':
      return renderAuthenticatingStep();
    default:
      return renderMobileStep();
  }
}

export default AuthFlow;