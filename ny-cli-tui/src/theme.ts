/**
 * Design System and Theme Constants for ny-cli-tui
 * 
 * A minimal, premium, and elegant design system with:
 * - Subtle grays for hierarchy and depth
 * - Accent colors for interactive elements
 * - Consistent spacing and typography
 */

// =============================================================================
// COLOR PALETTE
// =============================================================================

/**
 * Primary colors - Used for main interactive elements and branding
 */
export const colors = {
  // Brand / Primary accent
  primary: '#00D4AA',      // Teal - Namma Yatri brand-inspired
  primaryDim: '#00A88A',   // Dimmer variant for secondary elements
  primaryBright: '#33FFCC', // Bright variant for highlights

  // Accent colors - For specific states and actions
  accent: {
    info: '#5B9CF6',       // Soft blue - informational
    success: '#4ADE80',    // Green - success states
    warning: '#FBBF24',    // Amber - warnings
    error: '#F87171',      // Red - errors
    highlight: '#FCD34D',  // Gold - special highlights
  },

  // Neutral grays - Core of the minimal aesthetic
  gray: {
    50: '#FAFAFA',   // Nearly white - backgrounds
    100: '#F4F4F5',  // Light background
    200: '#E4E4E7',  // Borders, dividers
    300: '#D4D4D8',  // Disabled text
    400: '#A1A1AA',  // Placeholder text
    500: '#71717A',  // Secondary text
    600: '#52525B',  // Body text
    700: '#3F3F46',  // Emphasized text
    800: '#27272A',  // Headings
    900: '#18181B',  // Maximum contrast
  },

  // Semantic colors - For specific use cases
  semantic: {
    selected: '#00D4AA',   // Selected item indicator
    active: '#5B9CF6',     // Active/focused element
    disabled: '#52525B',   // Disabled state
    link: '#60A5FA',       // Clickable links
    money: '#4ADE80',      // Currency/fare display
    time: '#A78BFA',       // Time estimates
    distance: '#FB923C',   // Distance display
  },
} as const;

/**
 * Ink-compatible color names (maps to terminal color support)
 * Use these for components that need string color names
 */
export const inkColors = {
  primary: 'cyan',
  success: 'green',
  warning: 'yellow',
  error: 'red',
  info: 'blue',
  muted: 'gray',
  highlight: 'magenta',
} as const;

// =============================================================================
// SPACING
// =============================================================================

/**
 * Spacing scale - Based on 4px base unit
 * Used for padding, margins, and gaps
 */
export const spacing = {
  none: 0,
  xs: 1,      // 4px - Tight spacing
  sm: 2,      // 8px - Small gaps
  md: 3,      // 12px - Medium gaps
  lg: 4,      // 16px - Large gaps
  xl: 5,      // 20px - Extra large
  '2xl': 6,   // 24px - Section spacing
  '3xl': 8,   // 32px - Major sections
} as const;

/**
 * Layout constants
 */
