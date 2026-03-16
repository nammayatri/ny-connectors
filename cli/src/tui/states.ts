/**
 * Wizard State Machine
 * Manages navigation and state transitions for the booking wizard
 */

// Wizard Steps
export type WizardStep = 
  | 'auth'        // Authentication screen
  | 'pickup'      // Select pickup location
  | 'drop'        // Select drop location
  | 'variant'     // Select ride variant
  | 'confirm'     // Confirm booking details
  | 'tracking';   // Track ride status

// Step configuration
export interface StepConfig {
  key: WizardStep;
  label: string;
  description: string;
  requiresAuth: boolean;
  canGoBack: boolean;
}

// Step definitions
export const WIZARD_STEPS: StepConfig[] = [
  { key: 'auth', label: 'Authentication', description: 'Sign in with your phone', requiresAuth: false, canGoBack: false },
  { key: 'pickup', label: 'Pickup Location', description: 'Where should we pick you up?', requiresAuth: true, canGoBack: true },
  { key: 'drop', label: 'Drop Location', description: 'Where are you going?', requiresAuth: true, canGoBack: true },
  { key: 'variant', label: 'Ride Variant', description: 'Choose your ride', requiresAuth: true, canGoBack: true },
  { key: 'confirm', label: 'Confirm', description: 'Review and confirm booking', requiresAuth: true, canGoBack: true },
  { key: 'tracking', label: 'Tracking', description: 'Track your ride', requiresAuth: true, canGoBack: false },
];

// State for each step
export interface AuthState {
  mobile: string;
  accessCode: string;
  isAuthenticating: boolean;
  error: string | null;
}

export interface LocationState {
  searchQuery: string;
  selectedLat: number | null;
  selectedLon: number | null;
  selectedName: string;
  isSearching: boolean;
  error: string | null;
}

export interface VariantState {
  estimates: RideEstimateInfo[];
  selectedEstimateId: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface RideEstimateInfo {
  id: string;
  vehicleVariant: string;
  serviceTierName: string;
  providerName: string;
  estimatedFare: number;
  currency: string;
  minFare?: number;
  maxFare?: number;
  estimatedPickupDuration?: number;
}

export interface ConfirmState {
  isBooking: boolean;
  bookingId: string | null;
  error: string | null;
}

export interface TrackingState {
  rideStatus: string;
  driverName: string | null;
  driverPhone: string | null;
  vehicleNumber: string | null;
  otp: string | null;
  isPolling: boolean;
  error: string | null;
}

// Main wizard state
export interface WizardState {
  currentStep: WizardStep;
  previousStep: WizardStep | null;
  isAuthenticated: boolean;
  
  // Step-specific state
  auth: AuthState;
  pickup: LocationState;
  drop: LocationState;
  variant: VariantState;
  confirm: ConfirmState;
  tracking: TrackingState;
}

// Initial states
const initialAuthState: AuthState = {
  mobile: '',
  accessCode: '',
  isAuthenticating: false,
  error: null,
};

const initialLocationState: LocationState = {
  searchQuery: '',
  selectedLat: null,
  selectedLon: null,
  selectedName: '',
  isSearching: false,
  error: null,
};

const initialVariantState: VariantState = {
  estimates: [],
  selectedEstimateId: null,
  isLoading: false,
  error: null,
};

const initialConfirmState: ConfirmState = {
  isBooking: false,
  bookingId: null,
  error: null,
};

const initialTrackingState: TrackingState = {
  rideStatus: 'PENDING',
  driverName: null,
  driverPhone: null,
  vehicleNumber: null,
  otp: null,
  isPolling: false,
  error: null,
};

// Initial wizard state
export const initialWizardState: WizardState = {
  currentStep: 'auth',
  previousStep: null,
  isAuthenticated: false,
  auth: initialAuthState,
  pickup: initialLocationState,
  drop: initialLocationState,
  variant: initialVariantState,
  confirm: initialConfirmState,
  tracking: initialTrackingState,
};

// Action types
export type WizardAction =
  | { type: 'SET_STEP'; payload: WizardStep }
  | { type: 'GO_BACK' }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'UPDATE_AUTH'; payload: Partial<AuthState> }
  | { type: 'UPDATE_PICKUP'; payload: Partial<LocationState> }
  | { type: 'UPDATE_DROP'; payload: Partial<LocationState> }
  | { type: 'UPDATE_VARIANT'; payload: Partial<VariantState> }
  | { type: 'UPDATE_CONFIRM'; payload: Partial<ConfirmState> }
  | { type: 'UPDATE_TRACKING'; payload: Partial<TrackingState> }
  | { type: 'RESET_WIZARD' }
  | { type: 'RESET_STEP'; payload: WizardStep };

