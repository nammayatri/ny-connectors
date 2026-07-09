import { LanguageStrings } from './types';

export const ta: LanguageStrings = {
  languageName: 'Tamil',
  nativeLanguageName: 'தமிழ்',

  // Welcome & menu
  bookARide: '🚕 சவாரி புக் செய்',
  trackRide: '📍 சவாரி கண்காணி',
  chooseLanguage: '🌐 மொழி',
  selectLanguage: '🌐 உங்கள் விருப்பமான மொழியைத் தேர்ந்தெடுக்கவும்:',
  languageUpdated: (lang: string) => `✅ மொழி *${lang}* ஆக மாற்றப்பட்டது.`,
  moreLanguages: '➕ மேலும் மொழிகள்',

  // Auth flow
  setupFailed: (err: string) => `அமைப்பு தோல்வியடைந்தது: ${err}\nமீண்டும் முயற்சிக்க "book" அனுப்பவும்.`,
  personNotFound: 'நீங்கள் புதியவர் போல் தெரிகிறது! உங்கள் கணக்கை அமைக்கலாம்.',
  otpSent: 'உங்கள் தொலைபேசிக்கு OTP அனுப்பப்பட்டுள்ளது. OTP ஐ உள்ளிடவும்:',
  invalidOtp: 'இது சரியான OTP இல்லை. 4 அல்லது 6 இலக்க குறியீட்டை உள்ளிடவும்:',
  resendOtp: '🔄 OTP மீண்டும் அனுப்பு',
  otpResent: 'OTP மீண்டும் அனுப்பப்பட்டுள்ளது. உங்கள் தொலைபேசியைச் சரிபார்க்கவும்:',
  otpResendFailed: (err: string) => `OTP மீண்டும் அனுப்ப முடியவில்லை: ${err}`,
  otpVerified: 'தொலைபேசி வெற்றிகரமாக சரிபார்க்கப்பட்டது!',
  otpVerifyFailed: (err: string) => `OTP சரிபார்ப்பு தோல்வி: ${err}\nமீண்டும் முயற்சிக்கவும்:`,

  // Origin & destination
  noPlacesFound: 'இடங்கள் எதுவும் கிடைக்கவில்லை. வேறு தேடலை முயற்சிக்கவும்:',

  // Ride search & estimates

  // Booking
  track: '📲 கண்காணி:',
  callDriver: '📞 அழைக்கவும்',
  cancelRide: '❌ ரத்து செய்',
  driverLabel: (name: string) => `👤 டிரைவர்: *${name}*`,
  vehicleLabel: (number: string) => `🔢 வாகனம்: *${number}*`,
  phoneLabel: (phone: string) => `📞 தொலைபேசி: *${phone}*`,
  otpLabel: (otp: string) => `🔑 OTP: *${otp}*`,
  driverPhone: (phone: string) => `📞 டிரைவரின் எண்: *${phone}*\n\nநீங்கள் நேரடியாக அழைக்கலாம்.`,
  driverDetailsNotAvailable: 'டிரைவர் விவரங்கள் இன்னும் கிடைக்கவில்லை. சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.',
  noActiveRide: 'செயலில் உள்ள சவாரி எதுவும் கிடைக்கவில்லை.',

  // No driver found
  mainMenu: '🏠 முதன்மை பட்டியல்',

  // Status
  activeRide: '📍 செயலில் உள்ள சவாரி\n',
  noActiveRidesBook: '🔍 செயலில் உள்ள சவாரிகள் எதுவும் கிடைக்கவில்லை.\n\nஒன்றை புக் செய்ய விரும்புகிறீர்களா?',

  // Cancel
  cancelConfirm: '⚠️ உங்கள் சவாரியை ரத்து செய்ய விரும்புகிறீர்களா?',
  cancelConfirmWithDriver: (driver: string, vehicle?: string) =>
    `⚠️ *${driver}*${vehicle ? ` (${vehicle})` : ''} உடனான சவாரியை ரத்து செய்யவா?`,
  yesCancelIt: '✅ ஆம், ரத்து செய்',
  noKeepIt: '🔙 வேண்டாம், தொடரவும்',
  rideCancelled: 'சவாரி ரத்து செய்யப்பட்டது. ✅',
  rideCompleted: 'இந்த சவாரி ஏற்கனவே முடிவடைந்துவிட்டது, ரத்து செய்ய இயலாது.',
  rideAlreadyCancelled: 'இந்த சவாரி ஏற்கனவே ரத்து செய்யப்பட்டுள்ளது.',
  rideInProgress: '⚠️ உங்கள் சவாரி ஏற்கனவே நடைபெற்றுக்கொண்டிருக்கிறது, ரத்து செய்ய இயலாது.',
  cancelFailed: (err: string) => `ரத்து செய்ய இயலவில்லை: ${err}`,
  cancelled: 'ரத்து செய்யப்பட்டது.',
  whatToDo: '\n\nநீங்கள் என்ன செய்ய விரும்புகிறீர்கள்?',

  // SOS & safety
  rideNotStarted: '🕐 சவாரி இன்னும் தொடங்கவில்லை — டிரைவர் வழியில் இருக்கிறார்.',
  rideInProgressStatus: '🚗 சவாரி நடைபெற்றுக்கொண்டிருக்கிறது.',
  sosButton: '🚨 SOS',
  call112Button: '📞 112 அழைக்கவும்',
  sosConfirm: '⚠️ SOS எச்சரிக்கையை அனுப்ப விரும்புகிறீர்களா? இது அவசர தொடர்புகள் மற்றும் நம்ம யாத்ரி பாதுகாப்பு குழுவிற்கு தெரிவிக்கும்.',
  yesTriggerSOS: '🚨 ஆம், SOS அனுப்பு',
  noGoBack: '🔙 வேண்டாம், திரும்பு',
  sosTriggered: '🚨 SOS எச்சரிக்கை அனுப்பப்பட்டது. பாதுகாப்பாக இருங்கள் — உதவி வருகிறது.\n\nஉடனடி அவசர உதவிக்கு 112 ஐ அழைக்கலாம்.',
  sosFailed: (err: string) => `SOS அனுப்ப இயலவில்லை: ${err}\n\nதயவுசெய்து அவசர உதவிக்கு நேரடியாக 112 ஐ அழைக்கவும்.`,
  markSafeButton: '✅ பாதுகாப்பானது எனக் குறிக்கவும்',
  markSafeConfirm: 'உங்கள் சவாரியை பாதுகாப்பானது எனக் குறிக்க விரும்புகிறீர்களா? இது SOS எச்சரிக்கையை ரத்து செய்யும்.',
  yesMarkSafe: '✅ ஆம், நான் பாதுகாப்பாக இருக்கிறேன்',
  markedSafe: '✅ உங்கள் சவாரி பாதுகாப்பானது எனக் குறிக்கப்பட்டது. SOS எச்சரிக்கை ரத்து செய்யப்பட்டது.',
  markSafeFailed: (err: string) => `பாதுகாப்பானது எனக் குறிக்க இயலவில்லை: ${err}`,

  // Flexi (location-only metered booking)
  welcome: '🙏 வணக்கம்! நான் உங்கள் Namma Yatri உதவியாளர்\n\nஆட்டோ புக் செய்ய தயாரா?',
  flexiSharePrompt: 'டிரைவர் உங்களை எங்கிருந்து அழைத்துச் செல்ல வேண்டும்? 📍',
  flexiFareRate: (base: number, perKm: number) => `🛺 மீட்டர் ஆட்டோ · ₹${base} + ₹${perKm}/கிமீ முதல்`,
  flexiConfirmPickup: (address: string) => `📍 உங்கள் இருப்பிடம்: *${address}* அருகில்.\n\nதொடரலாமா?`,
  flexiConfirmSavedPlace: (name: string) => `📍 நீங்கள் சேமித்த இடத்தை அனுப்பியுள்ளீர்கள்:\n *${name}*.\nதொடரலாமா?`,
  pickupConfirmButton: '✅ பிக்அப்பை உறுதிப்படுத்து',
  pickupAdjustButton: '✏️ இடத்தை மாற்று',
  flexiFinding: '🛺 உங்களுக்கு அருகில் ஆட்டோ தேடுகிறோம்…',
  flexiStillFinding: (elapsed: number) => `⏳ இன்னும் உங்களுக்கு அருகில் ஆட்டோ தேடுகிறோம்… (${elapsed} வி)\n\nநிறுத்த "cancel" அனுப்பவும்.`,
  flexiCancelSearch: '❌ தேடலை நிறுத்து',
  flexiFoundDriver: (name: string) => `🛺 *${name}* வந்து கொண்டிருக்கிறார்.`,
  flexiDriverMeta: (rating: number, etaMin: number) => `⭐ ${rating} · ${etaMin} நிமிடம் தொலைவில்`,
  flexiOtpShare: (otp: string) => `🔑 தொடக்க OTP: *${otp}*`,
  flexiCallDriver: (phone: string) => `📞 டிரைவரை அழைக்கவும்: ${phone}`,
  flexiSafetyNote: 'டிரைவரிடம் உங்கள் சேருமிடத்தை உறுதிப்படுத்துங்கள்.',
  flexiNoAuto: '😔 இப்போது உங்களுக்கு அருகில் ஆட்டோ எதுவும் இல்லை. மீண்டும் முயற்சிக்கவும்.',
  flexiTryAgain: '🔁 மீண்டும் முயற்சிக்கவும்',
  flexiOutOfArea: (area: string) => `📍 இந்த இடம் எங்கள் சேவைப் பகுதிக்கு வெளியே உள்ளது.\n\nNamma Yatri ஆட்டோக்கள் தற்போது *${area}* இல் இயங்குகின்றன. அங்கிருந்து பிக்அப் முயற்சிக்கவும், அல்லது சிறிது நேரம் கழித்து பார்க்கவும்.`,

  // Flexi ride-progress updates (pushed by the background tracker)
  flexiArrived: (otp: string) => otp
    ? `🛺 உங்கள் ஆட்டோ வந்துவிட்டது!\nசவாரியைத் தொடங்க டிரைவரிடம் OTP ஐ சொல்லுங்கள்.\n\n🔑 OTP: *${otp}* `
    : '🛺 உங்கள் ஆட்டோ வந்துவிட்டது!\nபிக்அப் இடத்தில் உங்கள் டிரைவரைச் சந்திக்கவும்.',
  flexiRideStarted: "🚦 சவாரி தொடங்கியது! சவாரியை ரசியுங்கள்.\n\nஉங்கள் சேருமிடத்தை அடைந்துவிட்டீர்களா? கீழே *சவாரியை முடி* என்பதை அழுத்தவும்",
  flexiFareFinal: (amount: number, km?: number) =>
    km != null ? `💰 மொத்த கட்டணம்: *₹${amount}* · ${km} கிமீ` : `💰 மொத்த கட்டணம்: *₹${amount}*`,
  flexiFareUnavailable: '💰 உங்கள் கட்டணம் விரைவில் உறுதிப்படுத்தப்படும்.',
  flexiRideEnded: (fareLine: string) => `🎉 சவாரி முடிந்தது!\n\n${fareLine}\n\n🙏 Namma Yatri உடன் பயணித்ததற்கு நன்றி.`,
  flexiRideCancelled: '❌ உங்கள் சவாரி ரத்து செய்யப்பட்டது.\n\nஎங்காவது செல்ல வேண்டுமா? எப்போது வேண்டுமானாலும் மற்றொரு ஆட்டோ புக் செய்யுங்கள்.',
  flexiBookAnother: '🛺 மற்றொன்று புக் செய்',

  // Flexi end-ride OTP (rental)
  flexiEndRideButton: '🏁 சவாரியை முடி',
  flexiEndOtpShare: (otp: string) => `🏁 முடிவு OTP: *${otp}*\n\nஉங்கள் சேருமிடத்தை அடையும்போது இதை உங்கள் டிரைவரிடம் சொல்லுங்கள்.`,
  flexiEndOtpNotReady: "⏳ உங்கள் சவாரி இன்னும் தொடங்கவில்லை. நீங்கள் வழியில் சென்றவுடன் முடிவு OTP கிடைக்கும்.",
  flexiEndOtpFetchError: "⚠️ இப்போது உங்கள் சவாரியைப் பெற முடியவில்லை. சிறிது நேரத்தில் மீண்டும் *சவாரியை முடி* என்பதைத் தட்டவும்.",
  flexiRideAlreadyEnded: '✅ இந்த சவாரி ஏற்கனவே முடிந்துவிட்டது.',

  // Flexi "hi" மெனு — More டிராயர் + இது எப்படி வேலை செய்கிறது + ஆதரவு
  moreButton: '⚙️ மேலும் விருப்பங்கள்',
  moreTitle: 'நீங்கள் என்ன செய்ய விரும்புகிறீர்கள்?',
  howItWorks: '❓ எப்படி வேலை செய்கிறது',
  contactSupport: '💬 ஆதரவு',
  howItWorksText: "📹 *Namma Yatri எப்படி வேலை செய்கிறது*\n\n1️⃣ *சவாரி புக் செய்* என்பதை அழுத்தவும்\n2️⃣ உங்கள் பிக்அப் இடத்தைப் பகிரவும் 📍\n3️⃣ உங்களுக்கு அருகில் ஒரு ஆட்டோவைக் கண்டுபிடிக்கிறோம்\n4️⃣ உங்கள் டிரைவரைச் சந்தித்து, OTP ஐ சொல்லி, புறப்படுங்கள்!\n\n_(அறிமுக வீடியோ விரைவில் வரும்.)_",
  howItWorksCaption: 'Namma Yatri இல் ஆட்டோ எப்படி புக் செய்வது 🛺',
  supportMessage: (phone: string) => `💬 உதவி வேண்டுமா?\n\nஎங்களை அழைக்கவும்: ${phone}\n\nஉங்களுக்கு உதவ நாங்கள் இங்கே இருக்கிறோம். 🙏`,

  // சவாரி வகை தேர்வு + பொது சவாரி-தொடக்கம்
  rideTypePrompt: 'நீங்கள் எப்படி பயணிக்க விரும்புகிறீர்கள்?',
  rideTypeFlexi: '🛺 விரைவு சவாரி',
  rideTypeRegular: '🚗 சேருமிட சவாரி',
  rideStartedSimple: '🚦 உங்கள் சவாரி தொடங்கியது. பயணத்தை ரசியுங்கள்!',

  // சாதாரண ஒரு வழி ஃப்ளோ (பிக்அப் + டிராப் → ஆட்டோ கட்டணம் → புக்)
  regularDropPrompt: 'நீங்கள் எங்கு செல்கிறீர்கள்? 📍\n\nஉங்கள் டிராப் இடத்தைப் பகிரவும், அல்லது முகவரியைத் தட்டச்சு செய்யவும்.',
  regularSelectDrop: 'எது? உங்கள் டிராப்பைத் தேர்ந்தெடுக்கவும்:',
  regularFareConfirm: (fare: number, area: string) => `🛺 *${area}* வரை ஆட்டோ\n💰 சுமார் *₹${fare}*\n\nபுக் செய்யவா?`,
  regularConfirmButton: '✅ ஆட்டோ புக் செய்',
  regularChangeDropButton: '✏️ டிராப் மாற்று',
  regularSearching: '🛺 உங்கள் கட்டணத்தைப் பெறுகிறோம்…',
  regularBooking: '🛺 உங்கள் ஆட்டோவை புக் செய்கிறோம்…',

  // Errors
  somethingWentWrong: 'ஏதோ தவறு ஏற்பட்டது. மீண்டும் தொடங்க "book" அனுப்பவும்.',
  sessionExpired: 'அமர்வு காலாவதியானது. மீண்டும் அங்கீகரிக்க "book" அனுப்பவும்.',
  error: (msg: string) => `பிழை: ${msg}\nமீண்டும் தொடங்க "cancel" அனுப்பவும்.`,
};
