import { NYPlaceDetails, NYSavedLocation } from '../ny';
import { SupportedLanguage } from '../i18n';

export type FlowState =
  | 'IDLE'
  | 'AWAITING_PICKUP'
  | 'CONFIRMING_PICKUP'
  | 'FLEXI_SEARCHING'
  | 'AWAITING_REGULAR_DROP'
  | 'CONFIRMING_REGULAR_DROP'
  | 'CONFIRMING_REGULAR_FARE'
  | 'REGULAR_SEARCHING'
  | 'TRACKING'
  | 'CONFIRMING_SOS'
  | 'CONFIRMING_MARK_SAFE'
  | 'CHOOSING_LANGUAGE'
  | 'AWAITING_OTP';

export interface FlowContext {
  state: FlowState;
  nyToken?: string;
  personId?: string;        // from auth response person.id
  savedLocations?: NYSavedLocation[];
  phone?: string;
  origin?: NYPlaceDetails;
  destination?: NYPlaceDetails;
  destinationOptions?: { description: string; placeId: string }[];
  activeBookingId?: string;
  selectStartedAt?: string;   // ISO timestamp just before selectEstimate — used to filter listV2 results
  cancelRequested?: boolean;
  sosId?: string;
  language?: SupportedLanguage;
  authId?: string;             // from POST /v2/auth during registration
  pendingAction?: 'status' | 'book';  // deferred action to run after authentication (registration)
  rideType?: 'flexi' | 'regular';  // chosen ride type for this booking (friction-free merchants)
  // Flexi (location-only metered booking)
  flexiSearchId?: string;
  flexiQuoteId?: string;
  flexiBookingId?: string;
  // The chosen quote's fare metadata, captured at pickup-share so the confirm
  // prompt + "finding" message can state it and so we can detect an expired quote.
  flexiQuote?: { fareBreakup?: Record<string, number>; startingFare?: number; validTill?: string; capturedAt?: string };
  // Regular (friction-free one-way auto: pickup + drop → estimate → book)
  regularSearchId?: string;
  regularEstimateId?: string;
  regularFare?: number;
}

export const INITIAL_CONTEXT: FlowContext = {
  state: 'IDLE',
};
