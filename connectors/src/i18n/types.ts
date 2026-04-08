export type SupportedLanguage = 'en' | 'hi' | 'gu' | 'kn' | 'ta' | 'te';

export interface LanguageStrings {
  // Language metadata
  languageName: string;        // e.g. "English"
  nativeLanguageName: string;  // e.g. "English", "हिन्दी"

  // Welcome & menu
  welcomeMessage: string;
  welcomeBack: string;
  bookARide: string;
  trackRide: string;
  chooseLanguage: string;
  selectLanguage: string;
  languageUpdated: (lang: string) => string;
  moreLanguages: string;

  // Auth flow
  needSignIn: string;
  enterPhone: string;
  invalidPhone: string;
  enterAccessCode: string;
  authSuccess: string;
  authSuccessFirstTime: string;
  setupFailed: (err: string) => string;
  authFailed: (err: string) => string;
  sharePhone: string;
  shareOwnPhone: string;
  sharePhonePrompt: string;
  couldNotReadPhone: string;
  allSet: string;

  // Origin & destination
  whereToGo: string;
  whereToGoWithRoutes: string;
  enterPickupAndDrop: string;
  enterPickupPrompt: string;
  enterDropPrompt: string;
  locationPinReceived: string;
  favouriteLocations: string;
  addHome: string;
  addWork: string;
  enterHomeAddress: string;
  enterWorkAddress: string;
  selectLocationFor: (tag: string) => string;
  locationSaved: (tag: string) => string;
  locationSaveFailed: string;
  fromHome: string;
  fromWork: string;
  moreOptions: string;
  pickSavedOrType: string;
  typePickupPlace: string;
  selectPickup: string;
  searchAgain: string;
  pickup: (place: string) => string;
  whereTo: string;
  whereToWithSaved: string;
  typeDropPlace: string;
  selectDrop: string;
  drop: (place: string) => string;
  noPlacesFound: string;
  invalidChoice: (max: number) => string;
  couldNotFindLocations: string;
  fromLabel: (tag: string) => string;

  // Ride search & estimates
  searchingRides: string;
  noRidesAvailable: string;
  noRidesAvailableRetry: string;
  activeRideExists: string;
  basedOnPastRides: string;
  availableRides: string;
  availableRidesForRoute: string;

  // Booking
  booking: (tier: string, fare: number) => string;
  stillSearching: (elapsed: number) => string;
  rideConfirmed: string;
  rideBooked: string;
  waitingForDriver: string;
  trackYourRide: string;
  track: string;
  callDriver: string;
  cancelRide: string;
  driverLabel: (name: string) => string;
  vehicleLabel: (number: string) => string;
  phoneLabel: (phone: string) => string;
  otpLabel: (otp: string) => string;
  driverPhone: (phone: string) => string;
  driverDetailsNotAvailable: string;
  noActiveRide: string;

  // No driver found
  noDriverFound: (tier: string) => string;
  retrySameVehicle: string;
  tryDifferentVehicle: string;
  mainMenu: string;
  retrying: (tier: string) => string;
  tierNotAvailable: (tier: string) => string;
  tryAgain: string;

  // Status
  activeRide: string;
  noActiveRides: string;
  noActiveRidesBook: string;

  // Cancel
  cancelConfirm: string;
  cancelConfirmWithDriver: (driver: string, vehicle?: string) => string;
  yesCancelIt: string;
  noKeepIt: string;
  rideSearchCancelled: string;
  rideCancelled: string;
  rideCompleted: string;
  rideAlreadyCancelled: string;
  rideInProgress: string;
  cancelFailed: (err: string) => string;
  cancelled: string;
  whatToDo: string;

  // SOS & safety
  rideNotStarted: string;
  rideInProgressStatus: string;
  sosButton: string;
  call112Button: string;
  sosConfirm: string;
  yesTriggerSOS: string;
  noGoBack: string;
  sosTriggered: string;
  sosFailed: (err: string) => string;
  markSafeButton: string;
  markSafeConfirm: string;
  yesMarkSafe: string;
  markedSafe: string;
  markSafeFailed: (err: string) => string;

  // Errors
  somethingWentWrong: string;
  sessionExpired: string;
  error: (msg: string) => string;
  rideBeingBooked: string;
}
