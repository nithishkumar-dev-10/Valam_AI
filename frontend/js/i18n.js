// ---------------------------------------------------------------------------
// Bilingual copy (English / Tamil) + a tiny lookup helper.
// "auto" resolves to English UI copy; the backend detects the actually spoken
// language at submit time when lang is left absent.
// ---------------------------------------------------------------------------

export const LANGS = [
  { value: 'auto', labelEn: 'Auto', labelTa: 'தானாக' },
  { value: 'en', labelEn: 'English', labelTa: 'English' },
  { value: 'ta', labelEn: 'தமிழ்', labelTa: 'தமிழ்' },
];

export const resolveLang = (lang) => (lang === 'auto' || !lang) ? 'en' : lang;

const STRINGS = {
  // ----- brand / home -----
  tagline: {
    en: 'Ask about your crop, speak in Tamil or English — get an answer with voice.',
    ta: 'உங்கள் பயிர் பற்றி கேளுங்கள் — தமிழ் அல்லது ஆங்கிலத்தில் பேசுங்கள், குரல் பதிலை பெறுங்கள்.',
  },
  langPair: { en: 'தமிழ் · English', ta: 'English · தமிழ்' },
  micCta: { en: 'Ask by voice', ta: 'குரலால் கேளுங்கள்' },
  micSub: { en: 'Tap the mic and speak. No typing needed.', ta: 'மைக்ரோஃபோனை தட்டி பேசுங்கள். எழுத தேவையில்லை.' },
  quickTitle: { en: 'Or start with…', ta: 'அல்லது இதில் தொடங்குங்கள்…' },
  qsCam: { en: 'A field photo', ta: 'புகைப்படம்' },
  qsCamSub: { en: 'Check leaf disease & pests', ta: 'நோய் & பூச்சி ஆய்வு' },
  qsLoc: { en: 'My location', ta: 'என் இடம்' },
  qsLocSub: { en: 'Best crop for my field', ta: 'சிறந்த பயிர் ஆலோசனை' },
  featTitle: { en: 'What Valam can do', ta: 'வாலம் என்ன செய்யும்' },
  featCrop: { en: 'Crop recommendation', ta: 'பயிர் பரிந்துரை' },
  featDisease: { en: 'Disease detection', ta: 'நோய் கண்டறிதல்' },
  featPest: { en: 'Pest detection', ta: 'பூச்சி கண்டறிதல்' },
  homeStartVoice: { en: 'Ask by voice', ta: 'குரலால் கேளுங்கள்' },

  // ----- check screen -----
  newCheck: { en: 'Ask Valam', ta: 'வாலமிடம் கேளுங்கள்' },
  newCheckSub: {
    en: 'Speak, add a photo, or share your location — Valam checks what you give it.',
    ta: 'பேசுங்கள், புகைப்படம் சேர்க்கவும், அல்லது இடத்தை பகிரவும் — வாலம் ஆய்வு செய்யும்.',
  },
  back: { en: 'Back', ta: 'பின்' },

  voiceTitle: { en: '1 · Say your question', ta: '1 · உங்கள் கேள்வியை சொல்லுங்கள்' },
  voiceSub: { en: 'Or upload a voice note', ta: 'அல்லது குரல் கோப்பை பதிவேற்றவும்' },
  micStart: { en: 'Tap to speak', ta: 'பேச தட்டவும்' },
  micStop: { en: 'Stop', ta: 'நிறுத்து' },
  micListening: { en: 'Listening… speak now', ta: 'கேட்கிறது… இப்போது பேசுங்கள்' },
  micKeep: { en: 'Use this', ta: 'இதை பயன்படுத்து' },
  micRetry: { en: 'Record again', ta: 'மீண்டும் பதிவு' },
  micListen: { en: 'Listen', ta: 'கேளுங்கள்' },
  micUpload: { en: 'Upload audio', ta: 'ஆடியோ பதிவேற்று' },
  micRemove: { en: 'Remove', ta: 'நீக்கு' },
  micHint: {
    en: 'Try: “Which crop is best for my field?” or “My leaves have spots.”',
    ta: 'எடுத்துக்காட்டு: “என் நிலத்திற்கு எந்த பயிர் சிறந்தது?” அல்லது “என் இலைகளில் புள்ளிகள் உள்ளன.”',
  },
  audioFile: { en: 'Audio file', ta: 'ஆடியோ கோப்பு' },

  photoTitle: { en: '2 · Add a photo', ta: '2 · புகைப்படம் சேர்க்க' },
  photoSub: { en: 'For disease & pest checks', ta: 'நோய் & பூச்சி ஆய்வுக்கு' },
  photoDrop: { en: 'Tap to add a photo', ta: 'புகைப்படம் சேர்க்க தட்டவும்' },
  photoDrag: { en: 'or drag one here', ta: 'அல்லது இழுத்து விடவும்' },
  photoChange: { en: 'Change', ta: 'மாற்று' },
  photoRemove: { en: 'Remove', ta: 'நீக்கு' },
  photoOptional: { en: 'Optional', ta: 'விருப்பம்' },
  photoGuideTitle: { en: 'A good photo is', ta: 'நல்ல புகைப்படம் என்றால்' },
  photoGuide1: { en: 'Clear close-up of the affected leaf', ta: 'பாதிக்கப்பட்ட இலையின் தெளிவான நெருக்கமான படம்' },
  photoGuide2: { en: 'Good light — not dark or blurry', ta: 'நல்ல வெளிச்சம் — இருட்டோ மங்கலோ வேண்டாம்' },
  photoGuide3: { en: 'Leaf fills most of the frame', ta: 'இலை படத்தை நிரப்பும் அளவு' },

  locTitle: { en: '3 · Add your location', ta: '3 · உங்கள் இடம்' },
  locSub: { en: 'Helps recommend the best crop', ta: 'சிறந்த பயிரை பரிந்துரைக்க உதவும்' },
  locPlaceholder: { en: 'Village or district name (optional)', ta: 'ஊர் அல்லது மாவட்டப் பெயர் (விருப்பம்)' },
  locGps: { en: 'Use current location', ta: 'தற்போதைய இடத்தை பயன்படுத்து' },
  locLocating: { en: 'Finding your location…', ta: 'இடத்தை கண்டறிகிறது…' },
  locFound: { en: 'Location added', ta: 'இடம் சேர்க்கப்பட்டது' },
  locCant: { en: 'Could not get location — retry or skip.', ta: 'இடம் கிடைக்கவில்லை — மீண்டும் முயற்சிக்கவும் அல்லது தவிர்க்கவும்.' },
  locHint: {
    en: 'GPS gives the most accurate advice. Typing a name is saved for your reference.',
    ta: 'GPS ஆலோசனை மிகவும் துல்லியமானது. பெயரை எழுதினால் அது உங்கள் குறிப்புக்கு மட்டுமே.',
  },

  langNote: { en: 'Answer language', ta: 'பதில் மொழி' },
  langNoteSub: {
    en: 'Choose Auto to let Valam match the language you speak.',
    ta: 'நீங்கள் பேசும் மொழிக்கு ஏற்ப வாலம் பதிலளிக்க Auto தேர்வு செய்யுங்கள்.',
  },

  submit: { en: 'Get my answer', ta: 'என் பதிலை பெறு' },
  submitHint: { en: 'Add a voice note, photo, or location to start.', ta: 'தொடங்க குரல், புகைப்படம், அல்லது இடம் சேர்க்கவும்.' },
  submitReady: { en: 'Ready — get your answer', ta: 'தயார் — பதில் பெறவும்' },

  // ----- processing -----
  processingTitle: { en: 'Checking your field…', ta: 'உங்கள் நிலத்தை ஆய்வு செய்கிறோம்…' },
  processingState: { en: 'Valam is looking at what you shared. This takes a few seconds.', ta: 'வாலம் உங்கள் தகவலை ஆராய்கிறது. சில நொடிகள் ஆகும்.' },
  stepListen: { en: 'Listening to your voice…', ta: 'உங்கள் குரல் கேட்கிறது…' },
  stepRead: { en: 'Reading your photo…', ta: 'உங்கள் புகைப்படம் படிக்கிறது…' },
  stepCrop: { en: 'Checking climate & soil…', ta: 'காலநிலை & மண் ஆராய்கிறது…' },
  stepAnswer: { en: 'Preparing your answer…', ta: 'உங்கள் பதிலை தயாரிக்கிறது…' },
  stepDone: { en: 'Almost done…', ta: 'முடிந்துவிட்டது…' },
  procNote: { en: 'Keep this page open', ta: 'இந்தப் பக்கத்தை திறந்து வையுங்கள்' },

  // ----- results -----
  results: { en: 'Here is your answer', ta: 'இதோ உங்கள் பதில்' },
  listenLabel: { en: 'Listen in Tamil', ta: 'கேளுங்கள்' },
  playingLabel: { en: 'Playing…', ta: 'ஒலிக்கிறது…' },
  whatChecked: { en: 'What we checked', ta: 'நாங்கள் ஆய்வு செய்தவை' },
  confidence: { en: 'Confidence', ta: 'நம்பகத்தன்மை' },
  modelCrop: { en: 'Crop recommendation', ta: 'பயிர் பரிந்துரை' },
  modelDisease: { en: 'Disease check', ta: 'நோய் ஆய்வு' },
  modelPest: { en: 'Pest check', ta: 'பூச்சி ஆய்வு' },
  resHigh: { en: 'High', ta: 'அதிகம்' },
  resMedium: { en: 'Medium', ta: 'நடுத்தரம்' },
  resLow: { en: 'Low', ta: 'குறைவு' },
  resDistrict: { en: 'District data', ta: 'மாவட்டத் தரவு' },
  resState: { en: 'State data', ta: 'மாநிலத் தரவு' },
  resFallback: { en: 'Generic averages', ta: 'பொது சராசரி' },
  resManual: { en: 'Your inputs', ta: 'உங்கள் உள்ளீடுகள்' },
  resInputConf: { en: 'Soil estimate', ta: 'மண் மதிப்பீடு' },
  resWarning: { en: 'Note', ta: 'குறிப்பு' },
  audioUnavailable: { en: 'Voice answer unavailable', ta: 'குரல் பதில் இல்லை' },
  newCheckBtn: { en: 'Ask again', ta: 'மீண்டும் கேளுங்கள்' },
  emptyResults: { en: 'No answers came back. Please try again.', ta: 'பதில் வரவில்லை. மீண்டும் முயற்சிக்கவும்.' },
  retry: { en: 'Try again', ta: 'மீண்டும் முயற்சி' },

  // ----- auth -----
  signIn: { en: 'Sign in', ta: 'உள்நுழை' },
  signUp: { en: 'Create account', ta: 'கணக்கு உருவாக்கு' },
  signOut: { en: 'Sign out', ta: 'வெளியேறு' },
  loginTitle: { en: 'Welcome back', ta: 'மீண்டும் வரவேற்கிறோம்' },
  signupTitle: { en: 'Create your account', ta: 'உங்கள் கணக்கை உருவாக்குங்கள்' },
  authOpt: { en: 'Optional — the assistant works without an account.', ta: 'விருப்பம் — கணக்கு இல்லாமலும் உதவியாளர் வேலை செய்கிறது.' },
  name: { en: 'Your name', ta: 'உங்கள் பெயர்' },
  phone: { en: 'Phone number', ta: 'தொலைபேசி எண்' },
  password: { en: 'Password', ta: 'கடவுச்சொல்' },
  confirmPassword: { en: 'Confirm password', ta: 'கடவுச்சொல்லை உறுதிப்படுத்தவும்' },
  nameRequired: { en: 'Please enter your name.', ta: 'உங்கள் பெயரை உள்ளிடவும்.' },
  phoneRequired: { en: 'Phone number is required.', ta: 'தொலைபேசி எண் தேவை.' },
  phoneInvalid: { en: 'Enter a valid 10–15 digit phone number.', ta: 'சரியான 10–15 இலக்க தொலைபேசி எண்ணை உள்ளிடவும்.' },
  pwdRequired: { en: 'Password is required.', ta: 'கடவுச்சொல் தேவை.' },
  pwdMin: { en: 'At least 6 characters.', ta: 'குறைந்தது 6 எழுத்துகள்.' },
  pwdMismatch: { en: 'Passwords do not match.', ta: 'கடவுச்சொற்கள் பொருந்தவில்லை.' },
  authInvalid: { en: 'Incorrect phone number or password.', ta: 'தொலைபேசி எண் அல்லது கடவுச்சொல் தவறானது.' },
  noAccount: { en: 'No account yet?', ta: 'இன்னும் கணக்கு இல்லையா?' },
  haveAccount: { en: 'Already have an account?', ta: 'ஏற்கனவே கணக்கு உள்ளதா?' },
  accountExists: { en: 'That phone number already has an account. Sign in instead.', ta: 'இந்த எண்ணில் ஏற்கனவே கணக்கு உள்ளது. உள்நுழையுங்கள்.' },

  // ----- errors -----
  errNetwork: {
    en: 'Could not reach Valam. Check your connection and try again.',
    ta: 'வாலத்தை அடைய முடியவில்லை. இணைப்பை சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',
  },
  errGeneric: { en: 'Something went wrong. Please try again.', ta: 'ஏதோ தவறு. மீண்டும் முயற்சிக்கவும்.' },
  errTooFast: {
    en: 'A little fast there — please wait about a minute and try again.',
    ta: 'கொஞ்சம் வேகமாக உள்ளது — ஒரு நிமிடம் காத்திருந்து மீண்டும் முயற்சிக்கவும்.',
  },
  errImage: { en: 'That photo looks damaged. Try another one.', ta: 'புகைப்படம் சரியாக இல்லை. மற்றொன்றை முயற்சிக்கவும்.' },
  errAudio: { en: 'That audio file could not be read. Try another.', ta: 'ஆடியோ படிக்க முடியவில்லை. மற்றொன்றை முயற்சிக்கவும்.' },
  fileTooBig: { en: 'File is too large (max 15 MB).', ta: 'கோப்பு மிகப்பெரியது (அதிகபட்சம் 15 MB).' },
  imageTooManyPixels: {
    en: 'Photo is too detailed. Use a smaller image and try again.',
    ta: 'புகைப்படம் மிக விரிவாக உள்ளது. சிறிய படத்தை பயன்படுத்தவும்.',
  },
  usedPhotoDiagnosed: { en: 'Photo added', ta: 'புகைப்படம் சேர்க்கப்பட்டது' },
  micUnavailable: {
    en: 'Microphone not available on this device. You can upload an audio file instead.',
    ta: 'இந்த சாதனத்தில் மைக்ரோஃபோன் இல்லை. ஆடியோ கோப்பை பதிவேற்றலாம்.',
  },
};

export function t(key, lang) {
  const resolved = resolveLang(lang);
  const row = STRINGS[key];
  if (!row) return key;
  return row[resolved] ?? row.en ?? key;
}