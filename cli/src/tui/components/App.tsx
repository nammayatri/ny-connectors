/**
 * Main App Component
 * Orchestrates the entire TUI wizard flow
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { AuthScreen } from './AuthScreen.js';
import { MainScreen } from './MainScreen.js';
import { BookingWizard } from './BookingWizard.js';
import { StatusScreen } from './StatusScreen.js';
import { SavedLocationsScreen } from './SavedLocationsScreen.js';
import { apiClient } from '../../api/index.js';

type Screen = 'auth' | 'main' | 'book' | 'status' | 'saved';

export function App(): React.ReactElement {
  const [currentScreen, setCurrentScreen] = useState<Screen>('main');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check if already authenticated
    setIsAuthenticated(apiClient.isAuthenticated());
    setIsChecking(false);
  }, []);

  const handleAuthSuccess = (): void => {
    setIsAuthenticated(true);
    setCurrentScreen('main');
  };

  const handleLogout = (): void => {
    apiClient.clearAuth();
    setIsAuthenticated(false);
    setCurrentScreen('main');
  };

  if (isChecking) {
    return (
      <Box padding={1}>
        <Text color="cyan">Loading...</Text>
      </Box>
    );
  }

  // Route to appropriate screen
  switch (currentScreen) {
    case 'auth':
      return <AuthScreen onAuthSuccess={handleAuthSuccess} onBack={() => setCurrentScreen('main')} />;

    case 'book':
      if (!isAuthenticated) {
        return <AuthScreen onAuthSuccess={handleAuthSuccess} onBack={() => setCurrentScreen('main')} />;
      }
      return <BookingWizard onBack={() => setCurrentScreen('main')} />;

    case 'status':
      if (!isAuthenticated) {
        return <AuthScreen onAuthSuccess={handleAuthSuccess} onBack={() => setCurrentScreen('main')} />;
      }
      return <StatusScreen onBack={() => setCurrentScreen('main')} />;

    case 'saved':
      if (!isAuthenticated) {
        return <AuthScreen onAuthSuccess={handleAuthSuccess} onBack={() => setCurrentScreen('main')} />;
      }
      return <SavedLocationsScreen onBack={() => setCurrentScreen('main')} />;

    case 'main':
    default:
      return (
        <MainScreen
          isAuthenticated={isAuthenticated}
          onSelectAuth={() => setCurrentScreen('auth')}
          onSelectBook={() => setCurrentScreen('book')}
          onSelectStatus={() => setCurrentScreen('status')}
          onSelectSaved={() => setCurrentScreen('saved')}
          onLogout={handleLogout}
        />
      );
  }
}