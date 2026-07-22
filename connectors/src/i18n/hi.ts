import { LanguageStrings } from './types';

export const hi: LanguageStrings = {
  languageName: 'Hindi',
  nativeLanguageName: 'हिन्दी',

  // Welcome & menu
  bookARide: '🚕 राइड बुक करें',
  trackRide: '📍 राइड ट्रैक करें',
  chooseLanguage: '🌐 भाषा',
  selectLanguage: '🌐 अपनी पसंदीदा भाषा चुनें:',
  languageUpdated: (lang: string) => `✅ भाषा *${lang}* में बदल दी गई।`,
  moreLanguages: '➕ और भाषाएँ',

  // Auth flow
  setupFailed: (err: string) => `सेटअप विफल: ${err}\nदोबारा कोशिश करने के लिए "book" भेजें।`,

  // Registration (OTP-based)
  personNotFound: 'लगता है आप नए हैं! चलिए आपका अकाउंट सेटअप करते हैं।',
  otpSent: 'आपके फ़ोन पर OTP भेजा गया है। कृपया OTP दर्ज करें:',
  invalidOtp: 'यह वैध OTP नहीं लगता। कृपया 4 या 6 अंकों का कोड दर्ज करें:',
  resendOtp: '🔄 OTP दोबारा भेजें',
  otpResent: 'OTP दोबारा भेजा गया है। कृपया अपना फ़ोन चेक करें:',
  otpResendFailed: (err: string) => `OTP दोबारा नहीं भेज पाए: ${err}`,
  otpVerified: 'फ़ोन सत्यापित हो गया!',
  otpVerifyFailed: (err: string) => `OTP सत्यापन विफल: ${err}\nकृपया दोबारा कोशिश करें:`,

  // Origin & destination
  noPlacesFound: 'कोई जगह नहीं मिली। कुछ और खोजें:',

  // Ride search & estimates

  // Booking
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
  mainMenu: '🏠 मुख्य मेनू',

  // Status
  activeRide: '📍 चालू राइड\n',
  noActiveRidesBook: '🔍 कोई चालू राइड नहीं मिली।\n\nक्या आप राइड बुक करना चाहेंगे?',

  // Cancel
  cancelConfirm: '⚠️ क्या आप वाकई अपनी राइड रद्द करना चाहते हैं?',
  cancelConfirmWithDriver: (driver: string, vehicle?: string) =>
    `⚠️ *${driver}*${vehicle ? ` (${vehicle})` : ''} के साथ राइड रद्द करें?`,
  yesCancelIt: '✅ हाँ, रद्द करें',
  noKeepIt: '🔙 नहीं, रहने दें',
  rideCancelled: 'राइड रद्द हो गई। ✅',
  rideCompleted: 'यह राइड पहले ही पूरी हो चुकी है और रद्द नहीं की जा सकती।',
  rideAlreadyCancelled: 'यह राइड पहले ही रद्द हो चुकी है।',
  rideInProgress: '⚠️ आपकी राइड चल रही है और रद्द नहीं की जा सकती।',
  cancelFailed: (err: string) => `रद्द नहीं हो सकी: ${err}`,
  cancelled: 'रद्द हो गया।',
  whatToDo: '\n\nआप क्या करना चाहेंगे?',

  // SOS & safety
  rideNotStarted: '🕐 राइड अभी शुरू नहीं हुई — ड्राइवर रास्ते में है।',
  rideInProgressStatus: '🚗 राइड चल रही है।',
  sosButton: '🚨 SOS',
  call112Button: '📞 112 पर कॉल करें',
  sosConfirm: '⚠️ क्या आप SOS अलर्ट भेजना चाहते हैं? यह आपातकालीन संपर्कों और नम्मा यात्री सुरक्षा टीम को सूचित करेगा।',
  yesTriggerSOS: '🚨 हाँ, SOS भेजें',
  noGoBack: '🔙 नहीं, वापस जाएँ',
  sosTriggered: '🚨 SOS अलर्ट भेज दिया गया है। सुरक्षित रहें — मदद आ रही है।\n\nआप तुरंत आपातकालीन सहायता के लिए 112 पर भी कॉल कर सकते हैं।',
  sosFailed: (err: string) => `SOS नहीं भेज सके: ${err}\n\nकृपया आपातकालीन मदद के लिए सीधे 112 पर कॉल करें।`,
  markSafeButton: '✅ सुरक्षित चिह्नित करें',
  markSafeConfirm: 'क्या आप अपनी राइड को सुरक्षित चिह्नित करना चाहते हैं? इससे SOS अलर्ट रद्द हो जाएगा।',
  yesMarkSafe: '✅ हाँ, मैं सुरक्षित हूँ',
  markedSafe: '✅ आपकी राइड सुरक्षित चिह्नित कर दी गई है। SOS अलर्ट रद्द हो गया है।',
  markSafeFailed: (err: string) => `सुरक्षित चिह्नित नहीं कर सके: ${err}`,

  // Flexi (location-only metered booking)
  welcome: '🙏 नमस्ते! मैं आपका Namma Yatri सहायक हूँ\n\nऑटो बुक करने के लिए तैयार हैं?',
  flexiSharePrompt: 'ड्राइवर आपको कहाँ से लेगा? 📍',
  flexiPricing: '📍 आपका किराया देख रहे हैं…',
  flexiFareBreakup: (base?: number, perKm?: number, nightMult?: number, nightWindow?: string) => {
    const fare = base != null && perKm != null ? `₹${base} + ₹${perKm}/किमी`
      : base != null ? `₹${base}`
      : perKm != null ? `₹${perKm}/किमी` : '';
    const night = nightMult != null && nightWindow ? ` · ${nightWindow}: ${nightMult}× किराया` : '';
    return `🛺 ${fare}${night}`;
  },
  flexiFareFrom: (amount: number) => `🛺 ₹${amount} से`,
  flexiConfirmPickup: (address: string, fareLine?: string) =>
    `📍 आपकी लोकेशन: *${address}* के पास।${fareLine ? `\n\n${fareLine}` : ''}\n\nआगे बढ़ें?`,
  flexiConfirmSavedPlace: (name: string, fareLine?: string) =>
    `📍 आपने एक सेव की गई जगह भेजी:\n *${name}*।${fareLine ? `\n\n${fareLine}` : ''}\nआगे बढ़ें?`,
  pickupConfirmButton: '✅ पिकअप कन्फर्म करें',
  pickupAdjustButton: '✏️ जगह बदलें',
  flexiFinding: '🛺 आपके पास ऑटो ढूँढ रहे हैं…',
  flexiStillFinding: (elapsed: number) => `⏳ अभी भी आपके पास ऑटो ढूँढ रहे हैं… (${elapsed} सेकंड)\n\nरोकने के लिए "cancel" भेजें।`,
  flexiCancelSearch: '❌ खोज रोकें',
  flexiFoundDriver: (name: string) => `🛺 *${name}* आ रहे हैं।`,
  flexiDriverMeta: (rating: number, etaMin: number) => `⭐ ${rating} · ${etaMin} मिनट दूर`,
  flexiOtpShare: (otp: string) => `🔑 स्टार्ट OTP: *${otp}*`,
  flexiCallDriver: (phone: string) => `📞 ड्राइवर को कॉल करें: ${phone}`,
  flexiSafetyNote: 'ड्राइवर के साथ अपना गंतव्य पक्का कर लें।',
  flexiNoAuto: '😔 अभी आपके पास कोई ऑटो उपलब्ध नहीं है। कृपया फिर कोशिश करें।',
  flexiTryAgain: '🔁 फिर कोशिश करें',
  flexiOutOfArea: (area: string) => `📍 यह जगह हमारी सेवा क्षेत्र से बाहर लगती है।\n\nNamma Yatri ऑटो फ़िलहाल *${area}* में उपलब्ध हैं। वहाँ से पिकअप आज़माएँ, या कुछ समय बाद देखें।`,

  // Flexi ride-progress updates (pushed by the background tracker)
  flexiArrived: (otp: string) => otp
    ? `🛺 आपका ऑटो आ गया है!\nराइड शुरू करने के लिए ड्राइवर को OTP बताएँ।\n\n🔑 OTP: *${otp}* `
    : '🛺 आपका ऑटो आ गया है!\nकृपया पिकअप पॉइंट पर अपने ड्राइवर से मिलें।',
  flexiFareFinal: (amount: number, km?: number) =>
    km != null ? `💰 कुल किराया: *₹${amount}* · ${km} किमी` : `💰 कुल किराया: *₹${amount}*`,
  flexiFareUnavailable: '💰 आपका किराया जल्द ही पक्का हो जाएगा।',
  flexiRideEnded: (fareLine: string) => `🎉 राइड पूरी हुई!\n\n${fareLine}\n\n🙏 Namma Yatri के साथ सफर करने के लिए धन्यवाद।`,
  flexiRideCancelled: '❌ आपकी राइड रद्द हो गई।\n\nकहीं जाना है? कभी भी दूसरा ऑटो बुक करें।',
  flexiBookAnother: '🛺 दूसरा बुक करें',


  // Flexi "hi" मेनू — More ड्रॉअर + यह कैसे काम करता है + सहायता
  moreButton: '⚙️ और विकल्प',
  moreTitle: 'आप क्या करना चाहेंगे?',
  howItWorks: '❓ यह कैसे काम करता है',
  contactSupport: '💬 सहायता',
  howItWorksText: "📹 *Namma Yatri कैसे काम करता है*\n\n1️⃣ *राइड बुक करें* पर टैप करें\n2️⃣ अपना पिकअप स्थान साझा करें 📍\n3️⃣ हम आपके पास एक ऑटो ढूँढते हैं\n4️⃣ अपने ड्राइवर से मिलें, OTP बताएँ, और चलें!\n\n_(परिचय वीडियो जल्द आ रहा है।)_",
  howItWorksCaption: 'Namma Yatri पर ऑटो कैसे बुक करें 🛺',
  supportMessage: (phone: string) => `💬 मदद चाहिए?\n\nहमें कॉल करें: ${phone}\n\nहम आपकी मदद के लिए यहाँ हैं। 🙏`,

  // राइड-टाइप चुनाव + सामान्य राइड-शुरू
  rideTypePrompt: 'आप कैसे यात्रा करना चाहेंगे?',
  rideTypeFlexi: '🛺 झटपट राइड',
  rideTypeRegular: '🚗 मंज़िल वाली राइड',
  rideStartedSimple: '🚦 आपकी राइड शुरू हो गई है। सफर का आनंद लें!',

  // सामान्य वन-वे फ्लो (पिकअप + ड्रॉप → ऑटो किराया → बुक)
  regularDropPrompt: 'आपको कहाँ जाना है? 📍\n\nअपनी ड्रॉप लोकेशन साझा करें, या पता टाइप करें।',
  regularSelectDrop: 'कौन सी? अपनी ड्रॉप चुनें:',
  regularFareConfirm: (fare: number, area: string) => `🛺 *${area}* तक ऑटो\n💰 लगभग *₹${fare}*\n\nबुक कर दूँ?`,
  regularConfirmButton: '✅ ऑटो बुक करें',
  regularChangeDropButton: '✏️ ड्रॉप बदलें',
  regularSearching: '🛺 आपका किराया ला रहे हैं…',
  regularBooking: '🛺 आपका ऑटो बुक कर रहे हैं…',

  // Errors
  somethingWentWrong: 'कुछ गड़बड़ हो गई। दोबारा शुरू करने के लिए "book" भेजें।',
  sessionExpired: 'सत्र समाप्त हो गया। पुनः प्रमाणित करने के लिए "book" भेजें।',
  error: (msg: string) => `त्रुटि: ${msg}\nदोबारा शुरू करने के लिए "cancel" भेजें।`,
};
