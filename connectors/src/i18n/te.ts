import { LanguageStrings } from './types';

export const te: LanguageStrings = {
  languageName: 'Telugu',
  nativeLanguageName: 'తెలుగు',

  // Welcome & menu
  welcomeMessage: "👋 స్వాగతం! నేను మీ నమ్మ యాత్రి రైడ్ సహాయకుడిని.\n\nమీరు ఏమి చేయాలనుకుంటున్నారు?",
  welcomeBack: '👋 తిరిగి స్వాగతం! మీరు ఏమి చేయాలనుకుంటున్నారు?',
  bookARide: '🚕 రైడ్ బుక్ చేయండి',
  trackRide: '📍 రైడ్ ట్రాక్ చేయండి',
  chooseLanguage: '🌐 భాష',
  selectLanguage: '🌐 మీకు నచ్చిన భాషను ఎంచుకోండి:',
  languageUpdated: (lang: string) => `✅ భాష *${lang}*కి మార్చబడింది.`,
  moreLanguages: '➕ మరిన్ని భాషలు',

  // Auth flow
  needSignIn: '🔐 రైడ్ ట్రాక్ చేయడానికి మీరు సైన్ ఇన్ అయి ఉండాలి.\n\nబదులుగా రైడ్ బుక్ చేయాలనుకుంటున్నారా?',
  enterPhone: 'మొదటిసారా? మీ 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి:',
  invalidPhone: 'చెల్లని ఫోన్ నంబర్. చెల్లుబాటు అయ్యే 10 అంకెల నంబర్ నమోదు చేయండి:',
  enterAccessCode: 'మీ యాక్సెస్ కోడ్ నమోదు చేయండి (నమ్మ యాత్రి యాప్ > ప్రొఫైల్ > మా గురించి):',
  authSuccess: "మీరు సిద్ధంగా ఉన్నారు! ఇది మళ్ళీ చేయాల్సిన అవసరం లేదు.",
  authSuccessFirstTime: "మీరు సిద్ధంగా ఉన్నారు! రైడ్ బుక్ చేద్దాం.",
  setupFailed: (err: string) => `సెటప్ విఫలమైంది: ${err}\nమళ్ళీ ప్రయత్నించడానికి "book" పంపండి.`,
  authFailed: (err: string) => `ప్రామాణీకరణ విఫలమైంది: ${err}\nమళ్ళీ ప్రయత్నించడానికి మీ ఫోన్ నంబర్ నమోదు చేయండి:`,
  sharePhone: 'దయచేసి మీ ఫోన్ నంబర్ షేర్ చేయడానికి క్రింది బటన్ నొక్కండి.',
  shareOwnPhone: "దయచేసి మీ స్వంత ఫోన్ నంబర్ షేర్ చేయండి, ఇతరుల నంబర్ కాదు.",
  sharePhonePrompt: 'మీ నంబర్ షేర్ చేయడానికి బటన్ నొక్కండి:',
  couldNotReadPhone: 'మీ ఫోన్ నంబర్ చదవలేకపోయాము. దయచేసి మళ్ళీ ప్రయత్నించండి.',
  allSet: "మీరు సిద్ధంగా ఉన్నారు! రైడ్ బుక్ చేద్దాం.",

  // Origin & destination
  whereToGo: 'మీరు ఎక్కడికి వెళ్ళాలనుకుంటున్నారు?',
  whereToGoWithRoutes: 'మీరు ఎక్కడికి వెళ్ళాలనుకుంటున్నారు?\n\nత్వరిత మార్గాలు లేదా ప్రదేశం ఎంచుకోండి.\nమీరు ప్రదేశం పేరు కూడా టైప్ చేయవచ్చు:',
  moreOptions: '➕ మరిన్ని ఎంపికలు',
  pickSavedOrType: 'సేవ్ చేసిన ప్రదేశం ఎంచుకోండి లేదా ప్రదేశం పేరు టైప్ చేయండి:',
  typePickupPlace: 'మీరు ఎక్కడ నుండి పికప్ అవుతున్నారు?\nవెతకడానికి ప్రదేశం పేరు టైప్ చేయండి:',
  selectPickup: 'పికప్ ప్రదేశం ఎంచుకోండి:',
  pickup: (place: string) => `పికప్: ${place}`,
  whereTo: 'ఎక్కడికి?\nవెతకడానికి ప్రదేశం పేరు టైప్ చేయండి:',
  whereToWithSaved: 'ఎక్కడికి?\n\nప్రదేశం ఎంచుకోండి లేదా ప్రదేశం పేరు టైప్ చేయండి:',
  typeDropPlace: 'మీరు ఎక్కడ దిగాలనుకుంటున్నారు?\nవెతకడానికి ప్రదేశం పేరు టైప్ చేయండి:',
  selectDrop: 'డ్రాప్ ప్రదేశం ఎంచుకోండి:',
  drop: (place: string) => `డ్రాప్: ${place}`,
  noPlacesFound: 'ప్రదేశాలు కనుగొనబడలేదు. వేరే పేరుతో ప్రయత్నించండి:',
  invalidChoice: (max: number) => `చెల్లని ఎంపిక. 1-${max} ఎంచుకోండి:`,
  couldNotFindLocations: 'ఆ ప్రదేశాలు కనుగొనబడలేదు. మళ్ళీ ప్రయత్నించడానికి "book" పంపండి.',
  fromLabel: (tag: string) => `📍 నుండి: ${tag}`,

  // Ride search & estimates
  searchingRides: 'రైడ్‌లు వెతుకుతున్నాము...',
  noRidesAvailable: 'ప్రస్తుతం రైడ్‌లు అందుబాటులో లేవు. మళ్ళీ ప్రయత్నించడానికి "book" పంపండి.',
  noRidesAvailableRetry: '😔 ప్రస్తుతం రైడ్‌లు అందుబాటులో లేవు. మీరు ఏమి చేయాలనుకుంటున్నారు?',
  basedOnPastRides: '🕐 మీ గత రైడ్‌ల ఆధారంగా:',
  availableRides: 'అందుబాటులో ఉన్న రైడ్‌లు:',
  availableRidesForRoute: 'మీ మార్గానికి అందుబాటులో ఉన్న రైడ్‌లు ఇవి:',

  // Booking
  booking: (tier: string, fare: number) => `${tier} (₹${fare}) బుక్ చేస్తున్నాము...`,
  stillSearching: (elapsed: number) => `⏳ ఇంకా సమీపంలో డ్రైవర్ కోసం వెతుకుతున్నాము... (${elapsed}s)\n\nఆపడానికి "cancel" పంపండి.`,
  rideConfirmed: '🎉 రైడ్ నిర్ధారించబడింది!\n',
  rideBooked: '✅ రైడ్ బుక్ అయింది!',
  waitingForDriver: 'డ్రైవర్ కేటాయింపు కోసం వేచి ఉన్నాము...',
  trackYourRide: '📲 మీ రైడ్ ట్రాక్ చేయండి:',
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
  noDriverFound: (tier: string) => `😔 3 నిమిషాల తర్వాత *${tier}* కోసం డ్రైవర్ దొరకలేదు.\n\nమీరు ఏమి చేయాలనుకుంటున్నారు?`,
  retrySameVehicle: '🔄 అదే వాహనంతో మళ్ళీ ప్రయత్నించండి',
  tryDifferentVehicle: '🚗 వేరే వాహనం ప్రయత్నించండి',
  mainMenu: '🏠 ప్రధాన మెనూ',
  retrying: (tier: string) => `🔄 ${tier} మళ్ళీ ప్రయత్నిస్తున్నాము...`,
  tierNotAvailable: (tier: string) => `${tier} ప్రస్తుతం అందుబాటులో లేదు. అందుబాటులో ఉన్న ఎంపికలు ఇవి:`,
  tryAgain: '🔄 మళ్ళీ ప్రయత్నించండి',

  // Status
  activeRide: '📍 యాక్టివ్ రైడ్\n',
  noActiveRides: 'యాక్టివ్ రైడ్‌లు కనుగొనబడలేదు. ఒకటి ప్రారంభించడానికి "book" పంపండి.',
  noActiveRidesBook: '🔍 యాక్టివ్ రైడ్‌లు కనుగొనబడలేదు.\n\nఒకటి బుక్ చేయాలనుకుంటున్నారా?',

  // Cancel
  cancelConfirm: '⚠️ మీరు ఖచ్చితంగా మీ రైడ్ రద్దు చేయాలనుకుంటున్నారా?',
  cancelConfirmWithDriver: (driver: string, vehicle?: string) =>
    `⚠️ *${driver}*${vehicle ? ` (${vehicle})` : ''} తో రైడ్ రద్దు చేయాలా?`,
  yesCancelIt: '✅ అవును, రద్దు చేయండి',
  noKeepIt: '🔙 వద్దు, ఉంచండి',
  rideSearchCancelled: 'రైడ్ వెతుకుడు రద్దు చేయబడింది.',
  rideCancelled: 'రైడ్ రద్దు చేయబడింది. ✅',
  rideCompleted: 'ఈ రైడ్ ఇప్పటికే పూర్తయింది మరియు రద్దు చేయలేము.',
  rideAlreadyCancelled: 'ఈ రైడ్ ఇప్పటికే రద్దు చేయబడింది.',
  rideInProgress: '⚠️ మీ రైడ్ ఇప్పటికే ప్రగతిలో ఉంది మరియు రద్దు చేయలేము.',
  cancelFailed: (err: string) => `రద్దు చేయలేకపోయాము: ${err}`,
  cancelled: 'రద్దు చేయబడింది.',
  whatToDo: '\n\nమీరు ఏమి చేయాలనుకుంటున్నారు?',

  // Errors
  somethingWentWrong: 'ఏదో తప్పు జరిగింది. మళ్ళీ ప్రారంభించడానికి "book" పంపండి.',
  sessionExpired: 'సెషన్ గడువు ముగిసింది. మళ్ళీ ప్రామాణీకరించడానికి "book" పంపండి.',
  error: (msg: string) => `లోపం: ${msg}\nమళ్ళీ ప్రారంభించడానికి "cancel" పంపండి.`,
  rideBeingBooked: 'మీ రైడ్ బుక్ అవుతోంది. దయచేసి వేచి ఉండండి లేదా రద్దు చేయడానికి "cancel" పంపండి.',
};
