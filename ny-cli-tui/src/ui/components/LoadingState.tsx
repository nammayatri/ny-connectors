import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors, spacing, icons, componentStyles } from '../../theme.js';

/**
 * Loading state type for contextual messages
 */
export type LoadingStateType = 
  | 'searching-places'
  | 'searching-rides'
  | 'confirming-booking'
  | 'cancelling-ride'
  | 'fetching-status'
  | 'authenticating'
  | 'loading-saved-locations'
  | 'refreshing-token'
  | 'generic';

/**
 * Configuration for each loading state type
 */
const loadingStateConfig: Record<LoadingStateType, {
  message: string;
  subMessage?: string;
  spinnerType: 'dots' | 'dots2' | 'dots3' | 'line' | 'bounce' | 'simpleDotsScrolling';
  color: string;
}> = {
  'searching-places': {
    message: 'Searching for places...',
    subMessage: 'Finding matching locations',
    spinnerType: 'dots2',
    color: colors.accent.info,
  },
  'searching-rides': {
    message: 'Searching for rides...',
    subMessage: 'Looking for available drivers nearby',
    spinnerType: 'dots3',
    color: colors.primary,
  },
  'confirming-booking': {
    message: 'Confirming your booking...',
    subMessage: 'Please wait while we process your request',
    spinnerType: 'bounce',
    color: colors.accent.success,
  },
  'cancelling-ride': {
    message: 'Cancelling ride...',
    subMessage: 'Processing cancellation request',
    spinnerType: 'line',
    color: colors.accent.warning,
  },
  'fetching-status': {
    message: 'Fetching ride status...',
    subMessage: 'Getting latest updates',
    spinnerType: 'dots',
    color: colors.accent.info,
  },
  'authenticating': {
    message: 'Authenticating...',
    subMessage: 'Verifying your credentials',
    spinnerType: 'dots',
    color: colors.primary,
  },
  'loading-saved-locations': {
    message: 'Loading saved locations...',
    subMessage: 'Fetching your favorite places',
    spinnerType: 'dots2',
    color: colors.accent.info,
  },
  'refreshing-token': {
    message: 'Refreshing session...',
    subMessage: 'Updating your authentication',
    spinnerType: 'simpleDotsScrolling',
    color: colors.gray[500],
  },
  'generic': {
    message: 'Loading...',
    spinnerType: 'dots',
    color: colors.primary,
  },
};

export interface LoadingStateProps {
  /**
   * Type of loading state (determines message and style)
   */
  type?: LoadingStateType;
  
  /**
   * Custom message (overrides default for type)
   */
  message?: string;
  
  /**
   * Custom sub-message (overrides default for type)
   */
  subMessage?: string;
  
  /**
   * Show sub-message
   * @default true
   */
  showSubMessage?: boolean;
  
  /**
   * Custom color (overrides default for type)
   */
  color?: string;
  
  /**
   * Show in compact mode (no sub-message, less padding)
   * @default false
   */
  compact?: boolean;
  
  /**
   * Show with a leading icon
   * @default false
   */
  showIcon?: boolean;
}

/**
 * Elegant loading state component with contextual messages
 * Provides a complete loading UI with spinner, message, and optional sub-message
 */
