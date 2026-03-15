import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useApp, useInput, Newline } from 'ink';
import { MainMenu } from './components/main-menu.js';
import { AuthScreen } from './screens/auth-screen.js';
import { SearchScreen } from './screens/search-screen.js';
import { StatusScreen } from './screens/status-screen.js';
import { SavedLocationsScreen } from './screens/saved-locations-screen.js';
import { CancelScreen } from './screens/cancel-screen.js';
import { SettingsScreen } from './screens/settings-screen.js';
import { useApi } from './hooks/useApi.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Screen identifiers for navigation state machine
 */
export type Screen =
  | 'main'
  | 'auth'
  | 'search'
  | 'status'
  | 'saved-locations'
  | 'cancel'
  | 'settings'
  | 'loading';

/**
 * Navigation history entry
 */
interface NavigationEntry {
  screen: Screen;
  timestamp: number;
}

/**
 * Error boundary state
 */
interface ErrorState {
  message: string;
  timestamp: number;
  recoverable: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const APP_HEADER = `
╔═══════════════════════════════════════════╗
║                                           ║
║      🚕  Namma Yatri CLI - TUI Mode       ║
║                                           ║
╚═══════════════════════════════════════════╝`;

const KEYBOARD_SHORTCUTS = {
  QUIT: 'q',
  BACK: 'escape',
  REFRESH: 'r',
} as const;

// =============================================================================
// Error Boundary Component
// =============================================================================

interface ErrorBoundaryProps {
  error: ErrorState | null;
  onRecover: () => void;
  onExit: () => void;
}

function ErrorBoundary({ error, onRecover, onExit }: ErrorBoundaryProps) {
  if (!error) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="red"
      paddingX={1}
      marginBottom={1}
    >
      <Box>
        <Text color="red" bold>
          ⚠ Error
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text>{error.message}</Text>
      </Box>
      {error.recoverable ? (
        <Box marginTop={1}>
          <Text dimColor>
            Press <Text bold>ESC</Text> to recover or <Text bold>q</Text> to exit
          </Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text dimColor>
            Press <Text bold>q</Text> to exit
          </Text>
        </Box>
      )}
    </Box>
  );
}

// =============================================================================
// Loading Screen Component
// =============================================================================

function LoadingScreen() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {APP_HEADER}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Loading{dots}</Text>
      </Box>
    </Box>
  );
}

// =============================================================================
// Main App Component
// =============================================================================