export const layout = {
  // Container padding
  containerPadding: spacing.md,
  
  // Screen margins
  screenMargin: spacing.lg,
  
  // Content width (for centered layouts)
  contentWidth: 60,
  
  // Minimum terminal width
  minTerminalWidth: 40,
  
  // Border radius (for box decorations)
  borderRadius: 1,
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================

/**
 * Typography constants
 * Note: Terminal fonts are limited, so we focus on weight and style
 */
export const typography = {
  // Font weights (boolean for Ink)
  weight: {
    normal: false,
    bold: true,
  },

  // Text sizes (conceptual - terminals use monospace)
  size: {
    xs: 0.8,    // Diminished text
    sm: 0.9,    // Secondary text
    base: 1,    // Body text
    lg: 1.1,    // Emphasized
    xl: 1.2,    // Headings
  },

  // Line heights (vertical spacing between lines)
  lineHeight: {
    tight: 1,
    normal: 1.2,
    relaxed: 1.5,
  },
} as const;

/**
 * Text style presets
 * Combine weight, color, and size for consistent text styling
 */
export const textStyles = {
  // Headings
  h1: {
    bold: true,
    color: colors.primary,
  },
  h2: {
    bold: true,
    color: colors.gray[800],
  },
  h3: {
    bold: true,
    color: colors.gray[700],
  },

  // Body text
  body: {
    bold: false,
    color: colors.gray[600],
  },
  bodyEmphasis: {
    bold: true,
    color: colors.gray[700],
  },

  // Secondary text
  secondary: {
    bold: false,
    color: colors.gray[500],
  },
  tertiary: {
    bold: false,
    color: colors.gray[400],
  },

  // Interactive
  link: {
    bold: false,
    color: colors.semantic.link,
  },
  selected: {
    bold: true,
    color: colors.primary,
  },

  // Status
  success: {
    bold: false,
    color: colors.accent.success,
  },
  warning: {
    bold: false,
    color: colors.accent.warning,
  },
  error: {
    bold: false,
    color: colors.accent.error,
  },
  info: {
    bold: false,
    color: colors.accent.info,
  },
} as const;

// =============================================================================
// COMPONENT STYLES
// =============================================================================

/**
 * Pre-built component style configurations
 * Use these for consistent styling across similar components
 */
export const componentStyles = {
  // Header component
  header: {
    marginBottom: spacing.md,
    title: {
      bold: true,
      color: colors.primary,
    },
    subtitle: {
      bold: false,
      color: colors.gray[500],
    },
  },

  // List items
  listItem: {
    padding: spacing.xs,
    indicator: {
      selected: '▶',
      unselected: ' ',
    },
    colors: {
      selected: colors.primary,
      unselected: colors.gray[600],
    },
  },

  // Buttons / Actions
  button: {
    padding: spacing.xs,
    primary: {
      color: colors.primary,
      bold: true,
    },
    secondary: {
      color: colors.gray[500],
      bold: false,
    },
    disabled: {
      color: colors.gray[400],
      bold: false,
    },
  },

  // Input fields
  input: {
    prefix: '›',
    placeholder: {
      color: colors.gray[400],
    },
    value: {
      color: colors.gray[100],
    },
    cursor: {
      color: colors.primary,
    },
  },

  // Cards / Panels
  card: {
    padding: spacing.md,
    borderColor: colors.gray[700],
    headerColor: colors.gray[800],
  },

  // Dividers
  divider: {
    char: '─',
    color: colors.gray[600],
    marginY: spacing.sm,
  },

  // Status indicators
  status: {
    spinner: {
      color: colors.accent.warning,
    },
    success: {
      icon: '✓',
      color: colors.accent.success,
    },
    error: {
      icon: '✗',
      color: colors.accent.error,
    },
    info: {
      icon: 'ℹ',
      color: colors.accent.info,
    },
    warning: {
      icon: '⚠',
      color: colors.accent.warning,
    },
  },

  // Fare / Money display
  fare: {
    currency: '₹',
    color: colors.semantic.money,
    bold: true,
  },

  // Time estimates
  time: {
    color: colors.semantic.time,
    bold: false,
  },

  // Distance display
  distance: {
    color: colors.semantic.distance,
    bold: false,
  },
} as const;

// =============================================================================
// ICONS
// =============================================================================

/**
 * Unicode icons for various UI elements
 * Using widely-supported Unicode characters for terminal compatibility
 */
export const icons = {
  // Navigation
  arrow: {
    right: '→',
    left: '←',
    up: '↑',
    down: '↓',
  },

  // Selection
  bullet: '•',
  check: '✓',
  cross: '✗',
  pointer: '▶',
  chevron: '›',

  // Status
  spinner: '⏳',
  loading: '◐',
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',

  // Transport
  car: '🚕',
  auto: '🛺',
  bike: '🏍',

  // Location
  pin: '📍',
  home: '🏠',
  work: '🏢',

  // Misc
  money: '💰',
  clock: '⏱',
  distance: '📏',
  user: '👤',
  phone: '📱',
  star: '★',
} as const;

// =============================================================================
// ANIMATION
// =============================================================================

/**
 * Animation timing constants
 */
export const animation = {
  // Spinner frame interval (ms)
  spinnerInterval: 80,
  
  // Transition duration (ms)
  transitionDuration: 150,
  
  // Debounce delay for search (ms)
  searchDebounce: 300,
  
  // Polling intervals
  pollInterval: 2000,
  searchPollMax: 30000,
  driverPollMax: 60000,
} as const;

// =============================================================================
// STYLE UTILITIES
// =============================================================================

/**
 * Utility functions for consistent styling
 */
export const styleUtils = {
  /**
   * Get color for a ride estimate based on price tier
   */
  getPriceTierColor(price: number, basePrice: number): string {
    const ratio = price / basePrice;
    if (ratio <= 0.8) return colors.accent.success;
    if (ratio <= 1.0) return colors.primary;
    if (ratio <= 1.2) return colors.accent.warning;
    return colors.accent.error;
  },

  /**
   * Format currency for display
   */
  formatCurrency(amount: number, currency = '₹'): string {
    return `${currency}${amount.toLocaleString('en-IN')}`;
  },

  /**
   * Format distance for display
   */
  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  },

  /**
   * Format duration for display
   */
  formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  },

  /**
   * Create a dimmed version of text (for secondary info)
   */
  dim(text: string): { text: string; dimColor: boolean } {
    return { text, dimColor: true };
  },

  /**
   * Create a highlighted version of text
   */
  highlight(text: string): { text: string; color: string; bold: boolean } {
    return { text, color: colors.primary, bold: true };
  },

  /**
   * Pad text to a fixed width
   */
  padRight(text: string, width: number, char = ' '): string {
    if (text.length >= width) return text;
    return text + char.repeat(width - text.length);
  },

  /**
   * Truncate text with ellipsis
   */
  truncate(text: string, maxLength: number, ellipsis = '…'): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + ellipsis;
  },

  /**
   * Create a divider line
   */
  divider(width = 40, char = componentStyles.divider.char): string {
    return char.repeat(width);
  },

  /**
   * Get status icon and color for ride states
   */
  getRideStatusStyle(status: string): { icon: string; color: string } {
    const statusMap: Record<string, { icon: string; color: string }> = {
      pending: { icon: icons.spinner, color: colors.accent.warning },
      searching: { icon: icons.spinner, color: colors.accent.info },
      confirmed: { icon: icons.check, color: colors.accent.success },
      arriving: { icon: icons.car, color: colors.accent.info },
      inProgress: { icon: icons.car, color: colors.primary },
      completed: { icon: icons.check, color: colors.accent.success },
      cancelled: { icon: icons.cross, color: colors.accent.error },
    };
    return statusMap[status] ?? { icon: icons.bullet, color: colors.gray[500] };
  },
};

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Color = typeof colors;
export type Spacing = typeof spacing;
export type Typography = typeof typography;
export type ComponentStyles = typeof componentStyles;
export type Icons = typeof icons;