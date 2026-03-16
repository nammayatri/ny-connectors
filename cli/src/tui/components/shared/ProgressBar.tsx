/**
 * ProgressBar Component
 * Visual progress indicator for wizard steps
 */

import React from 'react';
import { Box, Text } from 'ink';

interface StepInfo {
  key: string;
  label: string;
}

interface ProgressBarProps {
  steps: StepInfo[];
  currentStep: string;
  showLabels?: boolean;
}

export function ProgressBar({ steps, currentStep, showLabels = true }: ProgressBarProps): React.ReactElement {
  const currentIndex = steps.findIndex(s => s.key === currentStep);
  
  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Visual progress bar */}
      <Box alignItems="center">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;
          
          return (
            <React.Fragment key={step.key}>
              {/* Step indicator */}
              <Box>
                <Text
                  bold={isCurrent}
                  color={isCompleted ? 'green' : isCurrent ? 'cyan' : 'gray'}
                >
                  {isCompleted ? '●' : isCurrent ? '○' : '○'}
                </Text>
              </Box>
              
              {/* Connector line */}
              {index < steps.length - 1 && (
                <Text color={isCompleted ? 'green' : 'gray'}>
                  {' '}
                  {isCompleted ? '───' : '---'}
                  {' '}
                </Text>
              )}
            </React.Fragment>
          );
        })}
      </Box>
      
      {/* Step labels */}
      {showLabels && (
        <Box marginTop={1}>
          <Text dimColor>
            Step {currentIndex + 1} of {steps.length}: {steps[currentIndex]?.label || 'Unknown'}
          </Text>
        </Box>
      )}
    </Box>
  );
}