export function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('loading');
  const [error, setError] = useState<ErrorState | null>(null);
  const [navigationHistory, setNavigationHistory] = useState<NavigationEntry[]>([]);
  const isTransitioningRef = useRef(false);

  // Use the unified API hook
  const {
    client,
    isReady,
    isAuthenticated,
    isLoading: isApiLoading,
    error: apiError,
    savedLocations,
    logout,
    clearError,
    refreshSavedLocations,
  } = useApi();

  // ==========================================================================
  // Initialization Effect
  // ==========================================================================

  useEffect(() => {
    if (!isReady) return;

    if (isAuthenticated && client) {
      navigateTo('main', false);
    } else {
      navigateTo('auth', false);
    }
  }, [isReady, isAuthenticated, client]);

  // ==========================================================================
  // Error Propagation Effect
  // ==========================================================================

  useEffect(() => {
    if (apiError) {
      setError({
        message: apiError,
        timestamp: Date.now(),
        recoverable: true,
      });
    }
  }, [apiError]);

  // ==========================================================================
  // Navigation State Machine
  // ==========================================================================

  /**
   * Navigate to a new screen with history tracking
   */
  const navigateTo = useCallback((newScreen: Screen, trackHistory = true) => {
    if (isTransitioningRef.current) return;

    isTransitioningRef.current = true;

    setNavigationHistory(prev => {
      if (!trackHistory) return prev;
      return [...prev, { screen: newScreen, timestamp: Date.now() }];
    });

    setError(null);
    clearError();
    setScreen(newScreen);

    // Allow transitions after a short delay
    setTimeout(() => {
      isTransitioningRef.current = false;
    }, 100);
  }, [clearError]);

  /**
   * Navigate back to the previous screen
   */
  const navigateBack = useCallback(() => {
    setNavigationHistory(prev => {
      if (prev.length <= 1) {
        // No history, go to main
        setScreen('main');
        return prev;
      }

      const newHistory = prev.slice(0, -1);
      const previousEntry = newHistory[newHistory.length - 1];
      if (previousEntry) {
        setScreen(previousEntry.screen);
      }
      return newHistory;
    });

    setError(null);
    clearError();
  }, [clearError]);

  /**
   * Get the parent screen for the current screen
   */
  const getParentScreen = useCallback((currentScreen: Screen): Screen => {
    const screenHierarchy: Record<Screen, Screen> = {
      'main': 'main',
      'auth': 'auth',
      'loading': 'loading',
      'search': 'main',
      'status': 'main',
      'saved-locations': 'main',
      'cancel': 'main',
      'settings': 'main',
    };
    return screenHierarchy[currentScreen] || 'main';
  }, []);

  // ==========================================================================
  // Global Keyboard Handler
  // ==========================================================================

  useInput((input, key) => {
    // Handle error recovery
    if (error?.recoverable && key.escape) {
      setError(null);
      clearError();
      return;
    }

    // Quit from main menu or loading
    if (input === KEYBOARD_SHORTCUTS.QUIT && (screen === 'main' || screen === 'loading')) {
      exit();
      return;
    }

    // Escape to go back (not from auth or loading)
    if (key.escape && screen !== 'main' && screen !== 'auth' && screen !== 'loading') {
      if (error) {
        setError(null);
        clearError();
      } else {
        navigateBack();
      }
      return;
    }

    // Quick navigation shortcuts from main menu
    if (screen === 'main' && isAuthenticated) {
      if (input === 'b') {
        navigateTo('search');
        return;
      }
      if (input === 's') {
        navigateTo('status');
        return;
      }
      if (input === 'c') {
        navigateTo('cancel');
        return;
      }
      if (input === 'l') {
        navigateTo('saved-locations');
        return;
      }
      if (input === 't') {
        navigateTo('settings');
        return;
      }
    }
  });

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  const handleAuthSuccess = useCallback(() => {
    navigateTo('main');
  }, [navigateTo]);

  const handleNavigate = useCallback((newScreen: Screen) => {
    navigateTo(newScreen);
  }, [navigateTo]);

  const handleError = useCallback((err: string) => {
    setError({
      message: err,
      timestamp: Date.now(),
      recoverable: true,
    });
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    navigateTo('auth', false);
  }, [logout, navigateTo]);

  const handleRecover = useCallback(() => {
    setError(null);
    clearError();
  }, [clearError]);

  // ==========================================================================
  // Screen Renderer
  // ==========================================================================

  const renderScreen = useCallback(() => {
    switch (screen) {
      case 'auth':
        return (
          <AuthScreen
            onSuccess={handleAuthSuccess}
            onError={handleError}
          />
        );

      case 'search':
        return client ? (
          <SearchScreen
            client={client}
            savedLocations={savedLocations}
            onRefreshLocations={refreshSavedLocations}
            onBack={() => navigateTo('main')}
            onError={handleError}
          />
        ) : (
          <NotAuthenticatedScreen onAuthRequired={() => navigateTo('auth')} />
        );

      case 'status':
        return client ? (
          <StatusScreen
            client={client}
            onBack={() => navigateTo('main')}
            onError={handleError}
          />
        ) : (
          <NotAuthenticatedScreen onAuthRequired={() => navigateTo('auth')} />
        );

      case 'saved-locations':
        return client ? (
          <SavedLocationsScreen
            client={client}
            savedLocations={savedLocations}
            onRefresh={refreshSavedLocations}
            onBack={() => navigateTo('main')}
            onError={handleError}
          />
        ) : (
          <NotAuthenticatedScreen onAuthRequired={() => navigateTo('auth')} />
        );

      case 'cancel':
        return client ? (
          <CancelScreen
            client={client}
            onBack={() => navigateTo('main')}
            onError={handleError}
          />
        ) : (
          <NotAuthenticatedScreen onAuthRequired={() => navigateTo('auth')} />
        );

      case 'settings':
        return (
          <SettingsScreen
            isAuthenticated={isAuthenticated}
            onLogout={handleLogout}
            onBack={() => navigateTo('main')}
            onAuthRequired={() => navigateTo('auth')}
            onError={handleError}
          />
        );

      case 'main':
      default:
        return (
          <MainMenu
            hasToken={isAuthenticated}
            onNavigate={handleNavigate}
            onExit={exit}
          />
        );
    }
  }, [
    screen,
    client,
    isAuthenticated,
    savedLocations,
    handleAuthSuccess,
    handleError,
    handleLogout,
    handleNavigate,
    navigateTo,
    refreshSavedLocations,
    exit,
  ]);

  // ==========================================================================
  // Render
  // ==========================================================================

  // Loading state
  if (!isReady || isApiLoading) {
    return <LoadingScreen />;
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {APP_HEADER}
        </Text>
      </Box>

      {/* Authentication Status Bar */}
      <Box
        marginBottom={1}
        paddingX={1}
        borderStyle="round"
        borderColor={isAuthenticated ? 'green' : 'yellow'}
      >
        <Text>
          {isAuthenticated ? (
            <>
              <Text color="green">✓</Text>
              <Text> Authenticated</Text>
            </>
          ) : (
            <>
              <Text color="yellow">⚠</Text>
              <Text> Not authenticated</Text>
            </>
          )}
        </Text>
        <Box marginLeft={2}>
          <Text dimColor>| Screen: {screen}</Text>
        </Box>
      </Box>

      {/* Error Boundary */}
      <ErrorBoundary
        error={error}
        onRecover={handleRecover}
        onExit={exit}
      />

      {/* Main Content */}
      <Box flexDirection="column">
        {renderScreen()}
      </Box>

      {/* Footer Navigation Hints */}
      {screen !== 'main' && screen !== 'auth' && screen !== 'loading' && (
        <Box marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
          <Text dimColor>
            <Text bold>ESC</Text> Back
          </Text>
          <Text dimColor> | </Text>
          <Text dimColor>
            <Text bold>Ctrl+C</Text> Exit
          </Text>
          {isAuthenticated && screen === 'main' && (
            <>
              <Text dimColor> | </Text>
              <Text dimColor>
                Quick: <Text bold>b</Text>=Book <Text bold>s</Text>=Status <Text bold>c</Text>=Cancel <Text bold>l</Text>=Locations <Text bold>t</Text>=Settings
              </Text>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

interface NotAuthenticatedScreenProps {
  onAuthRequired: () => void;
}

function NotAuthenticatedScreen({ onAuthRequired }: NotAuthenticatedScreenProps) {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="red" bold>
          ⚠ Authentication Required
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text>You need to authenticate to access this feature.</Text>
      </Box>
      <Box>
        <Text dimColor>
          Press <Text bold>ESC</Text> to go back or navigate to Settings to authenticate.
        </Text>
      </Box>
    </Box>
  );
}

// =============================================================================
// Default Export
// =============================================================================

export default App;