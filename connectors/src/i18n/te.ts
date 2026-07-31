import { LanguageStrings } from './types';

export const te: LanguageStrings = {
  languageName: 'Telugu',
  nativeLanguageName: 'తెలుగు',

  // Welcome & menu
  bookARide: '🚕 రైడ్ బుక్ చేయండి',
  trackRide: '📍 రైడ్ ట్రాక్ చేయండి',
  chooseLanguage: '🌐 భాష',
  selectLanguage: '🌐 మీకు నచ్చిన భాషను ఎంచుకోండి:',
  languageUpdated: (lang: string) => `✅ భాష *${lang}*కి మార్చబడింది.`,
  moreLanguages: '➕ మరిన్ని భాషలు',

  // Auth flow
  setupFailed: (err: string) => `సెటప్ విఫలమైంది: ${err}\nమళ్ళీ ప్రయత్నించడానికి "book" పంపండి.`,
  personNotFound: 'మీరు కొత్తవారు అనిపిస్తోంది! మీ ఖాతాను సెటప్ చేద్దాం.',
  otpSent: 'మీ ఫోన్‌కు OTP పంపబడింది. దయచేసి OTP నమోదు చేయండి:',
  invalidOtp: 'ఇది చెల్లుబాటు అయ్యే OTP కాదు. దయచేసి 4 లేదా 6 అంకెల కోడ్ నమోదు చేయండి:',
  resendOtp: '🔄 OTP మళ్ళీ పంపు',
  otpResent: 'OTP మళ్ళీ పంపబడింది. దయచేసి మీ ఫోన్ తనిఖీ చేయండి:',
  otpResendFailed: (err: string) => `OTP మళ్ళీ పంపలేకపోయాము: ${err}`,
  otpVerified: 'ఫోన్ విజయవంతంగా ధృవీకరించబడింది!',
  otpVerifyFailed: (err: string) => `OTP ధృవీకరణ విఫలమైంది: ${err}\nదయచేసి మళ్ళీ ప్రయత్నించండి:`,

  // Origin & destination
  noPlacesFound: 'ప్రదేశాలు కనుగొనబడలేదు. వేరే పేరుతో ప్రయత్నించండి:',

  // Ride search & estimates

  // Booking
  track: '📲 ట్రాక్:',
  callDriver: '📞 కాల్ చేయండి',
  cancelRide: '❌ రద్దు చేయండి',
  driverLabel: (name: string) => `👤 డ్రైవర్: *${name}*`,
  vehicleLabel: (number: string) => `🔢 వాహనం: *${number}*`,
  phoneLabel: (phone: string) => `📞 ఫోన్: *${phone}*`,
  otpLabel: (otp: string) => `🔑 OTP: *${otp}*`,
  driverPhone: (phone: string) => `📞 డ్రైవర్ నంబర్: *${phone}*\n\nమీరు వారికి నేరుగా కాల్ చేయవచ్చు.`,
  driverDetailsNotAvailable: 'డ్రైవర్ వివరాలు ఇంకా అందుబాటులో లేవు. దయచేసి కొద్దిసేపట్లో మళ్ళీ ప్రయత్నించండి.',
  noActiveRide: 'యాక్టివ్ రైడ్ కనుగొనబడలేదు.',

  // No driver found
  mainMenu: '🏠 ప్రధాన మెనూ',

  // Status
  activeRide: '📍 యాక్టివ్ రైడ్\n',
  noActiveRidesBook: '🔍 యాక్టివ్ రైడ్‌లు కనుగొనబడలేదు.\n\nఒకటి బుక్ చేయాలనుకుంటున్నారా?',

  // Cancel
  cancelConfirm: '⚠️ మీరు ఖచ్చితంగా మీ రైడ్ రద్దు చేయాలనుకుంటున్నారా?',
  cancelConfirmWithDriver: (driver: string, vehicle?: string) =>
    `⚠️ *${driver}*${vehicle ? ` (${vehicle})` : ''} తో రైడ్ రద్దు చేయాలా?`,
  yesCancelIt: '✅ అవును, రద్దు చేయండి',
  noKeepIt: '🔙 వద్దు, ఉంచండి',
  rideCancelled: 'రైడ్ రద్దు చేయబడింది. ✅',
  rideCompleted: 'ఈ రైడ్ ఇప్పటికే పూర్తయింది మరియు రద్దు చేయలేము.',
  rideAlreadyCancelled: 'ఈ రైడ్ ఇప్పటికే రద్దు చేయబడింది.',
  rideInProgress: '⚠️ మీ రైడ్ ఇప్పటికే ప్రగతిలో ఉంది మరియు రద్దు చేయలేము.',
  cancelFailed: (err: string) => `రద్దు చేయలేకపోయాము: ${err}`,
  cancelled: 'రద్దు చేయబడింది.',
  whatToDo: '\n\nమీరు ఏమి చేయాలనుకుంటున్నారు?',

  // SOS & safety
  rideNotStarted: '🕐 రైడ్ ఇంకా ప్రారంభం కాలేదు — డ్రైవర్ వస్తున్నారు.',
  rideInProgressStatus: '🚗 రైడ్ ప్రగతిలో ఉంది.',
  sosButton: '🚨 SOS',
  call112Button: '📞 112 కి కాల్ చేయండి',
  sosConfirm: '⚠️ SOS అలర్ట్ పంపాలనుకుంటున్నారా? ఇది ఎమర్జెన్సీ కాంటాక్ట్‌లకు మరియు నమ్మ యాత్రి సేఫ్టీ టీమ్‌కు తెలియజేస్తుంది.',
  yesTriggerSOS: '🚨 అవును, SOS పంపండి',
  noGoBack: '🔙 వద్దు, వెనక్కి వెళ్ళండి',
  sosTriggered: '🚨 SOS అలర్ట్ పంపబడింది. సురక్షితంగా ఉండండి — సహాయం వస్తోంది.\n\nతక్షణ ఎమర్జెన్సీ సహాయం కోసం 112 కి కూడా కాల్ చేయవచ్చు.',
  sosFailed: (err: string) => `SOS పంపలేకపోయాము: ${err}\n\nదయచేసి ఎమర్జెన్సీ సహాయం కోసం నేరుగా 112 కి కాల్ చేయండి.`,
  markSafeButton: '✅ సురక్షితం అని గుర్తించండి',
  markSafeConfirm: 'మీ రైడ్‌ను సురక్షితం అని గుర్తించాలనుకుంటున్నారా? ఇది SOS అలర్ట్‌ను రద్దు చేస్తుంది.',
  yesMarkSafe: '✅ అవును, నేను సురక్షితం',
  markedSafe: '✅ మీ రైడ్ సురక్షితం అని గుర్తించబడింది. SOS అలర్ట్ రద్దు చేయబడింది.',
  markSafeFailed: (err: string) => `సురక్షితం అని గుర్తించలేకపోయాము: ${err}`,

  // Flexi (location-only metered booking)
  welcome: '🙏 నమస్కారం! నేను మీ Namma Yatri అసిస్టెంట్\n\nఆటో బుక్ చేయడానికి సిద్ధంగా ఉన్నారా?',
  flexiSharePrompt: 'డ్రైవర్ మిమ్మల్ని ఎక్కడ నుండి తీసుకెళ్లాలి? 📍',
  flexiFareBreakup: (base?: number, perKm?: number, nightMult?: number, nightWindow?: string) => {
    const lines: string[] = [];
    if (base != null) lines.push(`మొదటి 2 కిమీ: ₹${base}`);
    if (perKm != null) lines.push(`అదనం: ₹${perKm}/కిమీ`);
    if (nightMult != null && nightWindow) lines.push(`🌙 రాత్రి (${nightWindow}): ${nightMult}× ఛార్జీ`);
    return lines.join('\n');
  },
  flexiFareFrom: (amount: number) => `🛺 ₹${amount} నుండి`,
  flexiConfirmPickup: (address: string, fareLine?: string) =>
    `📍 మీ లొకేషన్: *${address}* దగ్గర.${fareLine ? `\n\n${fareLine}` : ''}\n\nరైడ్ తర్వాత డ్రైవర్‌కు నగదు/UPI చెల్లించండి.\nబుక్ చేయాలా?`,
  pickupConfirmButton: '✅ పికప్ నిర్ధారించండి',
  pickupAdjustButton: '✏️ స్థలం మార్చు',
  flexiFinding: '🛺 మీ దగ్గర ఆటో వెతుకుతున్నాము. 1 నిమిషం వేచి ఉండండి. WhatsApp మూసివేయవద్దు.',
  flexiStillFinding: '⏳ ఇంకా మీ దగ్గర ఆటో వెతుకుతున్నాము…\n\nఆపడానికి "cancel" పంపండి.',
  flexiCancelSearch: '❌ శోధన ఆపు',
  flexiFoundDriver: (name: string) => `🛺 *${name}* వస్తున్నారు.`,
  flexiDriverMeta: (rating: number, etaMin: number) => `⭐ ${rating} · ${etaMin} నిమిషాల దూరంలో`,
  flexiOtpShare: (otp: string) => `🔑 స్టార్ట్ OTP: *${otp}*`,
  flexiCallDriver: (phone: string) => `📞 డ్రైవర్‌కు కాల్ చేయండి: ${phone}`,
  flexiSafetyNote: 'డ్రైవర్‌తో మీ గమ్యస్థానాన్ని నిర్ధారించుకోండి.',
  flexiNoAuto: '😔 ప్రస్తుతం ఖాళీ ఆటో లేదు. 2 నిమిషాల తర్వాత మళ్లీ ప్రయత్నించండి.',
  flexiTryAgain: '🔁 మళ్లీ ప్రయత్నించండి',
  flexiOutOfArea: (area: string) => `📍 ఈ ప్రదేశం మా సేవా ప్రాంతం వెలుపల ఉంది.\n\nNamma Yatri ఆటోలు ప్రస్తుతం *${area}* లో అందుబాటులో ఉన్నాయి. అక్కడి నుండి పికప్ ప్రయత్నించండి, లేదా కొద్దిసేపటి తర్వాత చూడండి.`,

  // Flexi ride-progress updates (pushed by the background tracker)
  flexiArrived: (otp: string) => otp
    ? `🛺 డ్రైవర్ వచ్చారు! డ్రైవర్‌కు స్టార్ట్ OTP చెప్పండి.\n\n🔑 OTP: ${otp}`
    : '🛺 డ్రైవర్ వచ్చారు! దయచేసి పికప్ పాయింట్ వద్ద మీ డ్రైవర్‌ను కలవండి.',
  flexiFareUnavailable: '💰 మీ ఛార్జీ త్వరలో నిర్ధారించబడుతుంది.',
  flexiRideFinishedHeader: '🎉 రైడ్ పూర్తయింది.',
  flexiPayDriver: (amount: number) => `💰 డ్రైవర్‌కు ₹${amount} నగదు/UPI ఇవ్వండి`,
  flexiDistanceLine: (km: number) => `📏 ${km} కిమీ`,
  flexiRideCancelled: '❌ మీ రైడ్ రద్దు చేయబడింది.\n\nఎక్కడికైనా వెళ్లాలా? ఎప్పుడైనా మరో ఆటో బుక్ చేయండి.',
  flexiBookAnother: '🛺 మరొకటి బుక్ చేయండి',
  appDownloadNudge: '🙏 Namma Yatri app డౌన్‌లోడ్ చేయండి!\nhttps://play.google.com/store/apps/details?id=in.juspay.nammayatri',


  // Flexi "hi" మెను — More డ్రాయర్ + ఇది ఎలా పనిచేస్తుంది + మద్దతు
  moreButton: '⚙️ మరిన్ని ఎంపికలు',
  moreTitle: 'మీరు ఏమి చేయాలనుకుంటున్నారు?',
  howItWorks: '❓ ఇది ఎలా పనిచేస్తుంది',
  contactSupport: '💬 మద్దతు',
  howItWorksText: "📹 *Namma Yatri ఎలా పనిచేస్తుంది*\n\n1️⃣ *రైడ్ బుక్ చేయండి* నొక్కండి\n2️⃣ మీ పికప్ ప్రదేశం షేర్ చేయండి 📍\n3️⃣ మేము మీ దగ్గర ఆటోను కనుగొంటాము\n4️⃣ మీ డ్రైవర్‌ను కలవండి, OTP చెప్పండి, బయలుదేరండి!\n\n_(పరిచయ వీడియో త్వరలో వస్తోంది.)_",
  howItWorksCaption: 'Namma Yatri లో ఆటో ఎలా బుక్ చేయాలి 🛺',
  supportMessage: (phone: string) => `💬 సహాయం కావాలా?\n\nమాకు కాల్ చేయండి: ${phone}\n\nమీకు సహాయం చేయడానికి మేము ఇక్కడ ఉన్నాము. 🙏`,

  // రైడ్-రకం ఎంపిక + సాధారణ రైడ్-ప్రారంభం
  rideTypePrompt: 'మీరు ఎలా ప్రయాణించాలనుకుంటున్నారు?',
  rideTypeFlexi: '🛺 త్వరిత రైడ్',
  rideTypeRegular: '🚗 గమ్యం రైడ్',
  rideStartedSimple: '🚦 మీ రైడ్ ప్రారంభమైంది. ప్రయాణాన్ని ఆస్వాదించండి!',

  // సాధారణ వన్-వే ఫ్లో (పికప్ + డ్రాప్ → ఆటో ఛార్జీ → బుక్)
  regularDropPrompt: 'మీరు ఎక్కడికి వెళ్తున్నారు? 📍\n\nమీ డ్రాప్ లొకేషన్ షేర్ చేయండి, లేదా చిరునామా టైప్ చేయండి.',
  regularSelectDrop: 'ఏది? మీ డ్రాప్ ఎంచుకోండి:',
  regularFareConfirm: (fare: number, area: string) => `🛺 *${area}* వరకు ఆటో\n💰 సుమారు *₹${fare}*\n\nబుక్ చేయనా?`,
  regularConfirmButton: '✅ ఆటో బుక్ చేయండి',
  regularChangeDropButton: '✏️ డ్రాప్ మార్చు',
  regularSearching: '🛺 మీ ఛార్జీని తెస్తున్నాము…',
  regularBooking: '🛺 మీ ఆటోను బుక్ చేస్తున్నాము…',

  // Errors
  somethingWentWrong: 'ఏదో తప్పు జరిగింది. మళ్ళీ ప్రారంభించడానికి "book" పంపండి.',
  sessionExpired: 'సెషన్ గడువు ముగిసింది. మళ్ళీ ప్రామాణీకరించడానికి "book" పంపండి.',
  error: (msg: string) => `లోపం: ${msg}\nమళ్ళీ ప్రారంభించడానికి "cancel" పంపండి.`,
};
