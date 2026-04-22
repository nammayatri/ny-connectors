import { NYPlaceDetails, NYEstimate, NYSavedLocation } from '../ny';
import { SupportedLanguage } from '../i18n';

export type FlowState =
  | 'IDLE'
  | 'AWAITING_CONTACT'
  | 'AWAITING_PHONE'
  | 'AWAITING_ORIGIN'
  | 'CONFIRMING_ORIGIN'
  | 'AWAITING_DESTINATION'
  | 'CONFIRMING_DESTINATION'
  | 'SEARCHING_RIDES'
  | 'SHOWING_ESTIMATES'
  | 'BOOKING'
  | 'TRACKING'
  | 'CONFIRMING_CANCEL'
  | 'CONFIRMING_SOS'
  | 'CONFIRMING_MARK_SAFE'
  | 'AWAITING_ADD_LOCATION'
  | 'CONFIRMING_ADD_LOCATION'
  | 'CHOOSING_LANGUAGE'
  | 'AWAITING_OTP'
  | 'AWAITING_NAME';

export interface FlowContext {
  state: FlowState;
  nyToken?: string;
  personId?: string;        // from auth response person.id
  savedLocations?: NYSavedLocation[];
  phone?: string;
  origin?: NYPlaceDetails;
  originTag?: string;
  destination?: NYPlaceDetails;
  originOptions?: { description: string; placeId: string }[];
  destinationOptions?: { description: string; placeId: string }[];
  searchId?: string;
  estimates?: NYEstimate[];
  selectedEstimateId?: string;
  selectedServiceTier?: string;   // serviceTierName of last chosen vehicle, for retry
  activeBookingId?: string;
  selectStartedAt?: string;   // ISO timestamp just before selectEstimate — used to filter listV2 results
  cancelRequested?: boolean;
  sosId?: string;
  addingLocationTag?: string;
  addLocationOptions?: { description: string; placeId: string }[];
  language?: SupportedLanguage;
  authId?: string;             // from POST /v2/auth during registration
}

export const INITIAL_CONTEXT: FlowContext = {
  state: 'IDLE',
};
