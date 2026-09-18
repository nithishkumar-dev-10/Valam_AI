// ---------------------------------------------------------------------------
// API base configuration.
// The backend runs separately from this frontend (sibling ../backend service).
// Default matches local dev. To point at a deployed API, define a global
// BEFORE this module loads, e.g. in index.html:
//   <script>window.VALAM_API_BASE = 'https://api.valam.in'</script>
// (No Vite/.env here — this frontend is dependency-free plain JS.)
// ---------------------------------------------------------------------------

export const API_BASE = window.VALAM_API_BASE || 'http://localhost:8000';
export const API_V1 = `${API_BASE}/api/v1`;

// Client-side mirror of the backend's upload caps (app/validation.py) so users
// get instant, in-language feedback instead of a bare 413.
export const MAX_IMAGE_MB = 15; // MAX_IMAGE_UPLOAD_MB
export const MAX_AUDIO_MB = 15; // MAX_AUDIO_UPLOAD_MB
export const MAX_IMAGE_PIXELS = 16_000_000; // same decompression-bomb guard