// Minimal bilingual copy for the UI. The language toggle also drives the
// backend override (--lang / voice language), so the same value flows into the
// API layer. "auto" renders English copy in the UI; the backend detects the
// actually *spoken* language at submit time.

export const LANGS = [
  { value: 'auto', labelEn: 'Auto', labelTa: 'தானாக' },
  { value: 'en', labelEn: 'English', labelTa: 'English' },
  { value: 'ta', labelEn: 'Tamil', labelTa: 'தமிழ்' },
]

const STRINGS = {
  brand: { en: 'Valam AI', ta: 'வாலம் AI' },
  tagline: {
    en: 'Your farmer assistant — speak, snap a photo, get an answer.',
    ta: 'உங்கள் விவசாய உதவியாளர் — பேசுங்கள், புகைப்படம் எடுங்கள், பதில் பெறுங்கள்.',
  },
  whatItDoes: { en: 'What Valam can do', ta: 'வாலம் என்ன செய்யும்' },
  featCrop: { en: 'Suggest the right crop for your soil', ta: 'உங்கள் நிலத்திற்கு சரியான பயிர்' },
  featDisease: { en: 'Detect disease from a leaf photo', ta: 'இலையிலிருந்து நோய் கண்டறிதல்' },
  featPest: { en: 'Spot pests before they spread', ta: 'பூச்சிகளை முன்கூட்டியே கண்டறிதல்' },
  startCheck: { en: 'Start a check', ta: 'ஆய்வு தொடங்கு' },

  newCheck: { en: 'New check', ta: 'புதிய ஆய்வு' },
  back: { en: 'Back', ta: 'பின்' },
  photo: { en: 'Photo', ta: 'புகைப்படம்' },
  voice: { en: 'Voice', ta: 'குரல்' },
  location: { en: 'Location', ta: 'இடம்' },
  language: { en: 'Language', ta: 'மொழி' },
  submit: { en: 'Check my field', ta: 'என் நிலத்தை ஆய்வு செய்' },

  photoHint: { en: 'Leaf or crop photo', ta: 'இலை அல்லது பயிர் புகைப்படம்' },
  photoDrop: { en: 'Drag a photo here, or tap to choose', ta: 'புகைப்படத்தை இங்கே இழுக்கவும், அல்லது தேர்வு செய்யவும்' },
  photoChange: { en: 'Change photo', ta: 'புகைப்படத்தை மாற்று' },
  photoOptional: { en: 'Optional — needed for disease & pest checks', ta: 'விருப்பம் — நோய் & பூச்சி ஆய்வுக்கு தேவை' },

  micStart: { en: 'Record voice', ta: 'குரல் பதிவு செய்' },
  micStop: { en: 'Stop', ta: 'நிறுத்து' },
  micRecording: { en: 'Recording…', ta: 'பதிவாகிறது…' },
  micPlayback: { en: 'Listen', ta: 'கேளுங்கள்' },
  micRetry: { en: 'Record again', ta: 'மீண்டும் பதிவு' },
  micUseThis: { en: 'Keep this recording', ta: 'இந்த பதிவை வைத்துக்கொள்' },
  micUpload: { en: 'Upload an audio file instead', ta: 'ஆடியோ கோப்பை பதிவேற்றவும்' },
  micErr: {
    en: 'Microphone not available. Upload an audio file instead.',
    ta: 'மைக்ரோஃபோன் கிடைக்கவில்லை. ஆடியோ கோப்பை பதிவேற்றவும்.',
  },
  micFallback: { en: 'Uploaded audio file', ta: 'பதிவேற்றிய ஆடியோ' },
  micHint: { en: 'Speak a question — e.g. "what crop for my soil?"', ta: 'கேள்வியைக் கேளுங்கள்'},

  locTypeHere: { en: 'Type your village or district', ta: 'உங்கள் ஊர் அல்லது மாவட்டத்தை எழுதுங்கள்' },
  locManual: { en: 'Type place name', ta: 'இடப் பெயரை எழுதுங்கள்' },
  locGeo: { en: 'Use my location', ta: 'என் இடத்தைப் பயன்படுத்து' },
  locGeoOk: { en: 'Location found', ta: 'இடம் கண்டறியப்பட்டது' },
  locGeoErr: { en: 'Could not get location. Type it instead.', ta: 'இடம் பெற முடியவில்லை. பெயரை எழுதுங்கள்.' },
  locHint: { en: 'Place name is most reliable on any device.', ta: 'இடப் பெயர் எப்போதும் நம்பகமானது.' },

  running: { en: 'Checking your field…', ta: 'உங்கள் நிலத்தை ஆய்வு செய்கிறோம்…' },
  results: { en: 'Your results', ta: 'உங்கள் முடிவுகள்' },
  summaryLabel: { en: 'In short', ta: 'சுருக்கமாக' },
  modelsRan: { en: 'What we checked', ta: 'நாங்கள் ஆய்வு செய்தவை' },
  newCheckAgain: { en: 'Start a new check', ta: 'புதிய ஆய்வு தொடங்கு' },
  playAudio: { en: 'Play voice answer', ta: 'குரல் பதிலைக் கேளுங்கள்' },
  confidenceLabel: { en: 'Confidence', ta: 'நம்பகத்தன்மை' },

  modelCrop: { en: 'Crop recommendation', ta: 'பயிர் பரிந்துரை' },
  modelDisease: { en: 'Disease check', ta: 'நோய் ஆய்வு' },
  modelPest: { en: 'Pest check', ta: 'பூச்சி ஆய்வு' },

  resHigh: { en: 'High', ta: 'அதிகம்' },
  resMedium: { en: 'Medium', ta: 'நடுத்தரம்' },
  resLow: { en: 'Low', ta: 'குறைவு' },

  resDistrict: { en: 'Based on district data', ta: 'மாவட்டத் தரவின் அடிப்படையில்' },
  resState: { en: 'Based on regional (state) data', ta: 'மாநிலத் தரவின் அடிப்படையில்' },
  resFallback: { en: 'Generic averages used', ta: 'பொதுவான சராசரி பயன்படுத்தப்பட்டது' },
  resManual: { en: 'Based on your inputs', ta: 'உங்கள் உள்ளீடுகளின் அடிப்படையில்' },

  noteLow: {
    en: 'Your location was not specific enough, so generic values were used. Please check with a local expert before acting.',
    ta: 'உங்கள் இடம் தெளிவாக இல்லாததால் பொதுவான மதிப்புகள் பயன்படுத்தப்பட்டன. செயல்படும் முன் உள்ளூர் நிபுணரிடம் சரிபார்க்கவும்.',
  },
  cropForYouTa: { en: 'Recommended crop', ta: 'பரிந்துரைக்கப்படும் பயிர்' },
  detectedTa: { en: 'Detected', ta: 'கண்டறியப்பட்டது' },
  sideBySideTa: {
    en: 'Both a crop and a leaf were provided, so we checked both.',
    ta: 'பயிர் மற்றும் இலை இரண்டும் கொடுக்கப்பட்டதால், இரண்டையும் ஆய்வு செய்தோம்.',
  },

  signIn: { en: 'Sign in', ta: 'உள்நுழை' },
  signUp: { en: 'Sign up', ta: 'பதிவு செய்' },
  signOut: { en: 'Sign out', ta: 'வெளியேறு' },
  loginTitle: { en: 'Welcome back', ta: 'மீண்டும் வரவேற்கிறோம்' },
  signupTitle: { en: 'Create your account', ta: 'உங்கள் கணக்கை உருவாக்குங்கள்' },
  authHint: {
    en: 'Sign in is optional — the assistant works without an account.',
    ta: 'உள்நுழைவு விருப்பம் — உதவியாளர் கணக்கு இல்லாமலும் வேலை செய்கிறது.',
  },
  name: { en: 'Your name', ta: 'உங்கள் பெயர்' },
  phone: { en: 'Phone number', ta: 'தொலைபேசி எண்' },
  password: { en: 'Password', ta: 'கடவுச்சொல்' },
  confirmPassword: { en: 'Confirm password', ta: 'கடவுச்சொல்லை உறுதிப்படுத்தவும்' },
  nameRequired: { en: 'Please enter your name.', ta: 'உங்கள் பெயரை உள்ளிடவும்.' },
  phoneRequired: { en: 'Phone number is required.', ta: 'தொலைபேசி எண் தேவை.' },
  phoneInvalid: {
    en: 'Enter a valid 10–15 digit phone number.',
    ta: 'சரியான 10–15 இலக்க தொலைபேசி எண்ணை உள்ளிடவும்.',
  },
  pwdRequired: { en: 'Password is required.', ta: 'கடவுச்சொல் தேவை.' },
  pwdMin: { en: 'At least 6 characters.', ta: 'குறைந்தது 6 எழுத்துகள்.' },
  pwdMismatch: { en: 'Passwords do not match.', ta: 'கடவுச்சொற்கள் பொருந்தவில்லை.' },
  authInvalid: {
    en: 'Incorrect phone number or password.',
    ta: 'தொலைபேசி எண் அல்லது கடவுச்சொல் தவறானது.',
  },
  authGenericError: {
    en: 'Something went wrong. Please try again.',
    ta: 'ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.',
  },
  noAccount: { en: 'No account yet?', ta: 'இன்னும் கணக்கு இல்லையா?' },
  haveAccount: { en: 'Already have an account?', ta: 'ஏற்கனவே கணக்கு உள்ளதா?' },
}

// "auto" resolves to English for rendered UI copy; the backend detects the
// *spoken* language at submit time instead.
export const resolveLang = (lang) => (lang === 'auto' ? 'en' : lang)

export function t(key, lang) {
  const resolved = resolveLang(lang)
  const row = STRINGS[key]
  if (!row) return key
  return row[resolved] ?? row.en ?? key
}