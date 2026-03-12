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
  | 'TRACKING';

export interface FlowContext {
  state: FlowState;
  nyToken?: string;
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
}

export const INITIAL_CONTEXT: FlowContext = {
  state: 'IDLE',
};
