import React, { useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, icons, spacing } from '../../theme.js';

// =============================================================================
// ERROR TYPES
// =============================================================================

export type ErrorType = 
  | 'network'
  | 'api'
  | 'session'
  | 'validation'
  | 'not_found'
  | 'rate_limit'
  | 'unknown';

export interface AppError {
  type: ErrorType;
  title: string;
  message: string;
  suggestion?: string;
  retryable: boolean;
  originalError?: unknown;
}

// =============================================================================
// ERROR CLASSIFICATION
// =============================================================================

/**
 * Classify an error into a known type with user-friendly messaging
 */
export function classifyError(error: unknown): AppError {
  // Handle known error types
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const statusCode = (error as { statusCode?: number }).statusCode;

    // Network errors
    if (
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('etimedout') ||
      message.includes('fetch failed') ||
      message.includes('network error')
    ) {
      return {
        type: 'network',
        title: 'Connection Error',
        message: 'Unable to connect to the server.',
        suggestion: 'Please check your internet connection and try again.',
        retryable: true,
        originalError: error,
      };
    }

    // Session/Auth errors
    if (
      statusCode === 401 ||
      message.includes('unauthorized') ||
      message.includes('not authenticated') ||
      message.includes('token expired') ||
      message.includes('authentication failed') ||
      message.includes('invalid token')
    ) {
      return {
        type: 'session',
        title: 'Session Expired',
        message: 'Your session has expired or is invalid.',
        suggestion: 'Please run `ny-cli auth` to login again.',
        retryable: false,
        originalError: error,
      };
    }

    // Rate limiting
    if (
      statusCode === 429 ||
      message.includes('rate limit') ||
      message.includes('too many requests')
    ) {
      return {
        type: 'rate_limit',
        title: 'Too Many Requests',
        message: 'You\'re making requests too quickly.',
        suggestion: 'Please wait a moment and try again.',
        retryable: true,
        originalError: error,
      };
    }

    // Not found errors
    if (
      statusCode === 404 ||
      message.includes('not found') ||
      message.includes('no results') ||
      message.includes('no rides') ||
      message.includes('no estimates')
    ) {
      return {
        type: 'not_found',
        title: 'Not Found',
        message: 'The requested resource was not found.',
        suggestion: 'Try adjusting your search or location.',
        retryable: true,
        originalError: error,
      };
    }

    // API errors (4xx/5xx)
    if (statusCode) {
      if (statusCode >= 400 && statusCode < 500) {
        return {
          type: 'api',
          title: 'Request Error',
          message: `The request could not be processed (${statusCode}).`,
          suggestion: 'Please check your input and try again.',
          retryable: statusCode !== 400,
          originalError: error,
        };
      }
      if (statusCode >= 500) {
        return {
          type: 'api',
          title: 'Server Error',
          message: 'The server encountered an error.',
          suggestion: 'Please try again later.',
          retryable: true,
          originalError: error,
        };
      }
    }

    // Validation errors
    if (
      message.includes('invalid') ||
      message.includes('required') ||
      message.includes('must be')
    ) {
      return {
        type: 'validation',
        title: 'Invalid Input',
        message: error.message,
        suggestion: 'Please check your input and try again.',
        retryable: true,
        originalError: error,
      };
    }

    // Generic error with message
    return {
      type: 'unknown',
      title: 'Error',
      message: error.message || 'An unexpected error occurred.',
      suggestion: 'Please try again.',
      retryable: true,
      originalError: error,
    };
  }

  // String error
  if (typeof error === 'string') {
    return {
      type: 'unknown',
      title: 'Error',
      message: error,
      suggestion: 'Please try again.',
      retryable: true,
    };
  }

  // Unknown error type
  return {
    type: 'unknown',
    title: 'Error',
    message: 'An unexpected error occurred.',
    suggestion: 'Please try again.',
    retryable: true,
    originalError: error,
  };
}

// =============================================================================
// ERROR DISPLAY COMPONENT
// =============================================================================

export interface ErrorDisplayProps {
  /** The error to display */
  error: unknown;
  /** Called when user wants to retry */
  onRetry?: () => void;
  /** Called when user wants to dismiss/go back */
  onDismiss?: () => void;
  /** Custom title override */
  title?: string;
  /** Custom message override */
  message?: string;
  /** Show detailed error info (for debugging) */
  showDetails?: boolean;
  /** Compact mode for inline display */
  compact?: boolean;
}

