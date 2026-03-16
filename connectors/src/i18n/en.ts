import { LanguageStrings } from './types';

export const en: LanguageStrings = {
  languageName: 'English',
  nativeLanguageName: 'English',

  // Welcome & menu
  welcomeMessage: "👋 Welcome! I'm your Namma Yatri ride assistant.\n\nWhat would you like to do?",
  welcomeBack: '👋 Welcome back! What would you like to do?',
  bookARide: '🚕 Book a Ride',
  trackRide: '📍 Track Ride',
  chooseLanguage: '🌐 Language',
  selectLanguage: '🌐 Choose your preferred language:',
  languageUpdated: (lang: string) => `✅ Language changed to *${lang}*.`,
  moreLanguages: '➕ More languages',

  // Auth flow
  needSignIn: '🔐 You need to be signed in to track a ride.\n\nWould you like to book a ride instead?',
  enterPhone: 'First time? Enter your 10-digit mobile number:',
  invalidPhone: 'Invalid phone number. Enter a valid 10-digit number:',
  enterAccessCode: 'Enter your access code (Namma Yatri app > Profile > About Us):',
  authSuccess: "You're all set! You won't need to do this again.",
  authSuccessFirstTime: "You're all set! Let's book a ride.",
  setupFailed: (err: string) => `Setup failed: ${err}\nSend "book" to try again.`,
  authFailed: (err: string) => `Authentication failed: ${err}\nEnter your phone number to try again:`,
  sharePhone: 'Please tap the button below to share your phone number.',
  shareOwnPhone: "Please share your own phone number, not someone else's.",
  sharePhonePrompt: 'Tap the button to share your number:',
  couldNotReadPhone: 'Could not read your phone number. Please try again.',
  allSet: "You're all set! Let's book a ride.",

  // Origin & destination
  whereToGo: 'Where would you like to go?',
  whereToGoWithRoutes: 'Where would you like to go?\n\nQuick routes or pick a location.\nYou can also type a place name:',
  moreOptions: '➕ More options',
  pickSavedOrType: 'Pick a saved location or type a place name:',
  typePickupPlace: 'Where are you picking up from?\nType a place name to search:',
  selectPickup: 'Select pickup location:',
  pickup: (place: string) => `Pickup: ${place}`,
  whereTo: 'Where to?\nType a place name to search:',
  typeDropPlace: 'Where to?\nType a place name to search:',
  whereToWithSaved: 'Where to?\n\nPick a location or type a place name:',
  selectDrop: 'Select drop location:',
  drop: (place: string) => `Drop: ${place}`,
  noPlacesFound: 'No places found. Try a different search:',
  invalidChoice: (max: number) => `Invalid choice. Pick 1-${max}:`,
  couldNotFindLocations: 'Could not find those locations. Send "book" to try again.',
  fromLabel: (tag: string) => `📍 From: ${tag}`,

  // Ride search & estimates
  searchingRides: 'Searching for rides...',
  noRidesAvailable: 'No rides available right now. Send "book" to retry.',
  noRidesAvailableRetry: '😔 No rides available right now. What would you like to do?',
  basedOnPastRides: '🕐 Based on your past rides:',
  availableRides: 'Available rides:',
  availableRidesForRoute: 'Here are the available rides for your route:',

  // Booking
  booking: (tier: string, fare: number) => `Booking ${tier} (₹${fare})...`,
  stillSearching: (elapsed: number) => `⏳ Still searching for a driver nearby... (${elapsed}s)\n\nSend "cancel" to stop.`,
  rideConfirmed: '🎉 Ride confirmed!\n',
  rideBooked: '✅ Ride booked!',
  waitingForDriver: 'Waiting for driver assignment...',
  trackYourRide: '📲 Track your ride:',
  track: '📲 Track:',
  callDriver: '📞 Call Driver',
  cancelRide: '❌ Cancel Ride',
  driverLabel: (name: string) => `👤 Driver: *${name}*`,
  vehicleLabel: (number: string) => `🔢 Vehicle: *${number}*`,
  phoneLabel: (phone: string) => `📞 Phone: *${phone}*`,
  otpLabel: (otp: string) => `🔑 OTP: *${otp}*`,
  driverPhone: (phone: string) => `📞 Driver's number: *${phone}*\n\nYou can call them directly.`,
  driverDetailsNotAvailable: 'Driver details are not available yet. Please try again in a moment.',
  noActiveRide: 'No active ride found.',

  // No driver found
  noDriverFound: (tier: string) => `😔 No driver found for *${tier}* after 3 minutes.\n\nWhat would you like to do?`,
  retrySameVehicle: '🔄 Retry same vehicle',
  tryDifferentVehicle: '🚗 Try a different vehicle',
  mainMenu: '🏠 Main menu',
  retrying: (tier: string) => `🔄 Retrying ${tier}...`,
  tierNotAvailable: (tier: string) => `${tier} is not available right now. Here are the available options:`,
  tryAgain: '🔄 Try again',

  // Status
  activeRide: '📍 Active Ride\n',
  noActiveRides: 'No active rides found. Send "book" to start one.',
  noActiveRidesBook: '🔍 No active rides found.\n\nWould you like to book one?',

  // Cancel
  cancelConfirm: '⚠️ Are you sure you want to cancel your ride?',
  cancelConfirmWithDriver: (driver: string, vehicle?: string) =>
    `⚠️ Cancel ride with *${driver}*${vehicle ? ` (${vehicle})` : ''}?`,
  yesCancelIt: '✅ Yes, cancel it',
  noKeepIt: '🔙 No, keep it',
  rideSearchCancelled: 'Ride search cancelled.',
  rideCancelled: 'Ride cancelled. ✅',
  rideCompleted: 'This ride has already been completed and cannot be cancelled.',
  rideAlreadyCancelled: 'This ride is already cancelled.',
  rideInProgress: '⚠️ Your ride is already in progress and cannot be cancelled.',
  cancelFailed: (err: string) => `Could not cancel: ${err}`,
  cancelled: 'Cancelled.',
  whatToDo: '\n\nWhat would you like to do?',

  // Errors
  somethingWentWrong: 'Something went wrong. Send "book" to start over.',
  sessionExpired: 'Session expired. Send "book" to re-authenticate.',
  error: (msg: string) => `Error: ${msg}\nSend "cancel" to start over.`,
  rideBeingBooked: 'Your ride is being booked. Please wait or send "cancel" to cancel.',
};
