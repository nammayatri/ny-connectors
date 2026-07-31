export type SupportedLanguage = 'en' | 'hi' | 'gu' | 'kn' | 'ta' | 'te';

export interface LanguageStrings {
  // Language metadata
  languageName: string;        // e.g. "English"
  nativeLanguageName: string;  // e.g. "English", "हिन्दी"

  // Welcome & menu
  bookARide: string;
  trackRide: string;
  chooseLanguage: string;
  selectLanguage: string;
  languageUpdated: (lang: string) => string;
  moreLanguages: string;

  // Auth flow
  setupFailed: (err: string) => string;

  // Registration (OTP-based)
  personNotFound: string;
  otpSent: string;
  invalidOtp: string;
  resendOtp: string;
  otpResent: string;
  otpResendFailed: (err: string) => string;
  otpVerified: string;
  otpVerifyFailed: (err: string) => string;

  // Origin & destination
  noPlacesFound: string;

  // Ride search & estimates

  // Booking
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
  mainMenu: string;

  // Status
  activeRide: string;
  noActiveRidesBook: string;

  // Cancel
  cancelConfirm: string;
  cancelConfirmWithDriver: (driver: string, vehicle?: string) => string;
  yesCancelIt: string;
  noKeepIt: string;
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

  // Flexi (location-only metered booking)
  welcome: string;
  flexiSharePrompt: string;
  // Pre-booking fare shown at the pickup-confirm prompt + re-stated in "finding".
  flexiFareBreakup: (base?: number, perKm?: number, nightMult?: number, nightWindow?: string) => string;
  // Neutral fallback when a quote carries no rate-card breakup (only a headline fare).
  flexiFareFrom: (amount: number) => string;
  flexiConfirmPickup: (address: string, fareLine?: string) => string;
  pickupConfirmButton: string;
  pickupAdjustButton: string;
  flexiFinding: string;
  flexiStillFinding: string;
  flexiCancelSearch: string;
  flexiFoundDriver: (name: string) => string;
  flexiDriverMeta: (rating: number, etaMin: number) => string;
  flexiOtpShare: (otp: string) => string;
  flexiCallDriver: (phone: string) => string;
  flexiSafetyNote: string;
  flexiNoAuto: string;
  flexiTryAgain: string;
  flexiOutOfArea: (area: string) => string;
  // Flexi ride-progress updates (pushed by the background tracker)
  flexiArrived: (otp: string) => string;
  flexiFareUnavailable: string;
  // Ride-finished message, assembled from atoms: header + pay-the-driver line +
  // optional distance line + the app-download nudge.
  flexiRideFinishedHeader: string;
  flexiPayDriver: (amount: number) => string;
  flexiDistanceLine: (km: number) => string;
  flexiRideCancelled: string;
  flexiBookAnother: string;
  // App-download nudge, appended to the ride-finished, Track-Ride status,
  // SOS-confirm, and Support surfaces.
  appDownloadNudge: string;
  // Flexi "hi" menu — More drawer + how-it-works + support
  moreButton: string;
  moreTitle: string;
  howItWorks: string;
  contactSupport: string;
  howItWorksText: string;
  howItWorksCaption: string;
  supportMessage: (phone: string) => string;
  // Ride-type chooser (merchant offers both Flexi + Regular) + generic ride-started
  rideTypePrompt: string;
  rideTypeFlexi: string;
  rideTypeRegular: string;
  rideStartedSimple: string;
  // Regular one-way flow (pickup + drop → auto fare → book)
  regularDropPrompt: string;
  regularSelectDrop: string;
  regularFareConfirm: (fare: number, area: string) => string;
  regularConfirmButton: string;
  regularChangeDropButton: string;
  regularSearching: string;
  regularBooking: string;

  // Errors
  somethingWentWrong: string;
  sessionExpired: string;
  error: (msg: string) => string;
}