// Reducer
export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP': {
      const stepConfig = WIZARD_STEPS.find(s => s.key === action.payload);
      // Check if step requires auth
      if (stepConfig?.requiresAuth && !state.isAuthenticated) {
        return {
          ...state,
          previousStep: state.currentStep,
          currentStep: 'auth',
        };
      }
      return {
        ...state,
        previousStep: state.currentStep,
        currentStep: action.payload,
      };
    }

    case 'GO_BACK': {
      const currentConfig = WIZARD_STEPS.find(s => s.key === state.currentStep);
      if (!currentConfig?.canGoBack || !state.previousStep) {
        return state;
      }
      return {
        ...state,
        currentStep: state.previousStep,
        previousStep: state.currentStep,
      };
    }

    case 'SET_AUTHENTICATED':
      return {
        ...state,
        isAuthenticated: action.payload,
      };

    case 'UPDATE_AUTH':
      return {
        ...state,
        auth: { ...state.auth, ...action.payload },
      };

    case 'UPDATE_PICKUP':
      return {
        ...state,
        pickup: { ...state.pickup, ...action.payload },
      };

    case 'UPDATE_DROP':
      return {
        ...state,
        drop: { ...state.drop, ...action.payload },
      };

    case 'UPDATE_VARIANT':
      return {
        ...state,
        variant: { ...state.variant, ...action.payload },
      };

    case 'UPDATE_CONFIRM':
      return {
        ...state,
        confirm: { ...state.confirm, ...action.payload },
      };

    case 'UPDATE_TRACKING':
      return {
        ...state,
        tracking: { ...state.tracking, ...action.payload },
      };

    case 'RESET_WIZARD':
      return {
        ...initialWizardState,
        isAuthenticated: state.isAuthenticated,
        auth: state.isAuthenticated ? { ...initialAuthState } : state.auth,
      };

    case 'RESET_STEP': {
      switch (action.payload) {
        case 'auth':
          return { ...state, auth: initialAuthState };
        case 'pickup':
          return { ...state, pickup: initialLocationState };
        case 'drop':
          return { ...state, drop: initialLocationState };
        case 'variant':
          return { ...state, variant: initialVariantState };
        case 'confirm':
          return { ...state, confirm: initialConfirmState };
        case 'tracking':
          return { ...state, tracking: initialTrackingState };
        default:
          return state;
      }
    }

    default:
      return state;
  }
}

// Helper functions
export function getNextStep(currentStep: WizardStep): WizardStep | null {
  const currentIndex = WIZARD_STEPS.findIndex(s => s.key === currentStep);
  if (currentIndex < 0 || currentIndex >= WIZARD_STEPS.length - 1) {
    return null;
  }
  return WIZARD_STEPS[currentIndex + 1].key;
}

export function getPreviousStep(currentStep: WizardStep): WizardStep | null {
  const currentIndex = WIZARD_STEPS.findIndex(s => s.key === currentStep);
  if (currentIndex <= 0) {
    return null;
  }
  return WIZARD_STEPS[currentIndex - 1].key;
}

export function getStepIndex(step: WizardStep): number {
  return WIZARD_STEPS.findIndex(s => s.key === step);
}

export function getStepConfig(step: WizardStep): StepConfig | undefined {
  return WIZARD_STEPS.find(s => s.key === step);
}

export function canNavigateToStep(
  targetStep: WizardStep,
  isAuthenticated: boolean
): boolean {
  const stepConfig = getStepConfig(targetStep);
  if (!stepConfig) return false;
  if (stepConfig.requiresAuth && !isAuthenticated) return false;
  return true;
}