/**
 * Navigation Context
 * Provides navigation state and keyboard handling for the TUI
 */

import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useInput } from 'ink';
import type { WizardStep } from './states.js';

// Navigation context types
interface NavigationContextValue {
  // Current navigation state
  currentScreen: Screen;
  currentStep: WizardStep;
  
  // Navigation actions
  navigateToScreen: (screen: Screen) => void;
  navigateToStep: (step: WizardStep) => void;
  goBack: () => void;
  exit: () => void;
  
  // History
  canGoBack: boolean;
  history: (Screen | WizardStep)[];
}

// Screen types (top-level navigation)
export type Screen = 'main' | 'auth' | 'book' | 'status' | 'saved' | 'help';

// Create context
const NavigationContext = createContext<NavigationContextValue | null>(null);

// Provider props
interface NavigationProviderProps {
  children: React.ReactNode;
  initialScreen?: Screen;
  onExit?: () => void;
}

// Navigation provider component
export function NavigationProvider({
  children,
  initialScreen = 'main',
  onExit,
}: NavigationProviderProps): React.ReactElement {
  const [currentScreen, setCurrentScreen] = useState<Screen>(initialScreen);
  const [currentStep, setCurrentStep] = useState<WizardStep>('auth');
  const [history, setHistory] = useState<(Screen | WizardStep)[]>([initialScreen]);

  // Navigate to a screen
  const navigateToScreen = useCallback((screen: Screen) => {
    setHistory(prev => [...prev, screen]);
    setCurrentScreen(screen);
  }, []);

  // Navigate to a wizard step
  const navigateToStep = useCallback((step: WizardStep) => {
    setHistory(prev => [...prev, step]);
    setCurrentStep(step);
  }, []);

  // Go back in history
  const goBack = useCallback(() => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop(); // Remove current
      const previous = newHistory[newHistory.length - 1];
      
      setHistory(newHistory);
      
      // Determine if it's a screen or step
      if (isScreen(previous)) {
        setCurrentScreen(previous);
      } else {
        setCurrentStep(previous);
      }
    }
  }, [history]);

  // Exit the application
  const exit = useCallback(() => {
    if (onExit) {
      onExit();
    } else {
      process.exit(0);
    }
  }, [onExit]);

  // Global keyboard handling
  useInput((input, key) => {
    // Escape - go back or exit
    if (key.escape) {
      if (history.length > 1) {
        goBack();
      } else if (currentScreen !== 'main') {
        navigateToScreen('main');
      }
    }
    
    // Ctrl+C - exit
    if (key.ctrl && input === 'c') {
      exit();
    }
    
    // Ctrl+D - exit (Unix convention)
    if (key.ctrl && input === 'd') {
      exit();
    }
  });

  const value: NavigationContextValue = {
    currentScreen,
    currentStep,
    navigateToScreen,
    navigateToStep,
    goBack,
    exit,
    canGoBack: history.length > 1,
    history,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

// Hook to use navigation
export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

// Hook for screen-specific navigation
export function useScreenNavigation(): {
  currentScreen: Screen;
  navigateToScreen: (screen: Screen) => void;
  goBack: () => void;
  canGoBack: boolean;
} {
  const { currentScreen, navigateToScreen, goBack, canGoBack } = useNavigation();
  return { currentScreen, navigateToScreen, goBack, canGoBack };
}

// Hook for wizard step navigation
export function useWizardNavigation(): {
  currentStep: WizardStep;
  navigateToStep: (step: WizardStep) => void;
  goBack: () => void;
  canGoBack: boolean;
} {
  const { currentStep, navigateToStep, goBack, canGoBack } = useNavigation();
  return { currentStep, navigateToStep, goBack, canGoBack };
}

// Type guard to check if value is a Screen
function isScreen(value: string): value is Screen {
  return ['main', 'auth', 'book', 'status', 'saved', 'help'].includes(value);
}