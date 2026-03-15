import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors, componentStyles } from '../../theme.js';

/**
 * Spinner type variants from ink-spinner
 */
type SpinnerType = 'dots' | 'dots2' | 'dots3' | 'dots4' | 'dots5' | 'dots6' | 
                   'dots7' | 'dots8' | 'dots9' | 'dots10' | 'dots11' | 'dots12' |
                   'line' | 'line2' | 'pipe' | 'simpleDots' | 'simpleDotsScrolling' |
                   'star' | 'flip' | 'hamburger' | 'growVertical' | 'growHorizontal' |
                   'balloon' | 'balloon2' | 'noise' | 'bounce' | 'boxBounce' |
                   'triangle' | 'arc' | 'circle' | 'squareCorners' | 'circleQuarters' |
                   'circleHalves' | 'squish' | 'toggle' | 'toggle2' | 'arrow' |
                   'arrow2' | 'arrow3' | 'bouncingBar' | 'bouncingBall' | 'smiley' |
                   'monkey' | 'hearts' | 'clock' | 'earth' | 'moon' | 'runner' |
                   'pong' | 'shark' | 'weather' | 'christmas' | 'grenade' | 'point' |
                   'layer' | 'betaWave';

export interface SpinnerProps {
  /**
   * Text to display next to the spinner
   */
  text?: string;
  
  /**
   * Color of the spinner (Ink color name or hex)
   * @default 'cyan'
   */
  color?: string;
  
  /**
   * Spinner animation type
   * @default 'dots'
   */
  type?: SpinnerType;
  
  /**
   * Whether to show the spinner (useful for conditional rendering)
   * @default true
   */
  active?: boolean;
  
  /**
   * Bold text
   * @default false
   */
  bold?: boolean;
}

/**
 * Elegant spinner component using ink-spinner
 * Provides animated loading indicators with customizable appearance
 */
export function SpinnerComponent({
  text,
  color = colors.primary,
  type = 'dots',
  active = true,
  bold = false,
}: SpinnerProps): JSX.Element | null {
  if (!active) {
    return null;
  }

  return (
    <Box>
      <Text color={color}>
        <Spinner type={type} />
      </Text>
      {text && (
        <Text bold={bold}> {text}</Text>
      )}
    </Box>
  );
}

/**
 * Preset spinner configurations for common use cases
 */
export const spinnerPresets = {
  /**
   * Default spinner - general purpose
   */
  default: {
    type: 'dots' as SpinnerType,
    color: colors.primary,
  },
  
  /**
   * Searching spinner - for location/ride searches
   */
  searching: {
    type: 'dots2' as SpinnerType,
    color: colors.accent.info,
  },
  
  /**
   * Loading spinner - for data fetching
   */
  loading: {
    type: 'line' as SpinnerType,
    color: colors.accent.warning,
  },
  
  /**
   * Processing spinner - for API calls
   */
  processing: {
    type: 'bounce' as SpinnerType,
    color: colors.primary,
  },
  
  /**
   * Waiting spinner - for polling states
   */
  waiting: {
    type: 'simpleDotsScrolling' as SpinnerType,
    color: colors.gray[500],
  },
  
  /**
   * Booking spinner - for ride booking operations
   */
  booking: {
    type: 'dots3' as SpinnerType,
    color: colors.accent.success,
  },
} as const;

/**
 * Pre-configured spinner for searching operations
 */
export function SearchSpinner({ text = 'Searching...' }: { text?: string }): JSX.Element {
  return (
    <SpinnerComponent
      text={text}
      type={spinnerPresets.searching.type}
      color={spinnerPresets.searching.color}
    />
  );
}

/**
 * Pre-configured spinner for loading operations
 */
export function LoadingSpinner({ text = 'Loading...' }: { text?: string }): JSX.Element {
  return (
    <SpinnerComponent
      text={text}
      type={spinnerPresets.loading.type}
      color={spinnerPresets.loading.color}
    />
  );
}

/**
 * Pre-configured spinner for booking operations
 */
export function BookingSpinner({ text = 'Booking ride...' }: { text?: string }): JSX.Element {
  return (
    <SpinnerComponent
      text={text}
      type={spinnerPresets.booking.type}
      color={spinnerPresets.booking.color}
    />
  );
}

/**
 * Pre-configured spinner for processing/waiting states
 */
export function WaitingSpinner({ text = 'Please wait...' }: { text?: string }): JSX.Element {
  return (
    <SpinnerComponent
      text={text}
      type={spinnerPresets.waiting.type}
      color={spinnerPresets.waiting.color}
    />
  );
}

export default SpinnerComponent;