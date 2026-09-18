// ---------------------------------------------------------------------------
// API layer — identical contract to the previous frontend:
//   POST /api/v1/auth/signup   (JSON)            -> FarmerOut
//   POST /api/v1/auth/login    (form-urlencoded) -> {access_token, refresh_token}
//   POST /api/v1/auth/refresh  (JSON)            -> fresh token pair
//   GET  /api/v1/auth/me       (Bearer)          -> FarmerOut
//   POST /api/v1/voice/query   (multipart)       -> UnifiedVoiceResponse
// The voice pipeline stays anonymous-capable: the Bearer token is attached
// only when a session exists (same as before).
// ---------------------------------------------------------------------------

import { API_V1, MAX_IMAGE_MB, MAX_AUDIO_MB } from './config.js';
import { store } from './store.js';
import { t } from './i18n.js';

const normalizePhone = (raw) => String(raw || '').replace(/[\s-]/g, '');

class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function parseJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text.slice(0, 300) };
  }
}

export async function authFetch(path, { headers = {}, ...options } = {}) {
  let res;
  try {
    res = await fetch(`${API_V1}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(t('errNetwork', store.state.lang), 0, 'network');
  }
  const data = await parseJson(res);
  if (!res.ok) {
    throw buildError(res.status, data);
  }
  return data;
}

function buildError(status, data) {
  const detail = data?.detail;
  let message;
  if (typeof detail === 'string') message = detail;
  else if (Array.isArray(detail)) message = detail.map((d) => d.msg || `${d.field}: ${d.message}`).join('; ');
  else message = `Backend error ${status}`;
  const err = new ApiError(message, status, data);
  // 429 exceptional: the backend's message stays, but give it a friendlier wrapper.
  if (status === 429) err.message = t('errTooFast', store.state.lang);
  return err;
}

// ---- optional auth: refresh once on 401, then retry once ----
let refreshing = null;

function refreshTokens() {
  if (!refreshing) {
    refreshing = (async () => {
      const res = await authFetch('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: store.state.refreshToken }),
      });
      store.signIn(res.access_token, store.state.user, res.refresh_token);
      return res.access_token;
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function authSignup({ name, phone_number, password }) {
  return authFetch('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone_number: normalizePhone(phone_number), password }),
  });
}

export async function authLogin({ phone_number, password }) {
  // Backend uses OAuth2PasswordRequestForm: the "username" field carries the
  // phone number (same as Swagger's Authorize button).
  return authFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: normalizePhone(phone_number), password }),
  });
}

export async function authMe(token) {
  return authFetch('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
}

// Unified voice query. Mirrors the prior multipart call exactly (audio, image,
// latitude, longitude) and additionally forwards `lang` — the endpoint's own
// documented optional field — when the user picked a language explicitly.
// Returns the normalized shape the UI renders: { summary, models_ran, audio }.
export async function submitCheck(input) {
  const fd = () => {
    const f = new FormData();
    if (input.audio) f.append('audio', input.audio, input.audio.name || 'voice.webm');
    if (input.image) f.append('image', input.image, input.image.name || 'leaf.jpg');
    if (input.location?.lat != null) f.append('latitude', String(input.location.lat));
    if (input.location?.lon != null) f.append('longitude', String(input.location.lon));
    if (input.lang === 'ta' || input.lang === 'en') f.append('lang', input.lang);
    return f;
  };

  const execute = async (accessToken) => {
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
    const res = await fetch(`${API_V1}/voice/query`, { method: 'POST', headers, body: fd() });
    const data = await parseJson(res);
    if (!res.ok) throw buildError(res.status, data);
    return data;
  };

  const token = store.state.token;
  let data;
  try {
    data = await execute(token);
  } catch (err) {
    // Expired access token: silently refresh once and retry with the fresh one.
    if (err.status === 401 && token && store.state.refreshToken) {
      try {
        const fresh = await refreshTokens();
        data = await execute(fresh);
      } catch (e2) {
        if (e2.status === 401) store.signOut();
        throw e2;
      }
    } else {
      throw err;
    }
  }

  const models = Array.isArray(data.results)
    ? data.results.map((r) => ({ model: r.model, ...r }))
    : [];
  if (!models.length) {
    throw new ApiError(t('emptyResults', store.state.lang), 200, data);
  }

  const audio = data.audio_url || data.audio_response_path
    ? { url: data.audio_url || data.audio_response_path }
    : null;
  // If the backend ever returns a relative path, make it playable.
  if (audio && audio.url.startsWith('/')) {
    audio.url = new URL(audio.url, API_V1).href;
  }

  return {
    ok: true,
    summary: data.text_response || data.response || '',
    models_ran: models,
    audio,
    intent: data.intent,
    transcribed: data.transcribed_text,
    detected_language: data.detected_language,
  };
}

// ---- client-side file pre-checks (mirror backend limits so users aren't
// surprised by a bare 413/415 after a slow upload) ----
export function checkImageFile(file) {
  if (!file) return null;
  if (!file.type.startsWith('image/')) return t('errImage', store.state.lang);
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return t('fileTooBig', store.state.lang);
  return null;
}

export function checkAudioFile(file) {
  if (!file) return null;
  if (!file.type.startsWith('audio/')) return t('errAudio', store.state.lang);
  if (file.size > MAX_AUDIO_MB * 1024 * 1024) return t('fileTooBig', store.state.lang);
  return null;
}

export { ApiError };