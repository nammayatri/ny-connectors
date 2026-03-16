import { LanguageStrings } from './types';

export const kn: LanguageStrings = {
  languageName: 'Kannada',
  nativeLanguageName: 'ಕನ್ನಡ',

  // Welcome & menu
  welcomeMessage: "👋 ಸ್ವಾಗತ! ನಾನು ನಿಮ್ಮ ನಮ್ಮ ಯಾತ್ರಿ ರೈಡ್ ಸಹಾಯಕ.\n\nನೀವು ಏನು ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?",
  welcomeBack: '👋 ಮತ್ತೆ ಸ್ವಾಗತ! ನೀವು ಏನು ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?',
  bookARide: '🚕 ರೈಡ್ ಬುಕ್ ಮಾಡಿ',
  trackRide: '📍 ರೈಡ್ ಟ್ರ್ಯಾಕ್ ಮಾಡಿ',
  chooseLanguage: '🌐 ಭಾಷೆ',
  selectLanguage: '🌐 ನಿಮ್ಮ ಆದ್ಯತೆಯ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ:',
  languageUpdated: (lang: string) => `✅ ಭಾಷೆಯನ್ನು *${lang}* ಗೆ ಬದಲಾಯಿಸಲಾಗಿದೆ.`,
  moreLanguages: '➕ ಹೆಚ್ಚಿನ ಭಾಷೆಗಳು',

  // Auth flow
  needSignIn: '🔐 ರೈಡ್ ಟ್ರ್ಯಾಕ್ ಮಾಡಲು ನೀವು ಸೈನ್ ಇನ್ ಆಗಬೇಕು.\n\nಬದಲಿಗೆ ರೈಡ್ ಬುಕ್ ಮಾಡಲು ಬಯಸುತ್ತೀರಾ?',
  enterPhone: 'ಮೊದಲ ಬಾರಿಯೇ? ನಿಮ್ಮ 10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ:',
  invalidPhone: 'ಅಮಾನ್ಯ ಫೋನ್ ಸಂಖ್ಯೆ. ಮಾನ್ಯ 10 ಅಂಕಿಯ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ:',
  enterAccessCode: 'ನಿಮ್ಮ ಆಕ್ಸೆಸ್ ಕೋಡ್ ನಮೂದಿಸಿ (ನಮ್ಮ ಯಾತ್ರಿ ಆಪ್ > ಪ್ರೊಫೈಲ್ > ನಮ್ಮ ಬಗ್ಗೆ):',
  authSuccess: 'ನೀವು ಸಿದ್ಧರಾಗಿದ್ದೀರಿ! ಇದನ್ನು ಮತ್ತೆ ಮಾಡಬೇಕಾಗಿಲ್ಲ.',
  authSuccessFirstTime: 'ನೀವು ಸಿದ್ಧರಾಗಿದ್ದೀರಿ! ರೈಡ್ ಬುಕ್ ಮಾಡೋಣ.',
  setupFailed: (err: string) => `ಸೆಟಪ್ ವಿಫಲವಾಗಿದೆ: ${err}\nಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು "book" ಕಳುಹಿಸಿ.`,
  authFailed: (err: string) => `ದೃಢೀಕರಣ ವಿಫಲವಾಗಿದೆ: ${err}\nಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು ನಿಮ್ಮ ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ:`,
  sharePhone: 'ನಿಮ್ಮ ಫೋನ್ ಸಂಖ್ಯೆ ಹಂಚಿಕೊಳ್ಳಲು ಕೆಳಗಿನ ಬಟನ್ ಒತ್ತಿ.',
  shareOwnPhone: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸ್ವಂತ ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ಹಂಚಿಕೊಳ್ಳಿ, ಬೇರೆಯವರದ್ದಲ್ಲ.',
  sharePhonePrompt: 'ನಿಮ್ಮ ಸಂಖ್ಯೆ ಹಂಚಿಕೊಳ್ಳಲು ಬಟನ್ ಒತ್ತಿ:',
  couldNotReadPhone: 'ನಿಮ್ಮ ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ಓದಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  allSet: 'ನೀವು ಸಿದ್ಧರಾಗಿದ್ದೀರಿ! ರೈಡ್ ಬುಕ್ ಮಾಡೋಣ.',

  // Origin & destination
  whereToGo: 'ನೀವು ಎಲ್ಲಿಗೆ ಹೋಗಲು ಬಯಸುತ್ತೀರಿ?',
  whereToGoWithRoutes: 'ನೀವು ಎಲ್ಲಿಗೆ ಹೋಗಲು ಬಯಸುತ್ತೀರಿ?\n\nತ್ವರಿತ ಮಾರ್ಗಗಳು ಅಥವಾ ಸ್ಥಳ ಆಯ್ಕೆ ಮಾಡಿ.\nನೀವು ಸ್ಥಳದ ಹೆಸರನ್ನೂ ಟೈಪ್ ಮಾಡಬಹುದು:',
  moreOptions: '➕ ಹೆಚ್ಚಿನ ಆಯ್ಕೆಗಳು',
  pickSavedOrType: 'ಉಳಿಸಿದ ಸ್ಥಳ ಆಯ್ಕೆ ಮಾಡಿ ಅಥವಾ ಸ್ಥಳದ ಹೆಸರನ್ನು ಟೈಪ್ ಮಾಡಿ:',
  typePickupPlace: 'ನೀವು ಎಲ್ಲಿಂದ ಹೊರಡುತ್ತೀರಿ?\nಹುಡುಕಲು ಸ್ಥಳದ ಹೆಸರನ್ನು ಟೈಪ್ ಮಾಡಿ:',
  selectPickup: 'ಪಿಕಪ್ ಸ್ಥಳ ಆಯ್ಕೆ ಮಾಡಿ:',
  pickup: (place: string) => `ಪಿಕಪ್: ${place}`,
  whereTo: 'ಎಲ್ಲಿಗೆ?\nಹುಡುಕಲು ಸ್ಥಳದ ಹೆಸರನ್ನು ಟೈಪ್ ಮಾಡಿ:',
  whereToWithSaved: 'ಎಲ್ಲಿಗೆ?\n\nಸ್ಥಳ ಆಯ್ಕೆ ಮಾಡಿ ಅಥವಾ ಸ್ಥಳದ ಹೆಸರನ್ನು ಟೈಪ್ ಮಾಡಿ:',
  typeDropPlace: 'ಎಲ್ಲಿಗೆ ಇಳಿಯಬೇಕು?\nಹುಡುಕಲು ಸ್ಥಳದ ಹೆಸರನ್ನು ಟೈಪ್ ಮಾಡಿ:',
  selectDrop: 'ಡ್ರಾಪ್ ಸ್ಥಳ ಆಯ್ಕೆ ಮಾಡಿ:',
  drop: (place: string) => `ಡ್ರಾಪ್: ${place}`,
  noPlacesFound: 'ಯಾವುದೇ ಸ್ಥಳ ಸಿಗಲಿಲ್ಲ. ಬೇರೆ ಹೆಸರಿನಿಂದ ಹುಡುಕಿ:',
  invalidChoice: (max: number) => `ಅಮಾನ್ಯ ಆಯ್ಕೆ. 1-${max} ಆಯ್ಕೆ ಮಾಡಿ:`,
  couldNotFindLocations: 'ಆ ಸ್ಥಳಗಳನ್ನು ಹುಡುಕಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು "book" ಕಳುಹಿಸಿ.',
  fromLabel: (tag: string) => `📍 ಇಲ್ಲಿಂದ: ${tag}`,

  // Ride search & estimates
  searchingRides: 'ರೈಡ್‌ಗಳನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ...',
  noRidesAvailable: 'ಈಗ ಯಾವುದೇ ರೈಡ್‌ಗಳು ಲಭ್ಯವಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು "book" ಕಳುಹಿಸಿ.',
  noRidesAvailableRetry: '😔 ಈಗ ಯಾವುದೇ ರೈಡ್‌ಗಳು ಲಭ್ಯವಿಲ್ಲ. ನೀವು ಏನು ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?',
  basedOnPastRides: '🕐 ನಿಮ್ಮ ಹಿಂದಿನ ರೈಡ್‌ಗಳ ಆಧಾರದ ಮೇಲೆ:',
  availableRides: 'ಲಭ್ಯವಿರುವ ರೈಡ್‌ಗಳು:',
  availableRidesForRoute: 'ನಿಮ್ಮ ಮಾರ್ಗಕ್ಕೆ ಲಭ್ಯವಿರುವ ರೈಡ್‌ಗಳು ಇಲ್ಲಿವೆ:',

  // Booking
  booking: (tier: string, fare: number) => `${tier} ಬುಕ್ ಮಾಡಲಾಗುತ್ತಿದೆ (₹${fare})...`,
  stillSearching: (elapsed: number) => `⏳ ಇನ್ನೂ ಹತ್ತಿರದ ಚಾಲಕರನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ... (${elapsed}s)\n\nನಿಲ್ಲಿಸಲು "cancel" ಕಳುಹಿಸಿ.`,
  rideConfirmed: '🎉 ರೈಡ್ ದೃಢೀಕರಿಸಲಾಗಿದೆ!\n',
  rideBooked: '✅ ರೈಡ್ ಬುಕ್ ಆಗಿದೆ!',
  waitingForDriver: 'ಚಾಲಕರ ನಿಯೋಜನೆಗಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ...',
  trackYourRide: '📲 ನಿಮ್ಮ ರೈಡ್ ಟ್ರ್ಯಾಕ್ ಮಾಡಿ:',
  track: '📲 ಟ್ರ್ಯಾಕ್:',
  callDriver: '📞 ಕರೆ ಮಾಡಿ',
  cancelRide: '❌ ರದ್ದು ಮಾಡಿ',
  driverLabel: (name: string) => `👤 ಚಾಲಕ: *${name}*`,
  vehicleLabel: (number: string) => `🔢 ವಾಹನ: *${number}*`,
  phoneLabel: (phone: string) => `📞 ಫೋನ್: *${phone}*`,
  otpLabel: (otp: string) => `🔑 OTP: *${otp}*`,
  driverPhone: (phone: string) => `📞 ಚಾಲಕರ ಸಂಖ್ಯೆ: *${phone}*\n\nನೀವು ನೇರವಾಗಿ ಕರೆ ಮಾಡಬಹುದು.`,
  driverDetailsNotAvailable: 'ಚಾಲಕರ ವಿವರಗಳು ಇನ್ನೂ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  noActiveRide: 'ಸಕ್ರಿಯ ರೈಡ್ ಕಂಡುಬಂದಿಲ್ಲ.',

  // No driver found
  noDriverFound: (tier: string) => `😔 3 ನಿಮಿಷಗಳ ನಂತರ *${tier}* ಗೆ ಚಾಲಕರು ಸಿಗಲಿಲ್ಲ.\n\nನೀವು ಏನು ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?`,
  retrySameVehicle: '🔄 ಅದೇ ವಾಹನ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
  tryDifferentVehicle: '🚗 ಬೇರೆ ವಾಹನ ಪ್ರಯತ್ನಿಸಿ',
  mainMenu: '🏠 ಮುಖ್ಯ ಮೆನು',
  retrying: (tier: string) => `🔄 ${tier} ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲಾಗುತ್ತಿದೆ...`,
  tierNotAvailable: (tier: string) => `${tier} ಈಗ ಲಭ್ಯವಿಲ್ಲ. ಲಭ್ಯವಿರುವ ಆಯ್ಕೆಗಳು ಇಲ್ಲಿವೆ:`,
  tryAgain: '🔄 ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',

  // Status
  activeRide: '📍 ಸಕ್ರಿಯ ರೈಡ್\n',
  noActiveRides: 'ಸಕ್ರಿಯ ರೈಡ್‌ಗಳು ಕಂಡುಬಂದಿಲ್ಲ. ಹೊಸದನ್ನು ಪ್ರಾರಂಭಿಸಲು "book" ಕಳುಹಿಸಿ.',
  noActiveRidesBook: '🔍 ಸಕ್ರಿಯ ರೈಡ್‌ಗಳು ಕಂಡುಬಂದಿಲ್ಲ.\n\nಒಂದನ್ನು ಬುಕ್ ಮಾಡಲು ಬಯಸುತ್ತೀರಾ?',

  // Cancel
  cancelConfirm: '⚠️ ನಿಮ್ಮ ರೈಡ್ ರದ್ದು ಮಾಡಲು ಖಚಿತವಾಗಿದ್ದೀರಾ?',
  cancelConfirmWithDriver: (driver: string, vehicle?: string) =>
    `⚠️ *${driver}*${vehicle ? ` (${vehicle})` : ''} ಜೊತೆಗಿನ ರೈಡ್ ರದ್ದು ಮಾಡಬೇಕೇ?`,
  yesCancelIt: '✅ ಹೌದು, ರದ್ದು ಮಾಡಿ',
  noKeepIt: '🔙 ಬೇಡ, ಉಳಿಸಿಕೊಳ್ಳಿ',
  rideSearchCancelled: 'ರೈಡ್ ಹುಡುಕಾಟ ರದ್ದಾಗಿದೆ.',
  rideCancelled: 'ರೈಡ್ ರದ್ದಾಗಿದೆ. ✅',
  rideCompleted: 'ಈ ರೈಡ್ ಈಗಾಗಲೇ ಪೂರ್ಣಗೊಂಡಿದೆ ಮತ್ತು ರದ್ದು ಮಾಡಲು ಸಾಧ್ಯವಿಲ್ಲ.',
  rideAlreadyCancelled: 'ಈ ರೈಡ್ ಈಗಾಗಲೇ ರದ್ದಾಗಿದೆ.',
  rideInProgress: '⚠️ ನಿಮ್ಮ ರೈಡ್ ಈಗಾಗಲೇ ಪ್ರಗತಿಯಲ್ಲಿದೆ ಮತ್ತು ರದ್ದು ಮಾಡಲು ಸಾಧ್ಯವಿಲ್ಲ.',
  cancelFailed: (err: string) => `ರದ್ದು ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ: ${err}`,
  cancelled: 'ರದ್ದಾಗಿದೆ.',
  whatToDo: '\n\nನೀವು ಏನು ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?',

  // Errors
  somethingWentWrong: 'ಏನೋ ತಪ್ಪಾಗಿದೆ. ಮತ್ತೆ ಪ್ರಾರಂಭಿಸಲು "book" ಕಳುಹಿಸಿ.',
  sessionExpired: 'ಸೆಶನ್ ಅವಧಿ ಮುಗಿದಿದೆ. ಮರು-ದೃಢೀಕರಿಸಲು "book" ಕಳುಹಿಸಿ.',
  error: (msg: string) => `ದೋಷ: ${msg}\nಮತ್ತೆ ಪ್ರಾರಂಭಿಸಲು "cancel" ಕಳುಹಿಸಿ.`,
  rideBeingBooked: 'ನಿಮ್ಮ ರೈಡ್ ಬುಕ್ ಆಗುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಕಾಯಿರಿ ಅಥವಾ ರದ್ದು ಮಾಡಲು "cancel" ಕಳುಹಿಸಿ.',
};
