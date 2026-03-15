import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, componentStyles, icons } from '../../theme.js';

export interface OtpInputProps {
  /**
   * Length of OTP (default: 4)
   */
  length?: number;

  /**
   * Callback when OTP is complete and submitted
   */
  onSubmit: (otp: string) => void | Promise<void>;

  /**
   * Callback when resend is requested
   */
  onResend?: () => void | Promise<void>;

  /**
   * Countdown duration in seconds for resend (default: 30)
   */
  resendCooldown?: number;

  /**
   * Error message to display
   */
  error?: string | null;

  /**
   * Whether the input is in loading state
   */
  isLoading?: boolean;

  /**
   * Whether retry is allowed after error
   */
  allowRetry?: boolean;

  /**
   * Label text above the input
   */
  label?: string;

  /**
   * Auto-submit when all digits are entered
   */
  autoSubmit?: boolean;
}

type InputState = 'inputting' | 'loading' | 'success' | 'error';

export function OtpInput({
  length = 4,
  onSubmit,
  onResend,
  resendCooldown = 30,
  error,
  isLoading = false,
  allowRetry = true,
  label = 'Enter OTP',
  autoSubmit = true,
}: OtpInputProps): JSX.Element {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const [countdown, setCountdown] = useState(0);
  const [state, setState] = useState<InputState>('inputting');
  const [localError, setLocalError] = useState<string | null>(null);
  const submitAttempted = useRef(false);

  // Focus index - which digit box is active
  const focusIndex = digits.findIndex((d, i) => {
    // Find first empty slot, or last slot if all filled
    if (i === digits.length - 1 && digits.every(d => d)) return true;
    return !d;
  });

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  // Update state based on props
  useEffect(() => {
    if (isLoading) {
      setState('loading');
    } else if (error) {
      setState('error');
      setLocalError(error);
    } else if (state === 'loading' && !isLoading) {
      setState('success');
    }
  }, [isLoading, error, state]);

  // Handle OTP submission
  const handleSubmit = useCallback(async (otp: string) => {
    if (submitAttempted.current) return;
    submitAttempted.current = true;

    try {
      setState('loading');
      await onSubmit(otp);
      setState('success');
    } catch (err) {
      setState('error');
      setLocalError(err instanceof Error ? err.message : 'Verification failed');
      // Reset digits on error
      setDigits(Array(length).fill(''));
      submitAttempted.current = false;
    }
  }, [onSubmit, length]);

  // Handle resend
  const handleResend = useCallback(async () => {
    if (countdown > 0 || !onResend) return;

    try {
      await onResend();
      setCountdown(resendCooldown);
      setDigits(Array(length).fill(''));
      setState('inputting');
      setLocalError(null);
      submitAttempted.current = false;
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to resend');
    }
  }, [countdown, onResend, resendCooldown, length]);

  // Handle retry after error
  const handleRetry = useCallback(() => {
    setDigits(Array(length).fill(''));
    setState('inputting');
    setLocalError(null);
    submitAttempted.current = false;
  }, [length]);

  // Keyboard input handling
  useInput((input, key) => {
    // Don't process input if loading or success
    if (state === 'loading' || state === 'success') return;

    // Handle backspace
    if (key.backspace || key.delete) {
      setDigits(prev => {
        const newDigits = [...prev];
        // Find the last non-empty digit and clear it
        for (let i = newDigits.length - 1; i >= 0; i--) {
          if (newDigits[i]) {
            newDigits[i] = '';
            break;
          }
        }
        return newDigits;
      });
      return;
    }

    // Handle number input
    if (/^\d$/.test(input)) {
      setDigits(prev => {
        const newDigits = [...prev];
        // Find first empty slot
        const emptyIndex = newDigits.findIndex(d => !d);
        if (emptyIndex !== -1) {
          newDigits[emptyIndex] = input;
        }
        return newDigits;
      });
    }

    // Handle enter key for retry
    if (key.return && state === 'error' && allowRetry) {
      handleRetry();
    }

    // Handle 'r' key for resend
    if (input.toLowerCase() === 'r' && countdown === 0 && onResend && state !== 'loading') {
      handleResend();
    }
  });

  // Auto-submit when all digits are entered
  useEffect(() => {
    if (!autoSubmit) return;

    const otp = digits.join('');
    if (otp.length === length && !submitAttempted.current && state === 'inputting') {
      handleSubmit(otp);
    }
  }, [digits, length, autoSubmit, handleSubmit, state]);

  // Render digit box
  const renderDigitBox = (digit: string, index: number) => {
    const isActive = index === focusIndex && state === 'inputting';
    const isFilled = !!digit;

    let borderColor = colors.gray[600];
    let bgColor = 'transparent';

    if (state === 'error') {
      borderColor = colors.accent.error;
    } else if (state === 'success') {
      borderColor = colors.accent.success;
    } else if (isActive) {
      borderColor = colors.primary;
    } else if (isFilled) {
      borderColor = colors.gray[500];
    }

    return (
      <Box
        key={index}
        width={3}
        height={1}
        borderStyle="round"
        borderColor={borderColor}
        justifyContent="center"
        alignItems="center"
        marginRight={index < length - 1 ? 1 : 0}
      >
        <Text
          bold={isFilled}
          color={isFilled ? colors.gray[100] : colors.gray[400]}
        >
          {digit || (isActive ? '│' : '·')}
        </Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      {/* Label */}
      <Box marginBottom={1}>
        <Text bold color={colors.gray[200]}>
          {label}
        </Text>
      </Box>

      {/* OTP Digit Boxes */}
      <Box>
        {digits.map((digit, index) => renderDigitBox(digit, index))}
      </Box>

      {/* Status Messages */}
      {state === 'loading' && (
        <Box marginTop={1}>
          <Text color={colors.accent.warning}>
            {icons.spinner} Verifying...
          </Text>
        </Box>
      )}

      {state === 'success' && (
        <Box marginTop={1}>
          <Text color={colors.accent.success}>
            {icons.check} Verified successfully
          </Text>
        </Box>
      )}

      {state === 'error' && (
        <Box marginTop={1} flexDirection="column">
          <Text color={colors.accent.error}>
            {icons.cross} {localError || 'Verification failed'}
          </Text>
          {allowRetry && (
            <Text dimColor>
              Press <Text bold>Enter</Text> to retry
            </Text>
          )}
        </Box>
      )}

      {/* Resend Option */}
      {onResend && state !== 'success' && (
        <Box marginTop={1}>
          {countdown > 0 ? (
            <Text dimColor>
              Resend OTP in <Text bold>{countdown}s</Text>
            </Text>
          ) : (
            <Text dimColor>
              Press <Text bold>r</Text> to resend OTP
            </Text>
          )}
        </Box>
      )}

      {/* Instructions */}
      {state === 'inputting' && (
        <Box marginTop={1}>
          <Text dimColor>
            Type the {length}-digit code
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default OtpInput;