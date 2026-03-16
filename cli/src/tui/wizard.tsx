/**
 * Wizard Context
 * Combines state machine with navigation for the booking wizard
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import {
  WizardState,
  WizardAction,
  WizardStep,
  wizardReducer,
  initialWizardState,
  WIZARD_STEPS,
  RideEstimateInfo,
} from './states.js';
import { useNavigation } from './navigation.js';
import { apiClient, PlacePrediction, SavedLocation } from '../api/index.js';

// Wizard context types
interface WizardContextValue {
  // State
  state: WizardState;
  
  // Navigation
  currentStep: WizardStep;
  stepConfig: typeof WIZARD_STEPS[0] | undefined;
  stepIndex: number;
  totalSteps: number;
  
  // Actions
  dispatch: React.Dispatch<WizardAction>;
  goToStep: (step: WizardStep) => void;
  goBack: () => void;
  nextStep: () => void;
  reset: () => void;
  
  // Data operations
  searchPlaces: (query: string, type: 'pickup' | 'drop') => Promise<PlacePrediction[]>;
  selectPickup: (prediction: PlacePrediction) => Promise<void>;
  selectDrop: (prediction: PlacePrediction) => Promise<void>;
  selectSavedLocation: (location: SavedLocation, type: 'pickup' | 'drop') => Promise<void>;
  searchRides: () => Promise<void>;
  selectEstimate: (estimateId: string) => void;
  confirmBooking: () => Promise<void>;
  pollRideStatus: () => Promise<void>;
  
  // Saved locations
  savedLocations: SavedLocation[];
  refreshSavedLocations: () => Promise<void>;
}

// Create context
const WizardContext = createContext<WizardContextValue | null>(null);

// Provider props
interface WizardProviderProps {
  children: React.ReactNode;
  isAuthenticated?: boolean;
  onComplete?: () => void;
}

// Wizard provider component
export function WizardProvider({
  children,
  isAuthenticated = false,
  onComplete,
}: WizardProviderProps): React.ReactElement {
  const [state, dispatch] = useReducer(wizardReducer, {
    ...initialWizardState,
    isAuthenticated,
    currentStep: isAuthenticated ? 'pickup' : 'auth',
  });
  
  const { navigateToStep, goBack: navGoBack } = useNavigation();
  const [savedLocations, setSavedLocations] = React.useState<SavedLocation[]>([]);
  
  // Load saved locations on mount
  useEffect(() => {
    const loadSavedLocations = async () => {
      try {
        const locations = await apiClient.getSavedLocations();
        setSavedLocations(locations);
      } catch {
        // Use cached version
        const cached = apiClient.getSavedLocationsFromCache();
        setSavedLocations(cached);
      }
    };
    
    if (isAuthenticated) {
      loadSavedLocations();
    }
  }, [isAuthenticated]);
  
  // Step info
  const currentStep = state.currentStep;
  const stepConfig = WIZARD_STEPS.find(s => s.key === currentStep);
  const stepIndex = WIZARD_STEPS.findIndex(s => s.key === currentStep);
  const totalSteps = WIZARD_STEPS.length;
  
  // Navigation actions
  const goToStep = useCallback((step: WizardStep) => {
    dispatch({ type: 'SET_STEP', payload: step });
    navigateToStep(step);
  }, [navigateToStep]);
  
  const goBack = useCallback(() => {
    dispatch({ type: 'GO_BACK' });
    navGoBack();
  }, [navGoBack]);
  
  const nextStep = useCallback(() => {
    const nextStepKey = WIZARD_STEPS[stepIndex + 1]?.key;
    if (nextStepKey) {
      goToStep(nextStepKey);
    }
  }, [stepIndex, goToStep]);
  
  const reset = useCallback(() => {
    dispatch({ type: 'RESET_WIZARD' });
  }, []);
  
  // Data operations
  const searchPlaces = useCallback(async (query: string, type: 'pickup' | 'drop') => {
    const updateAction = type === 'pickup' 
      ? { type: 'UPDATE_PICKUP' as const, payload: { isSearching: true, searchQuery: query } }
      : { type: 'UPDATE_DROP' as const, payload: { isSearching: true, searchQuery: query } };
    
    dispatch(updateAction);
    
    try {
      const sourceLat = state.pickup.selectedLat || 12.9741;
      const sourceLon = state.pickup.selectedLon || 77.5853;
      const predictions = await apiClient.searchPlaces(query, sourceLat, sourceLon);
      
      const clearAction = type === 'pickup'
        ? { type: 'UPDATE_PICKUP' as const, payload: { isSearching: false } }
        : { type: 'UPDATE_DROP' as const, payload: { isSearching: false } };
      dispatch(clearAction);
      
      return predictions;
    } catch (error) {
      const errorAction = type === 'pickup'
        ? { type: 'UPDATE_PICKUP' as const, payload: { isSearching: false, error: (error as Error).message } }
        : { type: 'UPDATE_DROP' as const, payload: { isSearching: false, error: (error as Error).message } };
      dispatch(errorAction);
      return [];
    }
  }, [state.pickup.selectedLat, state.pickup.selectedLon]);
  
  const selectPickup = useCallback(async (prediction: PlacePrediction) => {
    dispatch({ type: 'UPDATE_PICKUP', payload: { isSearching: true, error: null } });
    
    try {
      const details = await apiClient.getPlaceDetails(prediction.placeId);
      dispatch({
        type: 'UPDATE_PICKUP',
        payload: {
          selectedLat: details.lat,
          selectedLon: details.lon,
          selectedName: prediction.description,
          isSearching: false,
        },
      });
      nextStep();
    } catch (error) {
      dispatch({
        type: 'UPDATE_PICKUP',
        payload: { isSearching: false, error: (error as Error).message },
      });
    }
  }, [nextStep]);
  
  const selectDrop = useCallback(async (prediction: PlacePrediction) => {
    dispatch({ type: 'UPDATE_DROP', payload: { isSearching: true, error: null } });
    
    try {
      const details = await apiClient.getPlaceDetails(prediction.placeId);
      dispatch({
        type: 'UPDATE_DROP',
        payload: {
          selectedLat: details.lat,
          selectedLon: details.lon,
          selectedName: prediction.description,
          isSearching: false,
        },
      });
      
      // Automatically start ride search
      await searchRidesInternal(
        state.pickup.selectedLat!,
        state.pickup.selectedLon!,
        details.lat,
        details.lon
      );
    } catch (error) {
      dispatch({
        type: 'UPDATE_DROP',
        payload: { isSearching: false, error: (error as Error).message },
      });
    }
  }, [state.pickup.selectedLat, state.pickup.selectedLon]);
  
  const selectSavedLocation = useCallback(async (
    location: SavedLocation,
    type: 'pickup' | 'drop'
  ) => {
    const updatePayload = {
      selectedLat: location.lat,
      selectedLon: location.lon,
      selectedName: location.tag + (location.locationName ? ` - ${location.locationName}` : ''),
      searchQuery: '',
    };
    
    if (type === 'pickup') {
      dispatch({ type: 'UPDATE_PICKUP', payload: updatePayload });
      nextStep();
    } else {
      dispatch({ type: 'UPDATE_DROP', payload: updatePayload });
      await searchRidesInternal(
        state.pickup.selectedLat!,
        state.pickup.selectedLon!,
        location.lat,
        location.lon
      );
    }
  }, [nextStep, state.pickup.selectedLat, state.pickup.selectedLon]);
  
  const searchRidesInternal = useCallback(async (
    originLat: number,
    originLon: number,
    destLat: number,
    destLon: number
  ) => {
    dispatch({ type: 'UPDATE_VARIANT', payload: { isLoading: true, error: null } });
    goToStep('variant');
    
    try {
      const searchId = await apiClient.searchRides(originLat, originLon, destLat, destLon);
      const estimates = await apiClient.pollSearchResults(searchId);
      
      const estimateInfos: RideEstimateInfo[] = estimates.map(e => ({
        id: e.id,
        vehicleVariant: e.vehicleVariant,
        serviceTierName: e.serviceTierName,
        providerName: e.providerName,
        estimatedFare: e.estimatedTotalFareWithCurrency.amount,
        currency: e.estimatedTotalFareWithCurrency.currency,
        minFare: e.totalFareRange?.minFare,
        maxFare: e.totalFareRange?.maxFare,
        estimatedPickupDuration: e.estimatedPickupDuration,
      }));
      
      dispatch({
        type: 'UPDATE_VARIANT',
        payload: { estimates: estimateInfos, isLoading: false },
      });
    } catch (error) {
      dispatch({
        type: 'UPDATE_VARIANT',
        payload: { isLoading: false, error: (error as Error).message },
      });
    }
  }, [goToStep]);
  
  const searchRides = useCallback(async () => {
    if (!state.pickup.selectedLat || !state.pickup.selectedLon || 
        !state.drop.selectedLat || !state.drop.selectedLon) {
      return;
    }
    
    await searchRidesInternal(
      state.pickup.selectedLat,
      state.pickup.selectedLon,
      state.drop.selectedLat,
      state.drop.selectedLon
    );
  }, [state.pickup.selectedLat, state.pickup.selectedLon, state.drop.selectedLat, state.drop.selectedLon, searchRidesInternal]);
  
  const selectEstimate = useCallback((estimateId: string) => {
    dispatch({ type: 'UPDATE_VARIANT', payload: { selectedEstimateId: estimateId } });
    goToStep('confirm');
  }, [goToStep]);
  
  const confirmBooking = useCallback(async () => {
    const estimateId = state.variant.selectedEstimateId;
    if (!estimateId) return;
    
    dispatch({ type: 'UPDATE_CONFIRM', payload: { isBooking: true, error: null } });
    
    try {
      await apiClient.selectEstimate(estimateId);
      const booking = await apiClient.pollForDriverAssignment();
      
      dispatch({
        type: 'UPDATE_CONFIRM',
        payload: {
          isBooking: false,
          bookingId: booking?.id || null,
        },
      });
      
      // Move to tracking
      goToStep('tracking');
      
      // Start polling for status
      await pollRideStatusInternal();
    } catch (error) {
      dispatch({
        type: 'UPDATE_CONFIRM',
        payload: { isBooking: false, error: (error as Error).message },
      });
    }
  }, [state.variant.selectedEstimateId, goToStep]);
  
  const pollRideStatusInternal = useCallback(async () => {
    dispatch({ type: 'UPDATE_TRACKING', payload: { isPolling: true } });
    
    try {
      const rides = await apiClient.getRideStatus(true);
      if (rides.length > 0) {
        const ride = rides[0];
        dispatch({
          type: 'UPDATE_TRACKING',
          payload: {
            rideStatus: ride.status,
            driverName: ride.driverName || null,
            driverPhone: ride.driverNumber || null,
            vehicleNumber: ride.vehicleNumber || null,
            isPolling: false,
          },
        });
      }
    } catch (error) {
      dispatch({
        type: 'UPDATE_TRACKING',
        payload: { isPolling: false, error: (error as Error).message },
      });
    }
  }, []);
  
  const pollRideStatus = useCallback(async () => {
    await pollRideStatusInternal();
  }, [pollRideStatusInternal]);
  
  const refreshSavedLocations = useCallback(async () => {
    try {
      const locations = await apiClient.getSavedLocations();
      setSavedLocations(locations);
    } catch {
      // Keep existing locations
    }
  }, []);
  
  const value: WizardContextValue = {
    state,
    currentStep,
    stepConfig,
    stepIndex,
    totalSteps,
    dispatch,
    goToStep,
    goBack,
    nextStep,
    reset,
    searchPlaces,
    selectPickup,
    selectDrop,
    selectSavedLocation,
    searchRides,
    selectEstimate,
    confirmBooking,
    pollRideStatus,
    savedLocations,
    refreshSavedLocations,
  };
  
  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
}

// Hook to use wizard context
export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}

// Hook for specific step state
export function useStepState<K extends keyof WizardState>(
  step: K
): WizardState[K] {
  const { state } = useWizard();
  return state[step];
}