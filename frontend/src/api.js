// ---------------------------------------------------------------------------
// Single swap point between MOCK and real backend responses.
//
// To go live after backend Part 2 (branching + TTS output) is finished:
//   1. flip USE_MOCK to false
//   2. make sure the backend is running and CORS covers your frontend origin
// The normalized shape below (NormalizedResult) is what the UI renders.
// ---------------------------------------------------------------------------

// The backend is a PURE API server, running separately from this frontend
// (sibling repos under the same parent). Configure its address here:
//   - set VITE_API_BASE_URL in frontend/.env (or frontend/.env.local) for the
//     environment you run in (e.g. http://localhost:8000 locally), or
//   - export it on the CLI:  VITE_API_BASE_URL=https://api.example.com npm run build
// The hardcoded default matches the local dev backend so a fresh clone runs
// zero-config.
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

// Set to false to hit the live backend instead of the bundled demo mocks.
export const USE_MOCK = false

// Backend fields we forward for crop recommendations (kept in sync with
// app/schemas/prediction.py: CropOutput).
const CROP_FIELDS = [
  'predicted_crop',
  'confidence',
  'confidence_label',
  'soil_source',
  'weather_source',
  'location',
  'warning',
  'data_resolution',
  'input_confidence',
  'data_quality_note',
]

export const toLabelForLang = (label, lang) => {
  const map = {
    high: lang === 'ta' ? 'அதிகம்' : 'High',
    medium: lang === 'ta' ? 'நடுத்தரம்' : 'Medium',
    low: lang === 'ta' ? 'குறைவு' : 'Low',
  }
  return map[label] || label
}

// ---------------------------------------------------------------------------
// MOCK ----------------------------------------------------------------------
// Deterministic demo data that mirrors the real response shapes.
// ---------------------------------------------------------------------------

function mockCrop(location, lang) {
  const none = !location?.text && location?.lat == null
  if (none) {
    return {
      model: 'crop',
      modelKey: 'modelCrop',
      predicted_class: lang === 'ta' ? 'நெல் (அரிசி)' : 'Rice',
      confidence: 0.81,
      confidence_label: lang === 'ta' ? 'நடுத்தரம்' : 'Medium',
      data_resolution: 'fallback',
      input_confidence: 'low',
      data_quality_note:
        lang === 'ta'
          ? 'உங்கள் இடம் கொடுக்கப்படாததால் பொதுவான மதிப்புகள் பயன்படுத்தப்பட்டன. செயல்படும் முன் உள்ளூர் நிபுணரிடம் சரிபார்க்கவும்.'
          : 'No location was provided, so generic values were used. Please check with a local expert before acting.',
      soil_source: 'training_data_median',
    }
  }
  const gps = location?.lat != null && location?.lon != null
  if (gps) {
    return {
      model: 'crop',
      modelKey: 'modelCrop',
      predicted_class: lang === 'ta' ? 'நெல் (அரிசி)' : 'Rice',
      confidence: 0.93,
      confidence_label: lang === 'ta' ? 'அதிகம்' : 'High',
      data_resolution: 'district',
      input_confidence: 'high',
      data_quality_note: null,
      soil_source: 'district_soil_index',
      location: (location.text || 'your field') + ' (GPS)',
    }
  }
  return {
    model: 'crop',
    modelKey: 'modelCrop',
    predicted_class: lang === 'ta' ? 'நெல் (அரிசி)' : 'Rice',
    confidence: 0.89,
    confidence_label: lang === 'ta' ? 'நடுத்தரம்' : 'Medium',
    data_resolution: 'state',
    input_confidence: 'medium',
    data_quality_note: null,
    soil_source: 'state_soil_index',
    location: location.text || 'your area',
  }
}

function mockDisease(lang) {
  return {
    model: 'disease',
    modelKey: 'modelDisease',
    predicted_class: lang === 'ta' ? 'துரு நோய் (Leaf Rust)' : 'Leaf Rust',
    confidence: 0.87,
    confidence_label: lang === 'ta' ? 'அதிகம்' : 'High',
  }
}

