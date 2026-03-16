import { LanguageStrings } from './types';

export const hi: LanguageStrings = {
  languageName: 'Hindi',
  nativeLanguageName: 'हिन्दी',

  // Welcome & menu
  welcomeMessage: "👋 नमस्ते! मैं आपका नम्मा यात्री राइड सहायक हूँ।\n\nआप क्या करना चाहेंगे?",
  welcomeBack: '👋 वापस स्वागत है! आप क्या करना चाहेंगे?',
  bookARide: '🚕 राइड बुक करें',
  trackRide: '📍 राइड ट्रैक करें',
  chooseLanguage: '🌐 भाषा',
  selectLanguage: '🌐 अपनी पसंदीदा भाषा चुनें:',
  languageUpdated: (lang: string) => `✅ भाषा *${lang}* में बदल दी गई।`,
  moreLanguages: '➕ और भाषाएँ',

  // Auth flow
  needSignIn: '🔐 राइड ट्रैक करने के लिए साइन इन करना ज़रूरी है।\n\nक्या आप राइड बुक करना चाहेंगे?',
  enterPhone: 'पहली बार? अपना 10 अंकों का मोबाइल नंबर दर्ज करें:',
  invalidPhone: 'अमान्य फ़ोन नंबर। सही 10 अंकों का नंबर दर्ज करें:',
  enterAccessCode: 'अपना एक्सेस कोड दर्ज करें (नम्मा यात्री ऐप > प्रोफ़ाइल > हमारे बारे में):',
  authSuccess: 'सब तैयार है! आपको यह दोबारा नहीं करना होगा।',
  authSuccessFirstTime: 'सब तैयार है! चलिए राइड बुक करते हैं।',
  setupFailed: (err: string) => `सेटअप विफल: ${err}\nदोबारा कोशिश करने के लिए "book" भेजें।`,
  authFailed: (err: string) => `प्रमाणीकरण विफल: ${err}\nदोबारा कोशिश करने के लिए अपना फ़ोन नंबर दर्ज करें:`,
  sharePhone: 'कृपया अपना फ़ोन नंबर साझा करने के लिए नीचे दिए बटन पर टैप करें।',
  shareOwnPhone: 'कृपया अपना खुद का फ़ोन नंबर साझा करें, किसी और का नहीं।',
  sharePhonePrompt: 'अपना नंबर साझा करने के लिए बटन पर टैप करें:',
  couldNotReadPhone: 'आपका फ़ोन नंबर पढ़ नहीं पाए। कृपया दोबारा कोशिश करें।',
  allSet: 'सब तैयार है! चलिए राइड बुक करते हैं।',

  // Origin & destination
  whereToGo: 'आप कहाँ जाना चाहेंगे?',
  whereToGoWithRoutes: 'आप कहाँ जाना चाहेंगे?\n\nक्विक रूट चुनें या कोई जगह चुनें।\nआप जगह का नाम भी टाइप कर सकते हैं:',
  moreOptions: '➕ और विकल्प',
  pickSavedOrType: 'सेव की गई जगह चुनें या जगह का नाम टाइप करें:',
  typePickupPlace: 'कहाँ से पिकअप करना है?\nखोजने के लिए जगह का नाम टाइप करें:',
  selectPickup: 'पिकअप जगह चुनें:',
  pickup: (place: string) => `पिकअप: ${place}`,
  whereTo: 'कहाँ जाना है?\nखोजने के लिए जगह का नाम टाइप करें:',
  whereToWithSaved: 'कहाँ जाना है?\n\nकोई जगह चुनें या जगह का नाम टाइप करें:',
  selectDrop: 'ड्रॉप जगह चुनें:',
  drop: (place: string) => `ड्रॉप: ${place}`,
  noPlacesFound: 'कोई जगह नहीं मिली। कुछ और खोजें:',
  invalidChoice: (max: number) => `अमान्य विकल्प। 1-${max} में से चुनें:`,
  couldNotFindLocations: 'वे जगहें नहीं मिलीं। दोबारा कोशिश करने के लिए "book" भेजें।',
  fromLabel: (tag: string) => `📍 से: ${tag}`,
  typeDropPlace: 'कहाँ उतरना है?\nखोजने के लिए जगह का नाम टाइप करें:',

  // Ride search & estimates
  searchingRides: 'राइड खोज रहे हैं...',
  noRidesAvailable: 'अभी कोई राइड उपलब्ध नहीं है। दोबारा कोशिश करने के लिए "book" भेजें।',
  noRidesAvailableRetry: '😔 अभी कोई राइड उपलब्ध नहीं है। आप क्या करना चाहेंगे?',
  basedOnPastRides: '🕐 आपकी पिछली राइड के आधार पर:',
  availableRides: 'उपलब्ध राइड:',
  availableRidesForRoute: 'आपके रूट के लिए उपलब्ध राइड:',

  // Booking
  booking: (tier: string, fare: number) => `${tier} (₹${fare}) बुक कर रहे हैं...`,
  stillSearching: (elapsed: number) => `⏳ अभी भी पास में ड्राइवर खोज रहे हैं... (${elapsed}s)\n\nरोकने के लिए "cancel" भेजें।`,
  rideConfirmed: '🎉 राइड कन्फ़र्म हो गई!\n',
  rideBooked: '✅ राइड बुक हो गई!',
  waitingForDriver: 'ड्राइवर की प्रतीक्षा हो रही है...',
  trackYourRide: '📲 अपनी राइड ट्रैक करें:',
  track: '📲 ट्रैक:',
  callDriver: '📞 कॉल करें',
  cancelRide: '❌ रद्द करें',
  driverLabel: (name: string) => `👤 ड्राइवर: *${name}*`,
  vehicleLabel: (number: string) => `🔢 गाड़ी: *${number}*`,
  phoneLabel: (phone: string) => `📞 फ़ोन: *${phone}*`,
  otpLabel: (otp: string) => `🔑 OTP: *${otp}*`,
  driverPhone: (phone: string) => `📞 ड्राइवर का नंबर: *${phone}*\n\nआप उन्हें सीधे कॉल कर सकते हैं।`,
  driverDetailsNotAvailable: 'ड्राइवर की जानकारी अभी उपलब्ध नहीं है। कृपया कुछ देर बाद कोशिश करें।',
  noActiveRide: 'कोई चालू राइड नहीं मिली।',

  // No driver found
  noDriverFound: (tier: string) => `😔 3 मिनट में *${tier}* के लिए कोई ड्राइवर नहीं मिला।\n\nआप क्या करना चाहेंगे?`,
  retrySameVehicle: '🔄 वही गाड़ी फिर से खोजें',
  tryDifferentVehicle: '🚗 अलग गाड़ी आज़माएँ',
  mainMenu: '🏠 मुख्य मेनू',
  retrying: (tier: string) => `🔄 ${tier} फिर से खोज रहे हैं...`,
  tierNotAvailable: (tier: string) => `${tier} अभी उपलब्ध नहीं है। ये विकल्प उपलब्ध हैं:`,
  tryAgain: '🔄 दोबारा कोशिश करें',

  // Status
  activeRide: '📍 चालू राइड\n',
  noActiveRides: 'कोई चालू राइड नहीं मिली। नई राइड शुरू करने के लिए "book" भेजें।',
  noActiveRidesBook: '🔍 कोई चालू राइड नहीं मिली।\n\nक्या आप राइड बुक करना चाहेंगे?',

  // Cancel
  cancelConfirm: '⚠️ क्या आप वाकई अपनी राइड रद्द करना चाहते हैं?',
  cancelConfirmWithDriver: (driver: string, vehicle?: string) =>
    `⚠️ *${driver}*${vehicle ? ` (${vehicle})` : ''} के साथ राइड रद्द करें?`,
  yesCancelIt: '✅ हाँ, रद्द करें',
  noKeepIt: '🔙 नहीं, रहने दें',
  rideSearchCancelled: 'राइड खोज रद्द कर दी गई।',
  rideCancelled: 'राइड रद्द हो गई। ✅',
  rideCompleted: 'यह राइड पहले ही पूरी हो चुकी है और रद्द नहीं की जा सकती।',
  rideAlreadyCancelled: 'यह राइड पहले ही रद्द हो चुकी है।',
  rideInProgress: '⚠️ आपकी राइड चल रही है और रद्द नहीं की जा सकती।',
  cancelFailed: (err: string) => `रद्द नहीं हो सकी: ${err}`,
  cancelled: 'रद्द हो गया।',
  whatToDo: '\n\nआप क्या करना चाहेंगे?',

  // Errors
  somethingWentWrong: 'कुछ गड़बड़ हो गई। दोबारा शुरू करने के लिए "book" भेजें।',
  sessionExpired: 'सत्र समाप्त हो गया। पुनः प्रमाणित करने के लिए "book" भेजें।',
  error: (msg: string) => `त्रुटि: ${msg}\nदोबारा शुरू करने के लिए "cancel" भेजें।`,
  rideBeingBooked: 'आपकी राइड बुक हो रही है। कृपया प्रतीक्षा करें या रद्द करने के लिए "cancel" भेजें।',
};
