/**
 * Namma Yatri TUI - Main Entry Point
 * 
 * A Terminal User Interface for booking Namma Yatri rides using Ink and React.
 */

// Export types
export * from './types/index.js';

// Export API client
export {
  NammaYatriClient,
  NYAuthError,
  NYApiError,
  createAddressFromCoordinates,
  parseCoordinates,
} from './api/index.js';