export function LoadingState({
  type = 'generic',
  message,
  subMessage,
  showSubMessage = true,
  color,
  compact = false,
  showIcon = false,
}: LoadingStateProps): JSX.Element {
  const config = loadingStateConfig[type];
  const displayMessage = message ?? config.message;
  const displaySubMessage = subMessage ?? config.subMessage;
  const displayColor = color ?? config.color;
  
  return (
    <Box 
      flexDirection="column" 
      paddingX={compact ? 0 : spacing.md}
      paddingY={compact ? 0 : spacing.sm}
    >
      <Box alignItems="center">
        {showIcon && (
          <Box marginRight={1}>
            <Text color={displayColor}>{icons.spinner}</Text>
          </Box>
        )}
        <Text color={displayColor}>
          <Spinner type={config.spinnerType} />
        </Text>
        <Text bold> {displayMessage}</Text>
      </Box>
      
      {!compact && showSubMessage && displaySubMessage && (
        <Box marginLeft={3}>
          <Text dimColor>{displaySubMessage}</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Pre-built loading states for common operations
 */

export function SearchingPlacesState({ message }: { message?: string }): JSX.Element {
  return <LoadingState type="searching-places" message={message} />;
}

export function SearchingRidesState({ message }: { message?: string }): JSX.Element {
  return <LoadingState type="searching-rides" message={message} />;
}

export function ConfirmingBookingState({ message }: { message?: string }): JSX.Element {
  return <LoadingState type="confirming-booking" message={message} />;
}

export function CancellingRideState({ message }: { message?: string }): JSX.Element {
  return <LoadingState type="cancelling-ride" message={message} />;
}

export function FetchingStatusState({ message }: { message?: string }): JSX.Element {
  return <LoadingState type="fetching-status" message={message} />;
}

export function AuthenticatingState({ message }: { message?: string }): JSX.Element {
  return <LoadingState type="authenticating" message={message} />;
}

export function LoadingSavedLocationsState({ message }: { message?: string }): JSX.Element {
  return <LoadingState type="loading-saved-locations" message={message} />;
}

/**
 * Inline loading indicator for use within other components
 */
export interface InlineLoadingProps {
  text?: string;
  color?: string;
}

export function InlineLoading({ text = 'Loading', color = colors.primary }: InlineLoadingProps): JSX.Element {
  return (
    <Box alignItems="center">
      <Text color={color}>
        <Spinner type="dots" />
      </Text>
      <Text dimColor> {text}</Text>
    </Box>
  );
}

/**
 * Loading overlay for full-screen loading states
 */
export interface LoadingOverlayProps {
  type?: LoadingStateType;
  message?: string;
  showBorder?: boolean;
}

export function LoadingOverlay({ 
  type = 'generic', 
  message,
  showBorder = true,
}: LoadingOverlayProps): JSX.Element {
  const config = loadingStateConfig[type];
  const displayMessage = message ?? config.message;
  
  return (
    <Box 
      flexDirection="column" 
      alignItems="center" 
      justifyContent="center"
      padding={spacing.lg}
      borderStyle={showBorder ? 'round' : undefined}
      borderColor={showBorder ? colors.gray[700] : undefined}
    >
      <Box marginBottom={spacing.md}>
        <Text color={config.color}>
          <Spinner type={config.spinnerType} />
        </Text>
      </Box>
      <Text bold>{displayMessage}</Text>
      {config.subMessage && (
        <Box marginTop={spacing.xs}>
          <Text dimColor>{config.subMessage}</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Loading with progress indication (for multi-step operations)
 */
export interface LoadingWithProgressProps {
  message: string;
  currentStep: number;
  totalSteps: number;
  stepName?: string;
}

export function LoadingWithProgress({
  message,
  currentStep,
  totalSteps,
  stepName,
}: LoadingWithProgressProps): JSX.Element {
  const progress = Math.round((currentStep / totalSteps) * 100);
  
  return (
    <Box flexDirection="column" paddingX={spacing.md}>
      <Box alignItems="center">
        <Text color={colors.primary}>
          <Spinner type="dots" />
        </Text>
        <Text bold> {message}</Text>
      </Box>
      
      <Box marginTop={spacing.xs} marginLeft={3}>
        <Text dimColor>
          Step {currentStep}/{totalSteps}
          {stepName && ` - ${stepName}`}
        </Text>
      </Box>
      
      <Box marginTop={spacing.xs} marginLeft={3}>
        <Text dimColor>[</Text>
        <Text color={colors.primary}>
          {'█'.repeat(Math.floor(progress / 5))}
        </Text>
        <Text dimColor>
          {'░'.repeat(20 - Math.floor(progress / 5))}
        </Text>
        <Text dimColor>] {progress}%</Text>
      </Box>
    </Box>
  );
}

export default LoadingState;