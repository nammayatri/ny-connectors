// ============================================================================
// State Machine Hook for Wizard Flow
// ============================================================================

import { useState, useCallback } from 'react';

export type StateTransition<TState extends string, TContext> =
  | TState
  | { state: TState; context?: Partial<TContext> };

export interface StateMachineConfig<TState extends string, TContext> {
  initialState: TState;
  initialContext: TContext;
}

export interface StateMachine<TState extends string, TContext> {
  state: TState;
  context: TContext;
  transition: (transition: StateTransition<TState, TContext>) => void;
  updateContext: (updates: Partial<TContext>) => void;
  setContext: (context: TContext) => void;
}

export function useStateMachine<TState extends string, TContext>(
  config: StateMachineConfig<TState, TContext>
): StateMachine<TState, TContext> {
  const [state, setState] = useState<TState>(config.initialState);
  const [context, setContextState] = useState<TContext>(config.initialContext);

  const transition = useCallback(
    (transition: StateTransition<TState, TContext>) => {
      if (typeof transition === 'string') {
        setState(transition);
      } else {
        setState(transition.state);
        if (transition.context) {
          setContextState((prev) => ({ ...prev, ...transition.context }));
        }
      }
    },
    []
  );

  const updateContext = useCallback((updates: Partial<TContext>) => {
    setContextState((prev) => ({ ...prev, ...updates }));
  }, []);

  const setContext = useCallback((newContext: TContext) => {
    setContextState(newContext);
  }, []);

  return {
    state,
    context,
    transition,
    updateContext,
    setContext,
  };
}
