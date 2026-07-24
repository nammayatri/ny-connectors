import { LanguageStrings } from './types';

export const kn: LanguageStrings = {
  languageName: 'Kannada',
  nativeLanguageName: 'ಕನ್ನಡ',

  // Welcome & menu
  bookARide: '🚕 ರೈಡ್ ಬುಕ್ ಮಾಡಿ',
  trackRide: '📍 ರೈಡ್ ಟ್ರ್ಯಾಕ್ ಮಾಡಿ',
  chooseLanguage: '🌐 ಭಾಷೆ',
  selectLanguage: '🌐 ನಿಮ್ಮ ಆದ್ಯತೆಯ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ:',
  languageUpdated: (lang: string) => `✅ ಭಾಷೆಯನ್ನು *${lang}* ಗೆ ಬದಲಾಯಿಸಲಾಗಿದೆ.`,
  moreLanguages: '➕ ಹೆಚ್ಚಿನ ಭಾಷೆಗಳು',

  // Auth flow
  setupFailed: (err: string) => `ಸೆಟಪ್ ವಿಫಲವಾಗಿದೆ: ${err}\nಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು "book" ಕಳುಹಿಸಿ.`,
  personNotFound: 'ನೀವು ಹೊಸಬರು ಎಂದು ತೋರುತ್ತದೆ! ನಿಮ್ಮ ಖಾತೆಯನ್ನು ಸೆಟಪ್ ಮಾಡೋಣ.',
  otpSent: 'ನಿಮ್ಮ ಫೋನ್‌ಗೆ OTP ಕಳುಹಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು OTP ನಮೂದಿಸಿ:',
  invalidOtp: 'ಇದು ಸರಿಯಾದ OTP ಅಲ್ಲ. ದಯವಿಟ್ಟು 4 ಅಥವಾ 6 ಅಂಕಿಯ ಕೋಡ್ ನಮೂದಿಸಿ:',
  resendOtp: '🔄 OTP ಮರುಕಳುಹಿಸಿ',
  otpResent: 'OTP ಮರುಕಳುಹಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಫೋನ್ ಪರಿಶೀಲಿಸಿ:',
  otpResendFailed: (err: string) => `OTP ಮರುಕಳುಹಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ: ${err}`,
  otpVerified: 'ಫೋನ್ ಯಶಸ್ವಿಯಾಗಿ ಪರಿಶೀಲಿಸಲಾಗಿದೆ!',
  otpVerifyFailed: (err: string) => `OTP ಪರಿಶೀಲನೆ ವಿಫಲವಾಗಿದೆ: ${err}\nದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ:`,

  // Origin & destination
  noPlacesFound: 'ಯಾವುದೇ ಸ್ಥಳ ಸಿಗಲಿಲ್ಲ. ಬೇರೆ ಹೆಸರಿನಿಂದ ಹುಡುಕಿ:',

  // Ride search & estimates

  // Booking
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
  mainMenu: '🏠 ಮುಖ್ಯ ಮೆನು',

  // Status
  activeRide: '📍 ಸಕ್ರಿಯ ರೈಡ್\n',
  noActiveRidesBook: '🔍 ಸಕ್ರಿಯ ರೈಡ್‌ಗಳು ಕಂಡುಬಂದಿಲ್ಲ.\n\nಒಂದನ್ನು ಬುಕ್ ಮಾಡಲು ಬಯಸುತ್ತೀರಾ?',

  // Cancel
  cancelConfirm: '⚠️ ನಿಮ್ಮ ರೈಡ್ ರದ್ದು ಮಾಡಲು ಖಚಿತವಾಗಿದ್ದೀರಾ?',
  cancelConfirmWithDriver: (driver: string, vehicle?: string) =>
    `⚠️ *${driver}*${vehicle ? ` (${vehicle})` : ''} ಜೊತೆಗಿನ ರೈಡ್ ರದ್ದು ಮಾಡಬೇಕೇ?`,
  yesCancelIt: '✅ ಹೌದು, ರದ್ದು ಮಾಡಿ',
  noKeepIt: '🔙 ಬೇಡ, ಉಳಿಸಿಕೊಳ್ಳಿ',
  rideCancelled: 'ರೈಡ್ ರದ್ದಾಗಿದೆ. ✅',
  rideCompleted: 'ಈ ರೈಡ್ ಈಗಾಗಲೇ ಪೂರ್ಣಗೊಂಡಿದೆ ಮತ್ತು ರದ್ದು ಮಾಡಲು ಸಾಧ್ಯವಿಲ್ಲ.',
  rideAlreadyCancelled: 'ಈ ರೈಡ್ ಈಗಾಗಲೇ ರದ್ದಾಗಿದೆ.',
  rideInProgress: '⚠️ ನಿಮ್ಮ ರೈಡ್ ಈಗಾಗಲೇ ಪ್ರಗತಿಯಲ್ಲಿದೆ ಮತ್ತು ರದ್ದು ಮಾಡಲು ಸಾಧ್ಯವಿಲ್ಲ.',
  cancelFailed: (err: string) => `ರದ್ದು ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ: ${err}`,
  cancelled: 'ರದ್ದಾಗಿದೆ.',
  whatToDo: '\n\nನೀವು ಏನು ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?',

  // SOS & safety
  rideNotStarted: '🕐 ರೈಡ್ ಇನ್ನೂ ಪ್ರಾರಂಭವಾಗಿಲ್ಲ — ಚಾಲಕ ಬರುತ್ತಿದ್ದಾರೆ.',
  rideInProgressStatus: '🚗 ರೈಡ್ ಪ್ರಗತಿಯಲ್ಲಿದೆ.',
  sosButton: '🚨 SOS',
  call112Button: '📞 112 ಗೆ ಕರೆ ಮಾಡಿ',
  sosConfirm: '⚠️ SOS ಎಚ್ಚರಿಕೆಯನ್ನು ಕಳುಹಿಸಲು ಖಚಿತವಾಗಿದ್ದೀರಾ? ಇದು ತುರ್ತು ಸಂಪರ್ಕಗಳು ಮತ್ತು ನಮ್ಮ ಯಾತ್ರಿ ಸುರಕ್ಷತಾ ತಂಡಕ್ಕೆ ತಿಳಿಸುತ್ತದೆ.',
  yesTriggerSOS: '🚨 ಹೌದು, SOS ಕಳುಹಿಸಿ',
  noGoBack: '🔙 ಬೇಡ, ಹಿಂದೆ ಹೋಗಿ',
  sosTriggered: '🚨 SOS ಎಚ್ಚರಿಕೆ ಕಳುಹಿಸಲಾಗಿದೆ. ಸುರಕ್ಷಿತವಾಗಿರಿ — ಸಹಾಯ ಬರುತ್ತಿದೆ.\n\nತುರ್ತು ಸಹಾಯಕ್ಕಾಗಿ 112 ಗೆ ಕರೆ ಮಾಡಬಹುದು.',
  sosFailed: (err: string) => `SOS ಕಳುಹಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ: ${err}\n\nದಯವಿಟ್ಟು ತುರ್ತು ಸಹಾಯಕ್ಕಾಗಿ ನೇರವಾಗಿ 112 ಗೆ ಕರೆ ಮಾಡಿ.`,
  markSafeButton: '✅ ಸುರಕ್ಷಿತ ಎಂದು ಗುರುತಿಸಿ',
  markSafeConfirm: 'ನಿಮ್ಮ ರೈಡ್ ಅನ್ನು ಸುರಕ್ಷಿತ ಎಂದು ಗುರುತಿಸಲು ಖಚಿತವಾಗಿದ್ದೀರಾ? ಇದು SOS ಎಚ್ಚರಿಕೆಯನ್ನು ರದ್ದು ಮಾಡುತ್ತದೆ.',
  yesMarkSafe: '✅ ಹೌದು, ನಾನು ಸುರಕ್ಷಿತ',
  markedSafe: '✅ ನಿಮ್ಮ ರೈಡ್ ಸುರಕ್ಷಿತ ಎಂದು ಗುರುತಿಸಲಾಗಿದೆ. SOS ಎಚ್ಚರಿಕೆ ರದ್ದಾಗಿದೆ.',
  markSafeFailed: (err: string) => `ಸುರಕ್ಷಿತ ಎಂದು ಗುರುತಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ: ${err}`,

  // Flexi (location-only metered booking)
  welcome: '🙏 ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ Namma Yatri ಸಹಾಯಕ\n\nಆಟೋ ಬುಕ್ ಮಾಡಲು ಸಿದ್ಧರಾ?',
  flexiSharePrompt: 'ಚಾಲಕ ನಿಮ್ಮನ್ನು ಎಲ್ಲಿಂದ ಕರೆದೊಯ್ಯಬೇಕು? 📍',
  flexiFareBreakup: (base?: number, perKm?: number, nightMult?: number, nightWindow?: string) => {
    const lines: string[] = [];
    if (base != null) lines.push(`ಮೊದಲ 2 ಕಿಮೀ: ₹${base}`);
    if (perKm != null) lines.push(`ಹೆಚ್ಚುವರಿ: ₹${perKm}/ಕಿಮೀ`);
    if (nightMult != null && nightWindow) lines.push(`🌙 ರಾತ್ರಿ (${nightWindow}): ${nightMult}× ಶುಲ್ಕ`);
    return lines.join('\n');
  },
  flexiFareFrom: (amount: number) => `🛺 ₹${amount} ರಿಂದ`,
  flexiConfirmPickup: (address: string, fareLine?: string) =>
    `📍 ನಿಮ್ಮ ಸ್ಥಳ: *${address}* ಹತ್ತಿರ.${fareLine ? `\n\n${fareLine}` : ''}\n\nರೈಡ್ ನಂತರ ಚಾಲಕರಿಗೆ ನಗದು/UPI ಪಾವತಿಸಿ.\nಬುಕ್ ಮಾಡೋಣವೇ?`,
  flexiConfirmSavedPlace: (name: string, fareLine?: string) =>
    `📍 ನೀವು ಉಳಿಸಿದ ಸ್ಥಳವನ್ನು ಕಳುಹಿಸಿದ್ದೀರಿ:\n *${name}*.${fareLine ? `\n\n${fareLine}` : ''}\n\nರೈಡ್ ನಂತರ ಚಾಲಕರಿಗೆ ನಗದು/UPI ಪಾವತಿಸಿ.\nಬುಕ್ ಮಾಡೋಣವೇ?`,
  pickupConfirmButton: '✅ ಪಿಕಪ್ ಖಚಿತಪಡಿಸಿ',
  pickupAdjustButton: '✏️ ಸ್ಥಳ ಬದಲಿಸಿ',
  flexiFinding: '🛺 ನಿಮ್ಮ ಹತ್ತಿರ ಆಟೋ ಹುಡುಕುತ್ತಿದ್ದೇವೆ. 1 ನಿಮಿಷ ಕಾಯಿರಿ. WhatsApp ಮುಚ್ಚಬೇಡಿ.',
  flexiStillFinding: '⏳ ಇನ್ನೂ ನಿಮ್ಮ ಹತ್ತಿರ ಆಟೋ ಹುಡುಕುತ್ತಿದ್ದೇವೆ…\n\nನಿಲ್ಲಿಸಲು "cancel" ಕಳುಹಿಸಿ.',
  flexiCancelSearch: '❌ ಹುಡುಕಾಟ ನಿಲ್ಲಿಸಿ',
  flexiFoundDriver: (name: string) => `🛺 *${name}* ಬರುತ್ತಿದ್ದಾರೆ.`,
  flexiDriverMeta: (rating: number, etaMin: number) => `⭐ ${rating} · ${etaMin} ನಿಮಿಷ ದೂರ`,
  flexiOtpShare: (otp: string) => `🔑 ಆರಂಭ OTP: *${otp}*`,
  flexiCallDriver: (phone: string) => `📞 ಚಾಲಕರಿಗೆ ಕರೆ ಮಾಡಿ: ${phone}`,
  flexiSafetyNote: 'ಚಾಲಕರೊಂದಿಗೆ ನಿಮ್ಮ ಗಮ್ಯಸ್ಥಾನವನ್ನು ಖಚಿತಪಡಿಸಿ.',
  flexiNoAuto: '😔 ಸದ್ಯಕ್ಕೆ ಖಾಲಿ ಆಟೋ ಇಲ್ಲ. 2 ನಿಮಿಷಗಳ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  flexiTryAgain: '🔁 ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
  flexiOutOfArea: (area: string) => `📍 ಈ ಸ್ಥಳ ನಮ್ಮ ಸೇವಾ ಪ್ರದೇಶದ ಹೊರಗಿದೆ.\n\nNamma Yatri ಆಟೋಗಳು ಸದ್ಯ *${area}* ನಲ್ಲಿ ಲಭ್ಯವಿವೆ. ಅಲ್ಲಿಂದ ಪಿಕಪ್ ಪ್ರಯತ್ನಿಸಿ, ಅಥವಾ ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ನೋಡಿ.`,

  // Flexi ride-progress updates (pushed by the background tracker)
  flexiArrived: (otp: string) => otp
    ? `🛺 ಚಾಲಕ ಬಂದಿದ್ದಾರೆ! ಚಾಲಕರಿಗೆ ಆರಂಭ OTP ಹೇಳಿ.\n\n🔑 OTP: ${otp}`
    : '🛺 ಚಾಲಕ ಬಂದಿದ್ದಾರೆ! ದಯವಿಟ್ಟು ಪಿಕಪ್ ಪಾಯಿಂಟ್‌ನಲ್ಲಿ ನಿಮ್ಮ ಚಾಲಕರನ್ನು ಭೇಟಿಯಾಗಿ.',
  flexiFareUnavailable: '💰 ನಿಮ್ಮ ಶುಲ್ಕ ಶೀಘ್ರದಲ್ಲೇ ಖಚಿತವಾಗುತ್ತದೆ.',
  flexiRideFinishedHeader: '🎉 ರೈಡ್ ಮುಗಿದಿದೆ.',
  flexiPayDriver: (amount: number) => `💰 ಚಾಲಕರಿಗೆ ₹${amount} ನಗದು/UPI ಕೊಡಿ`,
  flexiDistanceLine: (km: number) => `📏 ${km} ಕಿಮೀ`,
  flexiRideCancelled: '❌ ನಿಮ್ಮ ರೈಡ್ ರದ್ದಾಗಿದೆ.\n\nಎಲ್ಲಿಗಾದರೂ ಹೋಗಬೇಕೇ? ಯಾವಾಗ ಬೇಕಾದರೂ ಇನ್ನೊಂದು ಆಟೋ ಬುಕ್ ಮಾಡಿ.',
  flexiBookAnother: '🛺 ಇನ್ನೊಂದು ಬುಕ್ ಮಾಡಿ',
  appDownloadNudge: '🙏 Namma Yatri app ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ!\nhttps://play.google.com/store/apps/details?id=in.juspay.nammayatri',


  // Flexi "hi" ಮೆನು — More ಡ್ರಾಯರ್ + ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ + ಬೆಂಬಲ
  moreButton: '⚙️ ಇನ್ನಷ್ಟು ಆಯ್ಕೆಗಳು',
  moreTitle: 'ನೀವು ಏನು ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?',
  howItWorks: '❓ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ',
  contactSupport: '💬 ಬೆಂಬಲ',
  howItWorksText: "📹 *Namma Yatri ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ*\n\n1️⃣ *ರೈಡ್ ಬುಕ್ ಮಾಡಿ* ಒತ್ತಿ\n2️⃣ ನಿಮ್ಮ ಪಿಕಪ್ ಸ್ಥಳ ಹಂಚಿಕೊಳ್ಳಿ 📍\n3️⃣ ನಾವು ನಿಮ್ಮ ಹತ್ತಿರ ಆಟೋ ಹುಡುಕುತ್ತೇವೆ\n4️⃣ ನಿಮ್ಮ ಚಾಲಕರನ್ನು ಭೇಟಿಯಾಗಿ, OTP ಹೇಳಿ, ಹೊರಡಿ!\n\n_(ಪರಿಚಯ ವೀಡಿಯೊ ಶೀಘ್ರದಲ್ಲೇ ಬರಲಿದೆ.)_",
  howItWorksCaption: 'Namma Yatri ನಲ್ಲಿ ಆಟೋ ಹೇಗೆ ಬುಕ್ ಮಾಡುವುದು 🛺',
  supportMessage: (phone: string) => `💬 ಸಹಾಯ ಬೇಕೇ?\n\nನಮಗೆ ಕರೆ ಮಾಡಿ: ${phone}\n\nನಿಮ್ಮ ಸಹಾಯಕ್ಕಾಗಿ ನಾವು ಇಲ್ಲಿದ್ದೇವೆ. 🙏`,

  // ರೈಡ್-ಪ್ರಕಾರ ಆಯ್ಕೆ + ಸಾಮಾನ್ಯ ರೈಡ್-ಪ್ರಾರಂಭ
  rideTypePrompt: 'ನೀವು ಹೇಗೆ ಪ್ರಯಾಣಿಸಲು ಬಯಸುತ್ತೀರಿ?',
  rideTypeFlexi: '🛺 ತ್ವರಿತ ರೈಡ್',
  rideTypeRegular: '🚗 ಗಮ್ಯದ ರೈಡ್',
  rideStartedSimple: '🚦 ನಿಮ್ಮ ರೈಡ್ ಪ್ರಾರಂಭವಾಗಿದೆ. ಪ್ರಯಾಣವನ್ನು ಆನಂದಿಸಿ!',

  // ಸಾಮಾನ್ಯ ಒನ್-ವೇ ಫ್ಲೋ (ಪಿಕಪ್ + ಡ್ರಾಪ್ → ಆಟೋ ಶುಲ್ಕ → ಬುಕ್)
  regularDropPrompt: 'ನೀವು ಎಲ್ಲಿಗೆ ಹೋಗುತ್ತಿದ್ದೀರಿ? 📍\n\nನಿಮ್ಮ ಡ್ರಾಪ್ ಸ್ಥಳ ಹಂಚಿಕೊಳ್ಳಿ, ಅಥವಾ ವಿಳಾಸ ಟೈಪ್ ಮಾಡಿ.',
  regularSelectDrop: 'ಯಾವುದು? ನಿಮ್ಮ ಡ್ರಾಪ್ ಆಯ್ಕೆ ಮಾಡಿ:',
  regularFareConfirm: (fare: number, area: string) => `🛺 *${area}* ವರೆಗೆ ಆಟೋ\n💰 ಸುಮಾರು *₹${fare}*\n\nಬುಕ್ ಮಾಡಲೇ?`,
  regularConfirmButton: '✅ ಆಟೋ ಬುಕ್ ಮಾಡಿ',
  regularChangeDropButton: '✏️ ಡ್ರಾಪ್ ಬದಲಿಸಿ',
  regularSearching: '🛺 ನಿಮ್ಮ ಶುಲ್ಕ ಪಡೆಯುತ್ತಿದ್ದೇವೆ…',
  regularBooking: '🛺 ನಿಮ್ಮ ಆಟೋ ಬುಕ್ ಮಾಡುತ್ತಿದ್ದೇವೆ…',

  // Errors
  somethingWentWrong: 'ಏನೋ ತಪ್ಪಾಗಿದೆ. ಮತ್ತೆ ಪ್ರಾರಂಭಿಸಲು "book" ಕಳುಹಿಸಿ.',
  sessionExpired: 'ಸೆಶನ್ ಅವಧಿ ಮುಗಿದಿದೆ. ಮರು-ದೃಢೀಕರಿಸಲು "book" ಕಳುಹಿಸಿ.',
  error: (msg: string) => `ದೋಷ: ${msg}\nಮತ್ತೆ ಪ್ರಾರಂಭಿಸಲು "cancel" ಕಳುಹಿಸಿ.`,
};