function mockPest(lang) {
  return {
    model: 'pest',
    modelKey: 'modelPest',
    predicted_class: lang === 'ta' ? 'அசுவிணி (Aphids)' : 'Aphids',
    confidence: 0.84,
    confidence_label: lang === 'ta' ? 'நடுத்தரம்' : 'Medium',
  }
}

function mockResult(input) {
  const { image, location, lang } = input
  const hasImage = Boolean(image)
  const hasLoc = Boolean(location?.text || location?.lat != null)
  const models = []

  if (hasImage && hasLoc) models.push(mockCrop(location, lang), mockDisease(lang))
  else if (hasImage) models.push(mockDisease(lang))
  else if (hasLoc) models.push(mockCrop(location, lang))
  else models.push(mockCrop(location, lang))

  const crop = models.find((m) => m.model === 'crop')
  const disease = models.find((m) => m.model === 'disease')

  let summary
  if (disease && crop) {
    summary =
      lang === 'ta'
        ? `உங்கள் பயிர் ${crop.predicted_class}. உங்கள் இலையில் ${disease.predicted_class} (${Math.round(disease.confidence * 100)}%) கண்டறியப்பட்டது.`
        : `Your field looks like ${crop.predicted_class}. The leaf shows ${disease.predicted_class} (${Math.round(disease.confidence * 100)}%).`
  } else if (disease) {
    summary =
      lang === 'ta'
        ? `உங்கள் இலையில் ${disease.predicted_class} (${Math.round(disease.confidence * 100)}%) கண்டறியப்பட்டது.`
        : `The leaf shows ${disease.predicted_class} (${Math.round(disease.confidence * 100)}%).`
  } else {
    summary =
      lang === 'ta'
        ? `உங்கள் நிலத்திற்கு ${crop.predicted_class} பயிர் பொருத்தமானது (${Math.round(crop.confidence * 100)}%).`
        : `A good fit for your field is ${crop.predicted_class} (${Math.round(crop.confidence * 100)}%).`
  }

  return {
    ok: true,
    summary,
    models_ran: models,
    audio: null, // TTS playback arrives once backend Part 2 ships
  }
}

// ---------------------------------------------------------------------------
// REAL ----------------------------------------------------------------------
// Multipart call to the unified voice pipeline. Backend Part 2 still pending,
// so this is best-effort and intentionally mirrors the target contract:
//   POST /voice/query  (audio file, optional image, latitude, longitude)
// ---------------------------------------------------------------------------

async function realSubmitCheck(input) {
  const token = localStorage.getItem('valam_token')
  const fd = new FormData()
  if (input.audio) fd.append('audio', input.audio, input.audio.name || 'voice.webm')
  if (input.image) fd.append('image', input.image, input.image.name || 'leaf.jpg')
  if (input.location?.lat != null) fd.append('latitude', String(input.location.lat))
  if (input.location?.lon != null) fd.append('longitude', String(input.location.lon))

  const res = await fetch(`${API_BASE}/voice/query`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Backend error ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()

  // data is expected to look like: { text_response, tamil_audio_path,
  // results: [{ model, predicted_class, confidence, ...CROP_FIELDS }] }
  const models = Array.isArray(data.results)
    ? data.results.map((r) => ({ model: r.model, ...r }))
    : []
  if (!models.length) {
    throw new Error('Backend response did not include per-model results.')
  }
  return {
    ok: true,
    summary: data.text_response || data.response || '',
    models_ran: models,
    audio: data.audio_url || data.tamil_audio_path ? { url: data.audio_url || data.tamil_audio_path } : null,
  }
}

// ---------------------------------------------------------------------------

export async function submitCheck(input) {
  await new Promise((r) => setTimeout(r, 900)) // realistic spinner for demo/mock
  if (!USE_MOCK) return realSubmitCheck(input)
  return mockResult(input)
}

// Crop model source-of-truth key list (exported for the crop card to never
// invent fields the backend does not send).
export { CROP_FIELDS }