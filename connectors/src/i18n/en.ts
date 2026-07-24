import { LanguageStrings } from './types';

export const en: LanguageStrings = {
  languageName: 'English',
  nativeLanguageName: 'English',

  // Welcome & menu
  bookARide: '🚕 Book a Ride',
  trackRide: '📍 Track Ride',
  chooseLanguage: '🌐 Language',
  selectLanguage: '🌐 Choose your preferred language:',
  languageUpdated: (lang: string) => `✅ Language changed to *${lang}*.`,
  moreLanguages: '➕ More languages',

  // Auth flow
  setupFailed: (err: string) => `Setup failed: ${err}\nSend "book" to try again.`,

  // Registration (OTP-based)
  personNotFound: "Looks like you're new! Let's get you set up.",
  otpSent: 'An OTP has been sent to your phone. Please enter the OTP:',
  invalidOtp: 'That doesn\'t look like a valid OTP. Please enter the 4 or 6 digit code:',
  resendOtp: '🔄 Resend OTP',
  otpResent: 'OTP has been resent. Please check your phone:',
  otpResendFailed: (err: string) => `Could not resend OTP: ${err}`,
  otpVerified: 'Phone verified successfully!',
  otpVerifyFailed: (err: string) => `OTP verification failed: ${err}\nPlease try again:`,

  // Origin & destination
  noPlacesFound: 'No places found. Try a different search:',

  // Ride search & estimates

  // Booking
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
  mainMenu: '🏠 Main menu',

  // Status
  activeRide: '📍 Active Ride\n',
  noActiveRidesBook: '🔍 No active rides found.\n\nWould you like to book one?',

  // Cancel
  cancelConfirm: '⚠️ Are you sure you want to cancel your ride?',
  cancelConfirmWithDriver: (driver: string, vehicle?: string) =>
    `⚠️ Cancel ride with *${driver}*${vehicle ? ` (${vehicle})` : ''}?`,
  yesCancelIt: '✅ Yes, cancel it',
  noKeepIt: '🔙 No, keep it',
  rideCancelled: 'Ride cancelled. ✅',
  rideCompleted: 'This ride has already been completed and cannot be cancelled.',
  rideAlreadyCancelled: 'This ride is already cancelled.',
  rideInProgress: '⚠️ Your ride is already in progress and cannot be cancelled.',
  cancelFailed: (err: string) => `Could not cancel: ${err}`,
  cancelled: 'Cancelled.',
  whatToDo: '\n\nWhat would you like to do?',

  // SOS & safety
  rideNotStarted: '🕐 Ride not started yet — driver is on the way.',
  rideInProgressStatus: '🚗 Ride is in progress.',
  sosButton: '🚨 SOS',
  call112Button: '📞 Call 112',
  sosConfirm: '⚠️ Are you sure you want to trigger an SOS alert? This will notify emergency contacts and Namma Yatri safety team.',
  yesTriggerSOS: '🚨 Yes, trigger SOS',
  noGoBack: '🔙 No, go back',
  sosTriggered: '🚨 SOS alert has been triggered. Stay safe — help is on the way.\n\nYou can also call 112 for immediate emergency assistance.',
  sosFailed: (err: string) => `Could not trigger SOS: ${err}\n\nPlease call 112 directly for emergency help.`,
  markSafeButton: '✅ Mark as Safe',
  markSafeConfirm: 'Are you sure you want to mark your ride as safe? This will cancel the SOS alert.',
  yesMarkSafe: '✅ Yes, I am safe',
  markedSafe: '✅ Your ride has been marked as safe. The SOS alert has been cancelled.',
  markSafeFailed: (err: string) => `Could not mark as safe: ${err}`,

  // Flexi (location-only metered booking)
  welcome: "🙏 Namaskara! I'm your Namma Yatri assistant\n\nReady to book an auto?",
  flexiSharePrompt: 'Where should the driver pick you up? 📍',
  flexiFareBreakup: (base?: number, perKm?: number, nightMult?: number, nightWindow?: string) => {
    const lines: string[] = [];
    if (base != null) lines.push(`First 2km: ₹${base}`);
    if (perKm != null) lines.push(`Extra: ₹${perKm}/km`);
    // Night line only when the caller judged it currently night (passes mult + window).
    if (nightMult != null && nightWindow) lines.push(`🌙 Night (${nightWindow}): ${nightMult}× fare`);
    return lines.join('\n');
  },
  flexiFareFrom: (amount: number) => `🛺 From ₹${amount}`,
  flexiConfirmPickup: (address: string, fareLine?: string) =>
    `📍 Your location: near *${address}*.${fareLine ? `\n\n${fareLine}` : ''}\n\nCash/UPI to the driver after the ride.\nShall we book?`,
  flexiConfirmSavedPlace: (name: string, fareLine?: string) =>
    `📍 You shared a saved place:\n *${name}*.${fareLine ? `\n\n${fareLine}` : ''}\n\nCash/UPI to the driver after the ride.\nShall we book?`,
  pickupConfirmButton: '✅ Confirm pickup',
  pickupAdjustButton: '✏️ Change location',
  flexiFinding: "🛺 Looking for an auto near you. Wait 1 minute. Don't close WhatsApp.",
  flexiStillFinding: '⏳ Still looking for an auto near you…\n\nSend "cancel" to stop.',
  flexiCancelSearch: '❌ Cancel search',
  flexiFoundDriver: (name: string) => `🛺 *${name}* is on the way.`,
  flexiDriverMeta: (rating: number, etaMin: number) => `⭐ ${rating} · ${etaMin} min away`,
  flexiOtpShare: (otp: string) => `🔑 Start OTP: *${otp}*`,
  flexiCallDriver: (phone: string) => `📞 Call driver: ${phone}`,
  flexiSafetyNote: "Confirm your destination with the driver.",
  flexiNoAuto: '😔 No free auto right now. Try again after 2 minutes.',
  flexiTryAgain: '🔁 Try again',
  flexiOutOfArea: (area: string) => `📍 That location looks outside our service area.\n\nNamma Yatri autos currently run in *${area}*. Try a pickup there, or check back soon.`,
  // Flexi ride-progress updates (pushed by the background tracker)
  flexiArrived: (otp: string) => otp
    ? `🛺 Driver arrived! Tell the start OTP to the driver.\n\n🔑 OTP: ${otp}`
    : '🛺 Driver arrived! Please meet your driver at the pickup point.',
  flexiFareUnavailable: '💰 Your fare will be confirmed shortly.',
  flexiRideFinishedHeader: '🎉 Ride finished.',
  flexiPayDriver: (amount: number) => `💰 Give the driver ₹${amount} cash/UPI`,
  flexiDistanceLine: (km: number) => `📏 ${km} km`,
  flexiRideCancelled: '❌ Your ride was cancelled.\n\nNeed to go somewhere? Book another auto anytime.',
  flexiBookAnother: '🛺 Book another',
  appDownloadNudge: '🙏 Download the Namma Yatri app!\nhttps://play.google.com/store/apps/details?id=in.juspay.nammayatri',
  // Flexi "hi" menu — More drawer + how-it-works + support
  moreButton: '⚙️ More options',
  moreTitle: 'What would you like to do?',
  howItWorks: '❓ How it works',
  contactSupport: '💬 Support',
  howItWorksText: "📹 *How Namma Yatri works*\n\n1️⃣ Tap *Book a Ride*\n2️⃣ Share your pickup location 📍\n3️⃣ We find you a nearby auto\n4️⃣ Meet your driver, share the OTP, and go!\n\n_(Intro video coming soon.)_",
  howItWorksCaption: 'How to book an auto on Namma Yatri 🛺',
  supportMessage: (phone: string) => `💬 Need help?\n\nCall us: ${phone}\n\nWe're here to help. 🙏`,
  // Ride-type chooser + generic ride-started
  rideTypePrompt: 'How would you like to travel?',
  rideTypeFlexi: '🛺 Quick Ride',
  rideTypeRegular: '🚗 Ride with drop',
  rideStartedSimple: '🚦 Your ride has started. Enjoy the trip!',
  // Regular one-way flow (pickup + drop → auto fare → book)
  regularDropPrompt: 'Where are you going? 📍\n\nShare your drop location, or type the address.',
  regularSelectDrop: 'Which one? Pick your drop:',
  regularFareConfirm: (fare: number, area: string) => `🛺 Auto to *${area}*\n💰 Approx *₹${fare}*\n\nShall I book it?`,
  regularConfirmButton: '✅ Book auto',
  regularChangeDropButton: '✏️ Change drop',
  regularSearching: '🛺 Getting your fare…',
  regularBooking: '🛺 Booking your auto…',

  // Errors
  somethingWentWrong: 'Something went wrong. Send "book" to start over.',
  sessionExpired: 'Session expired. Send "book" to re-authenticate.',
  error: (msg: string) => `Error: ${msg}\nSend "cancel" to start over.`,
};
