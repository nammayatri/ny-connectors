import { NYPlaceDetails, NYEstimate, NYSavedLocation } from '../ny';

export type FlowState =
  | 'IDLE'
  | 'AWAITING_CONTACT'
  | 'AWAITING_PHONE'
  | 'AWAITING_ACCESS_CODE'
  | 'AWAITING_ORIGIN'
  | 'CONFIRMING_ORIGIN'
  | 'AWAITING_DESTINATION'
  | 'CONFIRMING_DESTINATION'
  | 'SEARCHING_RIDES'
  | 'SHOWING_ESTIMATES'
  | 'BOOKING'
  | 'TRACKING'
  | 'CONFIRMING_CANCEL';

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
}

export const INITIAL_CONTEXT: FlowContext = {
  state: 'IDLE',
};