export function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  title,
  message,
  showDetails = false,
  compact = false,
}: ErrorDisplayProps): JSX.Element {
  const appError = useMemo(() => classifyError(error), [error]);

  // Use custom overrides if provided
  const displayTitle = title ?? appError.title;
  const displayMessage = message ?? appError.message;

  // Determine available actions
  const canRetry = appError.retryable && onRetry;
  const canDismiss = onDismiss !== undefined;

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape && canDismiss) {
      onDismiss();
      return;
    }

    if ((input === 'r' || input === 'R') && canRetry) {
      onRetry();
      return;
    }

    if ((key.return || input === 'q' || input === 'Q') && canDismiss) {
      onDismiss();
    }
  });

  // Get icon and color based on error type
  const { icon, color } = getErrorStyle(appError.type);

  // Compact inline display
  if (compact) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color={color}>{icon}</Text>
          <Text bold color={color}> {displayTitle}:</Text>
          <Text> {displayMessage}</Text>
        </Box>
        {canRetry && (
          <Box marginLeft={2}>
            <Text dimColor>Press </Text>
            <Text bold color="cyan">R</Text>
            <Text dimColor> to retry</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Full error display
  return (
    <Box 
      flexDirection="column" 
      padding={spacing.md}
      borderStyle="round"
      borderColor={colors.gray[700]}
    >
      {/* Error Header */}
      <Box marginBottom={spacing.sm}>
        <Text color={color}>{icon}</Text>
        <Text bold color={color}> {displayTitle}</Text>
      </Box>

      {/* Error Message */}
      <Box marginBottom={spacing.xs}>
        <Text>{displayMessage}</Text>
      </Box>

      {/* Suggestion */}
      {appError.suggestion && (
        <Box marginBottom={spacing.sm}>
          <Text dimColor>{appError.suggestion}</Text>
        </Box>
      )}

      {/* Debug details (only if explicitly enabled) */}
      {showDetails && appError.originalError && (
        <Box 
          flexDirection="column" 
          marginTop={spacing.sm}
          padding={spacing.xs}
          borderStyle="single"
          borderColor={colors.gray[600]}
        >
          <Text dimColor bold>Debug Info:</Text>
          <Text dimColor>
            {getErrorDetails(appError.originalError)}
          </Text>
        </Box>
      )}

      {/* Actions */}
      {(canRetry || canDismiss) && (
        <Box marginTop={spacing.md} gap={spacing.lg}>
          {canRetry && (
            <Box>
              <Text dimColor>[</Text>
              <Text bold color="cyan">R</Text>
              <Text dimColor>] Retry</Text>
            </Box>
          )}
          {canDismiss && (
            <Box>
              <Text dimColor>[</Text>
              <Text bold color="cyan">Esc/Q</Text>
              <Text dimColor>] {canRetry ? 'Back' : 'Dismiss'}</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

// =============================================================================
// ERROR BANNER COMPONENT (for inline errors)
// =============================================================================

export interface ErrorBannerProps {
  error: unknown;
  onRetry?: () => void;
  onDismiss?: () => void;
}

/**
 * A minimal inline error banner for use within other screens
 */
export function ErrorBanner({ error, onRetry, onDismiss }: ErrorBannerProps): JSX.Element {
  const appError = useMemo(() => classifyError(error), [error]);
  const { icon, color } = getErrorStyle(appError.type);

  useInput((input) => {
    if ((input === 'r' || input === 'R') && onRetry) {
      onRetry();
    }
    if ((input === 'q' || input === 'Q' || input === 'x' || input === 'X') && onDismiss) {
      onDismiss();
    }
  });

  return (
    <Box 
      flexDirection="column"
      paddingX={spacing.sm}
      borderStyle="single"
      borderColor={color}
    >
      <Box>
        <Text color={color}>{icon}</Text>
        <Text> {appError.message}</Text>
      </Box>
      {(onRetry || onDismiss) && (
        <Box gap={spacing.md}>
          {onRetry && (
            <Text dimColor>
              [<Text bold color="cyan">R</Text>] retry
            </Text>
          )}
          {onDismiss && (
            <Text dimColor>
              [<Text bold color="cyan">X</Text>] dismiss
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}

// =============================================================================
// ERROR MESSAGE COMPONENT (text only, no interaction)
// =============================================================================

export interface ErrorMessageProps {
  error: unknown;
  /** Show suggestion text */
  showSuggestion?: boolean;
}

/**
 * Simple error text display without interaction
 */
export function ErrorMessage({ error, showSuggestion = true }: ErrorMessageProps): JSX.Element {
  const appError = useMemo(() => classifyError(error), [error]);
  const { icon, color } = getErrorStyle(appError.type);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={color}>{icon}</Text>
        <Text> {appError.message}</Text>
      </Box>
      {showSuggestion && appError.suggestion && (
        <Text dimColor>  {appError.suggestion}</Text>
      )}
    </Box>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function getErrorStyle(type: ErrorType): { icon: string; color: string } {
  switch (type) {
    case 'network':
      return { icon: icons.warning, color: colors.accent.warning };
    case 'session':
      return { icon: icons.error, color: colors.accent.error };
    case 'api':
      return { icon: icons.error, color: colors.accent.error };
    case 'validation':
      return { icon: icons.warning, color: colors.accent.warning };
    case 'not_found':
      return { icon: icons.info, color: colors.accent.info };
    case 'rate_limit':
      return { icon: icons.warning, color: colors.accent.warning };
    case 'unknown':
    default:
      return { icon: icons.error, color: colors.accent.error };
  }
}

/**
 * Extract safe error details for debugging (no stack traces)
 */
function getErrorDetails(error: unknown): string {
  if (error instanceof Error) {
    const parts: string[] = [];
    
    // Error name
    if (error.name && error.name !== 'Error') {
      parts.push(`Type: ${error.name}`);
    }
    
    // Status code if available
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode) {
      parts.push(`Status: ${statusCode}`);
    }
    
    // Response body if available
    const body = (error as { body?: unknown }).body;
    if (body && typeof body === 'object') {
      parts.push(`Response: ${JSON.stringify(body)}`);
    }
    
    return parts.join('\n') || 'No additional details available.';
  }
  
  return String(error);
}

// =============================================================================
// ERROR HOOK
// =============================================================================

import { useState, useCallback } from 'react';

export interface UseErrorResult {
  error: AppError | null;
  setError: (error: unknown) => void;
  clearError: () => void;
  retry: () => void;
}

/**
 * Hook for managing error state with retry capability
 */
export function useError(retryFn?: () => Promise<void> | void): UseErrorResult {
  const [error, setErrorState] = useState<AppError | null>(null);

  const setError = useCallback((err: unknown) => {
    setErrorState(classifyError(err));
  }, []);

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  const retry = useCallback(async () => {
    if (!retryFn) return;
    
    clearError();
    
    try {
      await retryFn();
    } catch (err) {
      setError(err);
    }
  }, [retryFn, clearError, setError]);

  return { error, setError, clearError, retry };
}