// ============================================================================
// Error Boundary Component
// Catches and displays errors gracefully
// ============================================================================

import React, { Component, type ReactNode } from 'react';
import { Box, Text } from 'ink';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for debugging
    console.error('Error caught by boundary:', error);
    console.error('Component stack:', errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box flexDirection="column" padding={2}>
          <Box marginBottom={1}>
            <Text bold color="red">
              ❌ Something went wrong
            </Text>
          </Box>

          <Box marginBottom={1} borderStyle="single" paddingX={1}>
            <Text color="red">{this.state.error?.message}</Text>
          </Box>

          {this.props.onReset && (
            <Box marginTop={1}>
              <Text>Press R to retry or Esc to exit</Text>
            </Box>
          )}
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
